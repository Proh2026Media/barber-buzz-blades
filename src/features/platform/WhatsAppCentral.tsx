import { useDemo } from "@/features/demo/context";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Loader2, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { Notice, Hint, ChoiceChips } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PlatformWhatsAppCard } from "./PlatformWhatsAppCard";
import {
  WhatsAppNumberReserve,
  numberName,
  type NumberConfiguration,
} from "./WhatsAppNumberReserve";

type Channel = Tables<"whatsapp_channels">;
type Directory = {
  number_reserves?: boolean;
  configuration_history?: {
    id: string;
    channel_id: string;
    before_config: { backup: string | null; mode: string };
    after_config: { backup: string | null; mode: string };
    created_at: string;
  }[];
  channels: Channel[];
  shops: { id: string; name: string }[];
  staff: { id: string; shop_id: string; name: string }[];
  history: {
    id: string;
    channel_id: string;
    old_shop_id: string | null;
    new_shop_id: string | null;
    old_staff_id: string | null;
    new_staff_id: string | null;
    created_at: string;
  }[];
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";
const errors: Record<string, MessageKey> = {
  WA_BACKUP_UNAVAILABLE: "waNumbers.unavailable",
  WA_NUMBER_RESERVED: "waNumbers.reservedError",
  WA_TECHNICAL_REQUIRED: "waNumbers.technicalRequired",
  WA_STALE: "waCentral.stale",
  WA_TARGET_OCCUPIED: "waCentral.occupied",
  WA_TARGET_INVALID: "waCentral.invalidTarget",
  WA_RESERVE_ASSIGNED: "waCentral.reserveFirst",
  WA_DELIVERY_BUSY: "waCentral.deliveryBusy",
  WA_LABEL_INVALID: "waCentral.labelInvalid",
};

export function WhatsAppCentral({ demo: demoProp = false }: { demo?: boolean }) {
  const demoContext = useDemo();
  const demo = demoProp || Boolean(demoContext);
  const { t, locale } = useI18n();
  const [data, setData] = useState<Directory | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "assigned" | "backup">("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const detail = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const live = useRef(true);
  const createId = useRef<string | null>(null);
  async function load() {
    const { data: result, error: failed } = await supabase.rpc("platform_whatsapp_directory");
    if (!live.current) return;
    if (failed) throw failed;
    setData(result as unknown as Directory);
    setSelected((current) => current ?? new URLSearchParams(window.location.search).get("numero"));
  }
  useEffect(() => {
    live.current = true;
    if (!demo) void run(load);
    return () => {
      live.current = false;
    };
    // A tela é remontada quando muda a sessão/área.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  async function run(work: () => Promise<void>) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await work();
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "";
      if (live.current)
        setError(
          Object.entries(errors).find(([key]) => message.includes(key))?.[1] ?? "waCentral.error",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const channel = data?.channels.find((c) => c.id === selected);
  const selectedNumberId = channel?.id;
  useEffect(() => {
    if (!selectedNumberId || !window.matchMedia("(max-width: 1023px)").matches) return;
    const frame = requestAnimationFrame(() =>
      detail.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selectedNumberId]);
  const reservedBy = data?.channels.find((c) => c.backup_instance_name === channel?.instance_name);
  function configure(number: Channel, configuration: NumberConfiguration) {
    void run(async () => {
      const { error: failed } = await supabase.rpc("platform_configure_whatsapp_number", {
        p_id: number.id,
        p_version: number.routing_version,
        p_backup_id: configuration.backupId,
        p_mode: configuration.mode,
        p_technical: configuration.technical,
        p_return_enabled: configuration.returns,
        p_keep_legacy: configuration.keepLegacy,
      });
      if (failed) throw failed;
      await load();
      if (live.current) setSaved(true);
    });
  }
  const destination = (shop: string | null, staff: string | null) => {
    if (!shop) return t("waCentral.unassigned");
    return [
      data?.shops.find((s) => s.id === shop)?.name ?? t("waCentral.inactiveShop"),
      staff
        ? (data?.staff.find((s) => s.id === staff)?.name ?? t("waCentral.inactiveStaff"))
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const filtered =
    data?.channels.filter(
      (c) =>
        (filter === "all" ||
          (filter === "backup"
            ? data.channels.some((n) => n.backup_instance_name === c.instance_name)
            : filter === "assigned"
              ? Boolean(c.barbershop_id)
              : !c.barbershop_id &&
                !data.channels.some((n) => n.backup_instance_name === c.instance_name))) &&
        `${c.label} ${c.display_phone ?? ""} ${destination((data.channels.find((owner) => owner.backup_instance_name === c.instance_name) ?? c).barbershop_id, (data.channels.find((owner) => owner.backup_instance_name === c.instance_name) ?? c).staff_id)}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
    ) ?? [];
  return (
    <section className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t("waCentral.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("waCentral.subtitle")}</p>
        </div>
        <button className="action-button" disabled={busy || demo} onClick={() => void run(load)}>
          <RefreshCw className="size-4" aria-hidden />
          {t("waCentral.refresh")}
        </button>
      </div>
      {demo ? (
        <Notice tone="info" title={t("waPair.demo")} />
      ) : (
        <>
          <details className="rounded-2xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold">{t("waCentral.platform")}</summary>
            <div className="mt-4">
              <PlatformWhatsAppCard />
            </div>
          </details>
          <Notice tone="info" title={t("waNumbers.intro")} />
          {error && <Notice tone="danger" title={t(error)} />}
          {saved && <Notice tone="success" title={t("waCentral.saved")} />}
          <details
            className="rounded-2xl border border-border bg-card p-4"
            open={adding}
            onToggle={(event) => setAdding(event.currentTarget.open)}
          >
            <summary className="cursor-pointer font-semibold">{t("waNumbers.addAnother")}</summary>
            <form
              className="flex flex-wrap items-end gap-3 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  createId.current ??= crypto.randomUUID();
                  const { data: id, error: failed } = await supabase.rpc(
                    "platform_create_whatsapp_channel",
                    { p_id: createId.current, p_label: label.trim() },
                  );
                  if (failed) throw failed;
                  if (!live.current) return;
                  createId.current = null;
                  setLabel("");
                  setAdding(false);
                  setFilter("all");
                  setQuery("");
                  setSelected(id);
                  await load();
                });
              }}
            >
              <label className="grid min-w-0 flex-1 basis-60 gap-1 font-semibold text-sm">
                {t("waCentral.label")}
                <input
                  className={field}
                  value={label}
                  maxLength={80}
                  minLength={2}
                  required
                  disabled={busy || !data}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <button
                className="action-button action-confirm"
                disabled={busy || !data || label.trim().length < 2}
              >
                <Plus className="size-4" aria-hidden />
                {t("waCentral.add")}
              </button>
            </form>
          </details>
          {busy && !data && (
            <p role="status" className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("shop.loading")}
            </p>
          )}
          {data && (
            <div className="grid items-start gap-5 pc:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
              <div className="min-w-0 space-y-3">
                <h3 className="font-bold">{t("waNumbers.existing")}</h3>
                <ChoiceChips<"all" | "available" | "assigned" | "backup">
                  label={t("waNumbers.filter")}
                  hideLabel
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: t("waNumbers.all") },
                    { value: "available", label: t("waNumbers.available") },
                    { value: "assigned", label: t("waNumbers.assigned") },
                    { value: "backup", label: t("waNumbers.reserves") },
                  ]}
                />
                <label className="grid gap-1 text-sm font-semibold">
                  {t("waCentral.search")}
                  <input
                    className={field}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="grid gap-2 tablet:grid-cols-2 pc:grid-cols-1">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={selected === c.id}
                      onClick={() => {
                        setSelected(c.id);
                        setSaved(false);
                        setError(null);
                      }}
                      className={`min-w-0 rounded-2xl border p-4 text-left ${selected === c.id ? "border-primary bg-accent" : "border-border bg-card"}`}
                    >
                      <span className="block break-words font-bold">
                        {c.label || c.display_phone || t("waCentral.channel")}
                      </span>
                      <span className="mt-1 block break-words text-sm">
                        {destination(
                          (
                            data.channels.find(
                              (owner) => owner.backup_instance_name === c.instance_name,
                            ) ?? c
                          ).barbershop_id,
                          (
                            data.channels.find(
                              (owner) => owner.backup_instance_name === c.instance_name,
                            ) ?? c
                          ).staff_id,
                        )}
                      </span>
                      {c.display_phone && (
                        <span className="block text-sm text-muted-foreground">
                          {c.display_phone}
                        </span>
                      )}
                      <span className="mt-2 block text-xs font-semibold">
                        {data.channels.some(
                          (owner) => owner.backup_instance_name === c.instance_name,
                        )
                          ? t("waNumbers.backup")
                          : c.barbershop_id
                            ? t("waNumbers.primary")
                            : t("waCentral.unassigned")}
                        {c.barbershop_id && (
                          <>
                            {" "}
                            ·{" "}
                            {t(
                              c.delivery_mode === "paused" || !c.enabled
                                ? "waCentral.disabled"
                                : c.delivery_mode === "backup"
                                  ? "waNumbers.backupInUse"
                                  : "waCentral.enabled",
                            )}
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                {!filtered.length && <Hint>{t("waCentral.empty")}</Hint>}
              </div>
              <div ref={detail} className="min-w-0 scroll-mt-24 space-y-4">
                {channel ? (
                  <>
                    {reservedBy ? (
                      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                        <h3 className="font-bold">{t("waNumbers.backup")}</h3>
                        <p className="break-words text-sm">
                          {t("waNumbers.reservedFor", {
                            name: numberName(reservedBy, t("waCentral.channel")),
                          })}
                        </p>
                        <p className="text-sm">
                          {destination(reservedBy.barbershop_id, reservedBy.staff_id)}
                        </p>
                        <button
                          className="action-button"
                          disabled={busy}
                          onClick={() => setSelected(reservedBy.id)}
                        >
                          {t("waNumbers.viewPrimary")}
                        </button>
                      </section>
                    ) : (
                      <>
                        <Assignment
                          key={`${channel.id}:${channel.routing_version}`}
                          channel={channel}
                          data={data}
                          busy={busy}
                          reserve={(primary) =>
                            configure(primary, {
                              backupId: channel.id,
                              mode: "primary",
                              technical: false,
                              returns: primary.return_notice_enabled,
                              keepLegacy: false,
                            })
                          }
                          save={(shop, staff, enabled) =>
                            run(async () => {
                              const { error: failed } = await supabase.rpc(
                                "platform_assign_whatsapp_channel",
                                {
                                  p_id: channel.id,
                                  p_version: channel.routing_version,
                                  p_shop: shop,
                                  p_staff: staff,
                                  p_enabled: enabled,
                                },
                              );
                              if (failed) throw failed;
                              await load();
                              if (live.current) setSaved(true);
                            })
                          }
                        />
                        {channel.barbershop_id && (
                          <WhatsAppNumberReserve
                            key={`reserve:${channel.id}:${channel.routing_version}`}
                            number={channel}
                            numbers={data.channels}
                            supported={Boolean(data.number_reserves)}
                            busy={busy}
                            save={(configuration) => configure(channel, configuration)}
                            selectNumber={setSelected}
                          />
                        )}
                      </>
                    )}
                    <PlatformWhatsAppCard
                      key={channel.id}
                      channelId={channel.id}
                      title={channel.label || t("waCentral.channel")}
                    />
                    <details className="rounded-2xl border border-border bg-card p-4">
                      <summary className="cursor-pointer font-semibold">
                        {t("waCentral.history")}
                      </summary>
                      <ol className="mt-3 space-y-3 text-sm">
                        {data.history
                          .filter((h) => h.channel_id === channel.id)
                          .map((h) => (
                            <li key={h.id} className="break-words">
                              <time>{new Date(h.created_at).toLocaleString(locale)}</time>
                              <p>
                                {destination(h.old_shop_id, h.old_staff_id)} →{" "}
                                {destination(h.new_shop_id, h.new_staff_id)}
                              </p>
                            </li>
                          ))}
                      </ol>
                      {(data.configuration_history ?? [])
                        .filter((h) => h.channel_id === channel.id)
                        .map((h) => (
                          <p key={h.id} className="mt-3 break-words text-sm">
                            <time>{new Date(h.created_at).toLocaleString(locale)}</time>
                            {" · "}
                            {t("waNumbers.configurationChanged")}
                            {" · "}
                            {t(
                              h.after_config.mode === "backup"
                                ? "waNumbers.backup"
                                : h.after_config.mode === "paused"
                                  ? "waDelivery.paused"
                                  : "waNumbers.primary",
                            )}
                            {h.after_config.backup && (
                              <>
                                {" "}
                                ·{" "}
                                {numberName(
                                  data.channels.find(
                                    (n) => n.instance_name === h.after_config.backup,
                                  ) ??
                                    ({
                                      label: t("waNumbers.legacy"),
                                      display_phone: null,
                                    } as Channel),
                                  t("waCentral.channel"),
                                )}
                              </>
                            )}
                          </p>
                        ))}
                    </details>
                  </>
                ) : (
                  <Notice tone="info" title={t("waCentral.select")} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Assignment({
  channel,
  data,
  busy,
  save,
  reserve,
}: {
  channel: Channel;
  data: Directory;
  busy: boolean;
  reserve: (primary: Channel) => void;
  save: (shop: string | null, staff: string | null, enabled: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<"primary" | "backup">("primary");
  const [primaryId, setPrimaryId] = useState("");
  const candidates = data.channels.filter(
    (n) =>
      n.id !== channel.id &&
      n.barbershop_id &&
      !n.backup_instance_name &&
      n.delivery_mode === "primary",
  );
  const [shop, setShop] = useState(channel.barbershop_id ?? "");
  const [staff, setStaff] = useState(channel.staff_id ?? "");
  const [enabled, setEnabled] = useState(channel.enabled);
  const [confirmed, setConfirmed] = useState(false);
  const moved = shop !== (channel.barbershop_id ?? "") || staff !== (channel.staff_id ?? "");
  const rolePicker =
    !channel.barbershop_id &&
    !channel.backup_instance_name &&
    channel.delivery_mode === "primary" &&
    !channel.enabled ? (
      <ChoiceChips<"primary" | "backup">
        label={t("waNumbers.role")}
        value={role}
        disabled={busy}
        onChange={setRole}
        options={[
          { value: "primary", label: t("waNumbers.primary") },
          { value: "backup", label: t("waNumbers.backup") },
        ]}
      />
    ) : null;
  if (role === "backup" && rolePicker)
    return (
      <form
        className="space-y-4 rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const primary = candidates.find((n) => n.id === primaryId);
          if (primary && !busy && data.number_reserves) reserve(primary);
        }}
      >
        {rolePicker}
        {!data.number_reserves ? (
          <Notice tone="info" title={t("waNumbers.install")} />
        ) : (
          <>
            <label className="grid min-w-0 gap-1 text-sm font-semibold">
              {t("waNumbers.reserveFor")}
              <select
                className={field}
                aria-label={t("waNumbers.reserveFor")}
                value={primaryId}
                disabled={busy}
                onChange={(event) => setPrimaryId(event.target.value)}
              >
                <option value="">{t("waNumbers.choosePrimary")}</option>
                {candidates.map((n) => (
                  <option key={n.id} value={n.id}>
                    {numberName(n, t("waCentral.channel"))} ·{" "}
                    {data.shops.find((s) => s.id === n.barbershop_id)?.name}
                    {n.staff_id
                      ? ` · ${data.staff.find((s) => s.id === n.staff_id)?.name ?? t("waCentral.inactiveStaff")}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <Hint>{t("waNumbers.reserveForHint")}</Hint>
            <button className="action-button action-confirm" disabled={busy || !primaryId}>
              {t("waNumbers.assignBackup")}
            </button>
          </>
        )}
      </form>
    );
  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!moved || confirmed) void save(shop || null, staff || null, enabled);
      }}
    >
      {rolePicker}
      <h3 className="flex items-center gap-2 font-bold">
        <ArrowRightLeft className="size-4" aria-hidden />
        {t("waCentral.assignment")}
      </h3>
      <div className="grid gap-3 tablet:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          {t("waCentral.shop")}
          <select
            aria-label={t("waCentral.shop")}
            className={field}
            disabled={busy}
            value={shop}
            onChange={(e) => {
              setShop(e.target.value);
              setStaff("");
              setEnabled(false);
              setConfirmed(false);
            }}
          >
            <option value="">{t("waCentral.unassigned")}</option>
            {data.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {t("waCentral.staff")}
          <select
            className={field}
            disabled={busy || !shop}
            aria-label={t("waCentral.staff")}
            value={staff}
            onChange={(e) => {
              setStaff(e.target.value);
              setEnabled(false);
              setConfirmed(false);
            }}
          >
            <option value="">{t("waCentral.wholeShop")}</option>
            {data.staff
              .filter((s) => s.shop_id === shop)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={enabled}
          disabled={!shop || busy}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t("waCentral.enable")}
      </label>
      {moved && (
        <>
          <Notice tone="warning" title={t("waCentral.moveWarning")} />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t("waCentral.confirm")}
          </label>
        </>
      )}
      <button className="action-button action-confirm" disabled={busy || (moved && !confirmed)}>
        <MessageCircle className="size-4" aria-hidden />
        {t("waCentral.save")}
      </button>
    </form>
  );
}
