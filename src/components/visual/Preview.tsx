import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tag } from "./StatusBadge";

/**
 * Moldura de exemplo/prévia: título pequeno em caixa alta com ícone e, se quiser, a etiqueta
 * "Exemplo" ou "Prévia" — para não confundir o que é ilustração com dado salvo. Use para
 * "Como fica na prática", "Assim o cliente vê" e prévias de mensagem.
 */
export function PreviewPanel({
  title,
  icon: Icon,
  badge,
  live,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  /** Etiqueta à direita ("Exemplo", "Prévia"). */
  badge?: string;
  /** Anuncia ao leitor de tela quando o exemplo muda com as escolhas. */
  live?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-3 rounded-2xl border border-border bg-background/60 p-4", className)}
      aria-live={live ? "polite" : undefined}
    >
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1">{title}</span>
        {badge && <Tag className="normal-case tracking-normal">{badge}</Tag>}
      </p>
      {children}
    </div>
  );
}

/** Horários em pílulas, como o cliente vê. `more` acrescenta "…" quando a lista continua. */
export function TimeChips({
  times,
  label,
  more,
  className,
}: {
  times: string[];
  /** Nome da lista para leitor de tela (ex.: "Primeiros horários oferecidos"). */
  label: string;
  more?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label={label}>
      {times.map((time) => (
        <li
          key={time}
          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold tabular-nums"
        >
          {time}
        </li>
      ))}
      {more && times.length > 0 && (
        <li aria-hidden className="px-1 py-1 text-xs font-bold text-muted-foreground">
          …
        </li>
      )}
    </ul>
  );
}
