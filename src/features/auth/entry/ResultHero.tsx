import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TONE_CLASS, TONE_ICON, type Tone } from "@/components/visual";
import { cn } from "@/lib/utils";

/** Palavras com hífen ("e-mail") não quebram no meio: viram um bloco que desce inteiro. */
function keepHyphenatedWords(text: string): ReactNode {
  if (!/\S-\S/.test(text)) return text;
  return text.split(/(\S+-\S+)/).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Topo de uma tela de resultado ("Confira seu e-mail", "Barbearia criada!", "Não deu para
 * criar"): o ícone do estado num círculo da cor do tom (o mesmo do `EmptyState` com `status`),
 * o título como cabeçalho da página e uma linha. Responde "o que aconteceu"; quem usa põe logo
 * abaixo o dado principal (e-mail, número, link) e a próxima ação.
 *
 * O título recebe `tabIndex={-1}`: a tela pode levar o foco até ele quando o resultado aparece.
 */
export const ResultHero = forwardRef<
  HTMLHeadingElement,
  {
    tone: Tone;
    /** Troca o ícone padrão do tom (ex.: MailCheck no lugar do ✓). */
    icon?: LucideIcon;
    title: ReactNode;
    children?: ReactNode;
    as?: "h1" | "h2";
    /** `start`: alinhado à esquerda (dentro de formulários). */
    align?: "center" | "start";
    id?: string;
    className?: string;
  }
>(function ResultHero(
  { tone, icon, title, children, as: Heading = "h1", align = "center", id, className },
  ref,
) {
  const Icon = icon ?? TONE_ICON[tone];
  const spin = tone === "progress";
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          TONE_CLASS[tone],
          "grid size-16 shrink-0 place-items-center rounded-full bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]",
        )}
      >
        <Icon className={cn("size-8", spin && "motion-safe:animate-spin")} />
      </span>
      <Heading
        ref={ref}
        id={id}
        tabIndex={-1}
        className="text-[1.4rem] font-bold leading-tight tracking-tight text-foreground outline-none min-[360px]:text-[1.6rem]"
      >
        {typeof title === "string" ? keepHyphenatedWords(title) : title}
      </Heading>
      {children ? (
        <div className="max-w-[24rem] text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
});
