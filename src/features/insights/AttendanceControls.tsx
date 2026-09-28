import { useEffect, useState } from "react";
import { ClipboardPen, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n } from "@/lib/i18n";
import { parseDelay, validateOccurrence, type Occurrence } from "./occurrences";
import { friendlyAuthError } from "@/lib/auth/friendly-error";

export function AttendanceControls({
  id,
  startsAt,
  endsAt,
  active,
  status,
  onChanged,
}: {
  id: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  status: string;
  onChanged: () => void;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const [facts, setFacts] = useState<Occurrence>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [customer, setCustomer] = useState("");
  const [shop, setShop] = useState("");
  const [version, setVersion] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setFacts(demo.attendance[id] ?? {});
      setLoaded(true);
      return;
    }
    setLoaded(false);
    void supabase.rpc("get_appointment_attendance", { p_id: id }).then(({ data, error }) => {
      if (cancelled) return;
      setError(error ? tNow("ins.att.loadError") : "");
      if (!error) {
        setFacts((data ?? {}) as Occurrence);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [demo, id, version]);
  const now = demo?.now ?? new Date(clock);
  const editable =
    now >= new Date(startsAt) && (active || status === "completed") && !facts.no_show_at;
  const noShowAllowed =
    active &&
    now >= new Date(endsAt) &&
    !facts.arrived_at &&
    !facts.started_at &&
    facts.customer_delay_minutes == null &&
    facts.shop_delay_minutes == null;
  async function save(noShow = false) {
    setBusy(true);
    setError("");
    try {
      const c = parseDelay(customer);
      const s = parseDelay(shop);
      validateOccurrence(
        { starts_at: startsAt, ends_at: endsAt, status },
        facts,
        c,
        s,
        noShow,
        demo?.now ?? new Date(),
      );
      if (demo) demo.dispatch({ type: "occurrence", id, customer: c, shop: s, noShow });
      else {
        const result = await supabase.rpc("save_appointment_occurrence", {
          p_id: id,
          p_customer_delay: c,
          p_shop_delay: s,
          p_no_show: noShow,
        });
        if (result.error) throw new Error(t("ins.att.saveError"));
      }
      setOpen(false);
      setConfirmNoShow(false);
      setVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      setError(friendlyAuthError(e, t("ins.att.saveErrorShort")));
    } finally {
      setBusy(false);
    }
  }
  if (!editable && !facts.no_show_at) return null;
  return (
    <details className="border-t border-border pt-2 text-xs">
      <summary className="flex min-h-11 cursor-pointer items-center py-2 font-semibold">
        {facts.no_show_at ||
        facts.customer_delay_minutes != null ||
        facts.shop_delay_minutes != null
          ? t("ins.att.recorded")
          : t("ins.att.optional")}
      </summary>
      {facts.no_show_at ? (
        <p className="py-2 text-destructive">{t("ins.att.noShow")}</p>
      ) : (
        <>
          {facts.customer_delay_minutes != null && (
            <p>{t("ins.att.customerDelay", { minutes: facts.customer_delay_minutes })}</p>
          )}
          {facts.shop_delay_minutes != null && (
            <p>{t("ins.att.shopDelay", { minutes: facts.shop_delay_minutes })}</p>
          )}
          {error && !open && (
            <p role="alert">
              {error}{" "}
              <button
                type="button"
                className="min-h-11 px-2 font-semibold underline underline-offset-2"
                onClick={() => setVersion((v) => v + 1)}
              >
                {t("common.retry")}
              </button>
            </p>
          )}
          <button
            disabled={!loaded}
            className="action-button mt-2"
            onClick={() => {
              setCustomer(String(facts.customer_delay_minutes ?? ""));
              setShop(String(facts.shop_delay_minutes ?? ""));
              setConfirmNoShow(false);
              setError("");
              setOpen(true);
            }}
          >
            <ClipboardPen className="size-4" />
            {facts.customer_delay_minutes != null || facts.shop_delay_minutes != null
              ? t("ins.att.edit")
              : t("ins.att.record")}
          </button>
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto bg-card">
          <DialogTitle>{t("ins.att.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("ins.att.dialogHint")}</DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="block space-y-2 text-sm">
              {t("ins.att.customerDelayLabel")}
              <input
                disabled={busy}
                type="number"
                min={1}
                max={1440}
                step={1}
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setConfirmNoShow(false);
                }}
                className="w-full rounded-lg border p-3"
              />
              <span className="block text-xs text-muted-foreground">
                {t("ins.att.customerDelayHint")}
              </span>
            </label>
            <label className="block space-y-2 text-sm">
              {t("ins.att.shopDelayLabel")}
              <input
                disabled={busy}
                type="number"
                min={1}
                max={1440}
                step={1}
                value={shop}
                onChange={(e) => {
                  setShop(e.target.value);
                  setConfirmNoShow(false);
                }}
                className="w-full rounded-lg border p-3"
              />
              <span className="block text-xs text-muted-foreground">
                {t("ins.att.shopDelayHint")}
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button disabled={busy} className="action-button action-confirm w-full">
              <Save className="size-4" />
              {busy ? t("common.saving") : t("ins.att.save")}
            </button>
          </form>
          {noShowAllowed &&
            !customer.trim() &&
            !shop.trim() &&
            (confirmNoShow ? (
              <div className="space-y-3">
                <p className="text-sm">{t("ins.att.noShowConfirmText")}</p>
                <button
                  disabled={busy}
                  className="action-button action-danger"
                  onClick={() => void save(true)}
                >
                  <X className="size-4" />
                  {t("ins.att.noShowConfirm")}
                </button>
                <button
                  disabled={busy}
                  className="action-button ml-2"
                  onClick={() => setConfirmNoShow(false)}
                >
                  {t("common.back")}
                </button>
              </div>
            ) : (
              <button
                className="action-button action-danger"
                disabled={busy}
                onClick={() => setConfirmNoShow(true)}
              >
                <X className="size-4" />
                {t("ins.att.noShow")}
              </button>
            ))}
        </DialogContent>
      </Dialog>
    </details>
  );
}
