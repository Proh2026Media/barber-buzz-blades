import { useEffect, useRef, useState } from "react";
import { Clock3, Check, X, RotateCcw, UserPlus, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DurationPicker } from "@/components/ui/schedule-picker";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "../demo/context";
import { cutoffExample, eventLabel, remaining } from "./model";
import type { WaitingController } from "./useWaiting";

const WAITING_CUTOFF_MAX = 1440;
const PRECISION_HOLD_MS = 3000;
const PRECISION_SLOWDOWN = 8;

function clampCutoff(value: number) {
  return Math.max(0, Math.min(WAITING_CUTOFF_MAX, Math.round(value)));
}

function cutoffFromPointer(clientX: number, track: DOMRect, pointerOffset = 0) {
  if (track.width <= 0) return 0;
  return clampCutoff(((clientX - pointerOffset - track.left) / track.width) * WAITING_CUTOFF_MAX);
}

function preciseCutoffFromPointer(origin: number, deltaX: number, trackWidth: number) {
  if (trackWidth <= 0) return origin;
  return clampCutoff(origin + (deltaX / trackWidth) * (WAITING_CUTOFF_MAX / PRECISION_SLOWDOWN));
}

export function WaitingSettings({
  settings,
  onSaved,
  onSaveRequest,
}: {
  settings: Tables<"barbershop_settings">;
  onSaved: (s: Tables<"barbershop_settings">) => void;
  onSaveRequest?: (enabled: boolean, cutoff: number) => Promise<"applied" | "pending">;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(settings.waiting_enabled);
  const [cutoff, setCutoff] = useState(settings.waiting_cutoff_minutes);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [precisionMode, setPrecisionMode] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderThumbRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    pointerOffset: number;
    latestX: number;
    precise: boolean;
    precisionOriginX: number;
    precisionOriginValue: number;
  } | null>(null);
  const cutoffRef = useRef(cutoff);
  cutoffRef.current = cutoff;

  const clearPrecisionTimer = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const updateCutoff = (value: number) => {
    const next = clampCutoff(value);
    cutoffRef.current = next;
    setCutoff(next);
    setSaved(false);
  };

  const endSliderInteraction = () => {
    clearPrecisionTimer();
    dragRef.current = null;
    setPrecisionMode(false);
  };

  useEffect(() => () => clearPrecisionTimer(), []);
  useEffect(() => {
    setEnabled(settings.waiting_enabled);
    setCutoff(settings.waiting_cutoff_minutes);
    setPrecisionMode(false);
    dragRef.current = null;
    clearPrecisionTimer();
  }, [settings.waiting_enabled, settings.waiting_cutoff_minutes]);
  const valid = Number.isInteger(cutoff) && cutoff >= 0 && cutoff <= 1440;
  const cutoffPosition = (cutoff / WAITING_CUTOFF_MAX) * 100;
  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let next = { ...settings, waiting_enabled: enabled, waiting_cutoff_minutes: cutoff };
      if (demo) demo.dispatch({ type: "settings.save", settings: next });
      else if (onSaveRequest) {
        const status = await onSaveRequest(enabled, cutoff);
        if (status === "pending") {
          setSaved(true);
          setConfirm(false);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("barbershop_settings")
          .update({ waiting_enabled: enabled, waiting_cutoff_minutes: cutoff })
          .eq("barbershop_id", settings.barbershop_id)
          .select("*")
          .single();
        if (error) throw error;
        next = data;
      }
      onSaved(next);
      setSaved(true);
      setConfirm(false);
      window.dispatchEvent(new Event("waiting-changed"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="app-action-card space-y-4 p-5" aria-label={t("wait.settings.aria")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("wait.settings.section")}</p>
          <h3 className="font-bold flex items-center gap-2">
            <Clock3 className="size-4" />
            {t("wait.settings.title")}
          </h3>
        </div>
        <Switch
          aria-label={t("wait.settings.toggle")}
          checked={enabled}
          disabled={busy}
          onCheckedChange={(value) => {
            setEnabled(value);
            setSaved(false);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-lg bg-muted px-3 py-2">{t("wait.settings.hold")}</span>
        <span className="rounded-lg bg-muted px-3 py-2">{t("wait.settings.claim")}</span>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <label id="waiting-cutoff-label" className="text-sm font-semibold">
            {t("wait.settings.cutoff")}
          </label>
          <DurationPicker
            value={cutoff}
            disabled={busy}
            onChange={(value) => {
              updateCutoff(value);
            }}
          />
        </div>
        <div
          ref={sliderRef}
          className={`waiting-cutoff-slider mt-3 ${precisionMode ? "is-precise" : ""}`}
          onPointerDown={(event) => {
            if (busy || event.button !== 0 || !sliderTrackRef.current) return;
            const track = sliderTrackRef.current.getBoundingClientRect();
            const pressedThumb =
              event.target instanceof Element &&
              Boolean(event.target.closest("[data-waiting-thumb]"));
            const thumbCenter = track.left + (cutoffRef.current / WAITING_CUTOFF_MAX) * track.width;
            const pointerOffset = pressedThumb ? event.clientX - thumbCenter : 0;

            if (!pressedThumb) updateCutoff(cutoffFromPointer(event.clientX, track));
            dragRef.current = {
              pointerId: event.pointerId,
              pointerOffset,
              latestX: event.clientX,
              precise: false,
              precisionOriginX: event.clientX,
              precisionOriginValue: cutoffRef.current,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            sliderThumbRef.current?.focus({ preventScroll: true });
            clearPrecisionTimer();
            holdTimerRef.current = setTimeout(() => {
              const drag = dragRef.current;
              if (!drag) return;
              drag.precise = true;
              drag.precisionOriginX = drag.latestX;
              drag.precisionOriginValue = cutoffRef.current;
              setPrecisionMode(true);
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(30);
              }
            }, PRECISION_HOLD_MS);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            const trackElement = sliderTrackRef.current;
            if (!drag || drag.pointerId !== event.pointerId || !trackElement) return;
            drag.latestX = event.clientX;
            const track = trackElement.getBoundingClientRect();
            updateCutoff(
              drag.precise
                ? preciseCutoffFromPointer(
                    drag.precisionOriginValue,
                    event.clientX - drag.precisionOriginX,
                    track.width,
                  )
                : cutoffFromPointer(event.clientX, track, drag.pointerOffset),
            );
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) endSliderInteraction();
          }}
          onPointerCancel={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) endSliderInteraction();
          }}
          onLostPointerCapture={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) endSliderInteraction();
          }}
        >
          <div className="waiting-cutoff-rail">
            <div ref={sliderTrackRef} className="waiting-cutoff-track" aria-hidden>
              <span className="waiting-cutoff-range" style={{ width: `${cutoffPosition}%` }} />
            </div>
            <button
              ref={sliderThumbRef}
              id="waiting-cutoff"
              type="button"
              role="slider"
              data-waiting-thumb
              disabled={busy}
              aria-valuemin={0}
              aria-valuemax={WAITING_CUTOFF_MAX}
              aria-valuenow={cutoff}
              aria-labelledby="waiting-cutoff-label"
              aria-describedby="waiting-cutoff-help"
              aria-valuetext={t(
                precisionMode ? "wait.settings.valueTextPrecise" : "wait.settings.valueText",
                { minutes: cutoff },
              )}
              className="waiting-cutoff-thumb rounded-full"
              style={{ left: `${cutoffPosition}%` }}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? cutoff + 1
                    : event.key === "ArrowLeft" || event.key === "ArrowDown"
                      ? cutoff - 1
                      : event.key === "PageUp"
                        ? cutoff + 60
                        : event.key === "PageDown"
                          ? cutoff - 60
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? WAITING_CUTOFF_MAX
                              : null;
                if (next === null) return;
                event.preventDefault();
                updateCutoff(next);
              }}
            />
          </div>
        </div>
        <div aria-hidden className="flex justify-between text-[11px] text-muted-foreground">
          <span>0 min</span>
          <span>12h</span>
          <span>24h</span>
        </div>
        <p id="waiting-cutoff-help" className="sr-only" aria-live="polite">
          {precisionMode ? t("wait.settings.precisionOn") : t("wait.settings.precisionHint")}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("wait.settings.explain")}</p>
      {valid && (
        <p className="rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed">
          {cutoffExample(cutoff)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("wait.settings.rulesNote")}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !valid}
        className="action-button action-confirm"
        onClick={() => (settings.waiting_enabled && !enabled ? setConfirm(true) : void save())}
      >
        <Save className="size-4" />
        {busy ? t("common.saving") : t("wait.settings.save")}
      </button>
      {saved && (
        <p role="status" className="text-sm">
          {t("wait.settings.saved")}
        </p>
      )}
      <AlertDialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("wait.settings.offTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("wait.settings.offBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.back")}</AlertDialogCancel>
            <button
              className="action-button action-danger"
              disabled={busy}
              onClick={() => void save()}
            >
              <X className="size-4" />
              {t("wait.settings.offConfirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function WaitingCards({
  controller,
  mode,
  staff,
  service,
  day,
  appointmentId,
  onChanged,
}: {
  controller: WaitingController;
  mode: "opportunities" | "mine" | "shop";
  staff: Tables<"staff">[];
  service?: Tables<"services">;
  day?: string;
  appointmentId?: string;
  onChanged?: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const { waits, now, busy, error, act } = controller;
  const rows = waits.filter((w) => {
    const d = new Date(w.starts_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (mode === "shop")
      return (!appointmentId || w.appointment_id === appointmentId) && (!day || key === day);
    if (mode === "mine") return w.mine;
    return (
      !w.has_interest &&
      service &&
      service.duration_minutes * 60000 <= Date.parse(w.ends_at) - Date.parse(w.starts_at) &&
      key === day &&
      Date.parse(w.hold_until) > +now
    );
  });
  if (!rows.length)
    return error && mode !== "shop" ? (
      <p role="alert" className="rounded-xl bg-card p-3 text-sm text-destructive">
        {t("wait.card.errorPrefix", { error })}
      </p>
    ) : null;
  return (
    <div className="space-y-3">
      {rows.map((w) => {
        const holding = Date.parse(w.hold_until) > +now;
        return (
          <section key={w.id} className="app-action-card space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="size-4 text-gold" />
                {mode === "opportunities"
                  ? t("wait.card.mayOpen")
                  : holding
                    ? t("wait.card.holding")
                    : t("wait.card.exclusive")}
              </h3>
              <span className="mb-waiting-timer rounded-xl bg-muted px-2.5 py-1 text-xs font-bold tabular-nums text-gold">
                {remaining(holding ? w.hold_until : w.claim_until, now)}
              </span>
            </div>
            <p className="text-sm">
              {new Date(w.starts_at).toLocaleDateString(intlLocale)} ·{" "}
              {new Date(w.starts_at).toLocaleTimeString(intlLocale, {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ·{" "}
              {staff.find((s) => s.id === w.staff_id)?.display_name ?? t("wait.card.staffFallback")}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === "opportunities"
                ? t("wait.card.oppHint")
                : mode === "shop"
                  ? w.has_interest
                    ? t("wait.card.shopWaiting")
                    : t("wait.card.shopNone")
                  : holding
                    ? t("wait.card.mineHolding")
                    : t("wait.card.mineClaim")}
            </p>
            <div className="flex flex-wrap gap-2">
              {mode === "opportunities" && (
                <button
                  disabled={busy}
                  className="action-button action-confirm"
                  onClick={() =>
                    void act(w.id, "join", service?.id).then((ok) => {
                      if (ok) onChanged?.();
                    })
                  }
                >
                  <UserPlus className="size-4" />
                  {t("wait.card.join")}
                </button>
              )}
              {mode === "mine" && !holding && (
                <button
                  disabled={busy}
                  className="action-button action-confirm"
                  onClick={() =>
                    void act(w.id, "claim").then((ok) => {
                      if (ok) onChanged?.();
                    })
                  }
                >
                  <Check className="size-4" />
                  {t("wait.card.claim")}
                </button>
              )}
              {mode === "mine" && (
                <button
                  disabled={busy}
                  className="action-button action-danger"
                  onClick={() =>
                    void act(w.id, "leave").then((ok) => {
                      if (ok) onChanged?.();
                    })
                  }
                >
                  <X className="size-4" />
                  {t("wait.card.leave")}
                </button>
              )}
              {mode === "shop" && holding && w.restorable && (
                <button
                  disabled={busy}
                  className="action-button action-confirm"
                  onClick={() =>
                    void act(w.id, "restore").then((ok) => {
                      if (ok) onChanged?.();
                    })
                  }
                >
                  <RotateCcw className="size-4" />
                  {t("wait.card.restore")}
                </button>
              )}
            </div>
          </section>
        );
      })}
      {error && (
        <p role="alert" className="rounded-xl bg-card p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function WaitingNotices({ controller }: { controller: WaitingController }) {
  const { t, intlLocale } = useI18n();
  if (!controller.events.length) return null;
  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
      aria-label={t("wait.notices.title")}
    >
      <h3 className="font-bold text-sm">{t("wait.notices.title")}</h3>
      {controller.events.slice(0, 10).map((e) => (
        <div key={e.id} className="border-t border-border pt-3">
          <p className="text-sm">
            {e.kind === "exclusive" && e.deadline && Date.parse(e.deadline) <= +controller.now
              ? t("wait.notices.expiredOffer")
              : eventLabel(e.kind)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("wait.notices.time", {
              time: new Date(e.starts_at).toLocaleString(intlLocale, {
                dateStyle: "short",
                timeStyle: "short",
              }),
            })}
            {e.kind === "exclusive" && e.deadline && Date.parse(e.deadline) > +controller.now
              ? ` · ${t("wait.notices.confirmBy", {
                  time: new Date(e.deadline).toLocaleTimeString(intlLocale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}`
              : ""}
          </p>
        </div>
      ))}
    </section>
  );
}
