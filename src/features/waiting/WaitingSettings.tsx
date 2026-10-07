import { useEffect, useId, useState } from "react";
import {
  BellRing,
  CalendarX2,
  CheckCircle2,
  Hourglass,
  Info,
  PlayCircle,
  Scissors,
  Timer,
  UserX,
  X,
} from "lucide-react";
import {
  ChoiceChips,
  ConfirmDialog,
  IconList,
  PreviewPanel,
  SectionHeader,
  StatusBadge,
  Timeline,
  UnsavedBar,
  type ActionState,
  type TimelineRow,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "../demo/context";
import { CLAIM_MINUTES, HOLD_MINUTES } from "./model";

const CUTOFF_MAX = 1440;
const CUTOFF_OPTIONS = [0, 30, 60, 120, 360, 720, 1440] as const;
/** Horário do exemplo: um atendimento às 15:00. */
const EXAMPLE_HOUR = 15;

export type WaitingPatch = Pick<
  Tables<"barbershop_settings">,
  "waiting_enabled" | "waiting_cutoff_minutes"
>;

/**
 * Fila de espera em Ajustes → Agendamento: ligada/desligada em botões, o limite em pílulas e,
 * no lugar do parágrafo de regras, uma mini agenda com os números reais do que acontece quando
 * o dono desmarca alguém.
 */
export function WaitingSettings({
  settings,
  onSaved,
  onSaveRequest,
  id,
}: {
  settings: Tables<"barbershop_settings">;
  /** Recebe só os campos salvos, para não apagar rascunhos de outros cartões. */
  onSaved: (patch: WaitingPatch) => void;
  onSaveRequest?: (enabled: boolean, cutoff: number) => Promise<"applied" | "pending">;
  id?: string;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const titleId = useId();
  const [enabled, setEnabled] = useState(settings.waiting_enabled);
  const [cutoff, setCutoff] = useState(settings.waiting_cutoff_minutes);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [errorText, setErrorText] = useState<string | undefined>();

  useEffect(() => {
    setEnabled(settings.waiting_enabled);
    setCutoff(settings.waiting_cutoff_minutes);
  }, [settings.waiting_enabled, settings.waiting_cutoff_minutes]);

  const valid = Number.isInteger(cutoff) && cutoff >= 0 && cutoff <= CUTOFF_MAX;
  const changed =
    enabled !== settings.waiting_enabled || (enabled && cutoff !== settings.waiting_cutoff_minutes);

  /** "14:15", ou "14:15 do dia anterior" quando o limite passa da meia-noite. */
  function before(minutes: number) {
    const date = new Date(2026, 0, 2, EXAMPLE_HOUR, -minutes);
    const time = date.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" });
    return date.getDate() === 1 ? t("wait.cutoff.prevDay", { time }) : time;
  }

  function durationLabel(minutes: number) {
    if (minutes === 0) return t("wait.settings.cutoffNone");
    if (minutes % 60 === 0) return t("wait.settings.hours", { hours: minutes / 60 });
    if (minutes > 60)
      return t("wait.settings.hoursMinutes", {
        hours: Math.floor(minutes / 60),
        minutes: minutes % 60,
      });
    return t("wait.settings.minutes", { minutes });
  }

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setState("saving");
    const patch: WaitingPatch = { waiting_enabled: enabled, waiting_cutoff_minutes: cutoff };
    try {
      if (demo) {
        demo.dispatch({ type: "settings.save", settings: { ...settings, ...patch } });
      } else if (onSaveRequest) {
        const status = await onSaveRequest(enabled, cutoff);
        if (status === "pending") {
          // Nada muda até a aprovação: o cartão volta a mostrar o que vale hoje.
          setEnabled(settings.waiting_enabled);
          setCutoff(settings.waiting_cutoff_minutes);
          setState("pending");
          setConfirm(false);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("barbershop_settings")
          .update(patch)
          .eq("barbershop_id", settings.barbershop_id)
          .select("waiting_enabled, waiting_cutoff_minutes")
          .single();
        if (error) throw error;
        patch.waiting_enabled = data.waiting_enabled;
        patch.waiting_cutoff_minutes = data.waiting_cutoff_minutes;
      }
      onSaved(patch);
      setState("saved");
      setConfirm(false);
      window.dispatchEvent(new Event("waiting-changed"));
    } catch (error) {
      const message = friendlyAuthError(error, t("visual.result.error"));
      setErrorText(message);
      setState("error");
      // Dentro da janela de confirmação o erro aparece nela (o ConfirmDialog mostra o texto).
      if (confirm) throw error;
    } finally {
      setBusy(false);
    }
  }

  // Mini agenda do exemplo: tudo calculado com o limite escolhido.
  const lastStart = before(cutoff + HOLD_MINUTES + CLAIM_MINUTES);
  const timeline: TimelineRow[] = [
    {
      kind: "blocked",
      icon: UserX,
      time: lastStart,
      label: t("wait.settings.step.cancel"),
    },
    {
      kind: "pending",
      icon: Hourglass,
      time: lastStart,
      label: t("wait.settings.step.hold", { minutes: HOLD_MINUTES }),
      minutes: HOLD_MINUTES * 3,
    },
    {
      kind: "pending",
      icon: BellRing,
      time: before(cutoff + CLAIM_MINUTES),
      label: t("wait.settings.step.claim", { minutes: CLAIM_MINUTES }),
      minutes: CLAIM_MINUTES * 4,
    },
    {
      kind: "free",
      time: before(cutoff),
      label: t("wait.settings.step.free"),
    },
    {
      kind: "booked",
      icon: Scissors,
      time: before(0),
      label: t("wait.settings.step.appointment"),
    },
  ];

  const resultText =
    state === "saved"
      ? t(settings.waiting_enabled ? "wait.settings.savedOn" : "wait.settings.savedOff")
      : state === "pending"
        ? t("visual.result.pending")
        : state === "error"
          ? errorText
          : undefined;

  return (
    <section
      id={id}
      tabIndex={-1}
      className="app-action-card scroll-mt-24 space-y-5 p-5 outline-none"
      aria-labelledby={titleId}
    >
      <SectionHeader
        icon={Hourglass}
        id={titleId}
        title={t("wait.settings.name")}
        description={t("wait.settings.intro")}
        aside={
          // O selo mostra o que vale hoje; com rascunho diferente, avisa que ainda não salvou.
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={settings.waiting_enabled ? "success" : "neutral"}
              label={t(settings.waiting_enabled ? "wait.settings.isOn" : "wait.settings.isOff")}
              size="sm"
            />
            {changed && (
              <StatusBadge tone="pending" variant="dot" label={t("visual.unsaved.badge")} />
            )}
          </span>
        }
      />

      <ChoiceChips
        label={t("wait.settings.toggle")}
        hideLabel
        options={[
          { value: "on", label: t("wait.settings.on"), icon: PlayCircle },
          { value: "off", label: t("wait.settings.off"), icon: X },
        ]}
        value={enabled ? "on" : "off"}
        disabled={busy}
        onChange={(value) => {
          setEnabled(value === "on");
          setState(null);
        }}
      />

      {enabled ? (
        <>
          <ChoiceChips
            icon={Timer}
            label={t("wait.settings.until")}
            hint={t("wait.settings.cutoffHint")}
            options={CUTOFF_OPTIONS.map((minutes) => ({
              value: minutes,
              label: durationLabel(minutes),
            }))}
            value={cutoff}
            disabled={busy}
            onChange={(value) => {
              setCutoff(value);
              setState(null);
            }}
            other={{
              min: 0,
              max: CUTOFF_MAX,
              step: 5,
              unit: "min",
              inputLabel: t("wait.settings.cutoffOther"),
            }}
          />

          {valid && (
            <PreviewPanel
              icon={Hourglass}
              title={t("wait.settings.example", { time: before(0) })}
              badge={t("bookingRules.example")}
              live
            >
              <Timeline rows={timeline} label={t("wait.settings.exampleAria")} />
            </PreviewPanel>
          )}

          <IconList
            items={[
              {
                icon: Timer,
                text: t("wait.settings.hintHold", { minutes: HOLD_MINUTES }),
              },
              {
                icon: CheckCircle2,
                text: t("wait.settings.hintClaim", { minutes: CLAIM_MINUTES }),
              },
              { icon: CalendarX2, text: t("wait.settings.hintLate", { time: lastStart }) },
              { icon: Info, text: t("wait.settings.hintNew") },
            ]}
          />
        </>
      ) : (
        <IconList items={[{ icon: Info, text: t("wait.settings.offText") }]} />
      )}

      {/* Mesmo padrão dos cartões de Regras: a barra "Salvar mudanças" só aparece com mudança,
          e o resultado (salvo, aguardando aprovação, erro com "Tentar de novo") fica nela. */}
      <UnsavedBar
        dirty={changed && valid}
        saving={busy}
        state={confirm && state === "error" ? null : state === "saving" ? null : state}
        stateText={resultText}
        onSave={() => (settings.waiting_enabled && !enabled ? setConfirm(true) : void save())}
        onDiscard={() => {
          setEnabled(settings.waiting_enabled);
          setCutoff(settings.waiting_cutoff_minutes);
          setState(null);
        }}
      />

      <ConfirmDialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value);
        }}
        tone="danger"
        title={t("wait.settings.offQuestion")}
        consequences={[
          { icon: X, tone: "danger", text: t("wait.settings.offEnds") },
          { icon: BellRing, tone: "muted", text: t("wait.settings.offNotify") },
          { icon: CheckCircle2, tone: "success", text: t("wait.settings.offKeeps") },
        ]}
        confirmLabel={t("wait.settings.offConfirm")}
        busyLabel={t("common.saving")}
        cancelLabel={t("wait.settings.offCancel")}
        errorText={errorText}
        onConfirm={save}
      />
    </section>
  );
}
