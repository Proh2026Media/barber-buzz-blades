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
}: {
  open: boolean;
  busy: boolean;
  reason: CancellationReason | "";
  onReason: (value: CancellationReason | "") => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
          <AlertDialogDescription>
            O motivo é opcional e ajuda a melhorar horários e serviços. Você pode continuar sem
            informar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="space-y-2 text-sm font-semibold">
          <span>Motivo do cancelamento</span>
          <select
            aria-label="Motivo do cancelamento"
            value={reason}
            disabled={busy}
            onChange={(event) => onReason(event.target.value as CancellationReason | "")}
            className="w-full rounded-xl border border-border bg-background px-3 py-3"
          >
            <option value="">Prefiro não informar</option>
            {Object.entries(cancellationReasons).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <AlertDialogFooter>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="action-button action-danger"
          >
            <X className="size-4" />
            {busy ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
