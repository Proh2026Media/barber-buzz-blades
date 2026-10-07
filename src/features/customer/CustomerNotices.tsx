import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Info,
  LogOut,
  RotateCcw,
  Ticket,
  Timer,
  TimerOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Countdown,
  EmptyState,
  IconTile,
  Notice,
  TONE_CLASS,
  type Tone,
} from "@/components/visual";
import type { WaitingController } from "@/features/waiting/useWaiting";
import { eventLabel } from "@/features/waiting/model";
import type { PendingRedemption } from "@/features/loyalty/usePendingRedemptions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SpinningLoader } from "./SpinningLoader";
import { offersFor } from "./offers";
import { shortWhen, timeAgo } from "./when";

export type SessionNotice = { id: number; title: string; text: string; at: number; read: boolean };

/** Horário do cliente, no formato mínimo que os avisos precisam. */
export type NoticeVisit = {
  id: string;
  startsAt: string;
  updatedAt?: string | null;
  serviceName: string;
  staffName: string;
};

type NoticeEntry = {
  id: string;
  tone: Tone;
  icon: LucideIcon;
  title: string;
  detail?: string;
  /** Quando aconteceu (ms), para "agora" / "há 5 min". */
  at?: number;
  unread?: boolean;
  aside?: ReactNode;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    primary?: boolean;
    /** Processando: botão travado, ícone girando e o verbo no gerúndio. */
    busy?: boolean;
  };
  /** Precisa de uma ação da pessoa: sobe para o topo da lista. */
  urgent?: boolean;
};

const WAIT_EVENT: Record<string, { tone: Tone; icon: LucideIcon }> = {
  exclusive: { tone: "neutral", icon: TimerOff },
  expired: { tone: "neutral", icon: TimerOff },
  restored: { tone: "info", icon: RotateCcw },
  disabled: { tone: "neutral", icon: Info },
  claimed: { tone: "success", icon: CheckCircle2 },
  left: { tone: "neutral", icon: LogOut },
};

/**
 * Avisos do cliente numa lista só: o que pede ação (vaga liberada, mudança pedida pela
 * barbearia) primeiro; depois reservas feitas nesta visita, cancelamentos da barbearia, prêmios
 * esperando retirada e o histórico da lista de espera. Cada aviso tem ícone e cor do estado,
 * quando aconteceu ("há 5 min") e um botão que leva ao lugar certo.
 */
export function CustomerNotices({
  session,
  waiting,
  staffName,
  reschedules,
  shopCancelled,
  pending,
  now,
  timeZone,
  onOpenBookings,
  onReschedule,
  onBookAgain,
  onOpenRewards,
  onClaimed,
}: {
  session: SessionNotice[];
  waiting: WaitingController;
  staffName: (staffId: string) => string;
  reschedules: NoticeVisit[];
  shopCancelled: NoticeVisit[];
  pending: PendingRedemption[];
  now: Date;
  timeZone: string;
  onOpenBookings: () => void;
  onReschedule: (id: string) => void;
  /** "Agendar outro": abre Agendar com o serviço e o profissional do horário cancelado. */
  onBookAgain: (id: string) => void;
  onOpenRewards: () => void;
  onClaimed: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const when = (date: string) => shortWhen(date, now, timeZone, intlLocale);
  const nowMs = +now;
  // O relógio do Countdown é o do aparelho; a vaga segue o relógio da loja (ou da demonstração).
  const skew = Date.now() - nowMs;
  const dateFormat = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit" });

  const entries: NoticeEntry[] = [];

  for (const wait of offersFor(waiting)) {
    entries.push({
      id: `offer-${wait.id}`,
      tone: "warning",
      icon: Timer,
      title: t("home.attention.offerTitle"),
      detail: `${when(wait.starts_at)} · ${staffName(wait.staff_id)}`,
      urgent: true,
      aside: (
        <Countdown
          endsAt={Date.parse(wait.claim_until) + skew}
          label={t("home.attention.offerLeft")}
        />
      ),
      action: {
        label: waiting.busy ? t("home.attention.offerBusy") : t("home.attention.offerAction"),
        icon: waiting.busy ? SpinningLoader : Check,
        primary: true,
        busy: waiting.busy,
        onClick: () =>
          void waiting.act(wait.id, "claim").then((ok) => {
            if (ok) onClaimed();
          }),
      },
    });
  }

  for (const visit of reschedules) {
    entries.push({
      id: `reschedule-${visit.id}`,
      tone: "warning",
      icon: CalendarClock,
      title: t("home.attention.rescheduleTitle"),
      detail: `${when(visit.startsAt)} · ${visit.serviceName} · ${visit.staffName}`,
      at: visit.updatedAt ? Date.parse(visit.updatedAt) : undefined,
      urgent: true,
      action: {
        label: t("home.attention.rescheduleAction"),
        icon: CalendarClock,
        primary: true,
        onClick: () => onReschedule(visit.id),
      },
    });
  }

  for (const notice of session) {
    entries.push({
      id: `session-${notice.id}`,
      tone: "success",
      icon: CalendarCheck,
      title: notice.title,
      detail: notice.text,
      at: notice.at,
      unread: !notice.read,
      action: { label: t("notices.seeBooking"), onClick: onOpenBookings },
    });
  }

  for (const visit of shopCancelled) {
    entries.push({
      id: `cancelled-${visit.id}`,
      tone: "danger",
      icon: XCircle,
      title: t("notices.shopCancelled"),
      detail: `${when(visit.startsAt)} · ${visit.serviceName}`,
      at: visit.updatedAt ? Date.parse(visit.updatedAt) : undefined,
      action: {
        label: t("notices.bookAnother"),
        icon: CalendarPlus,
        onClick: () => onBookAgain(visit.id),
      },
    });
  }

  for (const row of pending) {
    entries.push({
      id: `reward-${row.id}`,
      tone: "pending",
      icon: Ticket,
      title: t("member.pickup", { name: row.reward_name }),
      detail: t("member.pickupUntil", { date: dateFormat.format(new Date(row.expires_at)) }),
      action: { label: t("notices.seeReward"), onClick: onOpenRewards },
    });
  }

  for (const event of waiting.events.slice(0, 10)) {
    const deadline = event.deadline ? Date.parse(event.deadline) : 0;
    // A vaga ainda aberta já aparece acima, com o botão de confirmar.
    if (event.kind === "exclusive" && deadline > nowMs) continue;
    const meta = WAIT_EVENT[event.kind] ?? { tone: "neutral" as Tone, icon: Bell };
    entries.push({
      id: `wait-${event.id}`,
      tone: meta.tone,
      icon: meta.icon,
      title: event.kind === "exclusive" ? t("wait.notices.expiredOffer") : eventLabel(event.kind),
      detail: when(event.starts_at),
      at: Date.parse(event.created_at),
      action:
        event.kind === "claimed"
          ? { label: t("notices.seeBooking"), onClick: onOpenBookings }
          : undefined,
    });
  }

  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        Number(Boolean(b.entry.urgent)) - Number(Boolean(a.entry.urgent)) ||
        (b.entry.at ?? 0) - (a.entry.at ?? 0) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);

  return (
    <div className="space-y-3">
      {waiting.error && <Notice tone="danger" title={waiting.error} />}
      {sorted.length === 0 ? (
        <EmptyState
          tone="bell"
          title={t("notices.emptyTitle")}
          description={t("notices.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((entry) => (
            <NoticeItem
              key={entry.id}
              entry={entry}
              time={
                entry.at ? timeAgo(new Date(entry.at), now, t("notices.now"), intlLocale) : null
              }
              unreadLabel={t("notices.unread")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoticeItem({
  entry,
  time,
  unreadLabel,
}: {
  entry: NoticeEntry;
  time: string | null;
  unreadLabel: string;
}) {
  const ActionIcon = entry.action?.icon;
  return (
    <li
      className={cn(
        TONE_CLASS[entry.tone],
        "app-action-card flex flex-wrap items-start gap-3 p-3.5",
      )}
      // Faixa lateral só no que pede ação (estilo em linha: `.app-action-card` manda na borda).
      style={
        entry.urgent
          ? { borderInlineStartWidth: 4, borderInlineStartColor: "var(--tone-line)" }
          : undefined
      }
    >
      <IconTile icon={entry.icon} tone={entry.tone} size="sm" />
      <div className="min-w-0 flex-1 basis-44">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
            {entry.unread && (
              <span className="me-1.5 inline-block size-2 rounded-full bg-[color:var(--tone-line)] align-middle">
                <span className="sr-only">{unreadLabel}</span>
              </span>
            )}
            {entry.title}
          </p>
          {time && (
            <span className="shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
              {time}
            </span>
          )}
        </div>
        {entry.detail && <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>}
      </div>
      {(entry.aside || entry.action) && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 ps-12">
          {entry.aside && <div className="me-auto">{entry.aside}</div>}
          {entry.action && (
            <button
              type="button"
              onClick={entry.action.onClick}
              disabled={entry.action.busy}
              aria-busy={entry.action.busy || undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-70",
                entry.action.primary
                  ? "action-button action-confirm"
                  : "border border-border bg-card hover:border-primary/40",
              )}
            >
              {ActionIcon && <ActionIcon className="size-4" aria-hidden />}
              {entry.action.label}
              {!entry.action.primary && (
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              )}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
