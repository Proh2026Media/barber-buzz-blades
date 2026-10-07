import {
  Ban,
  CheckCircle2,
  Clock3,
  Hourglass,
  Moon,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tipos de bloco da mini agenda — o mesmo código visual em Ajustes, Horários e Agenda:
 * `booked` já marcado (escuro da marca), `prep` folga (dourado listrado), `free` livre / pode
 * começar (verde), `none` não cabe (vermelho claro), `blocked` bloqueado (vermelho listrado),
 * `closed` fechado (cinza tracejado), `pending` aguardando (âmbar tracejado).
 */
export type TimelineKind = "booked" | "prep" | "free" | "none" | "blocked" | "closed" | "pending";

export type TimelineRow = {
  kind: TimelineKind;
  /** Horário à esquerda ("9:30") ou "—". */
  time: string;
  label: ReactNode;
  /** Duração em minutos: deixa o bloco proporcional (32 a 72 px). */
  minutes?: number;
  /** Troca o ícone padrão do tipo. */
  icon?: LucideIcon;
  key?: string;
};

const KIND_STYLE: Record<TimelineKind, string> = {
  booked: "bg-primary text-primary-foreground",
  prep: "border border-dashed border-gold/60 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_srgb,var(--gold)_14%,transparent)_6px_12px)] text-foreground",
  free: "tone-success border-2 border-[color:var(--tone-line)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]",
  none: "tone-danger border border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]",
  blocked:
    "tone-danger border border-dashed border-[color:var(--tone-line)] bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_srgb,var(--tone-line)_12%,transparent)_6px_12px)] text-[color:var(--tone-ink)]",
  closed:
    "tone-neutral border border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]",
  pending:
    "tone-pending border border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]",
};

const KIND_ICON: Record<TimelineKind, LucideIcon> = {
  booked: Clock3,
  prep: Sparkles,
  free: CheckCircle2,
  none: X,
  blocked: Ban,
  closed: Moon,
  pending: Hourglass,
};

/**
 * Mini agenda ilustrada: horário à esquerda e um bloco por momento, com altura proporcional à
 * duração. Mostra a regra pelo resultado ("já marcado → folga → pode começar") em vez de
 * explicá-la. Lida como lista pelo leitor de tela.
 */
export function Timeline({
  rows,
  label,
  proportional = true,
  className,
}: {
  rows: TimelineRow[];
  /** Nome da lista para leitor de tela. */
  label?: string;
  /** Altura pela duração (padrão). Desligado, todos os blocos têm 40 px. */
  proportional?: boolean;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("space-y-1.5", className)}>
      {rows.map((row, index) => {
        const height =
          !proportional || row.kind === "none" || !row.minutes
            ? 40
            : Math.min(72, Math.max(32, row.minutes * 1.1));
        const Icon = row.icon ?? KIND_ICON[row.kind];
        return (
          <li
            key={row.key ?? `${row.kind}-${row.time}-${index}`}
            className="flex items-stretch gap-3"
          >
            <span className="w-11 shrink-0 pt-1.5 text-right text-xs font-bold tabular-nums text-muted-foreground">
              {row.time}
            </span>
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-xs font-semibold",
                KIND_STYLE[row.kind],
              )}
              style={{ minHeight: height }}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{row.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
