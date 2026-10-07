import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "@/components/visual";
import { useI18n } from "@/lib/i18n";

/**
 * Cabeçalho das telas filhas do Início (Meus pontos, Avisos): botão "← Início" à vista, ícone
 * e título. Diz onde a pessoa está e como voltar, sem frase de orientação.
 */
export function CustomerPageHeader({
  icon,
  title,
  titleId,
  aside,
  onBack,
}: {
  icon: LucideIcon;
  title: string;
  titleId?: string;
  aside?: ReactNode;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <header className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={t("nav.backHome")}
        className="-ms-1 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--button-radius)] px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.home")}
      </button>
      <div className="flex items-center gap-3">
        <IconTile icon={icon} />
        <h2 id={titleId} className="min-w-0 flex-1 text-xl font-bold tracking-tight">
          {title}
        </h2>
        {aside}
      </div>
    </header>
  );
}
