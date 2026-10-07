import { Clock3, Repeat2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PersonAvatar, StatusBadge, Tag, type AppointmentStatus } from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { formatShopDate } from "@/lib/shop/appointments";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { daysFromToday, relativeDayLabel, timeUntil } from "../when";
import { useReservationStatus } from "./format";

/**
 * Ticket da reserva: o mesmo formato em Reservas, no sucesso do agendamento, no De → Para da
 * remarcação, na janela de cancelar e na "Precisa de você". Bloco de data à esquerda (HOJE / 05 /
 * OUT, como o "Seu próximo horário" do Início), hora grande, serviço com ícone, profissional com
 * foto ou iniciais e o selo da situação.
 */

export type TicketData = {
  startsAt: string;
  endsAt?: string | null;
  serviceName: string;
  serviceIcon?: string | null;
  staffName: string;
  staffId?: string | null;
  staffPhoto?: string | null;
  /** "Qualquer profissional": ícone de grupo no lugar das iniciais (não é uma pessoa). */
  anyStaff?: boolean;
  priceCents?: number | null;
};

export function ReservationStatusBadge({
  status,
  startsAt,
  now,
  size,
  actionable,
  className,
}: {
  status: AppointmentStatus;
  startsAt: string;
  now: Date;
  size?: "sm" | "md" | "lg";
  /** O cartão ainda tem Remarcar/Cancelar: não mostra "Já passou". */
  actionable?: boolean;
  className?: string;
}) {
  const view = useReservationStatus()(status, startsAt, now, actionable);
  return (
    <StatusBadge
      tone={view.tone}
      icon={view.icon}
      label={view.label}
      size={size}
      className={className}
    />
  );
}

/** Bloco de data: rótulo relativo (HOJE, AMANHÃ, QUA), dia e mês. */
export function DateBlock({
  date,
  now,
  timeZone,
  size = "md",
  muted = false,
}: {
  date: string;
  now: Date;
  timeZone: string;
  size?: "sm" | "md";
  muted?: boolean;
}) {
  const { intlLocale } = useI18n();
  const days = daysFromToday(date, now, timeZone);
  // Destaque escuro só para o que ainda vai acontecer hoje ou amanhã (não para o que já passou).
  const upcoming = new Date(date).getTime() > now.getTime();
  const soon = !muted && upcoming && days >= 0 && days <= 1;
  return (
    <div
      aria-hidden
      className={cn(
        // Largura mínima, não fixa: "AMANHÃ", "TOMORROW" e "YESTERDAY" alargam o bloco em vez de
        // serem cortados. O raio vem da variável (o portão do link fica fora do .arena-workspace).
        "shrink-0 overflow-hidden rounded-[var(--panel-radius)] border bg-card text-center",
        size === "sm" ? "min-w-14" : "min-w-[4.5rem]",
        soon ? "border-foreground" : "border-border",
        muted && "opacity-70",
      )}
    >
      <span
        className={cn(
          "block whitespace-nowrap py-0.5 font-bold uppercase",
          size === "sm" ? "px-1.5 text-[10px] tracking-normal" : "px-2 text-[11px] tracking-wide",
          soon ? "bg-foreground text-background" : "bg-muted",
        )}
      >
        {relativeDayLabel(date, now, timeZone, intlLocale)}
      </span>
      <span
        className={cn(
          "block font-bold leading-none tabular-nums",
          size === "sm" ? "pt-1 text-xl" : "pt-1.5 text-3xl",
        )}
      >
        {formatShopDate(date, timeZone, { day: "2-digit" }, intlLocale)}
      </span>
      <span
        className={cn(
          "block pt-0.5 font-semibold uppercase text-muted-foreground",
          size === "sm" ? "pb-1 text-[10px]" : "pb-1.5 text-[11px]",
        )}
      >
        {formatShopDate(date, timeZone, { month: "short" }, intlLocale).replace(".", "")}
      </span>
    </div>
  );
}

export function AppointmentTicket({
  data,
  now,
  timeZone,
  status,
  variant = "card",
  struck = false,
  repeatLabel,
  showUntil = true,
  extra,
  actions,
  className,
  highlight,
  id,
}: {
  data: TicketData;
  now: Date;
  timeZone: string;
  /** Selo de situação (ex.: `<ReservationStatusBadge/>`). */
  status?: ReactNode;
  /** `card`: cartão completo. `mini`: linha compacta para janelas e resumos (sem moldura). */
  variant?: "card" | "mini";
  /** Horário antigo (remarcação) ou cancelado: riscado e apagado. */
  struck?: boolean;
  /** Etiqueta "Repete" (dourada) quando faz parte de uma repetição. */
  repeatLabel?: string;
  /** Mostra "em 2 horas" ao lado do horário. */
  showUntil?: boolean;
  /** Linha extra (motivo do cancelamento, datas da repetição). */
  extra?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Destaque temporário (reserva aberta pelo link do aviso). */
  highlight?: ReactNode;
  id?: string;
}) {
  const { t, intlLocale } = useI18n();
  const start = new Date(data.startsAt);
  const time = formatShopDate(start, timeZone, { hour: "2-digit", minute: "2-digit" }, intlLocale);
  const end = data.endsAt
    ? formatShopDate(data.endsAt, timeZone, { hour: "2-digit", minute: "2-digit" }, intlLocale)
    : null;
  const until = showUntil && !struck ? timeUntil(start, now, timeZone, intlLocale) : null;
  const fullDate = formatShopDate(
    start,
    timeZone,
    { weekday: "long", day: "numeric", month: "long" },
    intlLocale,
  );
  const price =
    typeof data.priceCents === "number"
      ? (data.priceCents / 100).toLocaleString(intlLocale, {
          style: "currency",
          currency: "BRL",
          currencyDisplay: "narrowSymbol",
        })
      : null;
  const mini = variant === "mini";

  const body = (
    <div className="flex items-start gap-3">
      <DateBlock
        date={data.startsAt}
        now={now}
        timeZone={timeZone}
        size={mini ? "sm" : "md"}
        muted={struck}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="sr-only">{fullDate}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "font-bold leading-none tabular-nums tracking-tight",
              mini ? "text-lg" : "text-2xl",
              struck && "text-muted-foreground line-through decoration-2",
            )}
          >
            {time}
            {end && !mini ? (
              <span className="text-base font-semibold text-muted-foreground">
                <span aria-hidden> – </span>
                <span className="sr-only"> {t("bookings.until")} </span>
                {end}
              </span>
            ) : null}
          </span>
          {until && <Tag icon={Clock3}>{until}</Tag>}
          {status && !mini ? <span className="ms-auto">{status}</span> : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold">
          <span className="grid size-5 shrink-0 place-items-center text-gold">
            <ServiceIcon
              icon={data.serviceIcon}
              className="size-4"
              imageClassName="size-5 rounded-md"
            />
          </span>
          <span className="break-normal hyphens-auto">{data.serviceName}</span>
          {price && !mini ? (
            <span className="ms-auto shrink-0 text-sm font-bold tabular-nums">{price}</span>
          ) : null}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.anyStaff ? (
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-gold"
            >
              <Users className="size-3.5" />
            </span>
          ) : (
            <PersonAvatar
              name={data.staffName}
              src={data.staffPhoto}
              seed={data.staffId ?? undefined}
              size="xs"
            />
          )}
          <span className="min-w-0 break-words">{data.staffName}</span>
        </p>
        {(repeatLabel || (status && mini)) && (
          <p className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {status && mini ? status : null}
            {repeatLabel ? (
              <StatusBadge tone="highlight" icon={Repeat2} label={repeatLabel} size="sm" />
            ) : null}
          </p>
        )}
      </div>
    </div>
  );

  if (mini) {
    return (
      <div id={id} className={cn("min-w-0", className)}>
        {body}
        {extra}
        {actions}
      </div>
    );
  }

  return (
    <article
      id={id}
      tabIndex={highlight ? -1 : undefined}
      className={cn(
        "app-action-card relative space-y-3 p-4 transition-shadow",
        highlight && "ring-2 ring-gold ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {highlight}
      {body}
      {extra}
      {actions}
    </article>
  );
}
