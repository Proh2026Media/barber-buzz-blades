import { CheckCircle2, type LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconTile, TONE_ICON, type Tone } from "@/components/visual";

/**
 * Janela só de aviso, com uma saída ("Entendi"). Usada quando não há decisão a tomar — por
 * exemplo, "Não dá para excluir" com o item já pausado — para não mostrar dois botões que fazem
 * a mesma coisa (variação local do ConfirmDialog, no mesmo visual).
 */
export function InfoDialog({
  open,
  onOpenChange,
  tone = "warning",
  icon,
  title,
  description,
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone?: Tone;
  icon?: LucideIcon;
  title: string;
  description: string;
  closeLabel: string;
}) {
  const HeaderIcon = icon ?? TONE_ICON[tone];
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-4 rounded-3xl border-border bg-card">
        <AlertDialogHeader className="text-left sm:text-left">
          <div className="flex items-start gap-3">
            <IconTile icon={HeaderIcon} tone={tone} />
            <div className="min-w-0 flex-1 space-y-1">
              <AlertDialogTitle className="text-lg font-bold leading-snug">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="action-button action-confirm min-h-11 w-full sm:w-auto"
          >
            <CheckCircle2 aria-hidden />
            {closeLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
