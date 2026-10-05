import { useEffect, useId, useState } from "react";
import { CalendarClock, Check, Info, Save, Settings2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import {
  SLOT_STEP_MINUTES,
  SLOT_STEP_OPTIONS,
  minutesLabel,
  previewSlotMinutes,
  slotRuleFromSettings,
  type SlotMode,
} from "@/lib/shop/appointments";

type ServiceLike = Pick<Tables<"services">, "name" | "duration_minutes" | "active">;
type HoursLike = Pick<Tables<"business_hours">, "weekday" | "is_open" | "opens_at" | "closes_at">;

const EXAMPLE_COUNT = 4;

/**
 * Opções mostradas ao dono. "De X em X minutos" cobre os modos `flexible` (15 min, o padrão)
 * e `custom` (outro intervalo) do banco, que davam o mesmo resultado com 15 minutos.
 */
type SlotChoice = "interval" | "literal";
const SLOT_CHOICES: readonly SlotChoice[] = ["interval", "literal"];

function choiceFromRule(rule: { mode: SlotMode; stepMinutes: number }) {
  return {
    choice: (rule.mode === "literal" ? "literal" : "interval") as SlotChoice,
    step: rule.mode === "custom" ? rule.stepMinutes : SLOT_STEP_MINUTES,
  };
}

/** Grava 15 minutos como `flexible` e os demais intervalos como `custom`. */
function modeFor(choice: SlotChoice, step: number): SlotMode {
  if (choice === "literal") return "literal";
  return step === SLOT_STEP_MINUTES ? "flexible" : "custom";
}

/** Dados do exemplo: expediente de um dia aberto e os serviços mais curto e mais longo da loja. */
function useSlotExample(services: ServiceLike[], hours: HoursLike[]) {
  const { t } = useI18n();
  const active = services
    .filter((row) => row.active && row.duration_minutes > 0)
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
  const short = active[0]
    ? { name: active[0].name, minutes: active[0].duration_minutes }
    : { name: t("slots.example.short"), minutes: 30 };
  const longest = active.at(-1);
  const long = longest
    ? { name: longest.name, minutes: longest.duration_minutes }
    : { name: t("slots.example.long"), minutes: 60 };
  const day =
    hours.find((row) => row.is_open && row.weekday === 1) ?? hours.find((row) => row.is_open);
  const opensAt = day?.opens_at.slice(0, 5) ?? "09:00";
  const closesAt = day?.closes_at.slice(0, 5) ?? "19:00";
  const [openHour, openMinute] = opensAt.split(":").map(Number);
  const open = openHour * 60 + openMinute;
  return { short, long, opensAt, closesAt, open };
}

function exampleFor(
  example: ReturnType<typeof useSlotExample>,
  mode: SlotMode,
  stepMinutes: number,
) {
  const rule = { mode, stepMinutes };
  const { short, long, opensAt, closesAt, open } = example;
  const longStarts = previewSlotMinutes(opensAt, closesAt, long.minutes, rule);
  const afterShort = previewSlotMinutes(opensAt, closesAt, long.minutes, rule, [
    [open, open + short.minutes],
  ]);
  return {
    list: longStarts.slice(0, EXAMPLE_COUNT).map(minutesLabel),
    tested: Array.from({ length: 3 }, (_, index) =>
      minutesLabel(
        open + index * (mode === "literal" ? long.minutes : mode === "custom" ? stepMinutes : 15),
      ),
    ),
    start: minutesLabel(open),
    shortEnd: minutesLabel(open + short.minutes),
    first: afterShort[0] === undefined ? null : minutesLabel(afterShort[0]),
  };
}

export function SlotModeSettings({
  settings,
  services,
  hours,
  onSave,
}: {
  settings: Tables<"barbershop_settings">;
  services: ServiceLike[];
  hours: HoursLike[];
  onSave: (mode: SlotMode, stepMinutes: number) => Promise<"applied" | "pending">;
}) {
  const { t } = useI18n();
  const saved = slotRuleFromSettings(settings);
  const savedChoice = choiceFromRule(saved);
  const [choice, setChoice] = useState<SlotChoice>(savedChoice.choice);
  const [step, setStep] = useState(savedChoice.step);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"applied" | "pending" | "error" | null>(null);
  const example = useSlotExample(services, hours);
  const groupName = useId();
  const stepId = useId();

  useEffect(() => {
    const next = choiceFromRule(slotRuleFromSettings(settings));
    setChoice(next.choice);
    setStep(next.step);
  }, [settings]);

  const mode = modeFor(choice, step);
  const changed =
    choice !== savedChoice.choice || (choice === "interval" && step !== savedChoice.step);
  const current = exampleFor(example, mode, step);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus(await onSave(mode, choice === "interval" ? step : saved.stepMinutes));
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="forma-dos-horarios"
      className="app-action-card space-y-4 p-5"
      aria-labelledby={`${groupName}-title`}
    >
      <div>
        <p className="text-xs text-muted-foreground">{t("slots.section")}</p>
        <h3 id={`${groupName}-title`} className="flex items-center gap-2 font-bold">
          <CalendarClock className="size-4" aria-hidden />
          {t("slots.title")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("slots.intro")}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="sr-only">{t("slots.title")}</legend>
        {SLOT_CHOICES.map((option) => {
          const optionExample = exampleFor(example, modeFor(option, step), step);
          const selected = choice === option;
          return (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name={groupName}
                value={option}
                checked={selected}
                disabled={busy}
                onChange={() => {
                  setChoice(option);
                  setStatus(null);
                }}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                  selected ? "border-primary" : "border-muted-foreground/50 bg-background"
                }`}
              >
                {selected && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  {t(`slots.mode.${option}.title`, { step })}
                  {option === "interval" && step === SLOT_STEP_MINUTES && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {t("slots.default")}
                    </span>
                  )}
                  {selected && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <Check className="size-3" aria-hidden />
                      {t("slots.selected")}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`slots.mode.${option}.text`, { step })}
                </span>
                <span className="mt-2 block text-xs font-semibold">
                  {t("slots.cardExample", {
                    service: example.long.name,
                    minutes: example.long.minutes,
                    list: optionExample.list.join(", "),
                  })}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {choice === "interval" && (
        <div className="space-y-2">
          <label htmlFor={stepId} className="text-xs font-semibold text-muted-foreground">
            {t("slots.step.label")}
          </label>
          <select
            id={stepId}
            value={step}
            disabled={busy}
            onChange={(event) => {
              setStep(Number(event.target.value));
              setStatus(null);
            }}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
          >
            {SLOT_STEP_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === SLOT_STEP_MINUTES
                  ? t("slots.step.optionDefault", { minutes })
                  : t("slots.step.option", { minutes })}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className="space-y-3 rounded-2xl border border-border bg-background/60 p-4"
        aria-live="polite"
      >
        <p className="text-xs font-semibold text-muted-foreground">{t("slots.preview.title")}</p>
        <p className="text-sm">
          {t("slots.preview.opening", {
            time: minutesLabel(example.open),
            service: example.long.name,
            minutes: example.long.minutes,
          })}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label={t("slots.preview.listAria")}>
          {current.list.map((label) => (
            <li
              key={label}
              className="min-w-14 rounded-lg border border-border bg-card px-3 py-2 text-center text-sm font-semibold tabular-nums"
            >
              {label}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          {current.first
            ? t("slots.preview.after", {
                short: example.short.name,
                start: current.start,
                end: current.shortEnd,
                long: example.long.name,
                first: current.first,
              })
            : t("slots.preview.afterNone", {
                short: example.short.name,
                start: current.start,
                end: current.shortEnd,
                long: example.long.name,
              })}
        </p>
        <p className="text-xs text-muted-foreground">{t(`slots.consequence.${choice}`)}</p>
      </div>

      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>{t("slots.breaks")}</li>
        <li>{t("slots.scope")}</li>
      </ul>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !changed}
        className="action-button action-confirm w-full"
      >
        <Save className="size-4" aria-hidden />
        {busy ? t("common.saving") : t("slots.save")}
      </button>
      {status && (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`text-center text-xs font-semibold ${status === "error" ? "text-destructive" : "text-primary"}`}
        >
          {t(`slots.status.${status}`)}
        </p>
      )}
    </section>
  );
}

/** Aviso curto nas telas de expediente e de serviços: como eles viram horários para o cliente. */
export function SlotModeNotice({
  settings,
  services,
  hours,
  context,
  onOpenSettings,
}: {
  settings: Pick<Tables<"barbershop_settings">, "slot_mode" | "slot_step_minutes"> | null;
  services: ServiceLike[];
  hours: HoursLike[];
  context: "hours" | "services";
  onOpenSettings?: () => void;
}) {
  const { t } = useI18n();
  const rule = slotRuleFromSettings(settings);
  const example = useSlotExample(services, hours);
  const current = exampleFor(example, rule.mode, rule.stepMinutes);
  const literal = exampleFor(example, "literal", rule.stepMinutes);
  return (
    <aside
      className="flex gap-3 rounded-2xl border border-border bg-card p-4"
      aria-label={t("slots.notice.title")}
    >
      <Info className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-bold">{t("slots.notice.title")}</p>
        <p className="text-xs text-muted-foreground">{t(`slots.notice.${context}`)}</p>
        <p className="text-xs">
          {t(`slots.notice.${rule.mode}`, {
            step: rule.stepMinutes,
            tested: current.tested.join(", "),
            list: current.list.join(", "),
            short: example.short.name,
            start: current.start,
            end: current.shortEnd,
            long: example.long.name,
            minutes: example.long.minutes,
            first: current.first ?? "—",
            literalFirst: literal.first ?? "—",
          })}
        </p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
          >
            <Settings2 className="size-4" aria-hidden />
            {t("slots.notice.link")}
          </button>
        )}
      </div>
    </aside>
  );
}
