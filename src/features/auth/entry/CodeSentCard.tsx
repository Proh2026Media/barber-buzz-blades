import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExampleBubble } from "./ExampleBubble";

/**
 * "Para onde foi o código": o número em pílula e um balão de exemplo da mensagem que chega no
 * WhatsApp (marcado como exemplo). Junta num lugar o número, a mensagem a procurar e, se
 * houver, a saída para número errado (`children`).
 */
export function CodeSentCard({
  toLabel,
  number,
  sender,
  message,
  exampleLabel,
  hideExample,
  children,
  className,
}: {
  /** "Enviamos para". */
  toLabel: string;
  /** Número já formatado: (11) 99999-0000. */
  number: string;
  /** Quem manda a mensagem ("Barba & Cabelo"). */
  sender: string;
  /** Linha do código no exemplo ("Seu código: ••• •••", sem dígitos que pareçam reais). */
  message: string;
  exampleLabel: string;
  /** Esconde o balão de exemplo (quando a pessoa já começou a digitar o código). */
  hideExample?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-2.5 rounded-2xl border border-border bg-background/60 p-3", className)}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden />
        <span className="text-muted-foreground">{toLabel}</span>
        <span className="rounded-xl border border-border bg-card px-2 py-0.5 font-bold tabular-nums text-foreground">
          {number}
        </span>
      </p>
      {!hideExample && (
        <ExampleBubble
          sender={sender}
          message={message}
          exampleLabel={exampleLabel}
          className="ps-6"
        />
      )}
      {children}
    </div>
  );
}
