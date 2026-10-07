import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  HelpCircle,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Save,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import { ChoiceChips, IconList, IconTile, Notice } from "@/components/visual";
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
import { useI18n } from "@/lib/i18n";
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
  subtitle,
}: {
  appointment: { id: string; customer_id: string; starts_at: string } | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** De qual atendimento se trata ("João · 09:00"). */
  subtitle?: string;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const [question, setQuestion] = useState<AllowedQuestion>("satisfaction");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // O diálogo fica sempre montado no painel: ao abrir para um novo atendimento,
  // começa limpo, mesmo que o anterior tenha sido fechado por "Voltar" ou após salvar.
  useEffect(() => {
    if (!open) return;
    setQuestion("satisfaction");
    setAnswer("");
    setError("");
  }, [open, appointment?.id]);
  const options = useMemo(() => questions[question].options as Record<string, string>, [question]);
  async function save() {
    if (!appointment || !answer) {
      setError(t("ins.staff.pickAnswer"));
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
      setError(t("ins.staff.error"));
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
      <AlertDialogContent className="max-h-[90dvh] gap-4 overflow-y-auto rounded-3xl border-border bg-card">
        <AlertDialogHeader className="text-left sm:text-left">
          <div className="flex items-start gap-3">
            <IconTile icon={MessageSquarePlus} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <AlertDialogTitle className="text-lg font-bold leading-snug">
                {t("ins.staff.title")}
              </AlertDialogTitle>
              {subtitle && <AlertDialogDescription>{subtitle}</AlertDialogDescription>}
            </div>
          </div>
        </AlertDialogHeader>
        {/* As regras à vista antes de anotar (os 30 dias não aparecem só no erro). */}
        <IconList
          items={[
            { key: "said", icon: ShieldCheck, text: t("ins.staff.ruleSaid") },
            { key: "team", icon: UserCheck, text: t("ins.staff.ruleTeam") },
            { key: "monthly", icon: CalendarClock, text: t("ins.staff.ruleMonthly") },
          ]}
        />
        <ChoiceChips
          label={t("ins.staff.question")}
          icon={HelpCircle}
          value={question}
          disabled={busy}
          onChange={(value) => {
            setQuestion(value);
            setAnswer("");
            setError("");
          }}
          options={allowedQuestions.map((key) => ({ value: key, label: questions[key].title }))}
          className="[&_[role=radio]]:max-w-full [&_[role=radio]]:py-2"
        />
        <ChoiceChips
          label={t("ins.staff.answer")}
          icon={MessageSquareText}
          value={answer || null}
          disabled={busy}
          onChange={(value) => {
            setAnswer(value);
            setError("");
          }}
          options={Object.entries(options).map(([value, label]) => ({
            value,
            label,
            icon: question === "satisfaction" && /^[1-5]$/.test(value) ? Star : undefined,
          }))}
          className="[&_[role=radio]]:max-w-full [&_[role=radio]]:py-2"
        />
        {error && <Notice tone="danger" title={error} />}
        <AlertDialogFooter className="grid gap-2 sm:grid-cols-2 sm:space-x-0">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-semibold"
          >
            {t("common.back")}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void save()}
            className="action-button action-confirm min-h-11 w-full"
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Save aria-hidden />
            )}
            {busy ? t("common.saving") : t("ins.staff.save")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
