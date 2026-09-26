import { X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cancellationReasons, type CancellationReason } from "./cancellation";

export function CancellationDialog({
  open,
  busy,
  reason,
  onReason,
  onCancel,
  onConfirm,
  summary,
}: {
  open: boolean;
  busy: boolean;
  reason: CancellationReason | "";
  onReason: (value: CancellationReason | "") => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Serviço, data e horário da reserva que será cancelada. */
  summary?: string | null;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar este agendamento?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {summary ? (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground">
                  {summary}
                </p>
              ) : null}
              <p>
                O horário será liberado. O motivo é opcional e ajuda a melhorar a agenda — você pode
                continuar sem informar.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="space-y-2 text-sm font-semibold">
          <span>Motivo do cancelamento</span>
          <select
            aria-label="Motivo do cancelamento"
            value={reason}
            disabled={busy}
            onChange={(event) => onReason(event.target.value as CancellationReason | "")}
            className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-3"
          >
            <option value="">Prefiro não informar</option>
            {Object.entries(cancellationReasons).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <AlertDialogFooter className="gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
          >
            Manter agendamento
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="action-button action-danger min-h-11 disabled:opacity-50"
          >
            <X className="size-4" />
            {busy ? "Cancelando…" : "Cancelar agendamento"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
