import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { questions, type Survey } from "./model";

const allowedQuestions = [
  "satisfaction",
  "improvement",
  "period",
  "professional",
  "frequency",
  "conversation",
  "service_interest",
] as const;
type AllowedQuestion = (typeof allowedQuestions)[number];
export function StaffSurveyDialog({
  appointment,
  open,
  onClose,
  onSaved,
}: {
  appointment: { id: string; customer_id: string; starts_at: string } | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const demo = useDemo();
  const [question, setQuestion] = useState<AllowedQuestion>("satisfaction");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = useMemo(() => questions[question].options as Record<string, string>, [question]);
  async function save() {
    if (!appointment || !answer) {
      setError("Selecione a resposta informada pelo cliente.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (demo) {
        if (!demo.privacy.surveys) throw new Error("disabled");
        if (
          demo.lastSurveyAt &&
          demo.now.getTime() - new Date(demo.lastSurveyAt).getTime() < 30 * 86400000
        )
          throw new Error("cooldown");
        const survey: Survey = {
          id: crypto.randomUUID(),
          question,
          answer,
          state: "answered",
          shown_at: demo.now.toISOString(),
          version: 1,
          appointment_id: appointment.id,
          appointment_starts_at: appointment.starts_at,
          source: "shop_staff",
        };
        demo.dispatch({ type: "survey.record", survey });
      } else {
        const result = await supabase.rpc("record_customer_survey_response", {
          p_appointment_id: appointment.id,
          p_question: question,
          p_answer: answer,
        });
        if (result.error) throw result.error;
      }
      setAnswer("");
      onSaved();
      onClose();
    } catch {
      setError(
        "Não foi possível registrar. O cliente precisa permitir pesquisas e estar fora do intervalo de 30 dias.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) {
          // Sem esta limpeza a resposta e o erro do atendimento anterior
          // reapareceriam ao abrir o diálogo para outro cliente.
          setQuestion("satisfaction");
          setAnswer("");
          setError("");
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Registrar resposta do cliente</AlertDialogTitle>
          <AlertDialogDescription>
            Use somente uma resposta declarada pelo cliente durante o atendimento. O registro será
            identificado como feito pela equipe.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="space-y-2 text-sm font-semibold">
          <span>Pergunta realizada</span>
          <select
            aria-label="Pergunta realizada"
            value={question}
            disabled={busy}
            onChange={(event) => {
              setQuestion(event.target.value as AllowedQuestion);
              setAnswer("");
              setError("");
            }}
            className="w-full rounded-xl border border-border bg-background px-3 py-3"
          >
            {allowedQuestions.map((key) => (
              <option key={key} value={key}>
                {questions[key].title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Resposta informada</span>
          <select
            aria-label="Resposta informada"
            value={answer}
            disabled={busy}
            onChange={(event) => setAnswer(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-3"
          >
            <option value="">Selecione</option>
            {Object.entries(options).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <button
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Voltar
          </button>
          <button
            disabled={busy || !answer}
            onClick={() => void save()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Registrar resposta"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
