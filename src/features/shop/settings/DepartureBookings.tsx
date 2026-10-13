import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  BellRing,
  CalendarClock,
  CalendarX,
  Loader2,
  Scissors,
  UserRound,
} from "lucide-react";
import { ActionResult, ConfirmDialog, DetailList, type ActionState } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { useI18n } from "@/lib/i18n";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

export type DepartureBooking = {
  id: string;
  staff_id: string;
  staff_name: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string | null;
  customer_name: string | null;
  free_staff: { id: string; name: string }[];
};

type DepartureBookingsProps = {
  shopId: string;
  /** Profissional que vai sair. Sem ele: reservas de quem já saiu da equipe. */
  staffId: string | null;
  title: string;
  hint?: string;
  timeZone?: string;
  /** Depois de passar ou cancelar (o pedido de saída atualiza a contagem). */
  onChanged?: () => void;
};

/**
 * Reservas marcadas de quem sai (ou já saiu): o dono passa cada uma para um colega livre no
 * horário ou cancela avisando o cliente. Sem a função no servidor, não mostra nada.
 */
export function DepartureBookings({
  shopId,
  staffId,
  title,
  hint,
  timeZone,
  onChanged,
}: DepartureBookingsProps) {
  const { t, intlLocale } = useI18n();
  // Demonstração: a equipe fictícia não tem reservas de quem sai.
  const demoOn = Boolean(useDemo());
  const [rows, setRows] = useState<DepartureBooking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [passing, setPassing] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DepartureBooking | null>(null);
  const [cancelError, setCancelError] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<{ id: string; state: ActionState; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoadError(null);
    if (demoOn) {
      setRows([]);
      return;
    }
    const { data, error } = await supabase.rpc("list_departure_appointments", {
      p_shop_id: shopId,
      p_staff_id: staffId,
    });
    if (error) {
      // Banco ainda sem a função: a tela segue como antes, sem a lista.
      if (error.code === "PGRST202" || error.code === "42883") setRows([]);
      else setLoadError(friendlyAuthError(error, t("eq.leave.bookingsFailed")));
      return;
    }
    setRows(Array.isArray(data) ? (data as unknown as DepartureBooking[]) : []);
  }, [shopId, staffId, t, demoOn]);

  useEffect(() => {
    void load();
  }, [load]);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));

  async function pass(row: DepartureBooking) {
    const target = choice[row.id] ?? row.free_staff[0]?.id;
    if (!target) return;
    const name = row.free_staff.find((staff) => staff.id === target)?.name ?? "";
    setPassing(row.id);
    setOutcome(null);
    try {
      const { error } = await supabase.rpc("reassign_appointment_staff", {
        p_appointment_id: row.id,
        p_staff_id: target,
      });
      if (error) throw error;
      setOutcome({ id: row.id, state: "saved", text: t("eq.leave.passed", { name }) });
      await load();
      onChanged?.();
    } catch (err) {
      setOutcome({
        id: row.id,
        state: "error",
        text: friendlyAuthError(err, t("eq.leave.bookingFailed")),
      });
    } finally {
      setPassing(null);
    }
  }

  async function cancelBooking() {
    if (!cancelTarget) return;
    setCancelError(undefined);
    const { error } = await supabase.rpc("cancel_appointment", {
      p_id: cancelTarget.id,
      p_reason: "other",
    });
    if (error) {
      setCancelError(friendlyAuthError(error, t("eq.leave.bookingFailed")));
      throw error;
    }
    setOutcome({ id: cancelTarget.id, state: "saved", text: t("eq.leave.bookingCancelled") });
    await load();
    onChanged?.();
  }

  if (loadError) return <ActionResult state="error" text={loadError} onRetry={() => void load()} />;
  if (rows === null) return null;
  if (rows.length === 0) {
    return outcome ? (
      <ActionResult state={outcome.state} text={outcome.text} onDismiss={() => setOutcome(null)} />
    ) : null;
  }

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-gold" aria-hidden />
          {title}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const selectId = `departure-pass-${row.id}`;
          const busy = passing === row.id;
          return (
            <li
              key={row.id}
              className="space-y-3 rounded-2xl border border-border bg-background/60 p-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-bold">{when(row.starts_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {[row.service_name, row.customer_name, staffId ? null : row.staff_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {row.free_staff.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label htmlFor={selectId} className="min-w-0 flex-1 space-y-1">
                    <span className="block text-xs font-semibold">{t("eq.leave.passTo")}</span>
                    <select
                      id={selectId}
                      className="h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-base sm:text-sm"
                      value={choice[row.id] ?? row.free_staff[0]!.id}
                      disabled={!!passing}
                      onChange={(event) =>
                        setChoice((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                    >
                      {row.free_staff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!!passing}
                    onClick={() => void pass(row)}
                    className="action-button action-confirm min-h-11 justify-center"
                  >
                    {busy ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <ArrowRightLeft className="size-4" aria-hidden />
                    )}
                    {t("eq.leave.pass")}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("eq.leave.noFree")}</p>
              )}
              <button
                type="button"
                disabled={!!passing}
                onClick={() => {
                  setCancelError(undefined);
                  setCancelTarget(row);
                }}
                className="action-button action-danger min-h-11 w-full justify-center sm:w-auto"
              >
                <CalendarX className="size-4" aria-hidden />
                {t("eq.leave.cancelBooking")}
              </button>
              {outcome && outcome.id === row.id && (
                <ActionResult
                  state={outcome.state}
                  text={outcome.text}
                  onDismiss={() => setOutcome(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {outcome && !rows.some((row) => row.id === outcome.id) && (
        <ActionResult
          state={outcome.state}
          text={outcome.text}
          onDismiss={() => setOutcome(null)}
        />
      )}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(next) => {
          if (!next) setCancelTarget(null);
        }}
        title={t("eq.leave.cancelConfirm")}
        summary={
          cancelTarget ? (
            <DetailList
              items={[
                {
                  icon: CalendarClock,
                  label: t("eq.diff.when"),
                  value: when(cancelTarget.starts_at),
                },
                {
                  icon: UserRound,
                  label: t("shop.customerFallback"),
                  value: cancelTarget.customer_name ?? t("shop.customerFallback"),
                },
                {
                  icon: Scissors,
                  label: t("booking.service"),
                  value: cancelTarget.service_name ?? t("shop.serviceFallback"),
                },
              ]}
            />
          ) : undefined
        }
        consequences={[{ icon: BellRing, tone: "warning", text: t("eq.leave.cancelNotice") }]}
        confirmLabel={t("eq.leave.cancelYes")}
        confirmIcon={CalendarX}
        cancelLabel={t("eq.leave.keep")}
        errorText={cancelError}
        onConfirm={cancelBooking}
      />
    </section>
  );
}
