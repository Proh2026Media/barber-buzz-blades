import type { ReactNode } from "react";
import { Tag } from "@/components/visual";
import { cn } from "@/lib/utils";

/**
 * Balão de mensagem do WhatsApp marcado como exemplo: mostra o que vai chegar ("Seu código:
 * ••• •••", "Lembrete: amanhã 14:00 · Corte") em vez de explicar. O selo "Exemplo" fica dentro
 * do balão, na linha do remetente, para não ser confundido com uma mensagem real. É decorativo
 * para leitor de tela (o texto real fica no rótulo do campo ou da escolha).
 */
export function ExampleBubble({
  sender,
  message,
  exampleLabel,
  className,
}: {
  sender: string;
  message: ReactNode;
  exampleLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex", className)} aria-hidden>
      <div className="min-w-0 max-w-[16rem] rounded-xl rounded-tl-sm border border-dashed border-[#065f46]/40 bg-[#f0fdf4] px-3 py-2 shadow-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-xs font-bold text-[#065f46]">{sender}</span>
          <Tag className="shrink-0">{exampleLabel}</Tag>
        </p>
        <p className="mt-1 text-sm text-[#1c1b18]">{message}</p>
      </div>
    </div>
  );
}
