import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  ClipboardPen,
  Clock3,
  ContactRound,
  Loader2,
  Lock,
  MessageSquarePlus,
  Repeat,
  RotateCcw,
  Store,
  User,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { ServiceIcon } from "@/components/ui/service-icon";
import {
  Countdown,
  MoreActions,
  Notice,
  PersonAvatar,
  StatusBadge,
  Tag,
  personColor,
  type MoreAction,
} from "@/components/visual";
import { cancellationReasonLabel } from "@/features/insights/cancellation";
import { useDemo } from "@/features/demo/context";
import type { SlotWait } from "@/features/waiting/model";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  NoShowDialog,
  OccurrenceDialog,
  OccurrenceTags,
  occurrenceRules,
  useAttendance,
} from "./attendance";
import { clientDisplay, recurringBadge } from "../clients/model";
import { momentOf } from "./model";
import { useShopTime } from "./summary";
import {
  AGENDA_STATE,
  ON_HOLD_STATE,
  agendaClientName,
  type CancellationDetail,
  type CardFeedback,
  type CardState,
  type DayAppointment,
} from "./types";

export type CardHandlers = {
  onConfirm: (row: DayAppointment) => void;
  /** Concluir: quem chama decide se pede confirmação (antes do início). */
  onComplete: (row: DayAppointment) => void;
  onWithdraw: (row: DayAppointment) => void;
  onCancel: (row: DayAppointment) => void;
  onStopSeries: (row: DayAppointment) => void;
  onSurvey: (row: DayAppointment) => void;
  onRetry: (row: DayAppointment) => void;
  onRestoreWait: (waitId: string) => void;
  /** Depois de registrar atraso ou falta. */
  onChanged: () => void;
  /**
   * Abre a ficha do cliente. Só vale quando o atendimento traz o `customer_id` (sem ele, o nome
   * continua como texto).
   */
  onOpenClient?: (row: DayAppointment) => void;
};

/**
 * Seta da ficha presa à última letra do nome: a seta nunca fica sozinha na linha de baixo, e
 * palavra longa (sobrenome em maiúsculas) ainda pode quebrar sem vazar do cartão.
 */
function withArrow(text: string) {
  const chars = Array.from(text);
  const last = chars.pop() ?? "";
  return (
    <>
      {chars.join("")}
      <span className="whitespace-nowrap">
        {last}
        <ChevronRight
          className="ms-1.5 inline size-4 align-middle text-muted-foreground"
          aria-hidden
        />
      </span>
    </>
  );
}

/**
 * Nome do cliente: com a ficha disponível vira botão (seta discreta e área de toque de 44 px);
 * sem ela, só o texto.
 */
function CustomerName({
  row,
  name,
  onOpen,
  className,
}: {
  row: DayAppointment;
  name: string;
  onOpen?: (row: DayAppointment) => void;
  className?: string;
}) {
  const { t } = useI18n();
  // Apelido na frente (é como a equipe chama) e o nome do cadastro menor, ao lado.
  const shown = clientDisplay(row.customer?.full_name ?? name, row.customer_nickname);
  const primary = shown.primary ?? name;
  const label = shown.secondary ? `${primary} (${shown.secondary})` : primary;
  // A seta (só no botão) vai dentro do último texto, presa à última palavra.
  const content = (arrow: boolean) => (
    <>
      <span className="min-w-0 break-words">
        {arrow && !shown.secondary ? withArrow(primary) : primary}
      </span>
      {shown.secondary && (
        <span className="min-w-0 break-words text-xs font-medium text-muted-foreground">
          {arrow ? withArrow(shown.secondary) : shown.secondary}
        </span>
      )}
    </>
  );
  if (!onOpen || !(row.customer_id || row.shop_client_id) || row.visibility === "busy") {
    return (
      <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
        {content(false)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      title={t("agenda.client.open", { name: label })}
      aria-label={t("agenda.client.open", { name: label })}
      className={cn(
        "relative inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 rounded-md text-start underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 transition hover:decoration-gold after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']",
        className,
      )}
    >
      {content(true)}
    </button>
  );
}

type CardProps = {
  row: DayAppointment;
  /**
   * Põe o id `agenda-row-<id>` (alvo do "ir até" e do "Ver e confirmar"). `false` na janela do
   * quadro, onde o bloco do quadro já tem esse id.
   */
  anchorId?: boolean;
  now: number;
  timeZone: string;
  showStaff: boolean;
  staffPhoto?: string | null;
  serviceIcon?: string | null;
  /** Minutos até começar, quando este é o próximo atendimento. */
  nextMinutes?: number;
  cancellation?: CancellationDetail;
  waits: SlotWait[];
  waitNow: Date;
  waitBusy: boolean;
  feedback?: CardFeedback;
  /** Outra ação está gravando: os botões esperam. */
  locked: boolean;
  loyalty: boolean;
  survey: boolean;
  handlers: CardHandlers;
};

function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}

/** Horário de outro profissional (quem não vê a loja toda): uma linha cinza com cadeado. */
export function BusyRow({ row, timeZone }: { row: DayAppointment; timeZone: string }) {
  const { t } = useI18n();
  const time = useShopTime(timeZone);
  return (
    <div className="agenda-busy flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
      <Lock className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 break-words">
        <span className="font-semibold text-foreground">{t("agenda.busy.title")}</span>
        {row.staff?.display_name ? ` · ${row.staff.display_name}` : ""}
      </span>
      <span className="shrink-0 font-semibold tabular-nums">
        {time(row.starts_at)}–{time(row.ends_at)}
      </span>
      <span className="sr-only">{t("shop.agenda.busyPrivate")}</span>
    </div>
  );
}

/** Espera do horário dentro do próprio atendimento: selo, prazo correndo, fila e restaurar. */
export function WaitPanel({
  wait,
  now,
  busy,
  onRestore,
  heading,
}: {
  wait: SlotWait;
  now: Date;
  busy: boolean;
  onRestore: (waitId: string) => void;
  heading?: string;
}) {
  const { t } = useI18n();
  const holding = Date.parse(wait.hold_until) > +now;
  const deadline = holding ? wait.hold_until : wait.claim_until;
  // O relógio da espera é o do servidor (ou o da demonstração): o prazo é recalculado a partir
  // dele para o contador mostrar o tempo que realmente resta.
  const endsAt = Date.now() + (Date.parse(deadline) - +now);
  return (
    <div className="tone-pending space-y-2 rounded-xl border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] p-3">
      {heading && <p className="text-sm font-bold text-foreground">{heading}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={ON_HOLD_STATE.tone}
          icon={ON_HOLD_STATE.icon}
          label={t(ON_HOLD_STATE.labelKey)}
          size="sm"
        />
        <Countdown endsAt={endsAt} label={holding ? undefined : t("agenda.wait.claimLabel")} />
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
          <Users className="size-3.5 shrink-0" aria-hidden />
          {wait.has_interest ? t("agenda.wait.queueOne") : t("agenda.wait.queueNone")}
        </span>
      </div>
      {holding && wait.restorable && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRestore(wait.id)}
          className="action-button action-confirm min-h-11 w-full sm:w-auto"
        >
          <RotateCcw aria-hidden />
          {t("wait.card.restore")}
        </button>
      )}
    </div>
  );
}

/**
 * Um atendimento na linha do tempo: horário (início, fim e barra da duração), cliente,
 * serviço, selo de situação e no máximo UM botão principal conforme o momento. O resto fica
 * no menu "⋯". Cancelados viram uma linha compacta e esmaecida.
 */
export function AppointmentCard(props: CardProps) {
  const { row, timeZone } = props;
  if (row.visibility === "busy") return <BusyRow row={row} timeZone={timeZone} />;
  return <FullCard {...props} />;
}

function FullCard({
  row,
  anchorId = true,
  now,
  timeZone,
  showStaff,
  staffPhoto,
  serviceIcon,
  nextMinutes,
  cancellation,
  waits,
  waitNow,
  waitBusy,
  feedback,
  locked,
  loyalty,
  survey,
  handlers,
}: CardProps) {
  const { t } = useI18n();
  const demo = useDemo();
  const time = useShopTime(timeZone);
  const attendance = useAttendance(row, true);
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const { facts } = attendance;
  const moment = momentOf(row, now);
  const rules = occurrenceRules(row, facts, demo?.now ?? new Date(now));
  const customer = agendaClientName(row, t("shop.customerFallback"));
  const service = row.service?.name ?? t("shop.serviceFallback");
  const start = time(row.starts_at);
  const end = time(row.ends_at);
  const duration = minutesBetween(row.starts_at, row.ends_at);
  const open = row.status === "pending" || row.status === "confirmed";
  const saving = feedback?.state === "saving";
  const recurring = recurringBadge(
    !!row.series_id,
    { kind: row.series_kind, intervalDays: row.series_interval_days },
    row.customer_recurring,
  );
  // Sem conta no app (cliente do balcão ou conta excluída): ele não remarca pelo app nem
  // responde pesquisa ligada à conta.
  const withAccount = !!row.customer_id;

  const state: CardState =
    row.status === "cancelled"
      ? facts.no_show_at
        ? "noShow"
        : "cancelled"
      : moment === "unresolved"
        ? "unresolved"
        : moment === "inProgress" && row.status === "confirmed"
          ? "inProgress"
          : row.status === "reschedule_requested"
            ? "reschedule_requested"
            : (row.status as CardState);
  const meta = AGENDA_STATE[state];

  if (row.status === "cancelled") {
    return (
      <article
        id={anchorId ? `agenda-row-${row.id}` : undefined}
        tabIndex={-1}
        className="agenda-card agenda-card-cancelled app-action-card flex scroll-mt-28 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 shadow-none"
      >
        <span className="w-14 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground line-through">
          {start}
        </span>
        <span className="min-w-0 flex-1 basis-32 break-words text-sm font-semibold text-muted-foreground">
          <CustomerName row={row} name={customer} onOpen={handlers.onOpenClient} /> · {service}
        </span>
        <StatusBadge tone={meta.tone} icon={meta.icon} label={t(meta.labelKey)} size="sm" />
        {cancellation && !facts.no_show_at && (
          <Tag icon={cancellation.source === "shop" ? Store : User}>
            {cancellation.source === "shop"
              ? t("agenda.cancelled.byShop")
              : t("agenda.cancelled.byCustomer")}
            {cancellation.reason ? ` · ${cancellationReasonLabel(cancellation.reason)}` : ""}
          </Tag>
        )}
      </article>
    );
  }

  const completeButton = (
    <button
      key="complete"
      type="button"
      disabled={locked}
      aria-busy={saving && feedback?.action === "complete" ? true : undefined}
      onClick={() => handlers.onComplete(row)}
      className="action-button action-success min-h-11"
    >
      {saving && feedback?.action === "complete" ? (
        <Loader2 className="motion-safe:animate-spin" aria-hidden />
      ) : (
        <CircleCheck aria-hidden />
      )}
      {saving && feedback?.action === "complete"
        ? t("agenda.busy.complete")
        : t("agenda.action.complete")}
      {loyalty && !saving && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-bold leading-none">
          <span aria-hidden>{t("agenda.action.points")}</span>
          <span className="sr-only">{t("agenda.early.points")}</span>
        </span>
      )}
    </button>
  );
  const confirmButton = (
    <button
      key="confirm"
      type="button"
      disabled={locked}
      aria-busy={saving && feedback?.action === "confirm" ? true : undefined}
      onClick={() => handlers.onConfirm(row)}
      className="action-button action-confirm min-h-11"
    >
      {saving && feedback?.action === "confirm" ? (
        <Loader2 className="motion-safe:animate-spin" aria-hidden />
      ) : (
        <CalendarCheck aria-hidden />
      )}
      {saving && feedback?.action === "confirm"
        ? t("agenda.busy.confirm")
        : t("shop.agenda.confirm")}
    </button>
  );
  const noShowButton = (
    <button
      key="noShow"
      type="button"
      disabled={locked}
      onClick={() => setNoShowOpen(true)}
      className="action-button action-danger min-h-11"
    >
      <UserX aria-hidden />
      {t("agenda.noShow.action")}
    </button>
  );

  // UM botão principal por momento (dois só quando o horário já passou sem desfecho).
  const primary: Array<"confirm" | "complete" | "noShow"> = !open
    ? []
    : moment === "unresolved"
      ? rules.noShowAllowed
        ? ["complete", "noShow"]
        : ["complete"]
      : moment === "inProgress"
        ? ["complete"]
        : row.status === "pending"
          ? ["confirm"]
          : [];

  const actions: MoreAction[] = [];
  if (open && !primary.includes("confirm") && row.status === "pending") {
    actions.push({
      id: "confirm",
      icon: CalendarCheck,
      label: t("shop.agenda.confirm"),
      onSelect: () => handlers.onConfirm(row),
      disabled: locked,
    });
  }
  if (open && !primary.includes("complete")) {
    actions.push({
      id: "complete",
      icon: CircleCheck,
      label: t("agenda.action.complete"),
      description: t("agenda.menu.completeEarly"),
      onSelect: () => handlers.onComplete(row),
      disabled: locked,
    });
  }
  if (row.status === "confirmed" && withAccount) {
    actions.push({
      id: "withdraw",
      icon: CalendarClock,
      label: t("agenda.withdraw.confirm"),
      description: t("agenda.menu.withdraw"),
      onSelect: () => handlers.onWithdraw(row),
      disabled: locked,
    });
  }
  if (rules.editable) {
    actions.push({
      id: "occurrence",
      icon: ClipboardPen,
      label: rules.hasDelay ? t("agenda.menu.editDelay") : t("agenda.menu.delay"),
      description: t("agenda.menu.delayHint"),
      onSelect: () => setOccurrenceOpen(true),
      disabled: !attendance.loaded,
    });
  }
  if (row.status === "completed" && survey && withAccount) {
    actions.push({
      id: "survey",
      icon: MessageSquarePlus,
      label: t("shop.agenda.feedback"),
      onSelect: () => handlers.onSurvey(row),
    });
  }
  if (open && rules.noShowAllowed && !primary.includes("noShow")) {
    actions.push({
      id: "noShow",
      icon: UserX,
      tone: "danger",
      label: t("agenda.noShow.action"),
      description: t("agenda.noShow.noPoints"),
      onSelect: () => setNoShowOpen(true),
      disabled: locked,
    });
  }
  if (open && row.series_id) {
    actions.push({
      id: "series",
      icon: Repeat,
      tone: "danger",
      label: t("agenda.series.confirm"),
      description: t("agenda.series.next"),
      onSelect: () => handlers.onStopSeries(row),
      disabled: locked,
    });
  }
  if (open || row.status === "reschedule_requested") {
    actions.push({
      id: "cancel",
      icon: XCircle,
      tone: "danger",
      label:
        row.status === "reschedule_requested"
          ? t("shop.agenda.cancelForGood")
          : t("agenda.menu.cancel"),
      description:
        row.status === "reschedule_requested"
          ? t("agenda.menu.cancelForGood")
          : t("agenda.menu.cancelHint"),
      onSelect: () => handlers.onCancel(row),
      disabled: locked,
    });
  }

  const stripe = showStaff ? personColor(row.staff_id).fg : undefined;

  return (
    <article
      id={anchorId ? `agenda-row-${row.id}` : undefined}
      tabIndex={-1}
      aria-label={`${start} · ${customer} · ${t(meta.labelKey)}`}
      // As classes agenda-card-* só servem ao CSS do tablet e do computador
      // (src/styles/agenda.css): cartão mais baixo com a ação à direita a partir de 768 px e
      // linha compacta a partir de 1280 px. No celular é o cartão de sempre.
      className={cn(
        "agenda-card app-action-card scroll-mt-28 overflow-hidden",
        row.status === "completed" && "shadow-none",
        nextMinutes !== undefined && "outline-2 -outline-offset-2 outline-gold",
        state === "unresolved" &&
          "tone-warning outline-2 -outline-offset-2 outline-dashed outline-[color:var(--tone-line)]",
      )}
      style={stripe ? { borderLeft: `4px solid ${stripe}` } : undefined}
    >
      <div className="agenda-card-body flex gap-3 p-3 sm:p-4">
        <div
          className="agenda-card-time flex w-14 shrink-0 flex-col items-center text-center"
          aria-hidden
        >
          <span className="text-base font-extrabold leading-none tabular-nums text-gold">
            {start}
          </span>
          <span
            className="agenda-card-time-bar my-1.5 w-1 rounded-full bg-gold/35"
            style={{ height: `${Math.min(44, Math.max(12, duration * 0.5))}px` }}
          />
          <span className="text-xs font-semibold leading-none tabular-nums text-muted-foreground">
            {end}
          </span>
        </div>
        <div className="agenda-card-main min-w-0 flex-1 space-y-1.5">
          <p className="agenda-card-name text-[15px] font-bold leading-snug break-words">
            <span className="sr-only">{`${start}–${end} · `}</span>
            <CustomerName row={row} name={customer} onOpen={handlers.onOpenClient} />
          </p>
          <p className="agenda-card-service flex items-center gap-1.5 text-sm text-muted-foreground">
            <ServiceIcon
              icon={serviceIcon}
              className="size-4 shrink-0 text-gold"
              imageClassName="size-5 shrink-0 rounded-md"
            />
            {/* Serviço e duração em texto corrido: quebra entre palavras (nunca "Premiu/m") e a
                duração desce inteira, sem linha a mais. Quando ela começa a linha, o "·" fica na
                faixa recortada à esquerda (margem negativa + overflow-hidden; o recuo do nome se
                repete em cada linha com box-decoration-clone): nenhuma linha começa por ele. */}
            <span className="min-w-0 overflow-hidden">
              <span className="-ms-3 block break-words">
                <span className="box-decoration-clone ps-3">{service}</span>{" "}
                <span className="whitespace-nowrap">
                  <span className="inline-block w-3 text-center" aria-hidden>
                    ·
                  </span>
                  {t("agenda.minutes", { minutes: duration })}
                </span>
              </span>
            </span>
          </p>
          {showStaff && row.staff?.display_name && (
            <p className="agenda-card-staff flex items-center gap-1.5 text-xs font-semibold">
              <PersonAvatar
                name={row.staff.display_name}
                src={staffPhoto}
                seed={row.staff_id}
                size="xs"
              />
              <span className="min-w-0 break-words">{row.staff.display_name}</span>
            </p>
          )}
          <div className="agenda-card-badges flex flex-wrap items-center gap-1.5 pt-0.5 empty:hidden">
            {/* "Confirmado" é o normal do dia (a loja confirma sozinha): o selo só aparece quando
                diz algo diferente (agora, a confirmar, passou do horário, concluído…). O estado
                continua no nome acessível do cartão. */}
            {state !== "confirmed" && (
              <StatusBadge
                tone={meta.tone}
                icon={meta.icon}
                label={t(meta.labelKey)}
                live={state === "inProgress"}
                size="sm"
              />
            )}
            {nextMinutes !== undefined && (
              <StatusBadge
                tone="highlight"
                icon={Clock3}
                label={
                  nextMinutes < 60
                    ? t("agenda.nextIn", { minutes: nextMinutes })
                    : t("agenda.summary.next")
                }
                size="sm"
              />
            )}
            {recurring && (
              <StatusBadge
                tone="highlight"
                icon={Repeat}
                size="sm"
                label={
                  recurring.key === "agenda.recurring.everyDays"
                    ? t(recurring.key, { days: recurring.days })
                    : t(recurring.key)
                }
              />
            )}
            {row.has_account === false && (
              <span title={t("agenda.client.walkInHint")}>
                <Tag icon={ContactRound}>{t("agenda.client.walkIn")}</Tag>
              </span>
            )}
            <OccurrenceTags facts={facts} />
          </div>
        </div>
        {actions.length > 0 && (
          <MoreActions
            actions={actions}
            label={t("agenda.menu.label", { time: start, name: customer })}
            title={`${start} · ${customer}`}
            className="agenda-card-more -me-1 -mt-1 shrink-0"
          />
        )}
      </div>

      {waits.map((wait) => (
        <div key={wait.id} className="agenda-card-extra px-3 pb-3 sm:px-4">
          <WaitPanel wait={wait} now={waitNow} busy={waitBusy} onRestore={handlers.onRestoreWait} />
        </div>
      ))}

      {attendance.failed && (
        <div className="agenda-card-extra px-3 pb-3 sm:px-4">
          <Notice
            tone="warning"
            title={t("ins.att.loadError")}
            action={{ label: t("visual.retry"), onClick: attendance.reload, icon: RotateCcw }}
          />
        </div>
      )}

      {feedback?.state === "error" && (
        <div className="agenda-card-extra px-3 pb-3 sm:px-4">
          <Notice
            tone="danger"
            title={t("shop.error.changeAppointment")}
            action={{
              label: t("visual.retry"),
              onClick: () => handlers.onRetry(row),
              icon: RotateCcw,
            }}
          />
        </div>
      )}

      {primary.length > 0 && (
        <div className="agenda-card-footer flex flex-wrap gap-2 border-t border-border/70 bg-muted/20 px-3 py-3 sm:px-4 [&>button]:flex-1 [&>button]:basis-44">
          {primary.map((kind) =>
            kind === "confirm"
              ? confirmButton
              : kind === "complete"
                ? completeButton
                : noShowButton,
          )}
        </div>
      )}

      {occurrenceOpen && (
        <OccurrenceDialog
          open={occurrenceOpen}
          onOpenChange={setOccurrenceOpen}
          row={row}
          attendance={attendance}
          timeZone={timeZone}
          onSaved={handlers.onChanged}
          onNoShow={() => setNoShowOpen(true)}
        />
      )}
      {noShowOpen && (
        <NoShowDialog
          open={noShowOpen}
          onOpenChange={setNoShowOpen}
          row={row}
          attendance={attendance}
          timeZone={timeZone}
          showStaff={showStaff}
          onSaved={handlers.onChanged}
        />
      )}
    </article>
  );
}
