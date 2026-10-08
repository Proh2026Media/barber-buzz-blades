import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Hourglass,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AttentionList,
  ChoiceChips,
  CountBadge,
  Countdown,
  EmptyState,
  LoadingState,
  Notice,
  PersonAvatar,
  StatusBadge,
  type AttentionItem,
} from "@/components/visual";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDemo } from "@/features/demo/context";
import { BusinessInsights } from "@/features/insights/BusinessInsights";
import { CancellationDialog } from "@/features/insights/CancellationDialog";
import type { CancellationReason } from "@/features/insights/cancellation";
import { StaffSurveyDialog } from "@/features/insights/StaffSurveyDialog";
import { ClientProfileModal } from "@/features/shop/ClientProfileModal";
import { canHold } from "@/features/waiting/model";
import type { WaitingController } from "@/features/waiting/useWaiting";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { shopDateTime, shopDayRange } from "@/lib/shop/appointments";
import { cn } from "@/lib/utils";
import { AgendaDayNav } from "./AgendaDayNav";
import { AgendaInsights } from "./AgendaInsights";
import { AppointmentCard, WaitPanel, type CardHandlers } from "./AppointmentCard";
import { BlockRow, ClosedRow } from "./blocks";
import { DaySummary } from "./DaySummary";
import { CompleteEarlyDialog, StopSeriesDialog, WithdrawDialog } from "./dialogs";
import {
  buildTimeline,
  countGroups,
  dayOffset,
  freeGaps,
  groupOf,
  happeningNow,
  minutesUntil,
  moneyOf,
  nextUp,
  weekdayOf,
  type AgendaGroup,
  type Interval,
} from "./model";
import { AppointmentSummary, useShopTime } from "./summary";
import { useDesktop } from "./board";
import { TeamDayBoard } from "./TeamDayBoard";
import {
  AGENDA_STATE,
  type AgendaBlock,
  type CancellationDetail,
  type CardFeedback,
  type DayAppointment,
} from "./types";

const MINUTE = 60_000;

/**
 * Cópia local idêntica do bloco "livre" da mini agenda comum (Timeline em components/visual):
 * borda verde contínua com ✓, a mesma cara em Ajustes, Horários e Agenda. Se a Timeline mudar,
 * mudar aqui também. O "Bloqueado" usa a faixa listrada de Horários (ver blocks.tsx).
 */
const TIMELINE_LOOK = {
  free: "tone-success border-2 border-[color:var(--tone-line)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]",
} as const;

export type AgendaExtra = {
  id: string;
  icon: LucideIcon;
  label: string;
  content: ReactNode;
  /**
   * Pendências da seção: aparece como bolha no atalho do topo. Com 0 o atalho some (a seção
   * continua montada, para a contagem se atualizar); sem valor, o atalho aparece sempre.
   */
  count?: number;
  countLabel?: string;
  /**
   * Seção larga (carteira do parceiro): no computador ocupa a largura toda, abaixo das duas
   * colunas, em vez de alongar só a coluna da lista.
   */
  wide?: boolean;
};

/*
 * Atalhos (AgendaExtra): no computador as seções ficam na página, abaixo da lista, e o atalho
 * rola até elas. No celular cada uma abre numa janela própria, sem perder o lugar na agenda; as
 * que têm `count` (mesmo indefinido) ficam montadas escondidas, para a bolha se atualizar.
 */

export type AgendaActions = {
  /** Grava a nova situação; falha lança erro (o cartão mostra o problema). */
  setStatus: (row: DayAppointment, status: Tables<"appointments">["status"]) => Promise<void>;
  cancel: (row: DayAppointment, reason: CancellationReason | null) => Promise<void>;
  stopSeries: (seriesId: string) => Promise<void>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/**
 * No computador, a coluna da esquerda (troca de dia, atenção, "Seu dia") acompanha a rolagem
 * só quando cabe inteira entre o cabeçalho fixo e a barra de navegação flutuante. Se não couber
 * (tela baixa, "Mais números" aberto), rola junto com a página: nada fica escondido nem atrás
 * da barra, e não há rolagem dentro da coluna. Devolve o `top` em px, ou `null` sem fixar.
 */
function useStickyWhenFits(ref: RefObject<HTMLElement | null>) {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const GAP = 16;
    const measure = () => {
      if (!desktop.matches) return setTop(null);
      const header = element.closest("main")?.parentElement?.querySelector(":scope > header");
      const headerBottom = header ? header.getBoundingClientRect().height : 0;
      const nav = document.querySelector(".app-mobile-nav");
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      const room = navTop - headerBottom - GAP * 2;
      setTop(element.offsetHeight <= room ? Math.round(headerBottom + GAP) : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    desktop.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      desktop.removeEventListener("change", measure);
    };
  }, [ref]);
  return top;
}

/**
 * Aba Agenda do painel da barbearia. Tudo o que aparece (números do dia, pílulas de filtro,
 * valores, "Precisa da sua atenção" e a linha do tempo) sai da MESMA lista carregada, no mesmo
 * escopo ("Minha agenda"/"Equipe"), dia e fuso da loja.
 */
export function AgendaTab({
  shopId,
  timeZone,
  actor,
  canSeeTeam,
  canViewMoney,
  canManageOperations,
  onOpenHours,
  day,
  today,
  onDayChange,
  loading,
  error,
  refreshing,
  onRefresh,
  revision,
  appointments,
  staff,
  services,
  businessHours,
  blocks,
  settings,
  cancellationDetails,
  waiting,
  updating,
  actions,
  setup,
  extras = [],
  focusStaffId,
}: {
  shopId: string;
  timeZone: string;
  actor: { role: "owner" | "partner" | "associate" | "employee"; staff_id: string | null } | null;
  /** Pode ver a agenda da equipe toda. */
  canSeeTeam: boolean;
  canViewMoney: boolean;
  canManageOperations: boolean;
  onOpenHours: () => void;
  day: string;
  today: string;
  onDayChange: (day: string) => void;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  /** `null` na demonstração (não há o que atualizar). */
  onRefresh: (() => void) | null;
  revision: number;
  appointments: DayAppointment[];
  staff: Tables<"staff">[];
  services: Tables<"services">[];
  businessHours: Tables<"business_hours">[];
  blocks: AgendaBlock[];
  settings: Tables<"barbershop_settings"> | null;
  cancellationDetails: Record<string, CancellationDetail>;
  waiting: WaitingController;
  /** Alguma gravação da Agenda em andamento (pausa a atualização automática). */
  updating: boolean;
  actions: AgendaActions;
  setup?: ReactNode;
  extras?: AgendaExtra[];
  /** Abre já filtrada por um profissional ("Ver agenda dele", em Equipe). */
  focusStaffId?: string | null;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const time = useShopTime(timeZone);
  const [scope, setScope] = useState<"mine" | "team">(
    focusStaffId && focusStaffId !== actor?.staff_id ? "team" : "mine",
  );
  const [statusFilter, setStatusFilter] = useState<AgendaGroup | "">("");
  const [staffFilter, setStaffFilter] = useState(
    focusStaffId && focusStaffId !== actor?.staff_id ? focusStaffId : "",
  );
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, CardFeedback>>({});
  const [withdrawTarget, setWithdrawTarget] = useState<DayAppointment | null>(null);
  const [seriesTarget, setSeriesTarget] = useState<DayAppointment | null>(null);
  const [earlyTarget, setEarlyTarget] = useState<DayAppointment | null>(null);
  const [surveyTarget, setSurveyTarget] = useState<DayAppointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DayAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [profileTarget, setProfileTarget] = useState<DayAppointment | null>(null);
  const [boardTarget, setBoardTarget] = useState<string | null>(null);
  const [openExtra, setOpenExtra] = useState<string | null>(null);
  const desktop = useDesktop();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const now = demo?.now ? demo.now.getTime() : clock;
  const sideRef = useRef<HTMLDivElement>(null);
  const sideTop = useStickyWhenFits(sideRef);

  // "Minha agenda" só existe para quem atende clientes; sem perfil de profissional a lista já
  // é a da barbearia inteira.
  const hasOwnAgenda = !!actor?.staff_id;
  const effectiveScope = canSeeTeam && hasOwnAgenda ? scope : hasOwnAgenda ? "mine" : "team";
  const showStaff = effectiveScope === "team";
  const showStaffFilter = showStaff && staff.length > 1;
  const activeStaffFilter = showStaffFilter ? staffFilter : "";

  // Trocar de dia ou de escopo limpa o filtro de situação (as contagens mudam).
  useEffect(() => {
    setStatusFilter("");
  }, [day, effectiveScope]);

  const scoped = useMemo(
    () =>
      appointments.filter(
        (row) => effectiveScope === "team" || !actor?.staff_id || row.staff_id === actor.staff_id,
      ),
    [appointments, effectiveScope, actor?.staff_id],
  );
  const query = normalize(search);
  // O resumo do dia ("Seu dia", atenção, valores) segue o escopo e o profissional escolhido,
  // que mudam o título; a busca por nome só filtra a lista, para o resumo não encolher calado.
  const daySet = activeStaffFilter
    ? scoped.filter((row) => row.staff_id === activeStaffFilter)
    : scoped;
  const base = query
    ? daySet.filter((row) =>
        normalize(`${row.customer?.full_name ?? ""} ${row.service?.name ?? ""}`).includes(query),
      )
    : daySet;
  const counts = countGroups(daySet, now);
  const visible = base.filter((row) => !statusFilter || groupOf(row, now) === statusFilter);
  const filtered = !!statusFilter || !!query || !!activeStaffFilter;
  const isToday = day === today;
  const offset = dayOffset(day, today);
  const money = canViewMoney ? moneyOf(daySet, (row) => row.service?.price_cents ?? 0) : null;
  const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
    });

  const fullRows = daySet.filter((row) => row.visibility !== "busy");
  const next = isToday ? nextUp(fullRows, now) : null;
  const current = isToday ? happeningNow(fullRows, now) : [];
  const staffById = new Map(staff.map((member) => [member.id, member]));
  const serviceIconFor = (row: DayAppointment) =>
    (
      services.find((service) => service.id === row.service_id) ??
      services.find((service) => service.name === row.service?.name)
    )?.icon ?? null;

  // Linha do tempo: horários livres só fazem sentido para UM profissional por vez.
  const hours = businessHours.find((row) => row.weekday === weekdayOf(day));
  const closedWeekdays = useMemo(
    () => new Set(businessHours.filter((row) => !row.is_open).map((row) => row.weekday)),
    [businessHours],
  );
  const singleProfessional =
    activeStaffFilter ||
    (effectiveScope === "mine" && actor?.staff_id) ||
    (staff.filter((member) => member.active).length === 1
      ? (staff.find((member) => member.active)?.id ?? "")
      : "");
  const range = shopDayRange(day, timeZone);
  const dayBlocks = blocks.filter(
    (block) =>
      Date.parse(block.starts_at) < range.end.getTime() &&
      Date.parse(block.ends_at) > range.start.getTime() &&
      (!block.staff_id ||
        (singleProfessional ? block.staff_id === singleProfessional : effectiveScope === "team")),
  );
  let gaps: Interval[] = [];
  if (singleProfessional && hours?.is_open && offset >= 0) {
    const open = shopDateTime(day, hours.opens_at, timeZone).getTime();
    const close = shopDateTime(day, hours.closes_at, timeZone).getTime();
    const busy: Interval[] = [
      // Quem aguarda o cliente remarcar só ocupa o horário enquanto a espera estiver valendo.
      ...daySet
        .filter(
          (row) =>
            row.status !== "cancelled" &&
            (row.status !== "reschedule_requested" ||
              waiting.waits.some((wait) => wait.appointment_id === row.id)),
        )
        .map((row) => [Date.parse(row.starts_at), Date.parse(row.ends_at)] as Interval),
      ...dayBlocks.map(
        (block) => [Date.parse(block.starts_at), Date.parse(block.ends_at)] as Interval,
      ),
    ];
    // Hoje, o que já passou não é horário livre: começa na próxima marca de 5 minutos.
    const from = isToday ? Math.max(open, Math.ceil(now / (5 * MINUTE)) * 5 * MINUTE) : open;
    gaps = freeGaps(busy, from, close, 30);
  }
  const timelineRows = filtered ? visible : visible.filter((row) => row.status !== "cancelled");
  const cancelledRows = filtered ? [] : visible.filter((row) => row.status === "cancelled");
  const timeline = buildTimeline(
    timelineRows,
    filtered
      ? []
      : dayBlocks.map((block) => ({
          key: `block-${block.id}`,
          at: Date.parse(block.starts_at),
          end: Date.parse(block.ends_at),
          item: block,
        })),
    filtered ? [] : gaps,
    isToday && !filtered ? now : null,
  );
  const openSpan = hours?.is_open
    ? {
        start: shopDateTime(day, hours.opens_at, timeZone).getTime(),
        end: shopDateTime(day, hours.closes_at, timeZone).getTime(),
      }
    : null;
  const daySpan = { start: range.start.getTime(), end: range.end.getTime() };
  // Computador, visão da equipe toda: uma coluna por profissional (no celular, a lista).
  const boardStaff = staff.filter(
    (member) => member.active || daySet.some((row) => row.staff_id === member.id),
  );
  const boardMode =
    desktop &&
    showStaff &&
    !activeStaffFilter &&
    boardStaff.length > 1 &&
    statusFilter !== "cancelled";
  const boardRow = boardTarget
    ? (appointments.find((row) => row.id === boardTarget) ?? null)
    : null;

  // Esperas do dia, no mesmo escopo da lista ("Minha agenda" mostra só as suas).
  const dayWaits = waiting.waits.filter(
    (wait) =>
      Date.parse(wait.starts_at) >= range.start.getTime() &&
      Date.parse(wait.starts_at) <= range.end.getTime() &&
      (effectiveScope === "team" || !actor?.staff_id || wait.staff_id === actor.staff_id) &&
      (!activeStaffFilter || wait.staff_id === activeStaffFilter),
  );
  const shownIds = new Set(timelineRows.map((row) => row.id));
  const orphanWaits = dayWaits.filter(
    (wait) => !wait.appointment_id || !shownIds.has(wait.appointment_id),
  );

  function jumpTo(id: string) {
    if (statusFilter || query || activeStaffFilter) {
      setStatusFilter("");
      setSearch("");
      setStaffFilter("");
    }
    window.setTimeout(() => {
      const element = document.getElementById(`agenda-row-${id}`);
      if (!element) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      element.focus({ preventScroll: true });
    }, 60);
  }
  function showList(group: AgendaGroup | "") {
    setStatusFilter(group);
    window.setTimeout(() => {
      const list = document.getElementById("agenda-list");
      if (!list) return;
      const rect = list.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < window.innerHeight * 0.6) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      list.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }, 60);
  }
  function clearFilters() {
    setStatusFilter("");
    setStaffFilter("");
    setSearch("");
    setSearchOpen(false);
  }

  const nameOf = (row: DayAppointment) => row.customer?.full_name ?? t("shop.customerFallback");

  async function runStatus(row: DayAppointment, action: CardFeedback["action"]) {
    setFeedback((value) => ({ ...value, [row.id]: { action, state: "saving" } }));
    try {
      await actions.setStatus(row, action === "confirm" ? "confirmed" : "completed");
      setFeedback((value) => {
        const nextValue = { ...value };
        delete nextValue[row.id];
        return nextValue;
      });
      toast.success(
        t(action === "confirm" ? "agenda.toast.confirmed" : "agenda.toast.completed", {
          name: nameOf(row),
          time: time(row.starts_at),
        }),
      );
    } catch {
      setFeedback((value) => ({ ...value, [row.id]: { action, state: "error" } }));
    }
  }

  const saving = Object.values(feedback).some((item) => item.state === "saving");
  const locked = updating || saving || cancelBusy;

  const handlers: CardHandlers = {
    onConfirm: (row) => void runStatus(row, "confirm"),
    onComplete: (row) => {
      if (now < Date.parse(row.starts_at)) setEarlyTarget(row);
      else void runStatus(row, "complete");
    },
    onWithdraw: setWithdrawTarget,
    onCancel: (row) => {
      setCancelError(null);
      setCancelReason("");
      setCancelTarget(row);
    },
    onStopSeries: setSeriesTarget,
    onSurvey: setSurveyTarget,
    onRetry: (row) => {
      const last = feedback[row.id];
      if (last) void runStatus(row, last.action);
    },
    onRestoreWait: (waitId) =>
      void waiting.act(waitId, "restore").then((ok) => {
        if (!ok) return;
        toast.success(t("agenda.toast.restored"));
        onRefresh?.();
      }),
    onChanged: () => onRefresh?.(),
    onOpenClient: setProfileTarget,
  };

  async function confirmCancel() {
    const row = cancelTarget;
    if (!row || cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await actions.cancel(row, cancelReason || null);
      setCancelTarget(null);
      setCancelReason("");
      toast.success(t("agenda.toast.cancelled", { name: nameOf(row), time: time(row.starts_at) }));
    } catch {
      setCancelError(t("shop.error.cancelAppointment"));
    } finally {
      setCancelBusy(false);
    }
  }

  const attention: AttentionItem[] = [];
  if (counts.unresolved > 0) {
    attention.push({
      id: "unresolved",
      tone: AGENDA_STATE.unresolved.tone,
      icon: AGENDA_STATE.unresolved.icon ?? Clock3,
      title: t(
        counts.unresolved === 1
          ? "agenda.attention.unresolvedOne"
          : "agenda.attention.unresolvedMany",
        { count: counts.unresolved },
      ),
      action: { label: t("agenda.attention.resolve"), onClick: () => showList("unresolved") },
    });
  }
  if (counts.pending > 0) {
    attention.push({
      id: "pending",
      tone: AGENDA_STATE.pending.tone,
      icon: AGENDA_STATE.pending.icon ?? Hourglass,
      title: t(
        counts.pending === 1 ? "agenda.attention.pendingOne" : "agenda.attention.pendingMany",
        { count: counts.pending },
      ),
      // O toque leva até os horários (com o botão Confirmar em cada um); não confirma sozinho.
      action: {
        label: t("agenda.attention.seePending"),
        icon: ListChecks,
        onClick: () => {
          const only =
            counts.pending === 1 ? daySet.find((row) => groupOf(row, now) === "pending") : null;
          if (only && !query && !activeStaffFilter) jumpTo(only.id);
          else showList("pending");
        },
      },
    });
  }
  for (const wait of dayWaits) {
    const holding = Date.parse(wait.hold_until) > +waiting.now;
    const deadline = holding ? wait.hold_until : wait.claim_until;
    attention.push({
      id: `wait-${wait.id}`,
      tone: "pending",
      icon: Timer,
      title: t("agenda.attention.wait", {
        time: time(wait.starts_at),
        name: staffById.get(wait.staff_id)?.display_name ?? t("wait.card.staffFallback"),
      }),
      aside: <Countdown endsAt={Date.now() + (Date.parse(deadline) - +waiting.now)} />,
      action: {
        label: t("agenda.attention.see"),
        onClick: () =>
          wait.appointment_id && shownIds.has(wait.appointment_id)
            ? jumpTo(wait.appointment_id)
            : showList(""),
      },
    });
  }

  const filteredMember = activeStaffFilter ? staffById.get(activeStaffFilter) : undefined;
  const summaryTitle = filteredMember
    ? t("agenda.summary.titleStaff", { name: filteredMember.display_name })
    : !hasOwnAgenda
      ? t("agenda.summary.titleShop")
      : effectiveScope === "team"
        ? t("agenda.summary.titleTeam")
        : t("agenda.summary.titleMine");
  // Sem conseguir ler a agenda não dá para dizer que o dia está livre: mostra só o erro.
  const loadFailed = !!error && !loading && scoped.length === 0;
  const emptyDay = !loading && !error && scoped.length === 0;
  const closedDay = hours ? !hours.is_open : false;
  const backToday =
    offset !== 0 ? (
      <button
        type="button"
        onClick={() => onDayChange(today)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40"
      >
        <RotateCcw className="size-4" aria-hidden />
        {t("agenda.day.backTodayLong")}
      </button>
    ) : null;

  const activeFilterText = [
    statusFilter ? t(AGENDA_STATE[statusFilter].labelKey) : null,
    activeStaffFilter ? staffById.get(activeStaffFilter)?.display_name : null,
    query ? `“${search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const holdFor = (row: DayAppointment) =>
    !!settings &&
    canHold(row.starts_at, waiting.now, settings.waiting_enabled, settings.waiting_cutoff_minutes);

  return (
    <section className="mb-stagger space-y-4">
      <div className="app-section-title">
        <Calendar />
        <h2>{t("shop.nav.agenda")}</h2>
        {onRefresh && (
          <button
            type="button"
            disabled={refreshing || locked}
            onClick={onRefresh}
            className="ml-auto flex min-h-11 items-center gap-2 px-1 text-xs font-semibold text-muted-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "motion-safe:animate-spin")}
              aria-hidden
            />
            {refreshing ? t("shop.agenda.refreshing") : t("shop.agenda.refresh")}
          </button>
        )}
      </div>

      {setup}

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,24.5rem)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div
          ref={sideRef}
          className="space-y-4 lg:p-1"
          style={sideTop !== null ? { position: "sticky", top: sideTop } : undefined}
        >
          <div className="agenda-toolbar app-action-card p-3 sm:p-4">
            {canSeeTeam && hasOwnAgenda && (
              <div className="agenda-scope" role="group" aria-label={t("shop.agenda.scopeAria")}>
                <button
                  type="button"
                  aria-pressed={effectiveScope === "mine"}
                  onClick={() => setScope("mine")}
                >
                  <Calendar className="size-4" aria-hidden />
                  {t("shop.agenda.mine")}
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveScope === "team"}
                  onClick={() => setScope("team")}
                >
                  <Users className="size-4" aria-hidden />
                  {t("shop.nav.team")}
                </button>
              </div>
            )}
            <AgendaDayNav
              day={day}
              today={today}
              onChange={onDayChange}
              closedWeekdays={closedWeekdays}
            />
          </div>

          {!emptyDay && !loadFailed && !loading && (
            <AttentionList items={attention} headingLevel="h3" />
          )}

          {loading && !scoped.length ? (
            <LoadingState variant="stats" count={2} hideLabel />
          ) : (
            !emptyDay &&
            !loadFailed && (
              <DaySummary
                title={summaryTitle}
                person={
                  filteredMember
                    ? {
                        id: filteredMember.id,
                        name: filteredMember.display_name,
                        photo: filteredMember.avatar_url,
                      }
                    : null
                }
                counts={counts}
                filter={statusFilter}
                onFilter={showList}
                future={offset > 0}
                today={isToday}
                current={current.map((row) => ({
                  id: row.id,
                  time: time(row.starts_at),
                  name: nameOf(row),
                }))}
                next={
                  next
                    ? {
                        id: next.id,
                        time: time(next.starts_at),
                        name: nameOf(next),
                        minutes: minutesUntil(next.starts_at, now),
                      }
                    : null
                }
                onJump={jumpTo}
                money={money}
                formatMoney={formatMoney}
                details={
                  actor ? (
                    <AgendaInsights
                      shopId={shopId}
                      day={day}
                      revision={revision}
                      timeZone={timeZone}
                      staffId={actor.staff_id}
                      role={actor.role}
                      listCustomers={
                        new Set(
                          daySet
                            .filter((row) => row.visibility !== "busy")
                            .map((row) => row.customer_id),
                        ).size
                      }
                    />
                  ) : (
                    <BusinessInsights
                      shopId={shopId}
                      day={day}
                      revision={revision}
                      timeZone={timeZone}
                      embedded
                    />
                  )
                }
              />
            )
          )}

          {extras.some((extra) => extra.count !== 0) && (
            <div role="group" aria-label={t("agenda.extras.aria")} className="flex flex-wrap gap-2">
              {extras
                .filter((extra) => extra.count !== 0)
                .map((extra) => {
                  const Icon = extra.icon;
                  return (
                    <a
                      key={extra.id}
                      href={`#agenda-extra-${extra.id}`}
                      // No celular abre a janela da seção; a âncora continua valendo (a lista de
                      // clientes abre sozinha por ela).
                      onClick={() => {
                        if (!desktop) setOpenExtra(extra.id);
                      }}
                      aria-haspopup={desktop ? undefined : "dialog"}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
                    >
                      <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                      {extra.label}
                      {extra.count ? (
                        <CountBadge count={extra.count} label={extra.countLabel} />
                      ) : null}
                    </a>
                  );
                })}
            </div>
          )}
        </div>

        {/* Coluna da direita: a lista do dia e, logo abaixo, as seções extras (sugestões,
            clientes), na mesma largura da lista. A carteira do parceiro (larga) vem depois das
            duas colunas. */}
        <div className="min-w-0 space-y-6">
          <div id="agenda-list" className="scroll-mt-24 space-y-3">
            {error && !loadFailed && (
              <Notice
                tone="danger"
                title={error}
                action={
                  onRefresh
                    ? { label: t("visual.retry"), onClick: onRefresh, icon: RotateCcw }
                    : undefined
                }
              />
            )}
            {waiting.error && <Notice tone="danger" title={waiting.error} />}

            {loading && !scoped.length ? (
              <LoadingState label={t("agenda.loading")} />
            ) : loadFailed ? (
              <EmptyState
                status="danger"
                title={t("agenda.loadError.title")}
                description={error}
                action={
                  onRefresh ? (
                    <button
                      type="button"
                      disabled={refreshing}
                      onClick={onRefresh}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      <RotateCcw
                        className={cn("size-4", refreshing && "motion-safe:animate-spin")}
                        aria-hidden
                      />
                      {t("visual.retry")}
                    </button>
                  ) : undefined
                }
                secondaryAction={backToday}
              />
            ) : emptyDay ? (
              <EmptyState
                tone={closedDay ? "store" : "calendar"}
                title={
                  closedDay
                    ? t("agenda.empty.closed")
                    : offset < 0
                      ? t("agenda.empty.past")
                      : t("agenda.empty.free")
                }
                description={closedDay || offset < 0 ? undefined : t("agenda.empty.freeHint")}
                action={
                  closedDay && canManageOperations ? (
                    <button
                      type="button"
                      onClick={onOpenHours}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      <Clock3 className="size-4" aria-hidden />
                      {t("agenda.empty.seeHours")}
                    </button>
                  ) : (
                    backToday
                  )
                }
                secondaryAction={closedDay && canManageOperations ? backToday : undefined}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold">
                    <ListChecks className="size-5 shrink-0 text-gold" aria-hidden />
                    {t("agenda.list.title")}
                    <span role="status" className="text-sm font-semibold text-muted-foreground">
                      {t(base.length === 1 ? "shop.agenda.countOne" : "shop.agenda.countMany", {
                        shown: visible.length,
                        total: base.length,
                      })}
                    </span>
                  </h3>
                  <button
                    type="button"
                    aria-expanded={searchOpen || !!search}
                    aria-controls="agenda-search"
                    aria-label={t("shop.agenda.searchLabel")}
                    title={t("shop.agenda.searchLabel")}
                    onClick={() => setSearchOpen((value) => !value)}
                    className={cn("app-icon-button", (searchOpen || search) && "ring-2 ring-gold")}
                  >
                    <Search className="size-5" aria-hidden />
                  </button>
                </div>
                {(searchOpen || search) && (
                  <label id="agenda-search" className="relative block">
                    <span className="sr-only">{t("shop.agenda.searchLabel")}</span>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      type="search"
                      // A busca abre por pedido da pessoa: o foco vai direto ao campo.
                      autoFocus={searchOpen && !search}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("shop.agenda.searchPlaceholder")}
                      className="min-h-11 w-full rounded-xl border border-border bg-card py-2 pl-10 pr-3 text-sm"
                    />
                  </label>
                )}
                {showStaffFilter && (
                  <ChoiceChips
                    label={t("shop.staffFallback")}
                    icon={Users}
                    hideLabel
                    scroll
                    value={staffFilter}
                    onChange={setStaffFilter}
                    options={[
                      { value: "", label: t("shop.agenda.allTeam") },
                      ...staff.map((member) => ({
                        value: member.id,
                        label: member.display_name,
                        media: (
                          <PersonAvatar
                            name={member.display_name}
                            src={member.avatar_url}
                            seed={member.id}
                            size="xs"
                          />
                        ),
                      })),
                    ]}
                  />
                )}
                {filtered && (
                  <div className="flex flex-wrap items-center gap-2">
                    {statusFilter && (
                      <StatusBadge
                        tone={AGENDA_STATE[statusFilter].tone}
                        icon={AGENDA_STATE[statusFilter].icon}
                        label={t(AGENDA_STATE[statusFilter].labelKey)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
                    >
                      <X className="size-4" aria-hidden />
                      {t("agenda.filter.clear")}
                    </button>
                  </div>
                )}

                {orphanWaits.map((wait) => (
                  <WaitPanel
                    key={wait.id}
                    wait={wait}
                    now={waiting.now}
                    busy={waiting.busy}
                    onRestore={handlers.onRestoreWait}
                    heading={`${time(wait.starts_at)} · ${
                      staffById.get(wait.staff_id)?.display_name ?? t("wait.card.staffFallback")
                    }`}
                  />
                ))}

                {closedDay && visible.length > 0 && !boardMode && <ClosedRow />}

                {visible.length === 0 ? (
                  <EmptyState
                    tone="search"
                    title={t("agenda.empty.filtered")}
                    description={activeFilterText}
                    action={
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      >
                        <X className="size-4" aria-hidden />
                        {t("agenda.filter.clear")}
                      </button>
                    }
                  />
                ) : boardMode ? (
                  <TeamDayBoard
                    dayStart={daySpan.start}
                    dayEnd={daySpan.end}
                    timeZone={timeZone}
                    rows={visible.filter((row) => row.status !== "cancelled")}
                    staff={boardStaff}
                    blocks={dayBlocks}
                    open={openSpan}
                    now={isToday ? now : null}
                    nextId={next?.id ?? null}
                    waitIds={
                      new Set(
                        dayWaits.flatMap((wait) =>
                          wait.appointment_id ? [wait.appointment_id] : [],
                        ),
                      )
                    }
                    serviceIconFor={serviceIconFor}
                    onOpen={(row) => setBoardTarget(row.id)}
                  />
                ) : (
                  <ol className="space-y-2.5" aria-label={t("shop.agenda.listAria")}>
                    {timeline.map((entry) => {
                      if (entry.kind === "now") {
                        return (
                          <li
                            key="now"
                            className="flex items-center gap-2 py-0.5 text-xs font-extrabold text-gold"
                          >
                            <span className="tabular-nums">
                              {t("agenda.now", { time: time(entry.at) })}
                            </span>
                            <span aria-hidden className="h-0.5 flex-1 rounded-full bg-gold" />
                          </li>
                        );
                      }
                      if (entry.kind === "gap") {
                        const minutes = Math.round((entry.end - entry.at) / MINUTE);
                        return (
                          // Fundo do cartão por baixo: no tema escuro a faixa segue off-white.
                          <li key={entry.key} className="rounded-2xl bg-card">
                            <div
                              className={cn(
                                TIMELINE_LOOK.free,
                                "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold",
                              )}
                            >
                              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                              <span className="min-w-0 flex-1">{t("agenda.gap")}</span>
                              <span className="tabular-nums">
                                {time(entry.at)}–{time(entry.end)}
                              </span>
                              <span className="text-xs font-semibold opacity-80">
                                {minutes >= 60
                                  ? t("agenda.hours", {
                                      hours: Math.floor(minutes / 60),
                                      minutes: String(minutes % 60).padStart(2, "0"),
                                    })
                                  : t("agenda.minutes", { minutes })}
                              </span>
                            </div>
                          </li>
                        );
                      }
                      if (entry.kind === "block") {
                        return (
                          <li key={entry.key}>
                            <BlockRow
                              block={entry.item}
                              timeZone={timeZone}
                              day={daySpan}
                              open={openSpan}
                              showWho={showStaff}
                              photo={
                                entry.item.staff_id
                                  ? staffById.get(entry.item.staff_id)?.avatar_url
                                  : null
                              }
                            />
                          </li>
                        );
                      }
                      const row = entry.item;
                      return (
                        <li key={entry.key}>
                          <AppointmentCard
                            row={row}
                            now={now}
                            timeZone={timeZone}
                            showStaff={showStaff}
                            staffPhoto={staffById.get(row.staff_id)?.avatar_url}
                            serviceIcon={serviceIconFor(row)}
                            nextMinutes={
                              next?.id === row.id ? minutesUntil(row.starts_at, now) : undefined
                            }
                            cancellation={cancellationDetails[row.id]}
                            waits={dayWaits.filter((wait) => wait.appointment_id === row.id)}
                            waitNow={waiting.now}
                            waitBusy={waiting.busy}
                            feedback={feedback[row.id]}
                            locked={locked}
                            loyalty={!!settings?.loyalty_enabled}
                            survey={settings?.survey_program_enabled !== false}
                            handlers={handlers}
                          />
                        </li>
                      );
                    })}
                  </ol>
                )}

                {cancelledRows.length > 0 && (
                  <details className="group space-y-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <StatusBadge
                        tone={AGENDA_STATE.cancelled.tone}
                        icon={AGENDA_STATE.cancelled.icon}
                        label={t(
                          cancelledRows.length === 1
                            ? "agenda.cancelled.groupOne"
                            : "agenda.cancelled.groupMany",
                          { count: cancelledRows.length },
                        )}
                        size="sm"
                      />
                      <span className="group-open:hidden">{t("agenda.cancelled.show")}</span>
                      <span className="hidden group-open:inline">{t("agenda.cancelled.hide")}</span>
                    </summary>
                    <ol className="space-y-2" aria-label={t("agenda.cancelled.aria")}>
                      {cancelledRows.map((row) => (
                        <li key={row.id}>
                          <AppointmentCard
                            row={row}
                            now={now}
                            timeZone={timeZone}
                            showStaff={showStaff}
                            serviceIcon={serviceIconFor(row)}
                            cancellation={cancellationDetails[row.id]}
                            waits={[]}
                            waitNow={waiting.now}
                            waitBusy={waiting.busy}
                            locked={locked}
                            loyalty={false}
                            survey={false}
                            handlers={handlers}
                          />
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </>
            )}
          </div>

          {desktop &&
            extras
              .filter((extra) => !extra.wide)
              .map((extra) => (
                <section key={extra.id} id={`agenda-extra-${extra.id}`} className="scroll-mt-24">
                  {extra.content}
                </section>
              ))}
        </div>
      </div>

      {desktop &&
        extras
          .filter((extra) => extra.wide)
          .map((extra) => (
            <section
              key={extra.id}
              id={`agenda-extra-${extra.id}`}
              className="scroll-mt-24 lg:pt-2"
            >
              {extra.content}
            </section>
          ))}

      {/* Celular: seções com contagem ficam montadas escondidas enquanto a janela está fechada. */}
      {!desktop &&
        extras
          .filter((extra) => "count" in extra && openExtra !== extra.id)
          .map((extra) => (
            <div key={extra.id} hidden>
              {extra.content}
            </div>
          ))}
      {!desktop && (
        <Dialog
          open={!!openExtra && extras.some((extra) => extra.id === openExtra)}
          onOpenChange={(value) => {
            if (value) return;
            setOpenExtra(null);
            if (window.location.hash.startsWith("#agenda-extra-")) {
              window.history.replaceState(
                window.history.state,
                "",
                window.location.pathname + window.location.search,
              );
            }
          }}
        >
          {extras
            .filter((extra) => extra.id === openExtra)
            .map((extra) => {
              const Icon = extra.icon;
              return (
                <DialogContent
                  key={extra.id}
                  aria-describedby={undefined}
                  onOpenAutoFocus={(event) => {
                    // Reforço: a janela sempre abre do topo (título e X à vista).
                    const content = event.currentTarget as HTMLElement | null;
                    if (content) content.scrollTop = 0;
                  }}
                  className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0"
                >
                  <div className="flex min-h-14 items-center gap-2.5 border-b border-border px-4 py-3 pr-14">
                    <Icon className="size-5 shrink-0 text-gold" aria-hidden />
                    <DialogTitle className="min-w-0 break-words text-base font-bold">
                      {extra.label}
                    </DialogTitle>
                  </div>
                  {/* Sem id aqui: com a âncora dentro da janela (overflow-hidden), o navegador
                      rolava a janela até a seção e escondia título e X em telas baixas. O hash
                      continua mudando e a lista de clientes abre pelo hashchange. */}
                  <section className="dialog-scroll-area flex-1 overflow-y-auto p-3">
                    {extra.content}
                  </section>
                </DialogContent>
              );
            })}
        </Dialog>
      )}

      <Dialog open={!!boardRow} onOpenChange={(value) => !value && setBoardTarget(null)}>
        {boardRow && (
          <DialogContent
            aria-describedby={undefined}
            className="w-[calc(100vw-1.5rem)] max-w-md gap-3 rounded-3xl border-border bg-background p-3 pt-2"
          >
            <DialogTitle className="flex min-h-11 items-center gap-2 pe-12 ps-1 text-base font-bold">
              <PersonAvatar
                name={boardRow.staff?.display_name ?? t("shop.staffFallback")}
                src={staffById.get(boardRow.staff_id)?.avatar_url}
                seed={boardRow.staff_id}
                size="xs"
              />
              <span className="min-w-0 break-words">
                {`${time(boardRow.starts_at)}–${time(boardRow.ends_at)} · ${
                  boardRow.staff?.display_name ?? t("shop.staffFallback")
                }`}
              </span>
            </DialogTitle>
            <AppointmentCard
              row={boardRow}
              anchorId={false}
              now={now}
              timeZone={timeZone}
              showStaff={false}
              serviceIcon={serviceIconFor(boardRow)}
              nextMinutes={
                next?.id === boardRow.id ? minutesUntil(boardRow.starts_at, now) : undefined
              }
              cancellation={cancellationDetails[boardRow.id]}
              waits={dayWaits.filter((wait) => wait.appointment_id === boardRow.id)}
              waitNow={waiting.now}
              waitBusy={waiting.busy}
              feedback={feedback[boardRow.id]}
              locked={locked}
              loyalty={!!settings?.loyalty_enabled}
              survey={settings?.survey_program_enabled !== false}
              handlers={handlers}
            />
          </DialogContent>
        )}
      </Dialog>

      {profileTarget && profileTarget.customer_id && (
        <ClientProfileModal
          shopId={shopId}
          customerId={profileTarget.customer_id}
          customerName={profileTarget.customer?.full_name ?? null}
          onClose={() => setProfileTarget(null)}
        />
      )}

      <WithdrawDialog
        row={withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        timeZone={timeZone}
        showStaff={showStaff}
        hold={withdrawTarget ? holdFor(withdrawTarget) : false}
        onConfirm={async (row) => {
          await actions.setStatus(row, "reschedule_requested");
          toast.success(t("agenda.toast.withdrawn", { name: nameOf(row) }));
        }}
      />
      <StopSeriesDialog
        row={seriesTarget}
        onClose={() => setSeriesTarget(null)}
        timeZone={timeZone}
        showStaff={showStaff}
        demo={!!demo}
        onConfirm={async (seriesId) => {
          await actions.stopSeries(seriesId);
          toast.success(t("agenda.toast.seriesStopped"));
        }}
      />
      <CompleteEarlyDialog
        row={earlyTarget}
        onClose={() => setEarlyTarget(null)}
        timeZone={timeZone}
        showStaff={showStaff}
        loyalty={!!settings?.loyalty_enabled}
        onConfirm={async (row) => {
          await actions.setStatus(row, "completed");
          toast.success(
            t("agenda.toast.completed", { name: nameOf(row), time: time(row.starts_at) }),
          );
        }}
      />
      <CancellationDialog
        open={!!cancelTarget}
        busy={cancelBusy}
        reason={cancelReason}
        error={cancelError}
        details={
          cancelTarget ? (
            <AppointmentSummary row={cancelTarget} timeZone={timeZone} showStaff={showStaff} />
          ) : null
        }
        title={t("agenda.cancel.title")}
        keepLabel={t("agenda.keep")}
        confirmLabel={t("agenda.menu.cancel")}
        onReason={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
          setCancelError(null);
        }}
        onConfirm={() => void confirmCancel()}
      />
      <StaffSurveyDialog
        appointment={surveyTarget}
        open={!!surveyTarget}
        subtitle={
          surveyTarget ? `${nameOf(surveyTarget)} · ${time(surveyTarget.starts_at)}` : undefined
        }
        onClose={() => setSurveyTarget(null)}
        onSaved={() => {
          toast.success(t("agenda.toast.survey"));
          onRefresh?.();
        }}
      />
    </section>
  );
}
