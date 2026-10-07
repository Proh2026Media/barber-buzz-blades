import {
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  History,
  Layers,
  Repeat2,
  XCircle,
} from "lucide-react";
import { ChoiceChips, ConfirmDialog, Tag } from "@/components/visual";
import type { ReservationFilter } from "@/lib/shop/appointments";
import { useShortSlot } from "./format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Filtros de Reservas: "Próximos | Anteriores" em controle segmentado e, dentro de Anteriores,
 * pílulas menores (Todos · Concluídos · Cancelados). Os quatro filtros de antes continuam.
 */
export function ReservationFilters({
  value,
  counts,
  onChange,
}: {
  value: ReservationFilter;
  counts: Record<ReservationFilter, number>;
  onChange: (value: ReservationFilter) => void;
}) {
  const { t } = useI18n();
  const past = value !== "upcoming";
  const segments = [
    {
      id: "upcoming" as const,
      label: t("bookings.upcoming"),
      icon: CalendarClock,
      count: counts.upcoming,
    },
    { id: "history" as const, label: t("bookings.past"), icon: History, count: counts.history },
  ];
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={t("bookings.filterAria")}
        className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1"
      >
        {segments.map((segment) => {
          const active = segment.id === "upcoming" ? !past : past;
          const Icon = segment.icon;
          return (
            <button
              key={segment.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(segment.id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0 max-[359px]:hidden" aria-hidden />
              <span className="min-w-0 truncate">{segment.label}</span>
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-muted text-foreground",
                )}
              >
                <span className="sr-only">: </span>
                {segment.count}
              </span>
            </button>
          );
        })}
      </div>
      {past && (
        <ChoiceChips
          label={t("bookings.pastFilterAria")}
          hideLabel
          scroll
          value={value}
          onChange={onChange}
          options={[
            { value: "history", label: t("bookings.all"), icon: Layers, count: counts.history },
            {
              value: "completed",
              label: t("bookings.completed"),
              icon: CheckCircle2,
              count: counts.completed,
              disabled: counts.completed === 0 && value !== "completed",
            },
            {
              value: "cancelled",
              label: t("bookings.cancelled"),
              icon: XCircle,
              count: counts.cancelled,
              disabled: counts.cancelled === 0 && value !== "cancelled",
            },
          ]}
        />
      )}
    </div>
  );
}

/**
 * Janela "Parar a repetição?": mostra, riscadas, as datas que serão canceladas, com
 * "Manter repetição" e "Parar e cancelar as próximas".
 */
export function StopRepeatDialog({
  open,
  dates,
  timeZone,
  errorText,
  onKeep,
  onConfirm,
}: {
  open: boolean;
  /** Próximas datas da repetição (ISO). */
  dates: string[];
  timeZone: string;
  /** Frase mostrada dentro da janela se parar falhar. */
  errorText: string;
  onKeep: () => void;
  onConfirm: () => Promise<unknown> | unknown;
}) {
  const { t } = useI18n();
  const shortSlot = useShortSlot();
  const pill = (iso: string) => {
    const slot = shortSlot(iso, timeZone);
    return `${slot.day} · ${slot.time}`;
  };
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeep();
      }}
      tone="danger"
      icon={Repeat2}
      title={t("bookings.stopRepeatTitle")}
      consequences={[
        {
          key: "cancel",
          tone: "danger",
          icon: CalendarX2,
          text: t("bookings.stopRepeatWillCancel"),
        },
        { key: "free", tone: "muted", text: t("cancel.freed") },
      ]}
      confirmLabel={t("bookings.stopRepeatConfirm")}
      busyLabel={t("bookings.cancelling")}
      confirmIcon={XCircle}
      cancelLabel={t("bookings.keepRepeat")}
      onConfirm={onConfirm}
      errorText={errorText}
    >
      {dates.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("bookings.stopRepeatWillCancel")}>
          {dates.map((iso) => (
            <li key={iso}>
              <Tag className="line-through decoration-2">{pill(iso)}</Tag>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
}
