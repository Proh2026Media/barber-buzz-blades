import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { InlineStatus } from "./Notice";
import { StatusBadge } from "./StatusBadge";
import type { ActionState } from "./status";

/**
 * Barra fixa no pé do cartão (acima da barra de navegação) que só aparece quando há mudança não
 * salva: "● 2 mudanças não salvas · Descartar · Salvar mudanças". Mostra "Salvando…", o resultado
 * (✓ salvo some sozinho; erro com "Tentar de novo") e evita o botão perdido no fim de um
 * formulário longo. Coloque-a como último filho do cartão do formulário.
 */
export function UnsavedBar({
  dirty,
  count,
  saving,
  state,
  stateText,
  onSave,
  onDiscard,
  saveLabel,
  className,
}: {
  /** Há diferença em relação ao que está gravado. */
  dirty: boolean;
  /** Quantas mudanças (opcional). */
  count?: number;
  saving?: boolean;
  /** Resultado do último salvamento. */
  state?: ActionState | null;
  stateText?: string;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!state || state === "saving") return;
    setShowResult(true);
    if (state !== "saved") return;
    const id = window.setTimeout(() => setShowResult(false), 3000);
    return () => window.clearTimeout(id);
  }, [state, stateText]);

  const result = showResult && state && state !== "saving" ? state : null;
  if (!dirty && !saving && !result) return null;

  const pendingText =
    count && count > 1
      ? t("visual.unsaved.many", { count })
      : count === 1
        ? t("visual.unsaved.one")
        : t("visual.unsaved.badge");

  return (
    <div
      className={cn(
        "sticky z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card p-2.5 shadow-lg",
        className,
      )}
      style={{ bottom: "var(--app-sticky-bottom)" }}
    >
      <div className="flex min-h-11 min-w-0 flex-1 basis-48 items-center px-1">
        {result ? (
          <InlineStatus state={result} text={stateText} onRetry={onSave} />
        ) : (
          <StatusBadge tone="pending" variant="dot" label={pendingText} />
        )}
      </div>
      {(dirty || saving) && (
        <div className="flex flex-1 basis-56 gap-2 sm:flex-none sm:basis-auto">
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="min-h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
            >
              {t("visual.unsaved.discard")}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            aria-busy={saving || undefined}
            className="action-button action-confirm min-h-11 flex-1 sm:flex-none sm:px-4"
          >
            {saving ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Save aria-hidden />
            )}
            {saving ? t("visual.result.saving") : (saveLabel ?? t("visual.unsaved.save"))}
          </button>
        </div>
      )}
    </div>
  );
}
