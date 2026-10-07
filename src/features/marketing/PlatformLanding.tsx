import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock3,
  Crown,
  LogIn,
  Scissors,
  Share2,
  Store,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconTile, PersonAvatar, Tag, TimeChips } from "@/components/visual";
import { HowSteps } from "@/features/marketing/HowSteps";
import { TierBadge } from "@/features/loyalty/TierBadge";
import { DEFAULT_TIERS, tierStyleKey } from "@/features/loyalty/program";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";

const heroButton = "app-icon-button hero-icon-button";

/** Cartão de escolha grande: quem é a pessoa e o próximo passo dela. */
function ChoiceCard({
  icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <li className="public-card flex flex-col gap-3 rounded-2xl border border-border p-4 shadow-[0_18px_44px_rgb(0_0_0/0.28)]">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} size="lg" tone="muted" />
        <div className="min-w-0 space-y-0.5 pt-0.5">
          <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

/** Cartão de recurso com mini-ilustração feita com os próprios componentes (marcada "Exemplo"). */
function FeatureCard({
  icon,
  title,
  example,
  children,
}: {
  icon: LucideIcon;
  title: string;
  example: string;
  children: ReactNode;
}) {
  return (
    <li className="public-card space-y-3 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <IconTile icon={icon} size="sm" tone="muted" />
        <span className="min-w-0 flex-1">{title}</span>
        <Tag>{example}</Tag>
      </p>
      {children}
    </li>
  );
}

/**
 * Início do site (beauty…): diz em segundos onde a pessoa está e o que fazer — dono cadastra a
 * barbearia, cliente entra para agendar — e mostra o produto com exemplos, não com parágrafos.
 */
export function PlatformLanding() {
  const { t, intlLocale } = useI18n();
  const samplePrice = (65).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
  const tierCount = Math.min(DEFAULT_TIERS.length, 4);

  return (
    <main className="platform-landing public-page mb-page min-h-dvh text-foreground">
      <div className="platform-landing-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      {/* No app instalado (iPhone) o topo e a base ficam sob a barra de status e o gesto de início. */}
      <div
        className="platform-landing-stage platform-landing-wide"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <header className="platform-landing-top">
          <span className="platform-landing-mark" aria-hidden="true">
            <Scissors className="size-5" />
          </span>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              // Sem destino fixo: depois de entrar, cada pessoa vai para a própria área (dono → painel, cliente → app).
              search={{ next: "" }}
              className="hero-quick-action inline-flex min-h-11 items-center gap-1.5 rounded-[var(--button-radius)] px-3 text-sm font-bold"
            >
              <LogIn className="size-4" aria-hidden="true" />
              {t("landing.signin")}
            </Link>
            <LanguageSwitcher showCode buttonClassName={heroButton} />
            <ThemeToggle buttonClassName={heroButton} />
          </div>
        </header>

        <div className="platform-landing-grid">
          <div className="space-y-6">
            <section aria-labelledby="platform-landing-title">
              <h1 id="platform-landing-title" className="platform-landing-title">
                Barba &amp; Cabelo
              </h1>
              <p className="platform-landing-lead">{t("landing.lead")}</p>
            </section>

            <ul aria-label={t("landing.chooseAria")} className="platform-landing-actions-grid">
              <ChoiceCard
                icon={Store}
                title={t("landing.ownerTitle")}
                text={t("landing.ownerText")}
              >
                <Link to="/cadastrar" className="action-button action-confirm min-h-12 w-full">
                  <UserPlus aria-hidden="true" />
                  {t("landing.ownerCta")}
                </Link>
              </ChoiceCard>
              <ChoiceCard
                icon={CalendarClock}
                title={t("landing.clientTitle")}
                text={t("landing.clientText")}
              >
                <Link
                  to="/auth"
                  search={{ next: "" }}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] border border-border bg-background px-4 text-sm font-bold transition-colors hover:border-foreground/40"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  {t("landing.clientCta")}
                </Link>
              </ChoiceCard>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#f4f1ea]/80">
              {t("landing.featuresTitle")}
            </h2>
            {/* items-start: cada cartão na própria altura, sem miolo vazio ao lado de "Como começar". */}
            <ul className="grid items-start gap-3 sm:grid-cols-2">
              <FeatureCard
                icon={CalendarDays}
                title={t("landing.featAgenda")}
                example={t("landing.example")}
              >
                <TimeChips
                  times={["09:00", "09:30", "10:00", "10:30"]}
                  label={t("landing.featAgenda")}
                  more
                />
              </FeatureCard>
              <FeatureCard
                icon={Crown}
                title={t("landing.featClub")}
                example={t("landing.example")}
              >
                <ul className="flex flex-wrap gap-1.5" aria-label={t("landing.featClub")}>
                  {DEFAULT_TIERS.slice(0, tierCount).map((tier, index) => (
                    <li key={tier.name}>
                      <TierBadge tier={tierStyleKey(index, tierCount)} name={tier.name} size="sm" />
                    </li>
                  ))}
                </ul>
              </FeatureCard>
              <FeatureCard
                icon={Users}
                title={t("landing.featTeam")}
                example={t("landing.example")}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex -space-x-2" aria-hidden="true">
                    {["Carlos", "Rafael", "Bruna"].map((name) => (
                      <PersonAvatar
                        key={name}
                        name={name}
                        size="sm"
                        className="ring-2 ring-[var(--card)]"
                      />
                    ))}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold">
                      {t("landing.sampleService")}
                    </span>
                    <Tag icon={Clock3}>
                      {samplePrice} · {t("shopLanding.minutes", { n: 45 })}
                    </Tag>
                  </span>
                </div>
              </FeatureCard>
              <li className="public-card rounded-2xl border border-border p-4">
                <p className="mb-3 text-sm font-bold">{t("landing.stepsTitle")}</p>
                <HowSteps
                  orientation="vertical"
                  label={t("landing.stepsTitle")}
                  steps={[
                    { label: t("landing.step1"), description: t("landing.step1Note"), icon: Store },
                    { label: t("landing.step2"), icon: ClipboardList },
                    { label: t("landing.step3"), icon: Share2 },
                  ]}
                />
              </li>
            </ul>
          </div>
        </div>

        <footer className="platform-landing-footer">
          <nav className="platform-landing-footer-nav" aria-label={t("landing.legalNav")}>
            <Link to="/privacidade">{t("landing.privacy")}</Link>
            <Link to="/termos">{t("landing.terms")}</Link>
            <Link to="/acordo-de-dados">{t("legal.dpaLink")}</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
