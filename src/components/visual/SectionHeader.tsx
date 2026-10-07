import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "./tones";

export type IconTileTone = "primary" | "selected" | "muted" | Tone;

const TILE_SIZE = {
  sm: { box: "size-9", icon: "size-4" },
  md: { box: "size-10", icon: "size-5" },
  lg: { box: "size-12", icon: "size-6" },
} as const;

/**
 * Ícone dentro de um quadrado — o mesmo bloco de "Como os horários aparecem". `primary` (padrão)
 * usa a cor da marca bem clara; `selected` é o preenchido de uma opção escolhida; os tons de
 * estado (success, warning…) usam as cores do sistema. Os cantos seguem o modo escolhido.
 */
export function IconTile({
  icon: Icon,
  tone = "primary",
  size = "md",
  className,
  children,
}: {
  icon?: LucideIcon;
  tone?: IconTileTone;
  size?: keyof typeof TILE_SIZE;
  className?: string;
  /** Conteúdo próprio (foto, número) no lugar do ícone. */
  children?: ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "selected"
        ? "bg-primary text-primary-foreground"
        : tone === "muted"
          ? "bg-muted text-foreground"
          : cn(TONE_CLASS[tone], "bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]");
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        TILE_SIZE[size].box,
        toneClass,
        className,
      )}
    >
      {Icon ? <Icon className={TILE_SIZE[size].icon} /> : children}
    </span>
  );
}

/**
 * Cabeçalho de seção ou cartão: ícone em quadrado + título + uma linha de apoio, com espaço à
 * direita para um selo de estado ou uma ação curta. Dá a mesma hierarquia a todas as abas.
 */
export function SectionHeader({
  icon,
  title,
  description,
  aside,
  id,
  descriptionId,
  as: Heading = "h3",
  tone,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  /** Uma linha curta: o que a pessoa resolve aqui. */
  description?: ReactNode;
  /** Selo de estado ou ação curta à direita. */
  aside?: ReactNode;
  /** id do título, para `aria-labelledby` da seção. */
  id?: string;
  /** id da linha de apoio, para `aria-describedby`. */
  descriptionId?: string;
  as?: "h2" | "h3" | "h4" | "p";
  tone?: IconTileTone;
  className?: string;
}) {
  return (
    // Em telas estreitas, o selo/ação da direita desce para a linha de baixo em vez de espremer o título.
    <div className={cn("flex flex-wrap items-start gap-x-3 gap-y-2", className)}>
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0 flex-1 basis-36">
        <Heading id={id} className="font-bold">
          {title}
        </Heading>
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0 self-center">{aside}</div>}
    </div>
  );
}
