import { Fragment, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { readableLink } from "@/components/visual";
import { cn } from "@/lib/utils";

/** Endereço com pontos de quebra depois de "." e "-": nunca corta uma palavra no meio. */
export function BreakableText({ text }: { text: string }) {
  // Sem lookbehind na expressão regular (Safari antigo não entende): corta à mão.
  const parts: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (".-/@".includes(char)) {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 && <wbr />}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Pílula de endereço: ícone de globo e o link legível (sem "https://"), com quebra só nos
 * pontos. Serve para a prévia do link da barbearia; depois de criada, use `CopyField`.
 */
export function LinkPill({
  url,
  label,
  note,
  id,
  className,
}: {
  url: string;
  /** Nome curto lido antes do endereço (ex.: "Link da sua página"). */
  label?: string;
  /** Etiqueta pequena ao lado (ex.: "pode ganhar -2 se já existir"). */
  note?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className="inline-flex min-w-0 max-w-full items-start gap-1.5 rounded-xl border border-border bg-background/70 px-2.5 py-1.5 text-[13px] font-semibold text-foreground">
        <Globe className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
        {label && <span className="sr-only">{label}: </span>}
        <span className="min-w-0 break-words">
          <BreakableText text={readableLink(url)} />
        </span>
      </span>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}
