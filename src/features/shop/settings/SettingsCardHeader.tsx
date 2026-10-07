import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/visual";

type SettingsCardHeaderProps = {
  /** Ícone do lucide-react, mostrado no quadrado de 40 px ao lado do título. */
  icon: LucideIcon;
  title: ReactNode;
  /** id do h3, para aria-labelledby do cartão. */
  id?: string;
  /** Chamada pequena acima do título (opcional). */
  eyebrow?: ReactNode;
  intro?: ReactNode;
  /** id do parágrafo de apoio, para aria-describedby. */
  introId?: string;
  /** Selo de estado ou ação curta à direita do título. */
  aside?: ReactNode;
};

/**
 * Cabeçalho dos cartões de Ajustes no padrão único do sistema (`SectionHeader`): ícone em
 * quadrado de 40 px, título, uma linha de apoio e espaço à direita para um selo. Mantido para
 * os cartões que ainda o importam; cartões novos podem usar `SectionHeader` direto.
 */
export function SettingsCardHeader({
  icon,
  title,
  id,
  eyebrow,
  intro,
  introId,
  aside,
}: SettingsCardHeaderProps) {
  return (
    <div className="space-y-1">
      {eyebrow && <p className="text-xs font-semibold text-muted-foreground">{eyebrow}</p>}
      <SectionHeader
        icon={icon}
        title={title}
        id={id}
        description={intro}
        descriptionId={introId}
        aside={aside}
      />
    </div>
  );
}
