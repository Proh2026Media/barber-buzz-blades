import type { ComponentType, ReactNode } from "react";

type SettingsCardHeaderProps = {
  /** Ícone do lucide-react, desenhado em 16px ao lado do título. */
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: ReactNode;
  /** id do h3, para aria-labelledby do cartão. */
  id?: string;
  /** Chamada pequena acima do título (opcional). */
  eyebrow?: ReactNode;
  intro?: ReactNode;
  /** id do parágrafo de apoio, para aria-describedby. */
  introId?: string;
};

/**
 * Cabeçalho único dos cartões de Ajustes: chamada opcional em text-xs,
 * título em negrito de 16px com ícone e texto de apoio. Mantém a mesma
 * hierarquia de Fuso horário, Forma dos horários e Espera.
 */
export function SettingsCardHeader({
  icon: Icon,
  title,
  id,
  eyebrow,
  intro,
  introId,
}: SettingsCardHeaderProps) {
  return (
    <div>
      {eyebrow && <p className="text-xs text-muted-foreground">{eyebrow}</p>}
      <h3 id={id} className="flex items-center gap-2 font-bold">
        <Icon className="size-4 shrink-0" aria-hidden />
        {title}
      </h3>
      {intro && (
        <p id={introId} className="mt-1 text-sm text-muted-foreground">
          {intro}
        </p>
      )}
    </div>
  );
}
