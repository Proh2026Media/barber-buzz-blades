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
import { useDemo } from "../demo/context";
import { cutoffExample, eventLabels, remaining } from "./model";
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
    <section className="app-action-card space-y-4 p-5" aria-label="Agenda: espera por horário">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Agenda</p>
          <h3 className="font-bold flex items-center gap-2">
            <Clock3 className="size-4" />
            Espera por horário
          </h3>
        </div>
        <Switch
          aria-label="Ativar espera por horário"
          checked={enabled}
          disabled={busy}
          onCheckedChange={(value) => {
            setEnabled(value);
            setSaved(false);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-lg bg-muted px-3 py-2">Retenção · 10 min</span>
        <span className="rounded-lg bg-muted px-3 py-2">Confirmação · 5 min</span>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <label id="waiting-cutoff-label" className="text-sm font-semibold">
            Antecedência mínima
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
              aria-valuetext={`${cutoff} minutos${precisionMode ? ", modo de precisão" : ""}`}
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
          {precisionMode
            ? "Modo de precisão ativo. Solte o controle para voltar ao modo normal."
            : "Mantenha o controle pressionado por 3 segundos para ajustar com mais precisão."}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Quando você retirar uma confirmação, o horário poderá receber um interessado durante 10
        minutos. Se for liberado, ele terá 5 minutos para confirmar. Esse processo só começa quando
        os 15 minutos completos cabem antes da antecedência mínima configurada. Fora dessa condição,
        o horário é liberado imediatamente.
      </p>
      {valid && (
        <p className="rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed">
          {cutoffExample(cutoff)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Novas regras de antecedência valem para novas esperas. Desligar encerra todas as esperas em
        andamento.
      </p>
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
        {busy ? "Salvando…" : "Salvar espera"}
      </button>
      {saved && (
        <p role="status" className="text-sm">
          Configuração salva ou enviada para aprovação.
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
            <AlertDialogTitle>Desligar espera por horário?</AlertDialogTitle>
            <AlertDialogDescription>
              As esperas em andamento serão encerradas e seus horários liberados. Os interessados
              serão avisados. Reservas já confirmadas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
            <button
              className="action-button action-danger"
              disabled={busy}
              onClick={() => void save()}
            >
              <X className="size-4" />
              Desligar e liberar
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
        Espera: {error}
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
                  ? "Pode ser liberado"
                  : holding
                    ? "Horário em espera"
                    : "Vaga exclusiva"}
              </h3>
              <span className="mb-waiting-timer rounded-xl bg-muted px-2.5 py-1 text-xs font-bold tabular-nums text-gold">
                {remaining(holding ? w.hold_until : w.claim_until, now)}
              </span>
            </div>
            <p className="text-sm">
              {new Date(w.starts_at).toLocaleDateString("pt-BR")} ·{" "}
              {new Date(w.starts_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {staff.find((s) => s.id === w.staff_id)?.display_name ?? "Profissional"}
            </p>
            <p className="text-xs text-muted-foreground">
              {mode === "opportunities"
                ? "Um interessado por vaga. Se liberada, você terá 5 minutos para confirmar."
                : mode === "shop"
                  ? w.has_interest
                    ? "Um cliente aguardando."
                    : "Ainda sem interessado."
                  : holding
                    ? "Você é o único interessado. Aguarde a liberação."
                    : "Confirme antes de o prazo terminar para garantir o horário."}
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
                  Tenho interesse
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
                  Confirmar horário
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
                  Desistir
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
                  Restaurar confirmação
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
  if (!controller.events.length) return null;
  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
      aria-label="Avisos da espera"
    >
      <h3 className="font-bold text-sm">Avisos da espera</h3>
      {controller.events.slice(0, 10).map((e) => (
        <div key={e.id} className="border-t border-border pt-3">
          <p className="text-sm">
            {e.kind === "exclusive" && e.deadline && Date.parse(e.deadline) <= +controller.now
              ? "A vaga foi oferecida a você. O prazo dessa oferta já terminou."
              : (eventLabels[e.kind] ?? e.kind)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Horário:{" "}
            {new Date(e.starts_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            {e.kind === "exclusive" && e.deadline && Date.parse(e.deadline) > +controller.now
              ? ` · Confirme até ${new Date(e.deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
      ))}
    </section>
  );
}
