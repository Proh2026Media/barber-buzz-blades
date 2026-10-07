import {
  CalendarClock,
  CalendarX2,
  CircleCheck,
  Hourglass,
  Repeat,
  Star,
  Timer,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { ConfirmDialog, Notice, Steps } from "@/components/visual";
import { CLAIM_MINUTES, HOLD_MINUTES } from "@/features/waiting/model";
import { useI18n } from "@/lib/i18n";
import { AppointmentSummary, useShopTime } from "./summary";
import type { DayAppointment } from "./types";

type BaseProps = {
  row: DayAppointment | null;
  onClose: () => void;
  timeZone: string;
  showStaff?: boolean;
};

/**
 * "Pedir para remarcar" (antes "Retirar confirmação"): mostra o atendimento e, em passos com
 * ícone, o que acontece depois — com ou sem a espera de 10 minutos.
 */
export function WithdrawDialog({
  row,
  onClose,
  timeZone,
  showStaff,
  hold,
  onConfirm,
}: BaseProps & { hold: boolean; onConfirm: (row: DayAppointment) => Promise<unknown> }) {
  const { t } = useI18n();
  const steps = hold
    ? [
        {
          key: "hold",
          icon: Timer,
          label: t("agenda.withdraw.stepHold", { minutes: HOLD_MINUTES }),
          description: t("agenda.withdraw.stepHoldHint"),
        },
        {
          key: "queue",
          icon: Users,
          label: t("agenda.withdraw.stepQueue", { minutes: CLAIM_MINUTES }),
        },
        { key: "customer", icon: UserRoundSearch, label: t("agenda.withdraw.stepCustomer") },
      ]
    : [
        { key: "free", icon: CalendarX2, label: t("agenda.withdraw.stepFree") },
        { key: "customer", icon: UserRoundSearch, label: t("agenda.withdraw.stepCustomer") },
      ];
  return (
    <ConfirmDialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="warning"
      icon={CalendarClock}
      title={t("agenda.withdraw.title")}
      summary={row && <AppointmentSummary row={row} timeZone={timeZone} showStaff={showStaff} />}
      confirmLabel={t("agenda.withdraw.confirm")}
      busyLabel={t("common.saving")}
      confirmIcon={CalendarClock}
      cancelLabel={t("agenda.keep")}
      errorText={t("shop.error.changeAppointment")}
      onConfirm={() => (row ? onConfirm(row) : undefined)}
    >
      <Steps
        orientation="vertical"
        label={t("agenda.withdraw.stepsLabel")}
        steps={steps.map((step, index) => ({
          ...step,
          status: index === 0 ? "current" : "upcoming",
        }))}
      />
    </ConfirmDialog>
  );
}

/** "Parar repetições": janela do sistema no lugar do `window.confirm`. */
export function StopSeriesDialog({
  row,
  onClose,
  timeZone,
  showStaff,
  demo,
  onConfirm,
}: BaseProps & { demo: boolean; onConfirm: (seriesId: string) => Promise<unknown> }) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="danger"
      icon={Repeat}
      title={t("agenda.series.title")}
      summary={row && <AppointmentSummary row={row} timeZone={timeZone} showStaff={showStaff} />}
      consequences={[
        { key: "next", tone: "danger", icon: CalendarX2, text: t("agenda.series.next") },
        { key: "this", tone: "success", icon: CircleCheck, text: t("agenda.series.keepPast") },
      ]}
      confirmLabel={t("agenda.series.confirm")}
      busyLabel={t("common.saving")}
      confirmIcon={Repeat}
      cancelLabel={t("agenda.series.keep")}
      errorText={t("shop.error.stopSeries")}
      confirmDisabled={demo}
      onConfirm={() => (row?.series_id ? onConfirm(row.series_id) : undefined)}
    >
      {demo && <Notice tone="info" role="none" title={t("agenda.series.demo")} />}
    </ConfirmDialog>
  );
}

/** Concluir antes do início pede uma confirmação curta (antes, um parágrafo em todo cartão). */
export function CompleteEarlyDialog({
  row,
  onClose,
  timeZone,
  showStaff,
  loyalty,
  onConfirm,
}: BaseProps & { loyalty: boolean; onConfirm: (row: DayAppointment) => Promise<unknown> }) {
  const { t } = useI18n();
  const time = useShopTime(timeZone);
  return (
    <ConfirmDialog
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="success"
      icon={Hourglass}
      title={t("agenda.early.title", { time: row ? time(row.starts_at) : "" })}
      summary={row && <AppointmentSummary row={row} timeZone={timeZone} showStaff={showStaff} />}
      consequences={[
        { key: "done", tone: "success", icon: CircleCheck, text: t("agenda.early.done") },
        ...(loyalty
          ? [{ key: "points", tone: "gold" as const, icon: Star, text: t("agenda.early.points") }]
          : []),
      ]}
      confirmLabel={t("agenda.early.confirm")}
      busyLabel={t("agenda.busy.complete")}
      confirmIcon={CircleCheck}
      cancelLabel={t("common.back")}
      errorText={t("shop.error.changeAppointment")}
      onConfirm={() => (row ? onConfirm(row) : undefined)}
    />
  );
}
