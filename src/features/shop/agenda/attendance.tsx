import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardPen,
  Loader2,
  Save,
  Scissors,
  StarOff,
  Store,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChoiceChips, ConfirmDialog, IconTile, Notice, Tag } from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import { validateOccurrence, type Occurrence } from "@/features/insights/occurrences";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n } from "@/lib/i18n";
import { AppointmentSummary, useShopTime } from "./summary";
import type { DayAppointment } from "./types";

const MINUTE = 60_000;

/**
 * Ocorrências de um atendimento (atrasos e falta): lê do banco (ou da demonstração) e grava.
 * Cada cartão da Agenda usa o seu, como antes fazia o antigo painel "Ocorrências".
 */
export function useAttendance(row: DayAppointment, enabled: boolean) {
  const demo = useDemo();
  const [facts, setFacts] = useState<Occurrence>({});
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const id = row.id;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (demo) {
      setFacts(demo.attendance[id] ?? {});
      setLoaded(true);
      setFailed(false);
      return;
    }
    setLoaded(false);
    void supabase.rpc("get_appointment_attendance", { p_id: id }).then(({ data, error }) => {
      if (cancelled) return;
      setFailed(!!error);
      if (!error) {
        setFacts((data ?? {}) as Occurrence);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demo, id, version, enabled]);

  async function save(customer: number | null, shop: number | null, noShow: boolean) {
    validateOccurrence(row, facts, customer, shop, noShow, demo?.now ?? new Date());
    if (demo) demo.dispatch({ type: "occurrence", id, customer, shop, noShow });
    else {
      const result = await supabase.rpc("save_appointment_occurrence", {
        p_id: id,
        p_customer_delay: customer,
        p_shop_delay: shop,
        p_no_show: noShow,
      });
      if (result.error) throw new Error(tNow("ins.att.saveError"));
    }
    setVersion((value) => value + 1);
  }

  return { facts, loaded, failed, save, reload: () => setVersion((value) => value + 1) };
}

export type Attendance = ReturnType<typeof useAttendance>;

/** O que dá para registrar agora (mesmas regras de antes, conferidas também no banco). */
export function occurrenceRules(row: DayAppointment, facts: Occurrence, now: Date) {
  const active = row.status === "pending" || row.status === "confirmed";
  const hasDelay = facts.customer_delay_minutes != null || facts.shop_delay_minutes != null;
  return {
    editable:
      now >= new Date(row.starts_at) && (active || row.status === "completed") && !facts.no_show_at,
    noShowAllowed:
      active && now >= new Date(row.ends_at) && !facts.arrived_at && !facts.started_at && !hasDelay,
    hasDelay,
  };
}

/** Pílulas que ficam no cartão depois de registrar: "Cliente +10 min", "Barbearia +5 min". */
export function OccurrenceTags({ facts }: { facts: Occurrence }) {
  const { t } = useI18n();
  return (
    <>
      {facts.customer_delay_minutes != null && (
        <Tag icon={UserCheck}>
          {t("agenda.occ.customerTag", { minutes: facts.customer_delay_minutes })}
        </Tag>
      )}
      {facts.shop_delay_minutes != null && (
        <Tag icon={Store}>{t("agenda.occ.shopTag", { minutes: facts.shop_delay_minutes })}</Tag>
      )}
    </>
  );
}

const CUSTOMER_OPTIONS = [0, 5, 10, 15, 20, 30];
const SHOP_OPTIONS = [0, 5, 10, 15];

/**
 * Atraso do atendimento em escolhas de botão (com "Outro" para o valor exato) e uma linha
 * desenhada pelas escolhas: marcado → chegou → começou. A falta abre a própria janela.
 */
export function OccurrenceDialog({
  open,
  onOpenChange,
  row,
  attendance,
  timeZone,
  onSaved,
  onNoShow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: DayAppointment;
  attendance: Attendance;
  timeZone: string;
  onSaved: () => void;
  onNoShow: () => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const time = useShopTime(timeZone);
  const [customer, setCustomer] = useState(0);
  const [shop, setShop] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { facts } = attendance;

  useEffect(() => {
    if (!open) return;
    setCustomer(facts.customer_delay_minutes ?? 0);
    setShop(facts.shop_delay_minutes ?? 0);
    setError("");
  }, [open, facts.customer_delay_minutes, facts.shop_delay_minutes]);

  const rules = occurrenceRules(row, facts, demo?.now ?? new Date());
  const scheduled = Date.parse(row.starts_at);
  const arrived = scheduled + customer * MINUTE;
  const began = Math.max(scheduled, arrived) + shop * MINUTE;
  const minutes = (value: number) =>
    value === 0 ? t("agenda.occ.none") : t("agenda.minutes", { minutes: value });

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await attendance.save(customer || null, shop || null, false);
      onOpenChange(false);
      onSaved();
    } catch (cause) {
      setError(friendlyAuthError(cause, t("ins.att.saveErrorShort")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto rounded-3xl bg-card">
        <div className="flex items-start gap-3 pr-8">
          <IconTile icon={ClipboardPen} />
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-lg font-bold leading-snug">
              {t("agenda.occ.title")}
            </DialogTitle>
            <DialogDescription>
              {`${row.customer?.full_name ?? t("shop.customerFallback")} · ${time(row.starts_at)}`}
            </DialogDescription>
          </div>
        </div>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ChoiceChips
            label={t("agenda.occ.customerLabel")}
            icon={UserCheck}
            value={customer}
            onChange={setCustomer}
            disabled={busy}
            options={CUSTOMER_OPTIONS.map((value) => ({ value, label: minutes(value) }))}
            other={{
              min: 1,
              max: 1440,
              unit: t("agenda.occ.unit"),
              inputLabel: t("agenda.occ.otherMinutes"),
            }}
          />
          <ChoiceChips
            label={t("agenda.occ.shopLabel")}
            icon={Store}
            value={shop}
            onChange={setShop}
            disabled={busy}
            options={SHOP_OPTIONS.map((value) => ({ value, label: minutes(value) }))}
            other={{
              min: 1,
              max: 1440,
              unit: t("agenda.occ.unit"),
              inputLabel: t("agenda.occ.otherMinutes"),
            }}
          />
          <div
            className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-background/60 p-3"
            aria-label={t("agenda.occ.lineAria")}
            role="group"
          >
            <Tag icon={CalendarClock}>{t("agenda.occ.scheduled", { time: time(scheduled) })}</Tag>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
            <Tag icon={UserCheck}>{t("agenda.occ.arrived", { time: time(arrived) })}</Tag>
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
            <Tag icon={Scissors}>{t("agenda.occ.began", { time: time(began) })}</Tag>
          </div>
          {error && <Notice tone="danger" title={error} />}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="action-button action-confirm min-h-11 w-full"
            >
              {busy ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
              ) : (
                <Save aria-hidden />
              )}
              {busy ? t("common.saving") : t("agenda.occ.save")}
            </button>
          </div>
        </form>
        {rules.noShowAllowed && customer === 0 && shop === 0 && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                window.setTimeout(onNoShow, 0);
              }}
              className="action-button action-danger min-h-11 w-full"
            >
              <UserX aria-hidden />
              {t("agenda.noShow.action")}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "O cliente não veio?": encerra o horário como falta, sem pontos. */
export function NoShowDialog({
  open,
  onOpenChange,
  row,
  attendance,
  timeZone,
  showStaff,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: DayAppointment;
  attendance: Attendance;
  timeZone: string;
  showStaff?: boolean;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={UserX}
      title={t("agenda.noShow.title")}
      summary={<AppointmentSummary row={row} timeZone={timeZone} showStaff={showStaff} />}
      consequences={[
        { key: "closed", tone: "danger", icon: XCircle, text: t("agenda.noShow.closed") },
        { key: "points", tone: "muted", icon: StarOff, text: t("agenda.noShow.noPoints") },
      ]}
      confirmLabel={t("agenda.noShow.confirm")}
      busyLabel={t("common.saving")}
      confirmIcon={UserX}
      cancelLabel={t("common.back")}
      errorText={t("agenda.noShow.error")}
      onConfirm={async () => {
        await attendance.save(null, null, true);
        onSaved();
      }}
    />
  );
}
