import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  Clock3,
  Gift,
  Hourglass,
  KeyRound,
  Languages,
  Link2,
  ListChecks,
  Monitor,
  Moon,
  Palette,
  QrCode,
  Smartphone,
  Sun,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  AttentionList,
  IconTile,
  STATE,
  SettingRow,
  StatusBadge,
  Tag,
  readableLink,
  type AttentionItem,
} from "@/components/visual";
import { parseLandingConfig } from "@/features/marketing/shop-landing";
import type { Tables } from "@/integrations/supabase/types";
import { LOCALE_NATIVE_NAMES, useI18n, type MessageKey } from "@/lib/i18n";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  normalizeBrandColor,
} from "@/lib/shop/branding";
import { SLOT_STEP_MINUTES, slotRuleFromSettings } from "@/lib/shop/appointments";
import { useThemePreference } from "@/lib/use-theme-preference";
import {
  ProgressRing,
  isShopSetupGuideHidden,
  showShopSetupGuide,
  useShopSetupProgress,
  type SetupTarget,
} from "../ShopSetupChecklist";
import { ColorDots, LogoChip, PageStatusBadge } from "./brand-bits";
import { DOMAIN_BADGE, type DomainStatus } from "./domain-status";
import type { SettingsSection } from "./section";
import type { SettingsSignals } from "./useSettingsSignals";
import { CONNECTION_META, connectionOf } from "./whatsapp-connection";

const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  aparencia: Palette,
  agendamento: CalendarClock,
  pontos: Gift,
  avisos: BellRing,
  enderecos: Link2,
  equipe: Users,
  idioma: Languages,
  conta: KeyRound,
};

/** Grupos do menu: o que é do mesmo assunto fica junto, sob um subtítulo curto. */
const GROUPS: { id: string; title: MessageKey; sections: SettingsSection[] }[] = [
  { id: "loja", title: "settingsHub.group.shop", sections: ["aparencia", "enderecos"] },
  {
    id: "funcionamento",
    title: "settingsHub.group.operation",
    sections: ["agendamento", "avisos", "pontos"],
  },
  { id: "pessoas", title: "settingsHub.group.people", sections: ["equipe"] },
  { id: "aparelho", title: "settingsHub.group.device", sections: ["idioma"] },
  { id: "conta", title: "settingsHub.group.account", sections: ["conta"] },
];

/** Telas que abrem outra página do painel em vez de uma subtela de Ajustes. */
const SECTION_LINKS: Partial<Record<SettingsSection, string>> = { pontos: "/shop/pontos" };

/** Dados que o painel já tem e que viram o resumo vivo de cada item do menu. */
export type SettingsOverview = {
  settings: Tables<"barbershop_settings"> | null;
  /** Link da página da barbearia (origem pública). */
  publicUrl: string;
  customDomain?: string | null;
  customDomainStatus?: DomainStatus | null;
  /** Mudanças esperando a decisão dos donos (selo e aviso em "Equipe e sociedade"). */
  pendingDecisions?: number;
  /** Descrição de "Equipe e sociedade" conforme o papel (parceiro, contratado). */
  teamHint?: string;
} & SettingsSignals;

/** Linha de atalho que leva a outra página do painel (mesmo desenho do `SettingRow`). */
function LinkRow({
  href,
  icon,
  title,
  description,
  summary,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  summary?: ReactNode;
}) {
  return (
    <div className="py-1">
      <a
        href={href}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <IconTile icon={icon} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {description && (
            <span className="block text-xs text-muted-foreground">{description}</span>
          )}
          {summary && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{summary}</span>}
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    </div>
  );
}

export function SettingsHub({
  sections,
  section,
  onSectionChange,
  renderSection,
  setupGuideShopId,
  onSetupGuideShown,
  setupGuide,
  overview,
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
  /**
   * Progresso do guia "Deixe sua barbearia pronta" em "Precisa da sua atenção" (anel "3/5" e o
   * próximo passo, com um botão que leva direto a ele). Só para quem vê o guia na Agenda.
   */
  setupGuide?: {
    shopId: string;
    services: Tables<"services">[];
    businessHours: Tables<"business_hours">[];
    onOpenStep: (target: SetupTarget) => void;
  };
  /** Dados para o resumo vivo de cada item e para "Precisa da sua atenção". */
  overview?: SettingsOverview;
}) {
  const { t, locale } = useI18n();
  const themePreference = useThemePreference();
  const current = section && sections.includes(section) ? section : null;
  const [guideHidden, setGuideHidden] = useState(false);
  const setupSettings = overview?.settings ?? null;
  const setup = useShopSetupProgress(
    setupGuide && setupSettings
      ? {
          shopId: setupGuide.shopId,
          services: setupGuide.services,
          businessHours: setupGuide.businessHours,
          settings: setupSettings,
        }
      : null,
  );

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
    // Uma linha: seta de voltar (44 px) + nome da tela. O título "Ajustes" já está logo acima.
    return (
      <div className="space-y-5">
        <div className="flex min-h-11 items-center gap-2">
          <button
            type="button"
            onClick={() => onSectionChange(null)}
            aria-label={t("shop.settings.back")}
            title={t("shop.settings.back")}
            className="-ms-1 grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:border-primary/40"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <h3 className="flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight">
            <Icon className="size-5 shrink-0 text-gold" aria-hidden />
            <span className="min-w-0">{t(`settingsHub.section.${current}` as const)}</span>
          </h3>
        </div>
        <div className="space-y-6">{renderSection(current)}</div>
      </div>
    );
  }

  const settings = overview?.settings ?? null;
  const domainStatus: DomainStatus = overview?.customDomain
    ? (overview.customDomainStatus ?? "none")
    : "none";

  // WhatsApp: o estado salvo no banco (a tela de Avisos confere ao vivo ao abrir).
  const whatsapp = overview?.whatsapp === undefined ? null : connectionOf(overview.whatsapp, true);
  const pending = overview?.pendingRedemptions ?? 0;
  const redemptionsLabel =
    pending > 0
      ? pending === 1
        ? t("settingsHub.summary.redemptionsOne")
        : t("settingsHub.summary.redemptionsMany", { n: pending })
      : null;

  const decisions = overview?.pendingDecisions ?? 0;

  /** Resumo vivo de cada item: o estado atual em pílulas e selos, sem precisar abrir. */
  function summaryFor(id: SettingsSection): ReactNode {
    if (id === "equipe" && decisions > 0) {
      return (
        <StatusBadge
          {...STATE.waiting}
          size="sm"
          label={t("eq.settings.teamPending", { count: decisions })}
        />
      );
    }
    if (id === "aparencia" && settings) {
      return (
        <>
          <LogoChip logoUrl={settings.logo_url} background={settings.logo_background_color} />
          <ColorDots
            primary={normalizeBrandColor(settings.primary_color, DEFAULT_PRIMARY_COLOR)}
            accent={normalizeBrandColor(settings.accent_color, DEFAULT_ACCENT_COLOR)}
          />
          <PageStatusBadge enabled={parseLandingConfig(settings.landing).enabled} />
        </>
      );
    }
    if (id === "enderecos" && overview) {
      const state = DOMAIN_BADGE[domainStatus];
      return (
        <>
          <StatusBadge tone={state.tone} icon={state.icon} label={t(state.label)} size="sm" />
          <span className="min-w-0 max-w-full truncate text-xs font-semibold text-muted-foreground">
            {readableLink(overview.publicUrl)}
          </span>
        </>
      );
    }
    // "Senha e acesso" não tem estado para resumir: fica a descrição de uma linha.
    if (id === "agendamento" && settings) {
      const rule = slotRuleFromSettings(settings);
      return (
        <>
          <Tag icon={Clock3}>
            {rule.mode === "literal"
              ? t("slots.mode.literal.title")
              : t("slots.notice.badge.interval", {
                  step: rule.mode === "custom" ? rule.stepMinutes : SLOT_STEP_MINUTES,
                })}
          </Tag>
          <StatusBadge
            tone={settings.waiting_enabled ? "success" : "neutral"}
            variant="dot"
            label={t(
              settings.waiting_enabled
                ? "settingsHub.summary.waitingOn"
                : "settingsHub.summary.waitingOff",
            )}
          />
        </>
      );
    }
    if (id === "pontos" && settings && typeof settings.loyalty_enabled === "boolean") {
      return (
        <>
          <StatusBadge
            tone={settings.loyalty_enabled ? "success" : "neutral"}
            variant="dot"
            label={t(
              settings.loyalty_enabled
                ? "settingsHub.summary.clubOn"
                : "settingsHub.summary.clubOff",
            )}
          />
          {redemptionsLabel && (
            <StatusBadge {...STATE.waiting} label={redemptionsLabel} size="sm" />
          )}
        </>
      );
    }
    if (id === "avisos" && whatsapp) {
      const meta = CONNECTION_META[whatsapp];
      return (
        <StatusBadge
          tone={meta.tone}
          icon={meta.icon}
          size="sm"
          label={t("settingsHub.summary.whatsapp", { state: t(meta.label) })}
        />
      );
    }
    if (id === "idioma") {
      const ThemeIcon =
        themePreference === "dark" ? Moon : themePreference === "light" ? Sun : Monitor;
      return (
        <>
          <Tag icon={Languages}>{LOCALE_NATIVE_NAMES[locale]}</Tag>
          <Tag icon={ThemeIcon}>{t(`theme.choice.${themePreference}` as const)}</Tag>
          <StatusBadge
            tone="neutral"
            icon={Smartphone}
            variant="dot"
            label={t("settingsHub.summary.thisDevice")}
          />
        </>
      );
    }
    return null;
  }

  // "Precisa da sua atenção": só o que pede uma ação, com um botão que leva direto ao ponto.
  const attention: AttentionItem[] = [];
  if (sections.includes("enderecos") && overview?.customDomain) {
    if (domainStatus === "pending_dns") {
      attention.push({
        id: "domain-pending",
        tone: "pending",
        icon: Hourglass,
        title: t("settingsHub.attention.domainPending", { domain: overview.customDomain }),
        description: t("settingsHub.attention.domainPendingHint"),
        action: {
          label: t("settingsHub.attention.seeSteps"),
          onClick: () => onSectionChange("enderecos"),
        },
      });
    } else if (domainStatus === "error") {
      attention.push({
        id: "domain-error",
        tone: "warning",
        icon: AlertTriangle,
        title: t("settingsHub.attention.domainError", { domain: overview.customDomain }),
        description: t("settingsHub.attention.domainErrorHint"),
        action: {
          label: t("settingsHub.attention.fix"),
          icon: Wrench,
          onClick: () => onSectionChange("enderecos"),
        },
      });
    }
  }

  if (sections.includes("avisos") && (whatsapp === "disconnected" || whatsapp === "attention")) {
    attention.push({
      id: "whatsapp-down",
      // Mesmo tom e ícone do selo da linha "Avisos e integrações".
      tone: CONNECTION_META[whatsapp].tone,
      icon: CONNECTION_META[whatsapp].icon,
      title: t("settingsHub.attention.whatsappDown"),
      description: t("settingsHub.attention.whatsappDownHint"),
      action: {
        label: t("settingsHub.attention.reconnect"),
        icon: Wrench,
        onClick: () => onSectionChange("avisos"),
      },
    });
  } else if (sections.includes("avisos") && whatsapp === "waitingQr") {
    // Começou a conectar e o QR não foi lido: as mensagens ainda não saem.
    attention.push({
      id: "whatsapp-waiting",
      tone: CONNECTION_META.waitingQr.tone,
      icon: CONNECTION_META.waitingQr.icon,
      // Mesmo nome do selo da linha "Avisos" (um estado, um rótulo).
      title: t("settingsHub.summary.whatsapp", { state: t(CONNECTION_META.waitingQr.label) }),
      description: t("settingsHub.attention.whatsappWaitingHint"),
      action: {
        label: t("settingsHub.attention.finishConnection"),
        icon: QrCode,
        onClick: () => onSectionChange("avisos"),
      },
    });
  }
  // Guia "Deixe sua barbearia pronta": o anel "3/5" e o próximo passo, com o botão que leva lá.
  if (setupGuide && setup?.next && !setup.hidden) {
    const next = setup.next;
    attention.push({
      id: "setup-guide",
      tone: "info",
      icon: ListChecks,
      title: t("cad.guia.title"),
      description: t("eq.guide.nextShort", { step: t(next.short) }),
      aside: (
        <ProgressRing
          size="sm"
          done={setup.done}
          total={setup.total}
          label={t("cad.guia.progress", { done: setup.done, total: setup.total })}
        />
      ),
      action: {
        label: t(next.action),
        icon: next.icon,
        onClick: () => {
          if (next.target) setupGuide.onOpenStep(next.target);
          // "Divulgar" compartilha pelo próprio guia, na Agenda.
          else onSetupGuideShown?.();
        },
      },
    });
  }
  if (sections.includes("equipe") && decisions > 0) {
    attention.push({
      id: "team-decisions",
      tone: "pending",
      icon: Hourglass,
      title:
        decisions === 1
          ? t("eq.attention.decisionsOne")
          : t("eq.attention.decisionsMany", { count: decisions }),
      description: t("eq.attention.decisionsHint"),
      action: {
        label: t("eq.attention.review"),
        onClick: () => onSectionChange("equipe"),
      },
    });
  }
  if (sections.includes("pontos") && redemptionsLabel) {
    attention.push({
      id: "redemptions",
      tone: "pending",
      icon: Gift,
      title: redemptionsLabel,
      description: t("settingsHub.attention.redemptionsHint"),
      action: {
        label: t("settingsHub.attention.seeRedemptions"),
        onClick: () => {
          window.location.href = "/shop/pontos?parte=resgates";
        },
      },
    });
  }

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.sections.filter((id) => sections.includes(id)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      <AttentionList items={attention} headingLevel="h3" />
      {/* minmax(0,1fr): um link longo (truncado) não alarga a coluna a 320 px. No computador,
          duas colunas independentes: cada grupo se empilha logo abaixo do anterior, sem o buraco
          que a grade deixava ao lado de um grupo curto. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:block md:columns-2 md:gap-4">
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`ajustes-grupo-${group.id}`}
            className="app-action-card min-w-0 break-inside-avoid px-2 py-2 md:mb-4"
          >
            <h3
              id={`ajustes-grupo-${group.id}`}
              className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {t(group.title)}
            </h3>
            <div className="divide-y divide-border/60">
              {group.items.map((id) => {
                const summary = summaryFor(id);
                const title = t(`settingsHub.section.${id}` as const);
                const description = summary
                  ? undefined
                  : id === "equipe" && overview?.teamHint
                    ? overview.teamHint
                    : t(`settingsHub.hint.${id}` as const);
                const href = SECTION_LINKS[id];
                if (href) {
                  return (
                    <LinkRow
                      key={id}
                      href={href}
                      icon={SECTION_ICONS[id]}
                      title={title}
                      description={description}
                      summary={summary}
                    />
                  );
                }
                const marked =
                  id === "enderecos" &&
                  (domainStatus === "pending_dns" || domainStatus === "error");
                return (
                  <SettingRow
                    key={id}
                    icon={SECTION_ICONS[id]}
                    title={title}
                    description={description}
                    summary={summary}
                    attention={
                      marked ? (
                        <span
                          aria-hidden
                          className={`size-2.5 shrink-0 rounded-full bg-[color:var(--tone-line)] ${
                            domainStatus === "error" ? "tone-warning" : "tone-pending"
                          }`}
                        />
                      ) : undefined
                    }
                    onClick={() => onSectionChange(id)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {guideHidden && (
        <div className="app-action-card px-2 py-1">
          <SettingRow
            icon={ListChecks}
            title={t("cad.guia.showAgain")}
            description={setup?.next ? undefined : t("cad.guia.showAgainHint")}
            summary={
              setup?.next ? (
                <>
                  <Tag icon={ListChecks}>
                    {t("cad.guia.progress", { done: setup.done, total: setup.total })}
                  </Tag>
                  <StatusBadge
                    tone="info"
                    icon={setup.next.icon}
                    size="sm"
                    label={t("eq.guide.nextShort", { step: t(setup.next.short) })}
                  />
                </>
              ) : undefined
            }
            onClick={showGuide}
          />
        </div>
      )}
    </div>
  );
}
