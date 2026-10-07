import { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Coffee,
  Globe2,
  Hourglass,
  LayoutGrid,
  Rows3,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  ChoiceCards,
  ChoiceChips,
  Hint,
  IconList,
  IconTile,
  StatusBadge,
  PreviewPanel,
  SectionHeader,
  Tag,
  TimeChips,
  Timeline,
  UnsavedBar,
  type ActionState,
  type TimelineRow,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
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

/** Resultado do salvamento, com a frase própria desta tela. */
type SaveResult = Exclude<ActionState, "saving">;
const SAVE_TEXT: Record<SaveResult, MessageKey> = {
  saved: "slots.status.applied",
  pending: "slots.status.pending",
  error: "slots.status.error",
};

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
  return { short, long, opensAt, closesAt, open, weekday: day?.weekday ?? null };
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
  const [status, setStatus] = useState<SaveResult | null>(null);
  const example = useSlotExample(services, hours);
  const groupName = useId();

  // Só os campos deste cartão: salvar ou mexer em outro cartão não apaga a escolha em andamento.
  const {
    slot_mode: savedMode,
    slot_step_minutes: savedStep,
    prep_minutes: savedPrepRaw,
  } = settings;
  useEffect(() => {
    const next = choiceFromRule(
      slotRuleFromSettings({
        slot_mode: savedMode,
        slot_step_minutes: savedStep,
        prep_minutes: savedPrepRaw,
      }),
    );
    setChoice(next.choice);
    setStep(next.step);
    setPrep(validPrepMinutes(savedPrepRaw));
  }, [savedMode, savedStep, savedPrepRaw]);

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
      const result = await onSave(mode, choice === "interval" ? step : saved.stepMinutes, prep);
      setStatus(result === "applied" ? "saved" : "pending");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const timeline: TimelineRow[] = [
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
        },
  ];

  return (
    <section
      id="forma-dos-horarios"
      tabIndex={-1}
      className="app-action-card scroll-mt-24 space-y-5 p-5 outline-none"
      aria-labelledby={`${groupName}-title`}
    >
      <SectionHeader
        icon={CalendarClock}
        id={`${groupName}-title`}
        title={t("slots.title")}
        description={t("slots.intro")}
      />

      <ChoiceCards
        legend={t("slots.title")}
        name={groupName}
        value={choice}
        disabled={busy}
        onChange={(option) => {
          setChoice(option);
          setStatus(null);
        }}
        options={SLOT_CHOICES.map((option) => ({
          value: option,
          title: t(`slots.mode.${option}.title`),
          description: t(`slots.mode.${option}.text`),
          icon: option === "literal" ? Rows3 : LayoutGrid,
          content: (
            <TimeChips
              times={exampleFor(example, modeFor(option, step), step, prep).list}
              label={t("slots.preview.listAria")}
              more
            />
          ),
        }))}
      />

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

      <PreviewPanel icon={Hourglass} title={t("slots.preview.title")} live>
        <Timeline rows={timeline} />
      </PreviewPanel>

      <IconList
        items={[
          { icon: Coffee, text: t("slots.breaks") },
          { icon: Globe2, text: t("slots.scope") },
        ]}
      />

      {/* Mesmo padrão dos outros cartões de Agendamento: a barra só aparece com mudança e
          mostra o resultado (aplicado, aguardando aprovação, erro com "Tentar de novo"). */}
      <UnsavedBar
        dirty={changed}
        saving={busy}
        state={status}
        stateText={status ? t(SAVE_TEXT[status]) : undefined}
        onSave={() => void save()}
        onDiscard={() => {
          setChoice(savedChoice.choice);
          setStep(savedChoice.step);
          setPrep(savedPrep);
          setStatus(null);
        }}
        saveLabel={t("slots.save")}
      />
    </section>
  );
}

/** Resumo nas telas de Serviços e Horários: como os horários aparecem para o cliente. */
export function SlotModeNotice({
  settings,
  services,
  hours,
  onOpenSettings,
  preview = false,
}: {
  settings: Pick<
    Tables<"barbershop_settings">,
    "slot_mode" | "slot_step_minutes" | "prep_minutes"
  > | null;
  services: ServiceLike[];
  hours: HoursLike[];
  onOpenSettings?: () => void;
  /** O funcionamento mudou e ainda não foi salvo: o exemplo é uma prévia. */
  preview?: boolean;
}) {
  const { t } = useI18n();
  const rule = slotRuleFromSettings(settings);
  const example = useSlotExample(services, hours);
  const current = exampleFor(example, rule.mode, rule.stepMinutes, rule.prepMinutes);
  const prep = rule.prepMinutes ?? 0;
  return (
    <aside
      className="space-y-3 rounded-2xl border border-border bg-card p-4"
      aria-label={t("slots.notice.title")}
    >
      {/* Título e "Mudar" na mesma linha; as pílulas ganham a largura toda embaixo (320 px). */}
      <div className="flex items-center gap-3">
        <IconTile icon={CalendarClock} />
        <p className="min-w-0 flex-1 text-sm font-bold">{t("slots.notice.title")}</p>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t("slots.notice.link")}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
          >
            <Settings2 className="size-4" aria-hidden />
            <span className="max-[379px]:sr-only">{t("slots.notice.link")}</span>
          </button>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag>
            {rule.mode === "literal"
              ? t("slots.mode.literal.title")
              : t("slots.notice.badge.interval", {
                  step: rule.mode === "custom" ? rule.stepMinutes : SLOT_STEP_MINUTES,
                })}
          </Tag>
          {prep > 0 && <Tag icon={Sparkles}>{t("slots.notice.badge.prep", { minutes: prep })}</Tag>}
          {preview && (
            <StatusBadge tone="pending" variant="dot" label={t("slots.notice.preview")} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Diz de qual dia é o exemplo, para ligar o resumo à barra da semana. */}
          <span className="text-xs text-muted-foreground">
            {example.weekday !== null && (
              <strong className="font-semibold text-foreground">
                {t(`shop.weekday.${example.weekday}` as MessageKey)} ·{" "}
              </strong>
            )}
            {example.long.name} · {t("slots.chip.minutes", { minutes: example.long.minutes })}
          </span>
          {current.list.length > 0 ? (
            <TimeChips times={current.list} label={t("slots.preview.listAria")} more />
          ) : (
            <Hint icon={AlertTriangle} tone="warning">
              {t("slots.notice.empty")}
            </Hint>
          )}
        </div>
      </div>
    </aside>
  );
}
