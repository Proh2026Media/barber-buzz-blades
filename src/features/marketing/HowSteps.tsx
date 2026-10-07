import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HowStep = {
  label: string;
  description?: ReactNode;
  icon: LucideIcon;
};

/**
 * "Como funciona" em passos com ícone, nas páginas públicas. Variação local do Steps: aqui não
 * há progresso (nenhuma etapa feita ou atual), então os passos ficam em tinta normal em vez do
 * cinza de "a fazer", que dava a impressão de desativado.
 */
export function HowSteps({
  steps,
  label,
  orientation = "horizontal",
  className,
}: {
  steps: HowStep[];
  /** Nome da lista para leitor de tela. */
  label: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const marker =
    "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 border-foreground/70 bg-card text-foreground";

  if (orientation === "vertical") {
    return (
      <ol aria-label={label} className={className}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const last = index === steps.length - 1;
          return (
            <li key={step.label} className={cn("relative flex gap-3", !last && "pb-4")}>
              {!last && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-4 top-8 w-0.5 -translate-x-1/2 bg-border"
                />
              )}
              <span aria-hidden className={marker}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 pt-1">
                <span className="block text-sm font-semibold text-foreground">{step.label}</span>
                {step.description && (
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <li
            key={step.label}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5 text-center"
          >
            {index > 0 && (
              <span
                aria-hidden
                className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-border"
              />
            )}
            <span aria-hidden className={marker}>
              <Icon className="size-4" />
            </span>
            <span className="max-w-full break-words text-[11px] font-semibold leading-tight text-foreground">
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
