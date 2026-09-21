import { useEffect, useRef, useState } from "react";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { nextSurvey, questions, type Survey } from "./model";

export function SurveyCard({ enabled = true }: { enabled?: boolean }) {
  const demo = useDemo();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    } catch {
      setError("Não foi possível salvar sua resposta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  if (!survey) return null;
  const question = questions[survey.question];
  if (!question) return null;
  return (
    <section
      aria-label="Pesquisa opcional"
      className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        Pesquisa opcional · 1 pergunta
      </p>
      <h3 className="text-sm font-semibold">{question.title}</h3>
      {survey.appointment_starts_at && (
        <p className="text-xs text-muted-foreground">
          Atendimento de{" "}
          {new Date(survey.appointment_starts_at).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(question.options).map(([value, label]) => (
          <button
            key={value}
            disabled={busy}
            onClick={() => void answer(value)}
            className="rounded-xl border border-border bg-background p-2 text-xs hover:border-primary disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={() => void answer(null)}
        className="text-xs text-muted-foreground underline"
      >
        Agora não
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
