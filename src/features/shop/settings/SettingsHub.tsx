import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  ChevronRight,
  Gift,
  Globe2,
  Languages,
  ListChecks,
  Palette,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isShopSetupGuideHidden, showShopSetupGuide } from "../ShopSetupChecklist";
import type { SettingsSection } from "./section";

const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  aparencia: Palette,
  agendamento: CalendarClock,
  pontos: Gift,
  avisos: BellRing,
  enderecos: Globe2,
  equipe: Users,
  idioma: Languages,
};

export function SettingsHub({
  sections,
  section,
  onSectionChange,
  renderSection,
  setupGuideShopId,
  onSetupGuideShown,
}: {
  sections: SettingsSection[];
  section: SettingsSection | null;
  onSectionChange: (next: SettingsSection | null) => void;
  renderSection: (section: SettingsSection) => ReactNode;
  /**
   * Loja do guia "Deixe sua barbearia pronta" (só para dono/sócio). Quando o guia foi
   * escondido nesta loja, o menu mostra "Mostrar guia de configuração".
   */
  setupGuideShopId?: string;
  /** Chamado depois de reexibir o guia, para levar a pessoa à Agenda. */
  onSetupGuideShown?: () => void;
}) {
  const { t } = useI18n();
  const current = section && sections.includes(section) ? section : null;
  const [guideHidden, setGuideHidden] = useState(false);

  // Lê depois de montar (o estado fica no aparelho) para não divergir do HTML do servidor.
  useEffect(() => {
    setGuideHidden(setupGuideShopId ? isShopSetupGuideHidden(setupGuideShopId) : false);
  }, [setupGuideShopId, current]);

  function showGuide() {
    if (!setupGuideShopId) return;
    showShopSetupGuide(setupGuideShopId);
    setGuideHidden(false);
    onSetupGuideShown?.();
  }

  if (current) {
    const Icon = SECTION_ICONS[current];
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => onSectionChange(null)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("shop.settings.back")}
        </button>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight">
              {t(`shop.settings.group.${current}.title` as const)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(`shop.settings.group.${current}.hint` as const)}
            </p>
          </div>
        </div>
        <div className="space-y-6">{renderSection(current)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("shop.settings.hubHint")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((id) => {
          const Icon = SECTION_ICONS[id];
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSectionChange(id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {t(`shop.settings.group.${id}.title` as const)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`shop.settings.group.${id}.hint` as const)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {guideHidden && (
        <button
          type="button"
          onClick={showGuide}
          className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ListChecks className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("cad.guia.showAgain")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("cad.guia.showAgainHint")}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}
