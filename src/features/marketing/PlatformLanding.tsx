import { Link } from "@tanstack/react-router";
import { ArrowRight, LogIn, Scissors } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";

/**
 * Landing do apex (beauty…): uma composição, marca em destaque, CTAs claros.
 */
export function PlatformLanding() {
  const { t } = useI18n();
  return (
    <main className="platform-landing mb-page min-h-dvh text-foreground">
      <div className="platform-landing-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      <div className="platform-landing-stage">
        <div className="platform-landing-main">
          <header className="platform-landing-top">
            <p className="platform-landing-brand">
              <span className="platform-landing-mark" aria-hidden="true">
                <Scissors className="size-5" />
              </span>
              <span className="platform-landing-brand-name">Barba &amp; Cabelo</span>
            </p>
            <LanguageSwitcher />
          </header>

          <section className="platform-landing-hero" aria-labelledby="platform-landing-title">
            <p className="platform-landing-eyebrow">{t("landing.eyebrow")}</p>
            <h1 id="platform-landing-title" className="platform-landing-title">
              Barba &amp; Cabelo
            </h1>
            <p className="platform-landing-lead">{t("landing.lead")}</p>
            <p className="platform-landing-support">{t("landing.support")}</p>

            <div className="platform-landing-actions">
              <Link to="/cadastrar" className="platform-landing-cta-primary">
                {t("landing.ctaOpen")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/auth"
                search={{ next: "/shop" }}
                className="platform-landing-cta-secondary"
              >
                <LogIn className="size-4" aria-hidden="true" />
                {t("landing.ctaSignin")}
              </Link>
            </div>

            <p className="platform-landing-hint">{t("landing.hint")}</p>
          </section>
        </div>

        <footer className="platform-landing-footer">
          <p className="platform-landing-footer-text">{t("landing.footer")}</p>
          <nav className="platform-landing-footer-nav" aria-label={t("landing.legalNav")}>
            <Link to="/privacidade">{t("landing.privacy")}</Link>
            <Link to="/termos">{t("landing.terms")}</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
