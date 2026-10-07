import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type MoreAction = {
  id: string;
  /** Verbo + objeto ("Pedir para remarcar"). */
  label: string;
  /** Uma linha com o efeito ("O cliente escolhe outro horário"). */
  description?: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** `danger` vai para o fim, separado, na cor de alerta. */
  tone?: "danger";
  disabled?: boolean;
};

function ActionBody({ action }: { action: MoreAction }) {
  const Icon = action.icon;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          action.tone === "danger"
            ? "tone-danger bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]"
            : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block text-sm font-semibold",
            action.tone === "danger" && "tone-danger text-[color:var(--tone-ink)]",
          )}
        >
          {action.label}
        </span>
        {action.description && (
          <span className="block text-xs font-normal text-muted-foreground">
            {action.description}
          </span>
        )}
      </span>
    </>
  );
}

/**
 * Botão "⋯" com as ações secundárias de um item. No celular abre uma folha inferior com botões
 * grandes; no computador, um menu. As ações destrutivas ficam no fim, separadas. Mantém tudo
 * acessível sem lotar o cartão com botões.
 */
export function MoreActions({
  actions,
  label,
  title,
  className,
}: {
  actions: MoreAction[];
  /** Nome do botão com o contexto ("Mais ações: Corte das 10:00"). */
  label?: string;
  /** Título da folha no celular (ex.: nome do item). */
  title?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const regular = actions.filter((action) => action.tone !== "danger");
  const danger = actions.filter((action) => action.tone === "danger");
  const triggerLabel = label ?? t("visual.moreActions");
  const triggerClass = cn("app-icon-button", className);

  if (!actions.length) return null;

  if (!mobile) {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={triggerLabel}
            title={triggerLabel}
            className={triggerClass}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-2xl p-1.5">
          {[regular, danger].map((group, groupIndex) =>
            group.length === 0 ? null : (
              <div key={groupIndex}>
                {groupIndex === 1 && regular.length > 0 && <DropdownMenuSeparator />}
                {group.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    disabled={action.disabled}
                    onSelect={() => action.onSelect()}
                    className="min-h-12 cursor-pointer gap-3 rounded-xl px-2 py-1.5"
                  >
                    <ActionBody action={action} />
                  </DropdownMenuItem>
                ))}
              </div>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function run(action: MoreAction) {
    setOpen(false);
    // Espera a folha fechar e devolver o foco antes de abrir outra janela.
    window.setTimeout(() => action.onSelect(), 0);
  }

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={triggerClass}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="bottom-[max(0.75rem,env(safe-area-inset-bottom))] top-auto translate-y-0 gap-1 p-3 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4"
        >
          <DialogTitle className="min-h-11 px-2 pr-12 pt-2.5 text-base font-bold">
            {title ?? triggerLabel}
          </DialogTitle>
          {[regular, danger].map((group, groupIndex) =>
            group.length === 0 ? null : (
              <ul
                key={groupIndex}
                className={cn(
                  groupIndex === 1 && regular.length > 0 && "mt-1 border-t border-border pt-1",
                )}
              >
                {group.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      disabled={action.disabled}
                      onClick={() => run(action)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/60 disabled:opacity-50"
                    >
                      <ActionBody action={action} />
                    </button>
                  </li>
                ))}
              </ul>
            ),
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
