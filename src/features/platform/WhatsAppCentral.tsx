import { useDemo } from "@/features/demo/context";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ArrowLeft,
  ArrowRight,
  Store,
  Smartphone,
  Scissors,
  ShieldCheck,
  KeyRound,
  History,
  Search,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
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

import { WhatsAppNumberDestinations, type WhatsAppNumberLink } from "./WhatsAppNumberDestinations";

type DetailTab = "links" | "connection" | "reserve" | "history";
type Channel = Tables<"whatsapp_channels">;
type Directory = {
  number_sharing?: boolean;
  links?: WhatsAppNumberLink[];
  link_history?: {
    id: string;
    channel_id: string;
    action: string;
    after_config: WhatsAppNumberLink;
    created_at: string;
  }[];
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
  WA_SHARED_MANAGE: "waShared.manage",
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
  const [tab, setTab] = useState<DetailTab>("links");
  const [platformOpen, setPlatformOpen] = useState(false);
  const initialLinkRead = useRef(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const pending = useRef(false);
  const live = useRef(true);
  const createId = useRef<string | null>(null);
  async function load() {
    const { data: result, error: failed } = await supabase.rpc("platform_whatsapp_directory");
    if (!live.current) return;
    if (failed) throw failed;
    setData(result as unknown as Directory);
    if (!initialLinkRead.current) {
      initialLinkRead.current = true;
      setSelected(new URLSearchParams(window.location.search).get("numero"));
    }
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
  const screen = platformOpen ? "platform" : (channel?.id ?? "numbers");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      detail.current?.scrollIntoView({ block: "start", behavior: "instant" });
      detail.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [screen]);
  function chooseNumber(id: string, nextTab: DetailTab = "links") {
    setSelected(id);
    setTab(nextTab);
    setPlatformOpen(false);
    setSaved(false);
    setError(null);
  }
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
  const numberDestinations = (number: Channel) => {
    const owner =
      data?.channels.find((n) => n.backup_instance_name === number.instance_name) ?? number;
    const links = data?.links?.filter((b) => b.channel_id === owner.id);
    return links?.length
      ? links.map((b) => destination(b.barbershop_id, b.staff_id)).join(" • ")
      : destination(owner.barbershop_id, owner.staff_id);
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
        `${c.label} ${c.display_phone ?? ""} ${numberDestinations(c)}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
    ) ?? [];
  const numberLinks = (number: Channel) => {
    const owner =
      data?.channels.find((n) => n.backup_instance_name === number.instance_name) ?? number;
    return data?.number_sharing
      ? (data.links ?? []).filter((b) => b.channel_id === owner.id)
      : owner.barbershop_id
        ? [{ id: owner.id, barbershop_id: owner.barbershop_id, staff_id: owner.staff_id }]
        : [];
  };
  const tabs: { value: DetailTab; label: MessageKey; icon: typeof Store; disabled?: boolean }[] = [
    { value: "links", label: "waHub.shops", icon: Store },
    { value: "connection", label: "waHub.connection", icon: Smartphone },
    {
      value: "reserve",
      label: "waNumbers.backup",
      icon: ShieldCheck,
      disabled: !channel?.barbershop_id || Boolean(reservedBy),
    },
    { value: "history", label: "waHub.history", icon: History },
  ];
  const shared =
    (data?.links ?? []).filter((b) => b.channel_id === (reservedBy ?? channel)?.id).length > 1;
  return (
    <section className="min-w-0 space-y-5 outline-none" ref={detail} tabIndex={-1}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{t("waCentral.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("waHub.subtitle")}</p>
        </div>
        <button className="action-button" disabled={busy || demo} onClick={() => void run(load)}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          <span className="sr-only tablet:not-sr-only">{t("waCentral.refresh")}</span>
        </button>
      </header>
      {demo ? (
        <Notice tone="info" title={t("waPair.demo")} />
      ) : (
        <>
          {error && <Notice tone="danger" title={t(error)} />}
          {saved && <Notice tone="success" title={t("waCentral.saved")} />}
          {(channel || platformOpen) && (
            <button
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setPlatformOpen(false);
                setSaved(false);
                setError(null);
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("waHub.back")}
            </button>
          )}
          {platformOpen ? (
            <section className="min-w-0 max-w-3xl space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <KeyRound className="size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-bold">{t("waCentral.platform")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("waHub.platformHint")}</p>
                </div>
              </div>
              <PlatformWhatsAppCard />
            </section>
          ) : channel && data ? (
            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card p-4 tablet:grid-cols-[auto_minmax(0,1fr)_auto] tablet:p-5">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <Smartphone className="size-7" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-bold">
                    {channel.label || t("waCentral.channel")}
                  </h3>
                  <p className="break-words text-sm text-muted-foreground">
                    {channel.display_phone || t("waHub.phonePending")}
                  </p>
                </div>
                <span className="col-start-2 inline-flex items-center gap-2 justify-self-start rounded-xl border border-border px-3 py-2 text-sm tablet:col-start-auto">
                  <Store className="size-4 shrink-0" aria-hidden />
                  {t("waHub.destinationsCount", { count: numberLinks(channel).length })}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-2 tablet:grid-cols-4"
                role="group"
                aria-label={t("waHub.numberSections")}
              >
                {tabs.map(({ value, label, icon: Icon, disabled }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={busy || disabled}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold disabled:opacity-45 ${tab === value ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {t(label)}
                  </button>
                ))}
              </div>
              <div hidden={tab !== "links"} className="min-w-0">
                {reservedBy ? (
                  <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
                    <ShieldCheck className="size-9 text-primary" aria-hidden />
                    <h3 className="font-bold">
                      {t("waNumbers.reservedFor", {
                        name: numberName(reservedBy, t("waCentral.channel")),
                      })}
                    </h3>
                    <p className="break-words text-sm">{numberDestinations(reservedBy)}</p>
                    <button
                      className="action-button action-confirm"
                      disabled={busy}
                      onClick={() => chooseNumber(reservedBy.id)}
                    >
                      {t("waNumbers.viewPrimary")}
                      <ArrowRight className="size-4" aria-hidden />
                    </button>
                  </section>
                ) : data.number_sharing && channel.barbershop_id ? (
                  <WhatsAppNumberDestinations
                    key={`links:${channel.id}`}
                    numberLabel={numberName(channel, t("waCentral.channel"))}
                    error={error ? t(error) : null}
                    links={(data.links ?? []).filter((b) => b.channel_id === channel.id)}
                    shops={data.shops}
                    staff={data.staff}
                    busy={busy}
                    destination={destination}
                    add={async (shop, staff) => {
                      let added = false;
                      await run(async () => {
                        const { error: failed } = await supabase.rpc("platform_add_whatsapp_link", {
                          p_id: channel.id,
                          p_version: channel.routing_version,
                          p_shop: shop,
                          p_staff: staff,
                          p_enabled: false,
                        });
                        if (failed) throw failed;
                        await load();
                        if (live.current) setSaved(true);
                        added = true;
                      });
                      return added;
                    }}
                    update={(link, enabled, returns, remove) =>
                      void run(async () => {
                        const { error: failed } = await supabase.rpc(
                          "platform_update_whatsapp_link",
                          {
                            p_link: link.id,
                            p_version: link.version,
                            p_enabled: enabled,
                            p_returns: returns,
                            p_remove: remove,
                          },
                        );
                        if (failed) throw failed;
                        await load();
                        if (live.current) setSaved(true);
                      })
                    }
                  />
                ) : (
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
                )}
              </div>
              <div hidden={tab !== "connection"} className="max-w-3xl space-y-4">
                {shared && <Notice tone="warning" title={t("waShared.connectionHint")} />}
                <PlatformWhatsAppCard
                  key={channel.id}
                  channelId={channel.id}
                  title={channel.label || t("waCentral.channel")}
                />
              </div>
              <div hidden={tab !== "reserve"} className="max-w-3xl space-y-4">
                {shared && <Notice tone="warning" title={t("waShared.connectionHint")} />}
                {channel.barbershop_id && !reservedBy && (
                  <WhatsAppNumberReserve
                    key={`reserve:${channel.id}:${channel.routing_version}`}
                    number={channel}
                    numbers={data.channels}
                    perDestinationReturns={Boolean(data.number_sharing)}
                    supported={Boolean(data.number_reserves)}
                    busy={busy}
                    save={(configuration) => configure(channel, configuration)}
                    selectNumber={(id) => chooseNumber(id, "connection")}
                  />
                )}
              </div>
              <section
                hidden={tab !== "history"}
                className="max-w-3xl rounded-2xl border border-border bg-card p-5"
              >
                <h3 className="flex items-center gap-2 font-bold">
                  <History className="size-5" aria-hidden />
                  {t("waHub.history")}
                </h3>
                {!data.history.some((h) => h.channel_id === channel.id) &&
                  !(data.link_history ?? []).some((h) => h.channel_id === channel.id) &&
                  !(data.configuration_history ?? []).some((h) => h.channel_id === channel.id) && (
                    <p className="mt-3 text-sm text-muted-foreground">{t("waHub.noHistory")}</p>
                  )}
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
                {(data.link_history ?? [])
                  .filter((h) => h.channel_id === channel.id)
                  .map((h) => (
                    <p key={h.id} className="mt-3 break-words text-sm">
                      <time>{new Date(h.created_at).toLocaleString(locale)}</time>
                      {" · "}
                      {t(
                        h.action === "added"
                          ? "waShared.added"
                          : h.action === "removed"
                            ? "waShared.removed"
                            : "waShared.updated",
                      )}
                      {" · "}
                      {destination(h.after_config.barbershop_id, h.after_config.staff_id)}
                    </p>
                  ))}
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
                            data.channels.find((n) => n.instance_name === h.after_config.backup) ??
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
              </section>
            </div>
          ) : (
            <>
              <section className="grid items-center gap-3 rounded-2xl border border-border bg-card p-4 tablet:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)] tablet:gap-5 tablet:p-6">
                <div>
                  <h3 className="text-base font-bold tablet:text-lg">{t("waHub.sharedTitle")}</h3>
                  <p className="mt-2 hidden max-w-xl text-sm text-muted-foreground tablet:block">
                    {t("waHub.sharedHint")}
                  </p>
                </div>
                <div className="flex min-w-0 items-center justify-center gap-3" aria-hidden="true">
                  <div className="grid justify-items-center gap-2">
                    <span className="grid size-12 place-items-center rounded-2xl border border-primary/30 bg-accent text-primary tablet:size-16">
                      <Smartphone className="size-7 tablet:size-9" />
                    </span>
                    <span className="text-xs font-semibold">{t("waHub.oneNumber")}</span>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                  <div className="grid gap-2">
                    <span className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold">
                      <Store className="size-5 text-primary" />
                      {t("waHub.shops")}
                    </span>
                    <span className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold">
                      <Scissors className="size-5 text-primary" />
                      {t("waHub.professionals")}
                    </span>
                  </div>
                </div>
              </section>
              <section className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-bold">
                    {t("waNumbers.existing")}
                    <span className="rounded-lg bg-accent px-2 py-1 text-sm">
                      {data?.channels.length ?? "—"}
                    </span>
                  </h3>
                  <button
                    className="action-button"
                    disabled={busy || !data}
                    onClick={() => setAdding(!adding)}
                    aria-expanded={adding}
                  >
                    <Plus className="size-4" aria-hidden />
                    <span className="sr-only tablet:not-sr-only">{t("waNumbers.addAnother")}</span>
                  </button>
                </div>
                {adding && (
                  <form
                    className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
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
                        chooseNumber(id);
                        await load();
                      });
                    }}
                  >
                    <label className="grid min-w-0 flex-1 basis-60 gap-1 text-sm font-semibold">
                      {t("waCentral.label")}
                      <input
                        className={field}
                        value={label}
                        minLength={2}
                        maxLength={80}
                        required
                        disabled={busy}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                    </label>
                    <button
                      className="action-button action-confirm"
                      disabled={busy || label.trim().length < 2}
                    >
                      {t("waCentral.add")}
                    </button>
                  </form>
                )}
                <div className="grid items-end gap-3 pc:grid-cols-[minmax(0,1fr)_minmax(240px,0.6fr)]">
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
                  <label className="grid min-w-0 gap-1 text-sm font-semibold">
                    {t("waCentral.search")}
                    <span className="relative block">
                      <Search
                        className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
                        aria-hidden
                      />
                      <input
                        className={`${field} pl-10`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </span>
                  </label>
                </div>
                {busy && !data && (
                  <p role="status" className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t("shop.loading")}
                  </p>
                )}
                <div className="grid gap-4 tablet:grid-cols-2 pc:grid-cols-3">
                  {filtered.map((c) => {
                    const owner = data?.channels.find(
                      (n) => n.backup_instance_name === c.instance_name,
                    );
                    const links = numberLinks(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={busy}
                        onClick={() => chooseNumber(c.id)}
                        className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                            {owner ? (
                              <ShieldCheck className="size-6" aria-hidden />
                            ) : (
                              <Smartphone className="size-6" aria-hidden />
                            )}
                          </span>
                          <span className="rounded-lg border border-border px-2 py-1 text-xs font-semibold">
                            {t(
                              owner
                                ? "waNumbers.backup"
                                : c.barbershop_id
                                  ? "waNumbers.primary"
                                  : "waNumbers.available",
                            )}
                          </span>
                        </span>
                        <span className="mt-4 block break-words font-bold">
                          {c.label || t("waCentral.channel")}
                        </span>
                        <span className="mt-1 break-words text-sm text-muted-foreground">
                          {c.display_phone || t("waHub.phonePending")}
                        </span>
                        <span className="my-4 grid flex-1 content-start gap-2">
                          {links.slice(0, 2).map((b) => (
                            <span key={b.id} className="flex min-w-0 items-start gap-2 text-sm">
                              <Store
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="break-words">
                                {destination(b.barbershop_id, b.staff_id)}
                              </span>
                            </span>
                          ))}
                          {links.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              {t("waHub.moreDestinations", { count: links.length - 2 })}
                            </span>
                          )}
                          {!links.length && (
                            <span className="text-sm text-muted-foreground">
                              {t("waHub.availableHint")}
                            </span>
                          )}
                        </span>
                        <span className="flex min-h-11 items-center justify-between gap-2 border-t border-border pt-3 text-sm font-bold text-primary">
                          <span>
                            {t(
                              owner
                                ? "waHub.manageBackup"
                                : c.barbershop_id && data?.number_sharing
                                  ? "waHub.useElsewhere"
                                  : "waHub.chooseDestination",
                            )}
                          </span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {data && !filtered.length && (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <Search className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
                    <p>{t("waCentral.empty")}</p>
                    {(query || filter !== "all") && (
                      <button
                        className="action-button mt-3"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        {t("waHub.clearFilters")}
                      </button>
                    )}
                  </div>
                )}
              </section>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPlatformOpen(true);
                  setError(null);
                  setSaved(false);
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left"
              >
                <KeyRound className="size-6 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("waCentral.platform")}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {t("waHub.platformHint")}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0" aria-hidden />
              </button>
            </>
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
