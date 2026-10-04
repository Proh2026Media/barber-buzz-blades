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
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onDismiss();
      }}
    >
      <AlertDialogContent className="max-w-md rounded-[var(--panel-radius)] border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("join.title")}</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed">
            {t("join.textBefore")} <span className="font-semibold text-foreground">{shopName}</span>
            . {t("join.textAfter")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={busy} onClick={onDismiss}>
            {t("join.notNow")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {busy ? t("join.confirming") : t("join.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
