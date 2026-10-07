import { Loader2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { announce } from "./announce";
import { IconList, type IconListItem } from "./Hint";
import { Notice } from "./Notice";
import { IconTile } from "./SectionHeader";
import { TONE_ICON } from "./tones";

export type ConfirmTone = "danger" | "warning" | "info" | "success";

/** Cor do botão de confirmar: as cores de ação aprovadas. */
const CONFIRM_CLASS: Record<ConfirmTone, string> = {
  danger: "action-danger",
  warning: "action-edit",
  info: "action-confirm",
  success: "action-success",
};

/**
 * Janela de decisão: diz de qual item se trata (resumo), o que vai acontecer (consequências com
 * ícone) e oferece dois botões com verbo + objeto ("Manter horário" / "Cancelar horário").
 * Enquanto confirma, o botão gira e a janela não fecha; se falhar, o erro aparece dentro dela e a
 * pessoa pode tentar de novo. Substitui `window.confirm` e parágrafos de regra.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  tone = "danger",
  icon,
  title,
  description,
  summary,
  consequences,
  consequencesLabel,
  children,
  confirmLabel,
  busyLabel,
  confirmIcon,
  cancelLabel,
  onConfirm,
  errorText,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: ConfirmTone;
  /** Ícone do cabeçalho; padrão: o ícone do tom. */
  icon?: LucideIcon;
  /** Pergunta direta ("Cancelar este horário?"). */
  title: string;
  /** Uma linha de apoio, se precisar. */
  description?: ReactNode;
  /** O item afetado (ex.: `<DetailList>` com serviço, cliente, dia e hora). */
  summary?: ReactNode;
  /** O que acontece, em frases curtas com ícone (✕ o horário fica livre, ✓ o cliente é avisado). */
  consequences?: IconListItem[];
  /** Nome da lista de consequências para leitor de tela. */
  consequencesLabel?: string;
  /** Controles extras (ex.: motivo em `ChoiceChips`). */
  children?: ReactNode;
  /** Verbo + objeto do botão principal ("Cancelar horário"). */
  confirmLabel: string;
  /** Texto enquanto confirma ("Cancelando…"). */
  busyLabel?: string;
  confirmIcon?: LucideIcon;
  /** Saída segura com verbo + objeto ("Manter horário"). */
  cancelLabel: string;
  /** Pode devolver uma promessa: a janela espera, fecha no sucesso e mostra o erro na falha. */
  onConfirm: () => unknown | Promise<unknown>;
  errorText?: string;
  confirmDisabled?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const HeaderIcon = icon ?? TONE_ICON[tone];
  const ConfirmIcon = confirmIcon;
  const hasDetails = Boolean(summary) || Boolean(consequences?.length);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  // Depois de uma falha, o foco volta ao botão de confirmar para tentar de novo pelo teclado.
  useEffect(() => {
    if (error && !busy) confirmRef.current?.focus();
  }, [error, busy]);

  const details = hasDetails ? (
    <div className="space-y-4 text-foreground">
      {summary && (
        <div className="rounded-2xl border border-border bg-background/60 p-3">{summary}</div>
      )}
      {consequences && consequences.length > 0 && (
        <IconList items={consequences} size="md" label={consequencesLabel} />
      )}
    </div>
  ) : null;

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      const message = errorText ?? t("visual.result.failed");
      setError(message);
      announce(message, "assertive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="gap-4 rounded-3xl border-border bg-card"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <AlertDialogHeader className="text-left sm:text-left">
          <div className="flex items-start gap-3">
            <IconTile icon={HeaderIcon} tone={tone} />
            <div className="min-w-0 flex-1 space-y-1">
              <AlertDialogTitle className="text-lg font-bold leading-snug">
                {title}
              </AlertDialogTitle>
              {description ? (
                <AlertDialogDescription>{description}</AlertDialogDescription>
              ) : (
                !hasDetails && (
                  <AlertDialogDescription className="sr-only">
                    {confirmLabel}
                  </AlertDialogDescription>
                )
              )}
            </div>
          </div>
        </AlertDialogHeader>
        {hasDetails &&
          (description ? (
            details
          ) : (
            // Sem linha de apoio, o resumo e as consequências descrevem a janela ao leitor de tela.
            <AlertDialogDescription asChild className="space-y-4 text-foreground">
              {details}
            </AlertDialogDescription>
          ))}
        {children}
        {error && <Notice tone="danger" title={error} role="none" />}
        {/* Celular: um botão por linha (a saída segura primeiro). Computador: lado a lado. */}
        <AlertDialogFooter className="grid gap-2 sm:grid-cols-2 sm:space-x-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={busy || confirmDisabled}
            aria-busy={busy || undefined}
            onClick={() => void confirm()}
            className={cn("action-button min-h-11 w-full", CONFIRM_CLASS[tone])}
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              ConfirmIcon && <ConfirmIcon aria-hidden />
            )}
            {busy ? (busyLabel ?? t("common.wait")) : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
