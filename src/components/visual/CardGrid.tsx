import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Grade de cartões que se encaixa pela largura (`repeat(auto-fill, minmax(min, 1fr))`) a partir
 * de 768 px. No celular é uma coluna só, ou duas quando o chamador pede `phoneColumns={2}`.
 * CSS em src/styles/leiaute.css.
 *
 * ```tsx
 * <CardGrid min="18rem">{servicos.map((s) => <ServiceCard key={s.id} … />)}</CardGrid>
 * ```
 */
export function CardGrid({
  min = "18rem",
  gap = "1rem",
  phoneColumns = 1,
  className,
  style,
  children,
}: {
  /** Largura mínima de cada cartão a partir de 768 px. */
  min?: string;
  gap?: string;
  /** Colunas no celular (abaixo de 768 px). */
  phoneColumns?: 1 | 2;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("app-card-grid", className)}
      data-phone-columns={phoneColumns}
      style={{ "--card-min": min, "--card-gap": gap, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}
