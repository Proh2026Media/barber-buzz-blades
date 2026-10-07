import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import type { Tone } from "./tones";

export type DetailItem = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Valor anterior: mostra "antes → agora" (mudanças, remarcação, ajuste de pontos). */
  previous?: ReactNode;
  /** Diferença em pílula ("+10 min", "+R$ 5,00"). */
  delta?: { label: string; tone?: Tone };
  key?: string;
};

/**
 * Resumo em linhas "rótulo → valor": dados de um item numa janela de confirmação, o que muda
 * num pedido (antes riscado → agora em negrito, com a diferença), conferência antes de salvar.
 */
export function DetailList({ items, className }: { items: DetailItem[]; className?: string }) {
  const { t } = useI18n();
  return (
    <dl className={cn("divide-y divide-border/70", className)}>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key ?? index}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0"
          >
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              {Icon && <Icon className="size-4 shrink-0 self-center text-gold" aria-hidden />}
              {item.label}
            </dt>
            <dd className="ms-auto flex flex-wrap items-center justify-end gap-1.5 text-right text-sm font-semibold tabular-nums">
              {item.previous !== undefined && item.previous !== null && (
                <>
                  <span className="sr-only">{t("visual.before")}:</span>
                  <span className="font-normal text-muted-foreground line-through">
                    {item.previous}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">{t("visual.after")}:</span>
                </>
              )}
              <span>{item.value}</span>
              {item.delta && (
                <StatusBadge
                  tone={item.delta.tone ?? "neutral"}
                  icon={null}
                  label={item.delta.label}
                  size="sm"
                />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
