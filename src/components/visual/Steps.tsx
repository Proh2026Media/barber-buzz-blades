import { AlertTriangle, Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type StepStatus = "done" | "current" | "upcoming" | "error";

export type StepItem = {
  /** Nome curto que diz o objetivo da etapa ("Escolha o horário"). */
  label: string;
  description?: ReactNode;
  /** Ícone no lugar do número (útil em "como funciona"). */
  icon?: LucideIcon;
  /** Situação da etapa no progresso (obrigatória: esquecer deixaria tudo cinza, "a fazer"). */
  status: StepStatus;
  key?: string;
};

/** Passo de "como funciona" (`variant="static"`): sem progresso, o `status` é dispensável. */
export type StaticStepItem = Omit<StepItem, "status"> & { status?: StepStatus };

type ShownStep = StepItem;

type StepsProps = {
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  /** Nome da lista para leitor de tela (ex.: "Etapas do cadastro"). */
  label?: string;
  /** Permite voltar a uma etapa feita tocando nela. */
  onStepClick?: (index: number) => void;
  className?: string;
} & (
  | {
      steps: StepItem[];
      /** `progress` (padrão): etapas de um fluxo, cada uma com o seu `status`. */
      variant?: "progress";
    }
  | {
      steps: StaticStepItem[];
      /** `static`: "como funciona", sem progresso. */
      variant: "static";
    }
);

function Marker({ step, index, still }: { step: ShownStep; index: number; still?: boolean }) {
  const Icon = step.icon;
  const base =
    "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular-nums";
  if (still) {
    // "Como funciona": todos os passos em tinta normal (nenhum cinza de "a fazer" ou desativado).
    return (
      <span aria-hidden className={cn(base, "border-foreground/70 bg-card text-foreground")}>
        {Icon ? <Icon className="size-4" /> : index + 1}
      </span>
    );
  }
  if (step.status === "done") {
    return (
      <span
        aria-hidden
        className={cn(
          base,
          "tone-success border-[color:var(--tone-ink)] bg-[color:var(--tone-ink)] text-[color:var(--tone-on-ink)]",
        )}
      >
        <Check className="size-4" />
      </span>
    );
  }
  if (step.status === "error") {
    return (
      <span
        aria-hidden
        className={cn(
          base,
          "tone-danger border-[color:var(--tone-ink)] bg-[color:var(--tone-ink)] text-[color:var(--tone-on-ink)]",
        )}
      >
        <AlertTriangle className="size-4" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        base,
        step.status === "current"
          ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {Icon ? <Icon className="size-4" /> : index + 1}
    </span>
  );
}

/**
 * Etapas ligadas por uma linha: feita (✓ verde), atual (preenchida, com anel), a fazer
 * (contorno) e com problema (vermelha). Serve para progresso real de um fluxo e para mostrar
 * "como funciona" em passos com ícone. `compact` esconde os nomes e mostra "Etapa 2 de 4 · Nome"
 * (só use quando o número de etapas não mudar no meio do caminho).
 *
 * `variant="static"`: "como funciona" sem progresso (páginas públicas, regras, instruções). Todos
 * os passos na mesma tinta, sem ✓, sem etapa atual e sem o cinza de "a fazer", que parecia
 * desativado; o `status` dos passos é dispensável e ignorado.
 */
export function Steps({
  steps: stepsIn,
  orientation = "horizontal",
  variant = "progress",
  compact,
  label,
  onStepClick,
  className,
}: StepsProps) {
  const { t } = useI18n();
  const still = variant === "static";
  const steps: ShownStep[] = (stepsIn as StaticStepItem[]).map((step) => ({
    ...step,
    status: still ? "upcoming" : (step.status ?? "upcoming"),
  }));
  // Sem progresso não há "(feita)"/"(atual)" para o leitor de tela, toque para voltar (nenhum
  // passo fica "feito") nem "Etapa 2 de 4".
  const short = compact && !still;
  const stateText: Record<StepStatus, string> = {
    done: t("visual.steps.done"),
    current: t("visual.steps.current"),
    upcoming: "",
    error: t("visual.steps.error"),
  };
  const currentIndex = steps.findIndex((s) => s.status === "current" || s.status === "error");

  if (orientation === "vertical") {
    return (
      <ol aria-label={label} className={cn("space-y-0", className)}>
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          const clickable = onStepClick && step.status === "done";
          const body = (
            <>
              <Marker step={step} index={index} still={still} />
              <span className="min-w-0 flex-1 pt-1 text-left">
                <span
                  className={cn(
                    "block text-sm",
                    step.status === "current" ? "font-bold" : "font-semibold",
                    step.status === "upcoming" && !still && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {stateText[step.status] && (
                    <span className="sr-only"> ({stateText[step.status]})</span>
                  )}
                </span>
                {step.description && (
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                )}
              </span>
            </>
          );
          return (
            <li
              key={step.key ?? index}
              aria-current={step.status === "current" ? "step" : undefined}
              className={cn("relative flex gap-3", !last && "pb-4")}
            >
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-0 left-4 top-8 w-0.5 -translate-x-1/2",
                    step.status === "done"
                      ? "tone-success bg-[color:var(--tone-line)]"
                      : "bg-border",
                  )}
                />
              )}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className="flex min-h-11 flex-1 gap-3 rounded-xl"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className={className}>
      <ol aria-label={label} className="flex items-start">
        {steps.map((step, index) => {
          const clickable = onStepClick && step.status === "done";
          const previousDone = index > 0 && steps[index - 1]?.status === "done";
          const body = (
            <>
              <Marker step={step} index={index} still={still} />
              <span
                className={cn(
                  "max-w-full break-words text-[11px] leading-tight",
                  step.status === "current" ? "font-bold text-foreground" : "font-semibold",
                  step.status === "upcoming" && !still && "text-muted-foreground",
                  short && "sr-only",
                )}
              >
                {step.label}
                {stateText[step.status] && (
                  <span className="sr-only"> ({stateText[step.status]})</span>
                )}
              </span>
            </>
          );
          return (
            <li
              key={step.key ?? index}
              aria-current={step.status === "current" ? "step" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                    previousDone ? "tone-success bg-[color:var(--tone-line)]" : "bg-border",
                  )}
                />
              )}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className="flex min-h-11 flex-col items-center gap-1.5 rounded-xl px-1"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
      {short && currentIndex >= 0 && (
        <p className="mt-2 text-center text-xs font-semibold" aria-hidden>
          {t("visual.steps.progress", { current: currentIndex + 1, total: steps.length })} ·{" "}
          {steps[currentIndex]?.label}
        </p>
      )}
    </div>
  );
}
