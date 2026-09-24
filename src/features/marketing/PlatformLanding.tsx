import { Link } from "@tanstack/react-router";
import { ArrowRight, LogIn, Scissors } from "lucide-react";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";

/**
 * Landing do apex (beauty…): uma composição, marca em destaque, CTAs claros.
 */
export function PlatformLanding() {
  return (
    <main className="platform-landing mb-page min-h-dvh text-foreground">
      <div className="platform-landing-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      <div className="platform-landing-stage">
        <header className="platform-landing-top">
          <p className="platform-landing-brand">
            <span className="platform-landing-mark" aria-hidden="true">
              <Scissors className="size-5" />
            </span>
            <span className="platform-landing-brand-name">Barba &amp; Cabelo</span>
          </p>
        </header>

        <section className="platform-landing-hero" aria-labelledby="platform-landing-title">
          <p className="platform-landing-eyebrow">Para donos e parceiros</p>
          <h1 id="platform-landing-title" className="platform-landing-title">
            Barba &amp; Cabelo
          </h1>
          <p className="platform-landing-lead">
            Agenda, fidelidade e equipe — com a cara da sua barbearia.
          </p>
          <p className="platform-landing-support">
            Abra sua loja, compartilhe o link e cuide dos horários com quem trabalha no salão.
          </p>

          <div className="platform-landing-actions">
            <Link to="/cadastrar" className="platform-landing-cta-primary">
              Abrir minha barbearia
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/auth" search={{ next: "/shop" }} className="platform-landing-cta-secondary">
              <LogIn className="size-4" aria-hidden="true" />
              Já tenho conta
            </Link>
          </div>

          <p className="platform-landing-hint">
            No cadastro confirmamos seu WhatsApp com um código. Quem já usa o sistema entra pelo
            botão ao lado.
          </p>
        </section>
      </div>
    </main>
  );
}
