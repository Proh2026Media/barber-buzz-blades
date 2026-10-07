import { EyeOff, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { InlineStatus } from "@/components/visual";

/**
 * Fim do formulário de edição: "Pausar" (a saída leve, quando o item está ativo) ao lado de
 * "Excluir". A ação fica ali mesmo, sem mandar a pessoa procurar o interruptor no cartão.
 */
export function DangerZone({
  hint,
  pauseLabel,
  onPause,
  deleteLabel,
  onDelete,
  disabled,
}: {
  /** Frase curta ao lado dos botões (só quando dá para pausar). */
  hint?: string;
  pauseLabel: string;
  /** Ausente quando o item já está pausado. Lança erro se não gravar. */
  onPause?: () => Promise<unknown>;
  deleteLabel: string;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [pausing, setPausing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function pause() {
    if (!onPause || pausing) return;
    setPausing(true);
    setFailed(false);
    setErrorText(null);
    try {
      await onPause();
    } catch (cause) {
      setErrorText(cause instanceof Error && cause.message ? cause.message : null);
      setFailed(true);
    } finally {
      setPausing(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-border p-3">
      {onPause && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onPause && (
          <button
            type="button"
            disabled={disabled || pausing}
            onClick={() => void pause()}
            className="action-button action-edit"
          >
            {pausing ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <EyeOff className="size-4" aria-hidden />
            )}
            {pauseLabel}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || pausing}
          onClick={onDelete}
          className="action-button action-danger"
        >
          <Trash2 className="size-4" aria-hidden />
          {deleteLabel}
        </button>
      </div>
      {failed && (
        <InlineStatus
          state="error"
          text={errorText ?? undefined}
          onRetry={() => void pause()}
          className="w-full justify-end"
        />
      )}
    </div>
  );
}
