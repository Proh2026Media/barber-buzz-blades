import type { ReactNode } from "react";
import { StaffPhoto } from "@/components/ui/staff-photo";
import { cn } from "@/lib/utils";
import { personColor, personInitials } from "./helpers";

const SIZE = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-12 text-base",
  lg: "size-16 text-xl",
} as const;

/**
 * Foto da pessoa ou, sem foto, as iniciais numa cor fixa por pessoa (a mesma em toda tela).
 * O círculo é exceção funcional aos modos de canto, como em qualquer avatar. Sem `alt`, é
 * decorativo: deixe o nome escrito ao lado.
 */
export function PersonAvatar({
  name,
  src,
  size = "md",
  alt,
  badge,
  seed,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZE;
  /** Nome acessível quando o nome não aparece escrito ao lado. */
  alt?: string;
  /** Selo pequeno no canto (ícone de câmera, coroa…). */
  badge?: ReactNode;
  /** Chave da cor (padrão: o nome). Use o id da pessoa se o nome puder mudar. */
  seed?: string;
  className?: string;
}) {
  const color = personColor(seed ?? name);
  const box = SIZE[size];
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
    >
      <StaffPhoto
        src={src}
        alt=""
        className={cn("rounded-full", box)}
        fallback={
          <span
            className={cn("grid place-items-center rounded-full font-bold leading-none", box)}
            style={{ backgroundColor: color.bg, color: color.fg }}
          >
            {personInitials(name)}
          </span>
        }
      />
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-card bg-card text-foreground [&>svg]:size-3">
          {badge}
        </span>
      )}
    </span>
  );
}
