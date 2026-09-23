import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ShopJoinDialogProps = {
  open: boolean;
  shopName: string;
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

/** Confirmação explícita ao abrir o link de uma barbearia ainda não vinculada. */
export function ShopJoinDialog({
  open,
  shopName,
  busy = false,
  onConfirm,
  onDismiss,
}: ShopJoinDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onDismiss();
      }}
    >
      <AlertDialogContent className="max-w-md rounded-[var(--panel-radius)]">
        <AlertDialogHeader>
          <AlertDialogTitle>Usar esta barbearia?</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed">
            Você abriu o link de <span className="font-semibold text-foreground">{shopName}</span>.
            Confirmar vincula sua conta a esta barbearia. Pontos e reservas ficam separados por
            estabelecimento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={busy} onClick={onDismiss}>
            Agora não
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Confirmando…" : "Confirmar barbearia"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
