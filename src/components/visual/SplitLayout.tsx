import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Conteúdo + coluna lateral (`aside`) para resumos ("Seu dia", "Assim o cliente vê", resumo do
 * Agendar). A partir de 1024 px são duas colunas e a lateral acompanha a rolagem (sticky);
 * abaixo disso empilha: a lateral depois do conteúdo, ou antes com `asideFirstOnPhone`.
 * CSS em src/styles/leiaute.css.
 *
 * ```tsx
 * <SplitLayout aside={<DaySummary />} asideWidth="22rem" asidePosition="start">
 *   <Timeline />
 * </SplitLayout>
 * ```
 */
export function SplitLayout({
  aside,
  asideWidth = "22rem",
  asidePosition = "end",
  asideFirstOnPhone = false,
  stickyTop = "1rem",
  gap = "1.5rem",
  className,
  asideClassName,
  children,
}: {
  aside: ReactNode;
  asideWidth?: string;
  /** Lado da coluna lateral a partir de 1024 px. */
  asidePosition?: "start" | "end";
  /** No celular, mostra a lateral antes do conteúdo. */
  asideFirstOnPhone?: boolean;
  /** Distância do topo em que a lateral fixa; `null` desliga o sticky. */
  stickyTop?: string | null;
  gap?: string;
  className?: string;
  asideClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("app-split", className)}
      data-aside={asidePosition}
      data-aside-first={asideFirstOnPhone || undefined}
      data-sticky={stickyTop ? "" : undefined}
      style={
        {
          "--split-aside": asideWidth,
          "--split-gap": gap,
          "--split-top": stickyTop ?? "0",
        } as CSSProperties
      }
    >
      <div className="app-split-main">{children}</div>
      <div className={cn("app-split-aside", asideClassName)}>{aside}</div>
    </div>
  );
}
