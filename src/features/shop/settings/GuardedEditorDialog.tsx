import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, LogOut, Save, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconTile, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** O que a janela entrega ao editor para proteger as mudanças não salvas. */
export type EditorGuard = {
  /** O editor avisa quando passa a ter (ou deixa de ter) mudança não salva. */
  setDirty: (dirty: boolean) => void;
  /**
   * O editor informa como salvar (usado em "Salvar e sair"; devolve `true` se salvou) e
   * passa `null` ao sair da tela.
   */
  registerSave: (save: (() => Promise<boolean>) | null) => void;
  /**
   * Fecha a janela passando pela proteção e, depois de fechada, executa `after`
   * (ex.: "Trocar foto" leva à identidade visual sem abrir uma janela sobre a outra).
   */
  requestClose: (after?: () => void) => void;
};

/**
 * Janela de edição longa (identidade visual, página da barbearia) que não perde trabalho:
 * com mudança não salva, o título ganha o selo "Não salvo" e fechar (X, Esc ou toque fora)
 * pergunta antes — "Salvar e sair", "Descartar mudanças" ou "Continuar editando".
 * A área de rolagem tem uma coluna que nunca passa da largura da tela.
 */
export function GuardedEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  descriptionHidden,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Linha de apoio do título (lida pelo leitor de tela mesmo quando escondida). */
  description: string;
  descriptionHidden?: boolean;
  /** Largura máxima da janela (padrão `max-w-2xl`). */
  className?: string;
  children: (guard: EditorGuard) => ReactNode;
}) {
  const { t } = useI18n();
  const [dirty, setDirtyState] = useState(false);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [canSave, setCanSave] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    setDirtyState(false);
  }, [open]);

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirtyState(next);
  }, []);

  const registerSave = useCallback((save: (() => Promise<boolean>) | null) => {
    saveRef.current = save;
    setCanSave(Boolean(save));
  }, []);

  const close = useCallback(() => {
    dirtyRef.current = false;
    setDirtyState(false);
    setAsking(false);
    onOpenChange(false);
    const next = afterClose.current;
    afterClose.current = null;
    // Deixa a janela terminar de fechar antes de abrir outra tela ou janela.
    if (next) window.setTimeout(next, 0);
  }, [onOpenChange]);

  const requestClose = useCallback(
    (after?: () => void) => {
      afterClose.current = after ?? null;
      if (dirtyRef.current) setAsking(true);
      else close();
    },
    [close],
  );

  const guard = useMemo<EditorGuard>(
    () => ({ setDirty, registerSave, requestClose }),
    [setDirty, registerSave, requestClose],
  );

  async function saveAndExit() {
    const save = saveRef.current;
    if (!save || saving) return;
    setSaving(true);
    try {
      const ok = await save();
      if (ok) close();
      else {
        // Falhou (campo a corrigir ou erro ao gravar): volta ao editor, que mostra o motivo.
        afterClose.current = null;
        setAsking(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border-border bg-card p-0",
            className ?? "max-w-2xl",
          )}
        >
          <DialogScrollArea className="grid max-h-[calc(92dvh-2px)] grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto p-5 sm:p-6">
            <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 pr-10">
              <DialogTitle className="text-lg font-extrabold tracking-tight">{title}</DialogTitle>
              {dirty && (
                <StatusBadge tone="pending" variant="dot" label={t("visual.unsaved.badge")} />
              )}
            </div>
            <DialogDescription
              className={descriptionHidden ? "sr-only" : "-mt-3 text-sm text-muted-foreground"}
            >
              {description}
            </DialogDescription>
            {children(guard)}
          </DialogScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={asking}
        onOpenChange={(next) => {
          if (next || saving) return;
          afterClose.current = null;
          setAsking(false);
        }}
      >
        <AlertDialogContent className="gap-4 rounded-3xl border-border bg-card">
          <AlertDialogHeader className="text-left sm:text-left">
            <div className="flex items-start gap-3">
              <IconTile icon={LogOut} tone="warning" />
              <div className="min-w-0 flex-1 space-y-1">
                <AlertDialogTitle className="text-lg font-bold leading-snug">
                  {t("editorGuard.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>{t("editorGuard.text", { title })}</AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {/* Celular: um botão por linha, a saída segura primeiro. Computador: lado a lado. */}
          <AlertDialogFooter className="grid gap-2 sm:grid-cols-3 sm:space-x-0">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                afterClose.current = null;
                setAsking(false);
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
            >
              {t("editorGuard.keep")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={close}
              className="action-button action-danger min-h-11 w-full"
            >
              <Trash2 aria-hidden />
              {t("editorGuard.discard")}
            </button>
            {canSave && (
              <button
                type="button"
                disabled={saving}
                aria-busy={saving || undefined}
                onClick={() => void saveAndExit()}
                className="action-button action-confirm min-h-11 w-full"
              >
                {saving ? (
                  <Loader2 className="motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Save aria-hidden />
                )}
                {saving ? t("visual.result.saving") : t("editorGuard.saveExit")}
              </button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
