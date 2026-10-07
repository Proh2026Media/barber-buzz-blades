import { useEffect, useRef, useState } from "react";
import { MessageSquareHeart, Scissors, Star, UserRound, X } from "lucide-react";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { ActionResult, IconTile, Notice } from "@/components/visual";
import { useShortSlot } from "@/features/customer/booking/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { nextSurvey, questions, type Survey } from "./model";

const SCALE = ["1", "2", "3", "4", "5"] as const;

/**
 * Pesquisa opcional do Início: uma pergunta por vez. A nota (1 a 5) vira cinco estrelas grandes
 * com "Ruim … Ótimo" nas pontas; as outras perguntas viram pílulas. "Agora não" é o X do canto e
 * "Prefiro não responder" fica como link discreto. Ao responder, aparece o agradecimento.
 */
export function SurveyCard({
  enabled = true,
  appointments,
  timeZone,
}: {
  enabled?: boolean;
  /** Serviço e profissional de cada atendimento (para dizer de qual atendimento se trata). */
  appointments?: Record<string, { service: string; staff: string }>;
  /** Fuso da loja (a data do atendimento sai igual à dos tickets). */
  timeZone?: string;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const shortSlot = useShortSlot();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thanked, setThanked] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled) {
      setSurvey(null);
      return;
    }
    if (started.current) return;
    started.current = true;
    if (demo) {
      if (!demo.privacy.surveys) return;
      if (
        demo.lastSurveyAt &&
        demo.now.getTime() - new Date(demo.lastSurveyAt).getTime() < 30 * 86400000
      )
        return;
      const candidate = nextSurvey(
        demo.surveys,
        demo.now,
        demo.appointments.filter((row) => row.customer_id === demo.customerId),
      );
      if (!candidate) return;
      const row: Survey = {
        id: crypto.randomUUID(),
        ...candidate,
        answer: null,
        state: "shown",
        shown_at: demo.now.toISOString(),
        version: 1,
      };
      demo.dispatch({ type: "survey.show", survey: row });
      setSurvey(row);
    } else {
      void supabase.rpc("next_customer_survey").then(({ data, error: failure }) => {
        if (!failure && data) setSurvey(data as unknown as Survey);
      });
    }
  }, [demo, enabled]);
  async function answer(value: string | null) {
    if (!survey) return;
    setBusy(true);
    setError("");
    try {
      if (demo) demo.dispatch({ type: "survey.answer", id: survey.id, answer: value });
      else {
        const result = await supabase.rpc("answer_customer_survey", {
          p_id: survey.id,
          p_answer: value,
        });
        if (result.error) throw result.error;
      }
      setSurvey(null);
      // "Agora não" só fecha; uma resposta (ou "prefiro não responder") ganha o obrigado.
      if (value !== null) setThanked(true);
    } catch {
      setError(t("ins.card.saveError"));
    } finally {
      setBusy(false);
    }
  }
  if (!survey) {
    return thanked ? (
      <ActionResult
        state="saved"
        text={t("ins.card.thanks")}
        autoHideMs={3000}
        reveal={false}
        onDismiss={() => setThanked(false)}
      />
    ) : null;
  }
  const question = questions[survey.question];
  if (!question) return null;
  const options = Object.entries(question.options) as [string, string][];
  const scale = survey.question === "satisfaction";
  const choices = options.filter(
    ([value]) => value !== "skip" && !(scale && SCALE.includes(value as (typeof SCALE)[number])),
  );
  const skip = options.find(([value]) => value === "skip");
  const context = survey.appointment_id ? appointments?.[survey.appointment_id] : undefined;
  return (
    <section
      aria-label={t("ins.card.aria")}
      aria-busy={busy || undefined}
      className="app-action-card space-y-4 p-4"
    >
      <div className="flex items-start gap-3">
        <IconTile icon={MessageSquareHeart} size="sm" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground">{t("ins.card.badge")}</p>
          <h3 className="text-base font-bold leading-snug">{question.title}</h3>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer(null)}
          aria-label={t("ins.card.notNow")}
          title={t("ins.card.notNow")}
          className="-me-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {survey.appointment_starts_at && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
          <span className="font-semibold tabular-nums">
            {/* Mesmo formato e fuso dos tickets de Reservas ("sáb 03/10 · 12:40"). */}
            {(() => {
              const slot = shortSlot(
                survey.appointment_starts_at,
                timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              );
              return `${slot.day} · ${slot.time}`;
            })()}
          </span>
          {context && (
            <>
              <span className="flex items-center gap-1.5">
                <Scissors className="size-3.5 text-gold" aria-hidden />
                {context.service}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <UserRound className="size-3.5" aria-hidden />
                {context.staff}
              </span>
            </>
          )}
        </p>
      )}
      {scale && (
        <div className="space-y-1.5">
          <div role="group" aria-label={question.title} className="grid grid-cols-5 gap-1.5">
            {SCALE.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => void answer(value)}
                aria-label={question.options[value as keyof typeof question.options]}
                className="group flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-border bg-background transition hover:border-gold hover:bg-gold/10 disabled:opacity-50"
              >
                <Star
                  className="size-6 text-gold transition group-hover:fill-current"
                  aria-hidden
                />
                <span className="text-xs font-bold tabular-nums">{value}</span>
              </button>
            ))}
          </div>
          <p
            className="flex justify-between text-xs font-semibold text-muted-foreground"
            aria-hidden
          >
            <span>{t("ins.card.scaleLow")}</span>
            <span>{t("ins.card.scaleHigh")}</span>
          </p>
        </div>
      )}
      {choices.length > 0 && (
        <div role="group" aria-label={question.title} className="flex flex-wrap gap-2">
          {choices.map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => void answer(value)}
              className={cn(
                "min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition hover:border-primary/50 disabled:opacity-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {skip && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer("skip")}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          {skip[1]}
        </button>
      )}
      {error && <Notice tone="danger" title={error} />}
    </section>
  );
}
