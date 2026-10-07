import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Clock3,
  Repeat2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import {
  APPOINTMENT_STATUS,
  EmptyState,
  IconTile,
  LoadingState,
  PersonAvatar,
  StatusBadge,
  Tag,
  type AppointmentStatus,
} from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { formatShopDate } from "@/lib/shop/appointments";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { daysFromToday, relativeDayLabel, shortWhen, timeUntil } from "./when";

export type NextVisit = {
  startsAt: string;
  status: AppointmentStatus;
  serviceName: string;
  serviceIcon?: string | null;
  staffName: string;
  staffId?: string | null;
  staffPhoto?: string | null;
};

/** Rótulo do estado na visão do cliente ("Aguardando a barbearia" em vez de "Em revisão"). */
const CUSTOMER_STATUS_LABEL: Partial<Record<AppointmentStatus, MessageKey>> = {
  pending: "home.status.pending",
  reschedule_requested: "home.status.reschedule",
};

/**
 * "Seu próximo horário": quando (Hoje/Amanhã + hora grande + "em 1 hora"), o quê (serviço com
 * ícone), com quem (foto do profissional) e a situação em selo. Ações explícitas no rodapé.
 * Sem horário, vira o convite para agendar; carregando, mostra o esqueleto do cartão.
 */
export function NextVisitCard({
  visit,
  moreCount,
  loading,
  error,
  now,
  timeZone,
  onRetry,
  onDetails,
  onMore,
  onReschedule,
  onBook,
  repeat,
  cancelledAt,
  className,
}: {
  visit: NextVisit | null;
  moreCount: number;
  loading: boolean;
  error: string | null;
  now: Date;
  timeZone: string;
  onRetry: () => void;
  /** "Ver detalhes": abre a reserva mostrada no cartão. */
  onDetails: () => void;
  /** "Mais N horários": abre a lista de reservas (sem ele, usa onDetails). */
  onMore?: () => void;
  onReschedule?: () => void;
  onBook: () => void;
  /** "Repetir o último": serviço e profissional do último atendimento concluído. */
  repeat?: { service: string; staff: string; onClick: () => void } | null;
  /** Sem horário porque a barbearia cancelou: o vazio diz isso em vez de "Nenhum horário". */
  cancelledAt?: string | null;
  className?: string;
}) {
  const { t, intlLocale } = useI18n();

  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <IconTile icon={CalendarClock} size="sm" />
      <h2 id="next-visit-title" className="min-w-0 flex-1 text-base font-bold">
        {t("home.nextTitle")}
      </h2>
      {visit && !loading && !error && <VisitStatus status={visit.status} />}
    </div>
  );

  let body;
  if (loading) {
    body = <LoadingState variant="cards" count={1} label={t("home.loadingSchedule")} />;
  } else if (error) {
    body = (
      <EmptyState
        variant="plain"
        status="danger"
        title={t("home.loadError")}
        description={error}
        action={
          <button type="button" onClick={onRetry} className="action-button min-h-11 w-full">
            <RotateCcw className="size-4" aria-hidden />
            {t("visual.retry")}
          </button>
        }
      />
    );
  } else if (!visit) {
    body = (
      <EmptyState
        variant="plain"
        tone="calendar"
        status={cancelledAt ? "danger" : undefined}
        title={t(cancelledAt ? "home.emptyCancelledTitle" : "home.emptyTitle")}
        description={
          cancelledAt ? (
            <>
              <span className="block font-semibold line-through decoration-muted-foreground/60">
                {shortWhen(cancelledAt, now, timeZone, intlLocale)}
              </span>
              {t("home.emptyCancelledHint")}
            </>
          ) : (
            t("home.emptyHint")
          )
        }
        className="py-4"
        action={
          <button
            type="button"
            onClick={onBook}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <CalendarPlus className="size-4" aria-hidden />
            {t("home.bookNow")}
          </button>
        }
        secondaryAction={
          repeat ? (
            <button
              type="button"
              onClick={repeat.onClick}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] border border-border px-3 py-2 text-sm font-semibold"
            >
              <Repeat2 className="size-4 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 text-left leading-snug">
                {t("home.repeatLast", { service: repeat.service, staff: repeat.staff })}
              </span>
            </button>
          ) : undefined
        }
      />
    );
  } else {
    const start = new Date(visit.startsAt);
    const days = daysFromToday(start, now, timeZone);
    const soon = days <= 1;
    const until = timeUntil(start, now, timeZone, intlLocale);
    const fullDate = formatShopDate(
      start,
      timeZone,
      { weekday: "long", day: "numeric", month: "long" },
      intlLocale,
    );
    body = (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {/* Bloco de data: rótulo relativo em cima (HOJE, AMANHÃ, QUA), dia e mês. */}
          <div
            className={cn(
              "w-[4.75rem] shrink-0 overflow-hidden rounded-2xl border text-center",
              soon ? "border-foreground" : "border-border",
            )}
            aria-hidden
          >
            <span
              className={cn(
                "block px-1 py-1 text-[11px] font-bold uppercase tracking-wide",
                soon ? "bg-foreground text-background" : "bg-muted",
              )}
            >
              {relativeDayLabel(start, now, timeZone, intlLocale)}
            </span>
            <span className="block pt-1.5 text-3xl font-bold leading-none tabular-nums">
              {formatShopDate(start, timeZone, { day: "2-digit" }, intlLocale)}
            </span>
            <span className="block pb-1.5 pt-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
              {formatShopDate(start, timeZone, { month: "short" }, intlLocale).replace(".", "")}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="sr-only">{fullDate}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-3xl font-bold leading-none tabular-nums tracking-tight">
                {formatShopDate(
                  start,
                  timeZone,
                  { hour: "2-digit", minute: "2-digit" },
                  intlLocale,
                )}
              </span>
              {until && <Tag icon={Clock3}>{until}</Tag>}
            </p>
            <p className="flex items-center gap-2 text-sm font-bold">
              <span className="grid size-6 shrink-0 place-items-center text-gold">
                <ServiceIcon
                  icon={visit.serviceIcon}
                  className="size-4"
                  imageClassName="size-6 rounded-md"
                />
              </span>
              <span className="min-w-0 truncate">{visit.serviceName}</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <PersonAvatar
                name={visit.staffName}
                src={visit.staffPhoto}
                seed={visit.staffId ?? undefined}
                size="xs"
              />
              <span className="min-w-0 truncate">{visit.staffName}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FooterButton icon={ChevronRight} trailing onClick={onDetails}>
            {t("home.details")}
          </FooterButton>
          {onReschedule && (
            <FooterButton icon={CalendarClock} onClick={onReschedule}>
              {t("bookings.reschedule")}
            </FooterButton>
          )}
        </div>
        {moreCount > 0 && (
          <button
            type="button"
            onClick={onMore ?? onDetails}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            {t(moreCount === 1 ? "home.moreOne" : "home.moreMany", { count: moreCount })}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="next-visit-title"
      className={cn("app-action-card space-y-4 p-4 sm:p-5", className)}
    >
      {header}
      {body}
    </section>
  );
}

function VisitStatus({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  const meta = APPOINTMENT_STATUS[status] ?? APPOINTMENT_STATUS.pending;
  const key = CUSTOMER_STATUS_LABEL[status] ?? meta.labelKey;
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={t(key)} />;
}

function FooterButton({
  icon: Icon,
  trailing = false,
  onClick,
  children,
}: {
  icon: LucideIcon;
  trailing?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--button-radius)] border border-border px-3 text-sm font-semibold transition-colors hover:border-primary/40"
    >
      {!trailing && <Icon className="size-4 shrink-0 text-gold" aria-hidden />}
      {children}
      {trailing && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>
  );
}
