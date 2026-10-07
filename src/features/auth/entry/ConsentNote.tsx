import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LegalDocLinks } from "./LegalDocLinks";

/**
 * Aceite jurídico compacto: a frase fica igual (num parágrafo curto, com um cadeado no lugar
 * de "Ambiente protegido") e os documentos viram links de 44 px logo abaixo, sem margem
 * negativa — o anel de foco não passa por cima do texto.
 */
export function ConsentNote({
  children,
  withDpa,
  id,
  className,
}: {
  /** A frase do aceite, com os nomes dos documentos em texto. */
  children: ReactNode;
  withDpa?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p id={id} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
        <span className="min-w-0">{children}</span>
      </p>
      <LegalDocLinks withDpa={withDpa} />
    </div>
  );
}
