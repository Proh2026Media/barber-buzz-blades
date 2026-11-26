import type { ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";

/**
 * Campo do acesso: rótulo sempre visível, moldura única com ícone, ajuda e erro em texto logo
 * abaixo. Quem usa passa o `<input id={id}>` como filho e liga `aria-describedby` aos ids
 * `ajudaId` / `erroId` (os mesmos passados aqui).
 */
export function Campo({
  id,
  rotulo,
  icone: Icone,
  erro,
  erroId,
  ajuda,
  ajudaId,
  ajudaSoLeitor,
  className,
  children,
}: {
  id: string;
  rotulo: ReactNode;
  icone?: LucideIcon;
  erro?: string | null;
  erroId?: string;
  ajuda?: ReactNode;
  ajudaId?: string;
  /** A ajuda existe para o leitor de tela, mas não ocupa espaço na tela. */
  ajudaSoLeitor?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`acesso-campo${className ? ` ${className}` : ""}`}>
      <label htmlFor={id} className="acesso-rotulo">
        {rotulo}
      </label>
      <div className="acesso-entrada" data-invalido={erro ? "true" : undefined}>
        {Icone && <Icone aria-hidden="true" />}
        {children}
      </div>
      {ajuda && (
        <p id={ajudaId} className={ajudaSoLeitor ? "sr-only" : "acesso-ajuda"}>
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={erroId} className="acesso-erro" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
}
