import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { TONE_CLASS, TONE_FILL, type Tone } from "./tones";

export type Segment = {
  label: string;
  value: number;
  tone: Tone;
  icon?: LucideIcon;
  key?: string;
};

/**
 * Barra horizontal dividida em partes com as cores dos estados (ex.: dia com 3 concluídos,
 * 2 confirmados e 1 a confirmar), com legenda em selos (ícone + nome + número) e uma frase
 * equivalente para leitor de tela. Com `total` maior que a soma, o resto fica como trilho vazio
 * ("3 de 5 respostas"). Para comparar, empilhe duas barras com o mesmo `total`.
 */
export function SegmentBar({
  segments,
  total,
  summary,
  showSummary,
  legend = true,
  size = "md",
  className,
}: {
  segments: Segment[];
  total?: number;
  /** Frase completa ("3 de 10 concluídos"): nome acessível da barra. */
  summary: string;
  /** Mostra a frase acima da barra. */
  showSummary?: boolean;
  legend?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const sum = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  const base = Math.max(total ?? sum, sum, 1);
  return (
    <div className={cn("space-y-2", className)}>
      {showSummary && <p className="text-xs font-semibold text-muted-foreground">{summary}</p>}
      <div
        role="img"
        aria-label={summary}
        className={cn(
          "flex w-full gap-0.5 overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-2" : "h-3",
        )}
      >
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment, index) => (
            <span
              key={segment.key ?? `${segment.label}-${index}`}
              className={cn(TONE_CLASS[segment.tone], TONE_FILL, "h-full shrink-0")}
              style={{ width: `${(segment.value / base) * 100}%` }}
            />
          ))}
      </div>
      {legend && (
        <ul className="flex flex-wrap gap-1.5">
          {segments.map((segment, index) => (
            <li key={segment.key ?? `${segment.label}-${index}`}>
              <StatusBadge
                tone={segment.tone}
                icon={segment.icon}
                label={segment.label}
                count={segment.value}
                size="sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
