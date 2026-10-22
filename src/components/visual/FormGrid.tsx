import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Campos em grade: 1 coluna no celular e 2 ou 3 a partir de 640 px. Um filho que precisa da
 * linha inteira (endereço, observações) pede `className="col-span-full"`. Para campos curtos
 * (CEP, preço) use `width` no `Field`. CSS em src/styles/leiaute.css.
 *
 * ```tsx
 * <FormGrid columns={2}>
 *   <Field label="Nome">…</Field>
 *   <Field label="Preço" width="sm">…</Field>
 *   <Field label="Descrição" className="col-span-full">…</Field>
 * </FormGrid>
 * ```
 */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("app-form-grid", className)} data-columns={columns}>
      {children}
    </div>
  );
}
