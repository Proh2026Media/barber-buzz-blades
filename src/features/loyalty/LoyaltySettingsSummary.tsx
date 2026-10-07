import {
  ChevronRight,
  Gift,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { IconTile, SectionHeader, StatusBadge } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";

const LINKS: { part: string; icon: LucideIcon; title: MessageKey; hint: MessageKey }[] = [
  {
    part: "resgates",
    icon: ShieldCheck,
    title: "loyalty.admin.part.redemptions",
    hint: "loyalty.summary.redemptionsHint",
  },
  {
    part: "regras",
    icon: Trophy,
    title: "loyalty.admin.part.rules",
    hint: "loyalty.summary.rulesHint",
  },
  {
    part: "recompensas",
    icon: Gift,
    title: "loyalty.admin.part.rewards",
    hint: "loyalty.summary.rewardsHint",
  },
  {
    part: "clientes",
    icon: Users,
    title: "loyalty.admin.part.customers",
    hint: "loyalty.summary.customersHint",
  },
];

/**
 * Ajustes → Clube de pontos: o estado do clube num selo e atalhos que abrem a página do clube
 * já na parte certa (resgates, regras, prêmios ou clientes).
 */
export function LoyaltySettingsSummary({ enabled }: { enabled?: boolean | null }) {
  const { t } = useI18n();
  return (
    <section className="app-action-card space-y-3 p-5" aria-labelledby="loyalty-summary-title">
      <SectionHeader
        icon={Gift}
        id="loyalty-summary-title"
        title={t("settingsHub.section.pontos")}
        description={t("loyalty.summary.text")}
        aside={
          typeof enabled === "boolean" ? (
            <StatusBadge
              tone={enabled ? "success" : "neutral"}
              label={t(enabled ? "settingsHub.summary.clubOn" : "settingsHub.summary.clubOff")}
              size="sm"
            />
          ) : undefined
        }
      />
      <ul className="divide-y divide-border/60">
        {LINKS.map((link) => (
          <li key={link.part}>
            <a
              href={`/shop/pontos?parte=${link.part}`}
              className="flex min-h-14 items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <IconTile icon={link.icon} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t(link.title)}</span>
                <span className="block text-xs text-muted-foreground">{t(link.hint)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <a href="/shop/pontos" className="action-button action-confirm w-full sm:w-auto sm:px-6">
        <Settings2 className="size-4" aria-hidden />
        {t("shop.settings.pontos.open")}
      </a>
    </section>
  );
}
