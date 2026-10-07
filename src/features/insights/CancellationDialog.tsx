import type { ReactNode } from "react";
import { CalendarX2, Loader2, MessageSquareText, X, XCircle } from "lucide-react";
import { ChoiceChips, IconList, IconTile, Notice } from "@/components/visual";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import {
  cancellationReasonText,
  cancellationReasons,
  type CancellationReason,
} from "./cancellation";

export function CancellationDialog({
  open,
  busy,
  reason,
  onReason,
  onCancel,
  onConfirm,
  summary,
  details,
  error,
  title,
  keepLabel,
  confirmLabel,
}: {
  open: boolean;
  busy: boolean;
  reason: CancellationReason | "";
  onReason: (value: CancellationReason | "") => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Serviço, data e horário da reserva que será cancelada. */
  summary?: string | null;
  /** Resumo visual (ex.: `<DetailList>`); tem prioridade sobre `summary`. */
  details?: ReactNode;
  /** Erro da tentativa, mostrado dentro da janela. */
  error?: string | null;
  /** Textos próprios de quem chama (a Agenda fala em "horário"); sem eles, os padrões. */
  title?: string;
  keepLabel?: string;
  confirmLabel?: string;
}) {
  const { t } = useI18n();
  const reasonOptions = [
    { value: "" as const, label: t("cancel.reasonNone") },
    ...(Object.keys(cancellationReasons) as CancellationReason[]).map((value) => ({
      value,
      label: cancellationReasonText(value),
    })),
  ];
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="max-h-[90dvh] gap-4 overflow-y-auto rounded-3xl border-border bg-card">
        <AlertDialogHeader className="text-left sm:text-left">
          <div className="flex items-start gap-3">
            <IconTile icon={XCircle} tone="danger" />
            <div className="min-w-0 flex-1 space-y-1">
              <AlertDialogTitle className="text-lg font-bold leading-snug">
                {title ?? t("cancel.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                {t("cancel.body")}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        {details || summary ? (
          <div className="rounded-2xl border border-border bg-background/60 p-3 text-sm text-foreground">
            {details ?? summary}
          </div>
        ) : null}
        <IconList
          size="md"
          items={[{ key: "free", tone: "danger", icon: CalendarX2, text: t("cancel.freed") }]}
        />
        <ChoiceChips
          label={t("cancel.reasonLabel")}
          icon={MessageSquareText}
          hint={t("cancel.reasonHint")}
          value={reason}
          onChange={onReason}
          disabled={busy}
          options={reasonOptions}
        />
        {error && <Notice tone="danger" title={error} />}
        <AlertDialogFooter className="grid gap-2 sm:grid-cols-2 sm:space-x-0">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 w-full rounded-xl border border-border bg-card px-4 text-sm font-semibold disabled:opacity-50"
          >
            {keepLabel ?? t("cancel.keep")}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
            className="action-button action-danger min-h-11 w-full disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <X className="size-4" aria-hidden />
            )}
            {busy ? t("bookings.cancelling") : (confirmLabel ?? t("cancel.confirm"))}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
