import { hasIdentifiedNumber } from "@/lib/whatsapp/directory-model";
import { CareGroupsAdmin } from "./CareGroupsAdmin";
import { WhatsAppSendingControls } from "./WhatsAppSendingControls";
import { WhatsAppShopDirectory } from "./WhatsAppShopDirectory";
import { useDemo } from "@/features/demo/context";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  UsersRound,
  ArrowRightLeft,
  Link2,
  ArrowLeft,
  ArrowRight,
  Store,
  Smartphone,
  ShieldCheck,
  KeyRound,
  History,
  Search,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Notice, Hint, ChoiceChips, MoreActions, StatusBadge } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  PlatformWhatsAppCard,
  type PlatformWaReport,
  type PlatformWhatsAppHandle,
} from "./PlatformWhatsAppCard";
import {
  WhatsAppNumberReserve,
  numberName,
  type NumberConfiguration,
} from "./WhatsAppNumberReserve";

import { WhatsAppNumberDestinations, type WhatsAppNumberLink } from "./WhatsAppNumberDestinations";

import { WhatsAppLinkDialog, type WhatsAppLinkRequest } from "./WhatsAppLinkDialog";

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
  unassigned_reserves?: boolean;
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
  const [view, setView] = useState<"shops" | "numbers" | "access" | "groups">("shops");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reports, setReports] = useState<Record<string, PlatformWaReport>>({});
  const connection = useRef<PlatformWhatsAppHandle>(null);
  const root = useRef<HTMLElement>(null);
  const initialLinkRead = useRef(false);
  const [adding, setAdding] = useState(false);
  const [linkRequest, setLinkRequest] = useState<WhatsAppLinkRequest | null>(null);
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
      const requested = new URLSearchParams(window.location.search).get("numero");
      const numbers = (result as unknown as Directory).channels;
      const target = numbers.find((n) => n.id === requested);
      setSelected(target?.id ?? numbers.find(hasIdentifiedNumber)?.id ?? numbers[0]?.id ?? null);
      setDetailsOpen(Boolean(target));
      if (target) setView("numbers");
      if (target && !hasIdentifiedNumber(target)) setTab("connection");
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
  const channel =
    data?.channels.find((c) => c.id === selected) ??
    data?.channels.find(hasIdentifiedNumber) ??
    data?.channels[0];
  const channelId = channel?.id;
  const report = useCallback(
    (status: PlatformWaReport | null, phone?: string | null) => {
      // A montagem do cartão envia null antes da consulta. Não apaga o estado já conhecido.
      if (!channelId || status === null) return;
      setReports((current) =>
        current[channelId] === status ? current : { ...current, [channelId]: status },
      );
      if (phone?.trim())
        setData((current) => {
          const number = current?.channels.find((n) => n.id === channelId);
          if (!current || !number || (number.display_phone === phone && number.status === status))
            return current;
          return {
            ...current,
            channels: current.channels.map((n) =>
              n.id === channelId
                ? { ...n, display_phone: phone, ...(status !== "error" ? { status } : {}) }
                : n,
            ),
          };
        });
    },
    [channelId],
  );
  const screen = `${view}:${detailsOpen ? channel?.id : "list"}`;
  useEffect(() => {
    if (view !== "numbers") return;
    const frame = requestAnimationFrame(() => {
      const target = detailsOpen && view === "numbers" ? detail.current : root.current;
      if (!window.matchMedia("(min-width: 1024px)").matches)
        target?.scrollIntoView({ block: "start", behavior: "instant" });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, detailsOpen, view]);
  function chooseNumber(id: string, nextTab: DetailTab = "links") {
    setSelected(id);
    setDetailsOpen(true);
    setTab(nextTab);
    setView("numbers");
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
  const numberLinks = (number: Channel) => {
    const owner =
      data?.channels.find((n) => n.backup_instance_name === number.instance_name) ?? number;
    return data?.number_sharing
      ? (data.links ?? []).filter((b) => b.channel_id === owner.id)
      : owner.barbershop_id
        ? [{ id: owner.id, barbershop_id: owner.barbershop_id, staff_id: owner.staff_id }]
        : [];
  };
  const identified = data?.channels.filter(hasIdentifiedNumber) ?? [];
  const preparations = data?.channels.filter((n) => !hasIdentifiedNumber(n)) ?? [];
  const filtered =
    identified.filter(
      (c) =>
        (filter === "all" ||
          (filter === "backup"
            ? (data?.channels ?? []).some((n) => n.backup_instance_name === c.instance_name)
            : filter === "assigned"
              ? numberLinks(c).length > 0
              : numberLinks(c).length === 0 &&
                !(data?.channels ?? []).some((n) => n.backup_instance_name === c.instance_name))) &&
        `${c.label} ${c.display_phone ?? ""} ${numberDestinations(c)}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
    ) ?? [];
  const shared =
    (data?.links ?? []).filter((b) => b.channel_id === (reservedBy ?? channel)?.id).length > 1;
  const backup = data?.channels.find((n) => n.instance_name === channel?.backup_instance_name);
  function backToNumbers() {
    setDetailsOpen(false);
    setView("numbers");
    setSaved(false);
    setError(null);
  }
  function openLink(request: WhatsAppLinkRequest = {}) {
    setError(null);
    setSaved(false);
    setLinkRequest(request);
  }
  async function addLink(id: string, shop: string, staff: string | null) {
    let added = false;
    const number = data?.channels.find((n) => n.id === id);
    if (!number) return false;
    await run(async () => {
      const { error: failed } = await supabase.rpc("platform_add_whatsapp_link", {
        p_id: number.id,
        p_version: number.routing_version,
        p_shop: shop,
        p_staff: staff,
        p_enabled: false,
      });
      if (failed) throw failed;
      await load();
      if (live.current) {
        chooseNumber(id);
        setSaved(true);
      }
      added = true;
    });
    return added;
  }
  async function releasePreparation(link: WhatsAppNumberLink) {
    let released = false;
    const owner = data?.channels.find((n) => n.id === link.channel_id);
    if (!owner || owner.display_phone?.trim()) return false;
    await run(async () => {
      const { error: failed } = await supabase.rpc("platform_update_whatsapp_link", {
        p_link: link.id,
        p_version: link.version,
        p_enabled: false,
        p_returns: false,
        p_remove: true,
      });
      if (failed) throw failed;
      await load();
      released = true;
    });
    return released;
  }
  return (
    <section ref={root} tabIndex={-1} className="min-w-0 space-y-5 outline-none">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{t("waOrg.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              view === "shops"
                ? "waOrg.shopsHint"
                : view === "numbers"
                  ? "waOrg.numbersHint"
                  : "waOrg.accessHint",
            )}
          </p>
        </div>
        <button
          className="action-button"
          disabled={busy || demo}
          onClick={() =>
            void run(async () => {
              await load();
              connection.current?.recheck();
            })
          }
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          <span className="sr-only tablet:not-sr-only">{t("waCentral.refresh")}</span>
        </button>
      </header>
      {demo ? (
        <Notice tone="info" title={t("waPair.demo")} />
      ) : (
        <>
          <WhatsAppSendingControls numbers={data?.channels ?? []} />
          {error && <Notice tone="danger" title={t(error)} />}
          {saved && <Notice tone="success" title={t("waCentral.saved")} />}
          <div
            role="group"
            aria-label={t("waOrg.navigation")}
            className="grid grid-cols-2 tablet:grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-2"
          >
            {(
              [
                { id: "shops", title: "waOrg.shops", icon: Store, count: data?.shops.length },
                {
                  id: "numbers",
                  title: "waOrg.numbers",
                  icon: Smartphone,
                  count: data ? identified.length : undefined,
                },
                { id: "access", title: "waOrg.access", icon: KeyRound },
                { id: "groups", title: "care.nav", icon: UsersRound },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id}
                onClick={() => {
                  setView(item.id);
                  setError(null);
                  setSaved(false);
                }}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-center text-sm font-semibold transition-colors tablet:flex-row tablet:gap-2 ${view === item.id ? "bg-accent text-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-muted"}`}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                <span>{t(item.title)}</span>
                {"count" in item && item.count !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                )}
              </button>
            ))}
          </div>
          {data?.number_sharing && view !== "access" && view !== "groups" && (
            <button
              type="button"
              className="action-button action-confirm w-full tablet:w-auto"
              disabled={busy}
              onClick={() => openLink()}
            >
              <Link2 className="size-5 shrink-0" aria-hidden />
              {t("waMissing.link")}
            </button>
          )}
          {data?.number_sharing && linkRequest && (
            <WhatsAppLinkDialog
              request={linkRequest}
              numbers={data.channels}
              shops={data.shops}
              staff={data.staff}
              links={data.links ?? []}
              busy={busy}
              error={error ? t(error) : null}
              close={() => setLinkRequest(null)}
              add={addLink}
              release={releasePreparation}
              viewNumber={chooseNumber}
            />
          )}
          {view === "groups" ? (
            <CareGroupsAdmin shops={data?.shops ?? []} numbers={data?.channels ?? []} />
          ) : view === "shops" ? (
            data ? (
              <WhatsAppShopDirectory
                shops={data.shops}
                staff={data.staff}
                numbers={data.channels.map((n) => ({ ...n, status: reports[n.id] ?? n.status }))}
                links={
                  data.number_sharing
                    ? (data.links ?? [])
                    : data.channels
                        .filter((n) => n.barbershop_id)
                        .map((n) => ({
                          id: n.id,
                          channel_id: n.id,
                          barbershop_id: n.barbershop_id!,
                          staff_id: n.staff_id,
                          enabled: n.enabled,
                        }))
                }
                busy={busy || !data.number_sharing}
                link={(target) => openLink(target)}
                viewNumber={chooseNumber}
                resume={(id) => chooseNumber(id, "connection")}
              />
            ) : busy ? (
              <p role="status" className="flex items-center gap-2 p-4 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("shop.loading")}
              </p>
            ) : null
          ) : view === "access" ? (
            <section className="max-w-3xl space-y-4">
              <button className="action-button" disabled={busy} onClick={backToNumbers}>
                <ArrowLeft className="size-4" aria-hidden />
                {t("waHub.back")}
              </button>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <KeyRound className="size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-bold">{t("waOrg.access")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("waOrg.accessHint")}</p>
                </div>
              </div>
              <PlatformWhatsAppCard />
            </section>
          ) : (
            <>
              <div className="grid min-w-0 items-start gap-4 min-[1024px]:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
                <aside
                  aria-label={t("waNumbers.existing")}
                  className={`${detailsOpen && channel ? "hidden min-[1024px]:block" : "block"} min-w-0 space-y-3 rounded-2xl border border-border bg-card p-3`}
                >
                  <div className="flex items-center justify-between gap-2 px-1">
                    <h3 className="text-sm font-bold">{t("waNumbers.existing")}</h3>
                    <span className="text-xs text-muted-foreground">
                      {data ? identified.length : "—"}
                    </span>
                  </div>
                  <label className="relative block">
                    <span className="sr-only">{t("waCentral.search")}</span>
                    <Search
                      className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      className={`${field} pl-10`}
                      placeholder={t("waCentral.search")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">{t("waNumbers.filter")}</span>
                    <select
                      className={field}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as typeof filter)}
                    >
                      <option value="all">{t("waNumbers.all")}</option>
                      <option value="available">{t("waNumbers.available")}</option>
                      <option value="assigned">{t("waNumbers.assigned")}</option>
                      <option value="backup">{t("waNumbers.reserves")}</option>
                    </select>
                  </label>
                  {busy && !data && (
                    <p role="status" className="flex items-center gap-2 p-3 text-sm">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {t("shop.loading")}
                    </p>
                  )}
                  <ul aria-label={t("waNumbers.existing")} className="space-y-2">
                    {filtered.map((c) => {
                      const owner = data?.channels.find(
                        (n) => n.backup_instance_name === c.instance_name,
                      );
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            aria-pressed={channel?.id === c.id}
                            disabled={busy}
                            onClick={() =>
                              chooseNumber(
                                c.id,
                                c.display_phone?.trim() && c.status === "open"
                                  ? "links"
                                  : "connection",
                              )
                            }
                            className={`flex w-full min-w-0 flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${channel?.id === c.id ? "border-primary/40 bg-accent" : "border-transparent hover:bg-accent/60"}`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70 text-primary">
                                {owner ? (
                                  <ShieldCheck className="size-5" aria-hidden />
                                ) : (
                                  <Smartphone className="size-5" aria-hidden />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-bold">
                                  {c.display_phone || c.label || t("waOrg.incompleteItem")}
                                </span>
                                <span className="block break-words text-xs text-muted-foreground">
                                  {c.display_phone
                                    ? c.label || t("waOrg.registeredNumber")
                                    : t("waOrg.finishConnection")}
                                </span>
                              </span>
                            </span>
                            <span className="flex w-full flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">
                                {owner
                                  ? t("waNumbers.backup")
                                  : numberLinks(c).length
                                    ? t("waOrg.usedShops", {
                                        count: new Set(numberLinks(c).map((l) => l.barbershop_id))
                                          .size,
                                      })
                                    : t("waOperation.available")}
                              </span>
                              <ConnectionBadge
                                status={reports[c.id] ?? c.status}
                                pending={!c.display_phone?.trim()}
                              />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {data && !filtered.length && (
                    <div className="space-y-2 p-3 text-sm">
                      <p>{t("waCentral.empty")}</p>
                      {(query || filter !== "all") && (
                        <button
                          className="action-button"
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
                  {preparations.length > 0 && (
                    <section
                      aria-label={t("waOrg.preparations")}
                      className="space-y-2 border-t border-border pt-3"
                    >
                      <h4 className="text-sm font-semibold">
                        {t("waOrg.preparations")} · {preparations.length}
                      </h4>
                      <p className="text-xs text-muted-foreground">{t("waOrg.preparationsHint")}</p>
                      {preparations.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="action-button w-full justify-between text-left"
                          disabled={busy}
                          onClick={() => chooseNumber(item.id, "connection")}
                        >
                          <span className="min-w-0 break-words">
                            {item.label || t("waOrg.incompleteItem")}
                          </span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </button>
                      ))}
                    </section>
                  )}
                  <div className="border-t border-border pt-3">
                    <button
                      className="action-button w-full"
                      disabled={busy || !data}
                      aria-expanded={adding}
                      onClick={() => setAdding(!adding)}
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("waNumbers.addAnother")}
                    </button>
                  </div>
                  {adding && (
                    <form
                      className="space-y-3"
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
                          chooseNumber(id, "connection");
                          await load();
                        });
                      }}
                    >
                      <label className="grid min-w-0 gap-1 text-sm font-semibold">
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
                        className="action-button action-confirm w-full"
                        disabled={busy || label.trim().length < 2}
                      >
                        {t("waCentral.add")}
                      </button>
                    </form>
                  )}
                </aside>
                {channel && data ? (
                  <section
                    ref={detail}
                    tabIndex={-1}
                    aria-label={numberName(channel, t("waCentral.channel"))}
                    className={`${detailsOpen ? "block" : "hidden min-[1024px]:block"} min-w-0 space-y-5 rounded-2xl border border-border bg-card p-4 outline-none tablet:p-5`}
                  >
                    <div className="min-[1024px]:hidden">
                      <button className="action-button" disabled={busy} onClick={backToNumbers}>
                        <ArrowLeft className="size-4" aria-hidden />
                        {t("waHub.back")}
                      </button>
                    </div>
                    <header className="flex items-start gap-3">
                      <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                        {reservedBy ? (
                          <ShieldCheck className="size-6" aria-hidden />
                        ) : (
                          <Smartphone className="size-6" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-lg font-bold">
                          {channel.display_phone || t("waOrg.incompleteItem")}
                        </h3>
                        <p className="break-words text-sm text-muted-foreground">
                          {channel.display_phone
                            ? channel.label || t("waOrg.registeredNumber")
                            : t("waOrg.noPhoneYet")}
                        </p>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1"
                          aria-label={t("waOperation.connectionDetails")}
                          disabled={busy}
                          onClick={() => setTab("connection")}
                        >
                          <ConnectionBadge status={reports[channel.id] ?? channel.status} />
                          <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                        </button>
                      </div>
                      <MoreActions
                        label={t("waOperation.options")}
                        title={channel.display_phone || t("waOrg.incompleteItem")}
                        actions={[
                          {
                            id: "links",
                            label: t("waShared.destinations"),
                            icon: Store,
                            disabled: busy || tab === "links",
                            onSelect: () => setTab("links"),
                          },
                          {
                            id: "connection",
                            label: t("waHub.connection"),
                            icon: Smartphone,
                            disabled: busy || tab === "connection",
                            onSelect: () => setTab("connection"),
                          },
                          {
                            id: "reserve",
                            label: t("waNumbers.backup"),
                            icon: ShieldCheck,
                            disabled:
                              busy ||
                              !channel.barbershop_id ||
                              Boolean(reservedBy) ||
                              tab === "reserve",
                            onSelect: () => setTab("reserve"),
                          },
                          {
                            id: "history",
                            label: t("waHub.history"),
                            icon: History,
                            disabled: busy || tab === "history",
                            onSelect: () => setTab("history"),
                          },
                        ]}
                      />
                    </header>
                    {tab !== "links" && (
                      <button
                        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
                        disabled={busy}
                        onClick={() => setTab("links")}
                      >
                        <ArrowLeft className="size-4" aria-hidden />
                        {t("waOperation.backToDestinations")}
                      </button>
                    )}
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
                          links={(data.links ?? []).filter((b) => b.channel_id === channel.id)}
                          busy={busy}
                          destination={destination}
                          add={() => openLink({ number: channel.id })}
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
                      {hasIdentifiedNumber(channel) && !reservedBy && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setTab("reserve")}
                          className="mt-5 flex min-h-16 w-full items-center gap-3 border-t border-border pt-4 text-left"
                        >
                          <ShieldCheck
                            className="size-5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {t("waNumbers.backup")}
                            </span>
                            <span className="block break-words text-xs text-muted-foreground">
                              {backup
                                ? numberName(backup, t("waCentral.channel"))
                                : channel.backup_instance_name
                                  ? t("waNumbers.legacy")
                                  : t("waNumbers.noBackup")}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </button>
                      )}
                    </div>
                    <div hidden={tab !== "connection"} className="max-w-3xl space-y-4">
                      {data.number_sharing && !channel.display_phone?.trim() && !reservedBy && (
                        <Notice
                          tone="info"
                          title={t("waLink.reusePreparation")}
                          action={{
                            label: t("waMissing.link"),
                            icon: Link2,
                            disabled: busy,
                            onClick: () =>
                              openLink({
                                shop: channel.barbershop_id ?? undefined,
                                staff: channel.staff_id,
                              }),
                          }}
                        />
                      )}
                      {shared && <Notice tone="warning" title={t("waShared.connectionHint")} />}
                      <PlatformWhatsAppCard
                        ref={connection}
                        onStatusChange={report}
                        key={channel.id}
                        channelId={channel.id}
                        title={channel.display_phone || t("waOrg.incompleteItem")}
                      />
                    </div>
                    <div hidden={tab !== "reserve"} className="max-w-3xl space-y-4">
                      {shared && <Notice tone="warning" title={t("waShared.connectionHint")} />}
                      {hasIdentifiedNumber(channel) && !reservedBy && (
                        <WhatsAppNumberReserve
                          key={`reserve:${channel.id}:${channel.routing_version}`}
                          number={channel}
                          numbers={data.channels}
                          perDestinationReturns={Boolean(data.number_sharing)}
                          supported={Boolean(
                            channel.barbershop_id ? data.number_reserves : data.unassigned_reserves,
                          )}
                          assignmentOnly={!channel.barbershop_id}
                          busy={busy}
                          save={(configuration) => configure(channel, configuration)}
                          selectNumber={(id) => chooseNumber(id, "connection")}
                        />
                      )}
                    </div>
                    <section hidden={tab !== "history"} className="space-y-3">
                      <h3 className="flex items-center gap-2 font-bold">
                        <History className="size-5" aria-hidden />
                        {t("waHub.history")}
                      </h3>
                      {!data.history.some((h) => h.channel_id === channel.id) &&
                        !(data.link_history ?? []).some((h) => h.channel_id === channel.id) &&
                        !(data.configuration_history ?? []).some(
                          (h) => h.channel_id === channel.id,
                        ) && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {t("waHub.noHistory")}
                          </p>
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
                    </section>
                  </section>
                ) : (
                  <div className="hidden min-[1024px]:block">
                    <Notice tone="info" title={t("waCentral.select")} />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function ConnectionBadge({
  status,
  pending = false,
}: {
  status: PlatformWaReport | null;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const label: MessageKey =
    pending && status !== "error"
      ? status === "open"
        ? "waOrg.identifyingNumber"
        : "waOrg.awaitingConnection"
      : status === "open"
        ? "integr.wa.status.open"
        : status === "disconnected"
          ? "integr.wa.status.disconnected"
          : status === "qr"
            ? "plat.wa.waitingScan"
            : status === "connecting"
              ? "integr.wa.status.connecting"
              : status === "error"
                ? "waOperation.checkConnection"
                : "shop.loading";
  return (
    <StatusBadge
      tone={
        pending
          ? "pending"
          : status === "open"
            ? "success"
            : status === "error"
              ? "warning"
              : status === "disconnected"
                ? "neutral"
                : "pending"
      }
      label={t(label)}
    />
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
      hasIdentifiedNumber(n) &&
      (n.barbershop_id || data.unassigned_reserves) &&
      !data.channels.some((owner) => owner.backup_instance_name === n.instance_name) &&
      !n.backup_instance_name &&
      n.delivery_mode === "primary",
  );
  const [shop, setShop] = useState(channel.barbershop_id ?? "");
  const [staff, setStaff] = useState(channel.staff_id ?? "");
  const [enabled, setEnabled] = useState(channel.enabled);
  const [confirmed, setConfirmed] = useState(false);
  const moved = shop !== (channel.barbershop_id ?? "") || staff !== (channel.staff_id ?? "");
  const rolePicker =
    hasIdentifiedNumber(channel) &&
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
                    {numberName(n, t("waCentral.channel"))}
                    {n.barbershop_id
                      ? ` · ${data.shops.find((s) => s.id === n.barbershop_id)?.name ?? ""}`
                      : ""}
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
