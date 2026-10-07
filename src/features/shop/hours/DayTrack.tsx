import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { rulerPercent, rulerTicks, type TimeSpan } from "./model";

/**
 * Barra de um dia numa régua comum: aberto (verde), bloqueado (vermelho hachurado), pedido à
 * espera dos sócios (âmbar tracejado) e dia fechado (trilho cinza tracejado). Mesmo código de cor
 * da mini agenda (Timeline). É decorativa: quem a usa escreve o horário ao lado ou no nome.
 */
export type TrackSegment = TimeSpan & {
  kind: "open" | "blocked" | "pending";
  /** Só uma pessoa da equipe: ocupa a metade de baixo (a loja segue aberta). */
  partial?: boolean;
};

const HATCH: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--tone-line) 0 3px, color-mix(in oklab, var(--tone-line) 25%, transparent) 3px 6px)",
};

export function DayTrack({
  ruler,
  segments,
  closed = false,
  nowMinute,
  size = "sm",
  className,
}: {
  ruler: TimeSpan;
  segments: TrackSegment[];
  closed?: boolean;
  /** Marca de "agora" (só no dia de hoje). */
  nowMinute?: number | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const height = size === "md" ? "h-4" : "h-2.5";
  return (
    <span
      aria-hidden
      className={cn(
        "relative block w-full overflow-hidden rounded-full",
        height,
        closed
          ? "tone-neutral border border-dashed border-[color:var(--tone-line)] bg-transparent"
          : "bg-muted",
        className,
      )}
    >
      {!closed &&
        segments.map((segment, index) => {
          const left = rulerPercent(segment.start, ruler);
          const width = Math.max(1.5, rulerPercent(segment.end, ruler) - left);
          return (
            <span
              key={`${segment.kind}-${index}`}
              className={cn(
                "absolute",
                segment.partial ? "bottom-0 top-1/2" : "inset-y-0",
                segment.kind === "open" && "tone-success bg-[color:var(--tone-line)]",
                segment.kind === "blocked" &&
                  "tone-danger rounded-sm border-x-2 border-[color:var(--tone-line)]",
                segment.kind === "pending" &&
                  "tone-pending rounded-full border-2 border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-bg)]",
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                ...(segment.kind === "blocked" ? HATCH : {}),
              }}
            />
          );
        })}
      {nowMinute != null && nowMinute > ruler.start && nowMinute < ruler.end && (
        <span
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${rulerPercent(nowMinute, ruler)}%` }}
        />
      )}
    </span>
  );
}

/** Marcas da régua ("9h · 12h · 15h · 18h") alinhadas com as barras logo abaixo. */
export function RulerTicks({ ruler, className }: { ruler: TimeSpan; className?: string }) {
  const { t } = useI18n();
  return (
    <span aria-hidden className={cn("relative block h-4 text-xs text-muted-foreground", className)}>
      {rulerTicks(ruler).map((minute) => {
        const percent = rulerPercent(minute, ruler);
        return (
          <span
            key={minute}
            className="absolute top-0 whitespace-nowrap tabular-nums leading-none"
            style={{
              left: `${percent}%`,
              transform: `translateX(${percent < 6 ? "0" : percent > 94 ? "-100%" : "-50%"})`,
            }}
          >
            {t("hours.ruler.tick", { hour: Math.floor(minute / 60) })}
          </span>
        );
      })}
    </span>
  );
}
