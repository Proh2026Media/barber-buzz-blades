import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ContactRound,
  Flag,
  History,
  MessageCircle,
  RefreshCw,
  Repeat,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";
import {
  APPOINTMENT_STATUS,
  DataList,
  EmptyState,
  LoadingState,
  Notice,
  PersonAvatar,
  StatTile,
  StatusBadge,
  Tag,
  type AppointmentStatus,
} from "@/components/visual";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { InlineStatus, type ActionState } from "@/components/visual";
import { formatSignupPhone } from "@/lib/auth/signup-phone";
import { useViewportAtLeast } from "@/lib/device";
import { ClientNoticeBell } from "./ClientNoticeBell";
import { AGENDA_STATE } from "./agenda/types";
import { InviteCard } from "./clients/InviteCard";
import { NicknameEditor } from "./clients/NicknameEditor";
import { clientDisplay, whatsappLink } from "./clients/model";
import { t as tNow, useI18n } from "@/lib/i18n";

export type ClientHistoryRow = {
  appointment_id: string;
  starts_at: string;
  service_name: string | null;
  staff_name: string | null;
  status: string;
  amount_cents: number;
};

export type ClientProfilePayload = {
  customer_id: string;
  customer_name: string | null;
  /** Migration 20261016130000 (ausentes antes dela): apelido e horário recorrente ativo. */
  nickname?: string | null;
  recurring?: boolean;
  avatar_url: string | null;
  visits: number;
  total_spent_cents: number;
  first_visit: string | null;
  last_visit: string | null;
  rhythm: RhythmPayload;
  history: ClientHistoryRow[];
};

/** Ficha do cliente do balcão (sem conta), de `get_shop_client`. */
type WalkInPayload = {
  shop_client_id: string;
  customer_id: string | null;
  has_account: boolean;
  name: string | null;
  nickname: string | null;
  whatsapp: string | null;
  notify_whatsapp: boolean;
  visits: number;
  total_spent_cents: number;
  last_visit: string | null;
  history: ClientHistoryRow[];
};

const UPCOMING = new Set(["pending", "confirmed", "reschedule_requested"]);

function formatBRL(cents: number, intlLocale: string) {
  return (cents / 100).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
}

function isStatus(value: string): value is AppointmentStatus {
  return value in APPOINTMENT_STATUS;
}

/**
 * Selo da situação com a mesma cor, ícone e rótulo da Agenda ("A confirmar", "Cliente vai
 * remarcar"…): quem vê a ficha reconhece o estado sem traduzir.
 */
function agendaMeta(status: AppointmentStatus) {
  return AGENDA_STATE[status];
}

/**
 * Histórico da ficha: tabela a partir de 768 px nas janelas largas; cartões no celular
 * e no painel lateral de 32rem, onde a tabela não cabe.
 */
function HistoryList({
  desktopSide = false,
  rows,
  dateTime,
}: {
  desktopSide?: boolean;
  rows: ClientHistoryRow[];
  dateTime: Intl.DateTimeFormat;
}) {
  const { t, intlLocale } = useI18n();
  const tablet = useViewportAtLeast(768);
  const computer = useViewportAtLeast(1280);
  const table = tablet && !(desktopSide && computer);
  if (rows.length === 0) {
    return <EmptyState tone="calendar" variant="plain" title={t("team.profile.historyEmpty")} />;
  }
  const badge = (status: string, size: "sm" | "md", icon = false) => {
    const meta = isStatus(status) ? agendaMeta(status) : null;
    if (!meta) return null;
    return (
      <StatusBadge
        tone={meta.tone}
        icon={meta.icon}
        label={t(meta.labelKey)}
        variant={icon ? "icon" : undefined}
        size={size}
      />
    );
  };
  const amount = (row: ClientHistoryRow) => (
    <span
      className={`text-xs font-bold tabular-nums ${row.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}
    >
      {formatBRL(row.amount_cents, intlLocale)}
    </span>
  );
  if (table) {
    return (
      <DataList
        tableFrom={768}
        rows={rows}
        rowKey={(row) => row.appointment_id}
        columns={[
          {
            key: "when",
            header: t("booking.date"),
            width: "11rem",
            cell: (row) => (
              <span className="tabular-nums first-letter:uppercase">
                {dateTime.format(new Date(row.starts_at))}
              </span>
            ),
          },
          {
            key: "service",
            header: t("bk.service"),
            cell: (row) => (
              <span className="font-semibold">
                {row.service_name ?? t("team.partner.serviceFallback")}
              </span>
            ),
          },
          {
            key: "staff",
            header: t("bk.staff"),
            cell: (row) => row.staff_name ?? "—",
          },
          {
            key: "status",
            header: t("plat.shops.colStatus"),
            width: "9rem",
            cell: (row) => badge(row.status, "sm"),
          },
          {
            key: "amount",
            header: t("domainCard.record.value"),
            width: "6rem",
            align: "end",
            cell: amount,
          },
        ]}
      />
    );
  }
  return (
    <ol className="space-y-1.5">
      {rows.map((row) => {
        const meta = isStatus(row.status) ? agendaMeta(row.status) : null;
        return (
          <li
            key={row.appointment_id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
          >
            {meta ? (
              // O selo com texto (2ª linha) já diz a situação ao leitor de tela.
              <span aria-hidden className="shrink-0">
                {badge(row.status, "md", true)}
              </span>
            ) : (
              <UserRound className="size-5 text-muted-foreground" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {row.service_name ?? t("team.partner.serviceFallback")}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{dateTime.format(new Date(row.starts_at))}</span>
                {badge(row.status, "sm")}
              </p>
              {row.staff_name && (
                <p className="text-xs text-muted-foreground">
                  {t("team.profile.with", { name: row.staff_name })}
                </p>
              )}
            </div>
            <span className="shrink-0">{amount(row)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Perfil do cliente: a próxima visita em destaque, os números (na barbearia e com você), o
 * caminho primeira → última → próxima, o ritmo e o histórico em linha do tempo. "Avisar" fica
 * à mão no topo. Janela do projeto (foco preso nela e devolvido à lista ao fechar).
 */
export function ClientProfileModal({
  shopId,
  customerId,
  shopClientId = null,
  customerName,
  ownVisits,
  desktopSide = false,
  publicOrigin = null,
  shopName = "",
  onClose,
  onChanged,
}: {
  shopId: string;
  /** Cliente com conta. Nulo quando é cliente do balcão (`shopClientId`). */
  customerId: string | null;
  /** Cliente do balcão (sem conta), marcado pela equipe. */
  shopClientId?: string | null;
  customerName: string | null;
  /** Visitas com o parceiro que abriu (a lista dele conta só as próprias). */
  ownVisits?: number;
  desktopSide?: boolean;
  /** Endereço público da barbearia, para o convite de cadastro do cliente do balcão. */
  publicOrigin?: string | null;
  shopName?: string;
  onClose: () => void;
  /** Apelido ou dados do cliente mudaram (a agenda recarrega). */
  onChanged?: () => void;
}) {
  if (!customerId && shopClientId) {
    return (
      <WalkInClientModal
        desktopSide={desktopSide}
        shopId={shopId}
        shopClientId={shopClientId}
        customerName={customerName}
        publicOrigin={publicOrigin}
        shopName={shopName}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  if (!customerId) return null;
  return (
    <AccountClientModal
      desktopSide={desktopSide}
      shopId={shopId}
      customerId={customerId}
      customerName={customerName}
      ownVisits={ownVisits}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function AccountClientModal({
  shopId,
  customerId,
  customerName,
  ownVisits,
  desktopSide = false,
  onClose,
  onChanged,
}: {
  shopId: string;
  customerId: string;
  customerName: string | null;
  ownVisits?: number;
  desktopSide?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [profile, setProfile] = useState<ClientProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const now = demo?.now.getTime() ?? Date.now();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (demo) {
      const rows = demo.appointments.filter((row) => row.customer_id === customerId);
      const completed = rows.filter((row) => row.status === "completed");
      const sorted = [...completed].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) {
        intervals.push(
          (new Date(sorted[i]!.starts_at).getTime() -
            new Date(sorted[i - 1]!.starts_at).getTime()) /
            86400000,
        );
      }
      const weekdays = new Map<number, number>();
      const hours = new Map<number, number>();
      const services = new Map<string, number>();
      for (const row of sorted) {
        const date = new Date(row.starts_at);
        weekdays.set(date.getDay(), (weekdays.get(date.getDay()) ?? 0) + 1);
        hours.set(date.getHours(), (hours.get(date.getHours()) ?? 0) + 1);
        const name =
          demo.services.find((s) => s.id === row.service_id)?.name ??
          tNow("team.partner.serviceFallback");
        services.set(name, (services.get(name) ?? 0) + 1);
      }
      const top = (map: Map<number, number>) =>
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topService = [...services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const totalCents = completed.reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0);
      setProfile({
        customer_id: customerId,
        customer_name: demo.customers.find((c) => c.id === customerId)?.name ?? customerName,
        nickname: demo.shopClients.find((c) => c.profile_id === customerId)?.nickname ?? null,
        recurring: demo.series.some((row) => row.customer_id === customerId && row.active),
        avatar_url: null,
        visits: completed.length,
        total_spent_cents: totalCents,
        first_visit: sorted[0]?.starts_at ?? null,
        last_visit: sorted.at(-1)?.starts_at ?? null,
        rhythm: {
          sample: intervals.length,
          avg_return_days: intervals.length
            ? intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
            : null,
          preferred_weekday: top(weekdays) ?? null,
          preferred_hour: top(hours) ?? null,
          top_service: topService ?? null,
          avg_spend_cents: completed.length ? Math.round(totalCents / completed.length) : null,
        },
        history: rows
          .map((row) => ({
            appointment_id: row.id,
            starts_at: row.starts_at,
            service_name: demo.services.find((s) => s.id === row.service_id)?.name ?? null,
            staff_name: demo.staff.find((s) => s.id === row.staff_id)?.display_name ?? null,
            status: row.status,
            amount_cents: demo.prices[row.id] ?? 0,
          }))
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      });
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = await supabase.rpc("get_client_profile", {
          p_shop_id: shopId,
          p_customer_id: customerId,
        });
        if (cancelled) return;
        if (result.error) setError(true);
        else setProfile(result.data as unknown as ClientProfilePayload);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, shopId, customerId, customerName, retry]);

  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [intlLocale],
  );
  const dateOnly = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "short", year: "numeric" }),
    [intlLocale],
  );

  // A próxima visita (a mais perto no futuro) sai do histórico e ganha cartão próprio.
  const upcoming = useMemo(() => {
    if (!profile) return null;
    return (
      [...profile.history]
        .filter((row) => UPCOMING.has(row.status) && new Date(row.starts_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
    );
  }, [profile, now]);
  const past = profile?.history.filter((row) => row !== upcoming) ?? [];
  const name = profile?.customer_name ?? customerName ?? t("team.partner.clientFallback");
  // Apelido só existe com a migration nova (a chave vem no pacote) ou na demonstração.
  const nicknameReady = !!profile && (!!demo || "nickname" in profile);

  async function saveNickname(next: string | null) {
    if (demo) {
      demo.dispatch({
        type: "client.nickname",
        customerId,
        shopClientId: null,
        nickname: next,
      });
    } else {
      const { error: saveError } = await supabase.rpc("set_client_nickname", {
        p_shop_id: shopId,
        p_customer_id: customerId,
        p_shop_client_id: null,
        p_nickname: next ?? "",
      });
      if (saveError) throw saveError;
    }
    setProfile((current) => (current ? { ...current, nickname: next } : current));
    onChanged?.();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        desktopSide={desktopSide}
        size="lg"
        className="agenda-client-modal flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0"
      >
        <div className="flex items-center gap-3 border-b border-border p-4 pr-14">
          <PersonAvatar
            name={name.replace(/\([^)]*\)/g, "").trim() || name}
            src={profile?.avatar_url}
            seed={customerId}
            size="md"
          />
          <div className="min-w-0 flex-1">
            {/* Nome inteiro em até 2 linhas; a última visita aparece no caminho logo abaixo. */}
            <DialogTitle className="line-clamp-2 break-words text-base font-bold">
              {name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("team.profile.aria", { name })}
            </DialogDescription>
            {profile?.recurring && (
              <StatusBadge
                tone="highlight"
                icon={Repeat}
                size="sm"
                label={t("agenda.recurring.client")}
                className="mt-1"
              />
            )}
          </div>
          <ClientNoticeBell shopId={shopId} customerId={customerId} customerName={name} />
        </div>

        <div className="agenda-client-body dialog-scroll-area flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <LoadingState label={t("team.profile.loading")} variant="stats" count={2} />
          ) : error || !profile ? (
            <Notice
              tone="danger"
              title={t("team.profile.loadError")}
              action={{
                label: t("common.retry"),
                onClick: () => setRetry((n) => n + 1),
                icon: RefreshCw,
              }}
            />
          ) : (
            <>
              {/* Os dois blocos (resumo | histórico) ficam lado a lado a partir de 1024 px
                  (src/styles/agenda.css); antes disso, a mesma pilha de sempre. */}
              <div className="agenda-client-aside space-y-5">
                {nicknameReady && (
                  <NicknameEditor value={profile.nickname ?? null} onSave={saveNickname} />
                )}
                {upcoming && (
                  <section className="tone-info space-y-2 rounded-2xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-4">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[color:var(--tone-ink)]">
                      <CalendarClock className="size-4" aria-hidden />
                      {t("team.profile.next")}
                    </p>
                    <p className="text-lg font-extrabold text-foreground first-letter:uppercase">
                      {dateTime.format(new Date(upcoming.starts_at))}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
                      <span className="font-semibold">
                        {upcoming.service_name ?? t("team.partner.serviceFallback")}
                      </span>
                      {upcoming.staff_name && (
                        <span className="text-muted-foreground">
                          · {t("team.profile.with", { name: upcoming.staff_name })}
                        </span>
                      )}
                      {isStatus(upcoming.status) && (
                        <StatusBadge
                          tone={agendaMeta(upcoming.status).tone}
                          icon={agendaMeta(upcoming.status).icon}
                          label={t(agendaMeta(upcoming.status).labelKey)}
                          size="sm"
                        />
                      )}
                    </div>
                  </section>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    icon={Repeat}
                    label={
                      profile.visits === 1
                        ? t("team.profile.visitsShopOne")
                        : t("team.profile.visitsShopMany")
                    }
                    value={profile.visits}
                    hint={
                      ownVisits != null
                        ? t(
                            ownVisits === 1
                              ? "team.clients.withYouOne"
                              : "team.clients.withYouMany",
                            { count: ownVisits },
                          )
                        : t("team.profile.sinceStart")
                    }
                  />
                  <StatTile
                    icon={Wallet}
                    label={t("team.profile.totalSpent")}
                    value={formatBRL(profile.total_spent_cents, intlLocale)}
                    hint={t("team.profile.sinceStart")}
                  />
                </div>

                {(profile.first_visit || profile.last_visit || upcoming) && (
                  <ol
                    className="flex flex-wrap items-center gap-1.5 text-xs"
                    aria-label={t("team.profile.trail")}
                  >
                    {profile.first_visit && (
                      <li className="flex items-center gap-1.5">
                        <Tag icon={Flag}>
                          {t("team.profile.firstShort", {
                            date: dateOnly.format(new Date(profile.first_visit)),
                          })}
                        </Tag>
                      </li>
                    )}
                    {profile.last_visit && profile.last_visit !== profile.first_visit && (
                      <li className="flex items-center gap-1.5">
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                        <Tag icon={History}>
                          {t("team.profile.lastShort", {
                            date: dateOnly.format(new Date(profile.last_visit)),
                          })}
                        </Tag>
                      </li>
                    )}
                    {upcoming && (
                      <li className="flex items-center gap-1.5">
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                        <StatusBadge
                          tone="info"
                          icon={CalendarClock}
                          size="sm"
                          label={t("team.profile.nextShort", {
                            date: dateOnly.format(new Date(upcoming.starts_at)),
                          })}
                        />
                      </li>
                    )}
                  </ol>
                )}

                <RhythmDashboard
                  rhythm={profile.rhythm}
                  title={t("team.profile.rhythmTitle")}
                  dayLabel={t("team.profile.rhythmDay")}
                  subject="client"
                />
              </div>

              <div className="agenda-client-main space-y-5">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <History className="size-4 text-gold" aria-hidden />
                    {t("team.profile.history")}
                  </h3>
                  <HistoryList desktopSide={desktopSide} rows={past} dateTime={dateTime} />
                </section>
                {ownVisits != null && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Store className="size-3.5" aria-hidden />
                    {t("team.profile.shopWide")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ficha do cliente do balcão (sem conta no app): nome, apelido, WhatsApp informado pelo
 * barbeiro, avisos, visitas e o convite para se cadastrar (sem conta não há horário recorrente).
 */
function WalkInClientModal({
  desktopSide = false,
  shopId,
  shopClientId,
  customerName,
  publicOrigin,
  shopName,
  onClose,
  onChanged,
}: {
  shopId: string;
  shopClientId: string;
  customerName: string | null;
  desktopSide?: boolean;
  publicOrigin: string | null;
  shopName: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [client, setClient] = useState<WalkInPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [notifyState, setNotifyState] = useState<ActionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    if (demo) {
      const row = demo.shopClients.find((item) => item.id === shopClientId);
      if (!row) {
        setError(true);
        setLoading(false);
        return;
      }
      const rows = demo.appointments.filter((item) => item.shop_client_id === shopClientId);
      const completed = rows.filter((item) => item.status === "completed");
      setClient({
        shop_client_id: row.id,
        customer_id: row.profile_id,
        has_account: !!row.profile_id,
        name: row.full_name,
        nickname: row.nickname,
        whatsapp: row.whatsapp_e164,
        notify_whatsapp: row.notify_whatsapp,
        visits: completed.length,
        total_spent_cents: completed.reduce((sum, item) => sum + (demo.prices[item.id] ?? 0), 0),
        last_visit:
          completed
            .map((item) => item.starts_at)
            .sort()
            .at(-1) ?? null,
        history: rows
          .map((item) => ({
            appointment_id: item.id,
            starts_at: item.starts_at,
            service_name: demo.services.find((s) => s.id === item.service_id)?.name ?? null,
            staff_name: demo.staff.find((s) => s.id === item.staff_id)?.display_name ?? null,
            status: item.status,
            amount_cents: demo.prices[item.id] ?? 0,
          }))
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      });
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const result = await supabase.rpc("get_shop_client", {
          p_shop_id: shopId,
          p_shop_client_id: shopClientId,
        });
        if (cancelled) return;
        if (result.error || !result.data) setError(true);
        else setClient(result.data as unknown as WalkInPayload);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, shopId, shopClientId, retry]);

  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [intlLocale],
  );

  async function saveNickname(next: string | null) {
    if (demo) {
      demo.dispatch({
        type: "client.nickname",
        customerId: null,
        shopClientId,
        nickname: next,
      });
    } else {
      const { error: saveError } = await supabase.rpc("set_client_nickname", {
        p_shop_id: shopId,
        p_customer_id: null,
        p_shop_client_id: shopClientId,
        p_nickname: next ?? "",
      });
      if (saveError) throw saveError;
    }
    setClient((current) => (current ? { ...current, nickname: next } : current));
    onChanged?.();
  }

  async function toggleNotify(next: boolean) {
    if (!client) return;
    const previous = client.notify_whatsapp;
    setClient({ ...client, notify_whatsapp: next });
    setNotifyState("saving");
    try {
      if (demo) {
        demo.dispatch({ type: "client.update", id: shopClientId, notify_whatsapp: next });
      } else {
        const { error: saveError } = await supabase.rpc("update_shop_client", {
          p_shop_id: shopId,
          p_shop_client_id: shopClientId,
          p_notify: next,
        });
        if (saveError) throw saveError;
      }
      setNotifyState("saved");
    } catch {
      setClient((current) => (current ? { ...current, notify_whatsapp: previous } : current));
      setNotifyState("error");
    }
  }

  const shown = clientDisplay(client?.name ?? customerName, client?.nickname);
  const title = shown.primary ?? t("team.partner.clientFallback");
  const phone = client?.whatsapp ? formatSignupPhone(client.whatsapp) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        desktopSide={desktopSide}
        size="lg"
        className="agenda-client-modal flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0"
      >
        <div className="flex items-center gap-3 border-b border-border p-4 pr-14">
          <PersonAvatar name={title} seed={shopClientId} size="md" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="line-clamp-2 break-words text-base font-bold">
              {title}
            </DialogTitle>
            {shown.secondary && (
              <p className="break-words text-sm text-muted-foreground">{shown.secondary}</p>
            )}
            <DialogDescription className="sr-only">
              {t("team.profile.aria", { name: title })}
            </DialogDescription>
            <Tag icon={ContactRound} className="mt-1">
              {t("agenda.client.walkIn")}
            </Tag>
          </div>
        </div>

        <div className="agenda-client-body dialog-scroll-area flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <LoadingState label={t("team.profile.loading")} variant="stats" count={2} />
          ) : error || !client ? (
            <Notice
              tone="danger"
              title={t("team.profile.loadError")}
              action={{
                label: t("common.retry"),
                onClick: () => setRetry((n) => n + 1),
                icon: RefreshCw,
              }}
            />
          ) : (
            <>
              <div className="agenda-client-aside space-y-5">
                <NicknameEditor value={client.nickname} onSave={saveNickname} />

                {phone && client.whatsapp && (
                  <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-3">
                    <a
                      href={whatsappLink(client.whatsapp, "")}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center gap-2 text-sm font-semibold"
                    >
                      <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden />
                      <span className="tabular-nums">{phone}</span>
                      <span className="text-xs font-medium text-muted-foreground">
                        · {t("client.walkIn.openChat")}
                      </span>
                    </a>
                    <label className="flex min-h-11 items-center gap-3">
                      <BellRing className="size-4 shrink-0 text-gold" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{t("bk.notify")}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t("bk.notifyHint")}
                        </span>
                      </span>
                      <Switch
                        checked={client.notify_whatsapp}
                        onCheckedChange={(value) => void toggleNotify(value)}
                        aria-label={t("bk.notify")}
                      />
                    </label>
                    <InlineStatus state={notifyState} onRetry={() => setNotifyState(null)} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    icon={Repeat}
                    label={
                      client.visits === 1
                        ? t("team.profile.visitsShopOne")
                        : t("team.profile.visitsShopMany")
                    }
                    value={client.visits}
                    hint={t("team.profile.sinceStart")}
                  />
                  <StatTile
                    icon={Wallet}
                    label={t("team.profile.totalSpent")}
                    value={formatBRL(client.total_spent_cents, intlLocale)}
                    hint={t("team.profile.sinceStart")}
                  />
                </div>

                <InviteCard
                  whatsappE164={client.whatsapp}
                  clientName={client.name}
                  shopName={shopName}
                  publicOrigin={publicOrigin}
                  context="profile"
                />
              </div>

              <div className="agenda-client-main">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <History className="size-4 text-gold" aria-hidden />
                    {t("team.profile.history")}
                  </h3>
                  <HistoryList
                    desktopSide={desktopSide}
                    rows={client.history}
                    dateTime={dateTime}
                  />
                </section>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
