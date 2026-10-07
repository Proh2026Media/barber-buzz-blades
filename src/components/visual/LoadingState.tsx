import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Notice } from "./Notice";

const BAR = "block rounded-md bg-muted motion-safe:animate-pulse";

function Shapes({ variant, count }: { variant: LoadingVariant; count: number }) {
  const items = Array.from({ length: count }, (_, index) => index);
  if (variant === "stats") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((index) => (
          <div key={index} className="app-action-card space-y-2 p-4">
            <span className={cn(BAR, "size-5")} />
            <span className={cn(BAR, "h-6 w-16")} />
            <span className={cn(BAR, "h-3 w-20")} />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "list") {
    return (
      <ul className="space-y-2">
        {items.map((index) => (
          <li
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-border/70 p-3"
          >
            <span className={cn(BAR, "size-10 shrink-0 rounded-full")} />
            <span className="flex-1 space-y-2">
              <span className={cn(BAR, "h-3.5 w-2/3")} />
              <span className={cn(BAR, "h-3 w-1/3")} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (variant === "lines") {
    return (
      <div className="space-y-2">
        {items.map((index) => (
          <span key={index} className={cn(BAR, "h-3.5", index % 3 === 2 ? "w-1/2" : "w-full")} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((index) => (
        <div key={index} className="app-action-card space-y-3 p-4">
          <span className="flex items-center gap-3">
            <span className={cn(BAR, "size-10 shrink-0 rounded-xl")} />
            <span className="flex-1 space-y-2">
              <span className={cn(BAR, "h-4 w-1/2")} />
              <span className={cn(BAR, "h-3 w-1/3")} />
            </span>
          </span>
          <span className={cn(BAR, "h-3 w-5/6")} />
        </div>
      ))}
    </div>
  );
}

type LoadingVariant = "cards" | "list" | "stats" | "lines";

/**
 * Carregando com o desenho do que vai aparecer (cartões, lista, números ou linhas) e um verbo
 * visível ("Buscando horários…"), sem pular a página quando o conteúdo chega. Se demorar, avisa
 * e oferece "Tentar de novo". A pulsação respeita a preferência por menos movimento.
 */
export function LoadingState({
  label,
  variant = "cards",
  count = 3,
  slowAfterMs = 10000,
  onRetry,
  hideLabel,
  className,
}: {
  /** O que está sendo buscado, no gerúndio. Padrão: "Carregando…". */
  label?: string;
  variant?: LoadingVariant;
  count?: number;
  /** Depois de quanto tempo avisa que está demorando (0 desliga). */
  slowAfterMs?: number;
  onRetry?: () => void;
  /** Deixa o verbo só para leitor de tela. */
  hideLabel?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!slowAfterMs) return;
    const id = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(id);
  }, [slowAfterMs]);
  return (
    <div role="status" aria-busy="true" className={cn("space-y-3", className)}>
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-semibold text-muted-foreground",
          hideLabel && "sr-only",
        )}
      >
        <Loader2 className="size-3.5 shrink-0 motion-safe:animate-spin" aria-hidden />
        {label ?? t("visual.loading")}
      </p>
      <div aria-hidden>
        <Shapes variant={variant} count={count} />
      </div>
      {slow && (
        <Notice
          tone="pending"
          role="none"
          title={t("visual.loadingSlow")}
          action={
            onRetry ? { label: t("visual.retry"), onClick: onRetry, icon: RotateCcw } : undefined
          }
        />
      )}
    </div>
  );
}
