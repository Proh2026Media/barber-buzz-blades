import { CheckCircle2, Circle } from "lucide-react";
import { TONE_CLASS } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type MissingItem = {
  key: string;
  /** Nome curto do item ("E-mail", "Aceite"). */
  label: string;
  done: boolean;
  /** id do campo que recebe o foco ao tocar no item. */
  targetId: string;
};

/**
 * "O que falta", ao lado do botão principal: os itens obrigatórios que ainda faltam, cada um
 * com círculo vazio e tocável (leva ao campo). Quando tudo está certo, vira "✓ Tudo pronto".
 * Substitui o botão desativado sem explicação.
 */
export function MissingChecklist({
  items,
  doneText,
  id,
  className,
}: {
  items: MissingItem[];
  /** Frase do estado completo ("Tudo pronto para receber o código"). */
  doneText: string;
  id?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const missing = items.filter((item) => !item.done);

  function goTo(targetId: string) {
    const field = document.getElementById(targetId);
    if (!field) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    field.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    field.focus({ preventScroll: true });
  }

  if (missing.length === 0) {
    return (
      <p
        id={id}
        className={cn(
          TONE_CLASS.success,
          "flex items-center gap-2 text-sm font-semibold text-[color:var(--tone-ink)]",
          className,
        )}
      >
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {doneText}
      </p>
    );
  }

  return (
    <div id={id} className={cn("space-y-1.5", className)}>
      <p className="text-xs font-bold text-muted-foreground">
        {missing.length === 1
          ? t("entry.missing.one")
          : t("entry.missing.many", { count: missing.length })}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {missing.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => goTo(item.targetId)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-border bg-background/60 px-3 text-xs font-semibold text-foreground transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
