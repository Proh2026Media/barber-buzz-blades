import { forwardRef } from "react";
import { Loader2, type LucideIcon, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícone "processando" girando, no formato de ícone que os componentes visuais recebem. */
export const SpinningLoader = forwardRef<SVGSVGElement, LucideProps>(function SpinningLoader(
  { className, ...props },
  ref,
) {
  return <Loader2 ref={ref} {...props} className={cn(className, "motion-safe:animate-spin")} />;
}) as LucideIcon;
