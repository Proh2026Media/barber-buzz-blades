import { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Globe2,
  Hourglass,
  LayoutGrid,
  Rows3,
  Save,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import {
  PREP_OPTIONS,
  SLOT_STEP_MINUTES,
  SLOT_STEP_OPTIONS,
  minutesLabel,
  previewSlotMinutes,
  slotRuleFromSettings,
  validPrepMinutes,
  type SlotMode,
} from "@/lib/shop/appointments";

type ServiceLike = Pick<Tables<"services">, "name" | "duration_minutes" | "active">;
type HoursLike = Pick<Tables<"business_hours">, "weekday" | "is_open" | "opens_at" | "closes_at">;

const EXAMPLE_COUNT = 4;

/**
 * Opções mostradas ao dono. "Ajustável" cobre os modos `flexible` (15 min, o padrão)
 * e `custom` (outro intervalo) do banco, que davam o mesmo resultado com 15 minutos.
 */
type SlotChoice = "interval" | "literal";
const SLOT_CHOICES: readonly SlotChoice[] = ["literal", "interval"];

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
  prepMinutes = 0,
) {
  const rule = { mode, stepMinutes, prepMinutes };
  const { short, long, opensAt, closesAt, open } = example;
  const longStarts = previewSlotMinutes(opensAt, closesAt, long.minutes, rule);
  const afterShort = previewSlotMinutes(opensAt, closesAt, long.minutes, rule, [
    [open, open + short.minutes],
  ]);
  return {
    list: longStarts.slice(0, EXAMPLE_COUNT).map(minutesLabel),
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
  onSave: (
    mode: SlotMode,
    stepMinutes: number,
    prepMinutes: number,
  ) => Promise<"applied" | "pending">;
}) {
  const { t } = useI18n();
  const saved = slotRuleFromSettings(settings);
  const savedChoice = choiceFromRule(saved);
  const [choice, setChoice] = useState<SlotChoice>(savedChoice.choice);
  const [step, setStep] = useState(savedChoice.step);
  // Antes da migration 20261005120000 a coluna não vem do banco: o campo fica escondido.
  const prepSupported = "prep_minutes" in settings;
  const savedPrep = validPrepMinutes(settings.prep_minutes);
  const [prep, setPrep] = useState(savedPrep);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"applied" | "pending" | "error" | null>(null);
  const example = useSlotExample(services, hours);
  const groupName = useId();

  useEffect(() => {
    const next = choiceFromRule(slotRuleFromSettings(settings));
    setChoice(next.choice);
    setStep(next.step);
    setPrep(validPrepMinutes(settings.prep_minutes));
  }, [settings]);

  const mode = modeFor(choice, step);
  const changed =
    choice !== savedChoice.choice ||
    (choice === "interval" && step !== savedChoice.step) ||
    prep !== savedPrep;
  const current = exampleFor(example, mode, step, prep);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      setStatus(await onSave(mode, choice === "interval" ? step : saved.stepMinutes, prep));
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="forma-dos-horarios"
      className="app-action-card space-y-5 p-5"
      aria-labelledby={`${groupName}-title`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 id={`${groupName}-title`} className="font-bold">
            {t("slots.title")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("slots.intro")}</p>
        </div>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">{t("slots.title")}</legend>
        {SLOT_CHOICES.map((option) => {
          const optionExample = exampleFor(example, modeFor(option, step), step, prep);
          const selected = choice === option;
          const Icon = option === "literal" ? Rows3 : LayoutGrid;
          return (
            <label
              key={option}
              className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 transition ${
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
              <span className="flex items-center gap-2">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold">
                  {t(`slots.mode.${option}.title`)}
                </span>
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {selected && <Check className="size-3.5" />}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`slots.mode.${option}.text`)}
              </span>
              <TimeChips times={optionExample.list} label={t("slots.preview.listAria")} more />
            </label>
          );
        })}
      </fieldset>

      {choice === "interval" && (
        <ChoiceChips
          icon={Clock3}
          label={t("slots.step.label")}
          options={SLOT_STEP_OPTIONS.map((minutes) => ({
            value: minutes,
            label: t("slots.chip.minutes", { minutes }),
            note: minutes === SLOT_STEP_MINUTES ? t("slots.default") : undefined,
          }))}
          value={step}
          disabled={busy}
          onChange={(value) => {
            setStep(value);
            setStatus(null);
          }}
        />
      )}

      {prepSupported && (
        <ChoiceChips
          icon={Sparkles}
          label={t("slots.prep.label")}
          hint={t("slots.prep.hint")}
          options={PREP_OPTIONS.map((minutes) => ({
            value: minutes,
            label: minutes === 0 ? t("slots.prep.none") : t("slots.chip.minutes", { minutes }),
          }))}
          value={prep}
          disabled={busy}
          onChange={(value) => {
            setPrep(value);
            setStatus(null);
          }}
        />
      )}

      <div
        className="space-y-3 rounded-2xl border border-border bg-background/60 p-4"
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Hourglass className="size-3.5" aria-hidden />
          {t("slots.preview.title")}
        </p>
        <SampleTimeline
          rows={[
            {
              kind: "booked",
              time: current.start,
              label: t("slots.timeline.booked", { service: example.short.name }),
              minutes: example.short.minutes,
            },
            ...(prep > 0
              ? [
                  {
                    kind: "prep" as const,
                    time: current.shortEnd,
                    label: t("slots.timeline.prep", { minutes: prep }),
                    minutes: prep,
                  },
                ]
              : []),
            current.first
              ? {
                  kind: "free" as const,
                  time: current.first,
                  label: t("slots.timeline.first", { service: example.long.name }),
                  minutes: example.long.minutes,
                }
              : {
                  kind: "none" as const,
                  time: "—",
                  label: t("slots.timeline.none", { service: example.long.name }),
                  minutes: 0,
                },
          ]}
        />
      </div>

      <ul className="space-y-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <Coffee className="size-4 shrink-0 text-gold" aria-hidden />
          {t("slots.breaks")}
        </li>
        <li className="flex items-center gap-2">
          <Globe2 className="size-4 shrink-0 text-gold" aria-hidden />
          {t("slots.scope")}
        </li>
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
      {status && <SaveStatus status={status} text={t(`slots.status.${status}`)} />}
    </section>
  );
}

/** Horários de exemplo em "pílulas", como o cliente vê. */
function TimeChips({ times, label, more }: { times: string[]; label: string; more?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {times.map((time) => (
        <li
          key={time}
          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold tabular-nums"
        >
          {time}
        </li>
      ))}
      {more && times.length > 0 && (
        <li aria-hidden className="px-1 py-1 text-xs font-bold text-muted-foreground">
          …
        </li>
      )}
    </ul>
  );
}

/** Escolha rápida em botões (intervalo, folga): mais visível que uma lista suspensa. */
function ChoiceChips({
  icon: Icon,
  label,
  hint,
  options,
  value,
  disabled,
  onChange,
}: {
  icon: typeof Clock3;
  label: string;
  hint?: string;
  options: Array<{ value: number; label: string; note?: string }>;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const labelId = useId();
  return (
    <div className="space-y-2">
      <p id={labelId} className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4 text-gold" aria-hidden />
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`flex min-h-11 min-w-14 flex-col items-center justify-center rounded-xl border px-3 text-sm font-bold tabular-nums transition ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {option.label}
              {option.note && (
                <span className="text-[10px] font-semibold leading-none opacity-80">
                  {option.note}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type TimelineRow = {
  kind: "booked" | "prep" | "free" | "none";
  time: string;
  label: string;
  minutes: number;
};

/** Mini agenda do exemplo: atendimento marcado, folga e o próximo horário livre. */
function SampleTimeline({ rows }: { rows: TimelineRow[] }) {
  return (
    <ol className="space-y-1.5">
      {rows.map((row) => {
        const height = row.kind === "none" ? 40 : Math.min(72, Math.max(32, row.minutes * 1.1));
        const styles = {
          booked: "bg-primary text-primary-foreground",
          prep: "border border-dashed border-gold/60 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_srgb,var(--gold)_14%,transparent)_6px_12px)] text-foreground",
          free: "border-2 border-emerald-600 bg-emerald-50 text-emerald-900",
          none: "border border-destructive/40 bg-destructive/5 text-destructive",
        }[row.kind];
        const Icon = { booked: Clock3, prep: Sparkles, free: CheckCircle2, none: X }[row.kind];
        return (
          <li key={`${row.kind}-${row.time}`} className="flex items-stretch gap-3">
            <span className="w-11 shrink-0 pt-1.5 text-right text-xs font-bold tabular-nums text-muted-foreground">
              {row.time}
            </span>
            <span
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${styles}`}
              style={{ minHeight: height }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{row.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Resultado do salvamento com ícone e cor (feito, aguardando aprovação, erro). */
function SaveStatus({ status, text }: { status: "applied" | "pending" | "error"; text: string }) {
  const Icon =
    status === "applied" ? CheckCircle2 : status === "pending" ? Hourglass : AlertTriangle;
  const tone =
    status === "applied"
      ? "border-emerald-600/30 bg-emerald-50 text-emerald-900"
      : status === "pending"
        ? "border-amber-600/30 bg-amber-50 text-amber-900"
        : "border-destructive/30 bg-destructive/5 text-destructive";
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${tone}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

/** Resumo nas telas de Serviços e Horários: como os horários aparecem para o cliente. */
export function SlotModeNotice({
  settings,
  services,
  hours,
  onOpenSettings,
}: {
  settings: Pick<
    Tables<"barbershop_settings">,
    "slot_mode" | "slot_step_minutes" | "prep_minutes"
  > | null;
  services: ServiceLike[];
  hours: HoursLike[];
  onOpenSettings?: () => void;
}) {
  const { t } = useI18n();
  const rule = slotRuleFromSettings(settings);
  const example = useSlotExample(services, hours);
  const current = exampleFor(example, rule.mode, rule.stepMinutes, rule.prepMinutes);
  const prep = rule.prepMinutes ?? 0;
  return (
    <aside
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
      aria-label={t("slots.notice.title")}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <CalendarClock className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-bold">{t("slots.notice.title")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
            {rule.mode === "literal"
              ? t("slots.mode.literal.title")
              : t("slots.notice.badge.interval", {
                  step: rule.mode === "custom" ? rule.stepMinutes : SLOT_STEP_MINUTES,
                })}
          </span>
          {prep > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
              <Sparkles className="size-3 text-gold" aria-hidden />
              {t("slots.notice.badge.prep", { minutes: prep })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {example.long.name} · {example.long.minutes} min
          </span>
          <TimeChips times={current.list} label={t("slots.preview.listAria")} more />
        </div>
      </div>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
        >
          <Settings2 className="size-4" aria-hidden />
          {t("slots.notice.link")}
        </button>
      )}
    </aside>
  );
}
