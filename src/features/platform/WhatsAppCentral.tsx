import { useDemo } from "@/features/demo/context";
import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Loader2, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { Notice, Hint } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { PlatformWhatsAppCard } from "./PlatformWhatsAppCard";

type Channel = Tables<"whatsapp_channels">;
type Directory = {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const live = useRef(true);
  const createId = useRef<string | null>(null);
  async function load() {
    const { data: result, error: failed } = await supabase.rpc("platform_whatsapp_directory");
    if (!live.current) return;
    if (failed) throw failed;
    setData(result as unknown as Directory);
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
    data?.channels.filter((c) =>
      `${c.label} ${c.display_phone ?? ""} ${destination(c.barbershop_id, c.staff_id)}`
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
          {error && <Notice tone="danger" title={t(error)} />}
          {saved && <Notice tone="success" title={t("waCentral.saved")} />}
          <form
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"
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
          {busy && !data && (
            <p role="status" className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("shop.loading")}
            </p>
          )}
          {data && (
            <div className="grid items-start gap-5 pc:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
              <div className="min-w-0 space-y-3">
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
                        {destination(c.barbershop_id, c.staff_id)}
                      </span>
                      {c.display_phone && (
                        <span className="block text-sm text-muted-foreground">
                          {c.display_phone}
                        </span>
                      )}
                      <span className="mt-2 block text-xs font-semibold">
                        {t(c.enabled ? "waCentral.enabled" : "waCentral.disabled")}
                      </span>
                    </button>
                  ))}
                </div>
                {!filtered.length && <Hint>{t("waCentral.empty")}</Hint>}
              </div>
              <div className="min-w-0 space-y-4">
                {channel ? (
                  <>
                    <Assignment
                      key={`${channel.id}:${channel.routing_version}`}
                      channel={channel}
                      data={data}
                      busy={busy}
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
}: {
  channel: Channel;
  data: Directory;
  busy: boolean;
  save: (shop: string | null, staff: string | null, enabled: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const [shop, setShop] = useState(channel.barbershop_id ?? "");
  const [staff, setStaff] = useState(channel.staff_id ?? "");
  const [enabled, setEnabled] = useState(channel.enabled);
  const [confirmed, setConfirmed] = useState(false);
  const moved = shop !== (channel.barbershop_id ?? "") || staff !== (channel.staff_id ?? "");
  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!moved || confirmed) void save(shop || null, staff || null, enabled);
      }}
    >
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
