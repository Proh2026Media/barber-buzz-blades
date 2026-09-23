import type { CSSProperties } from "react";
import { ArrowRight, Eye, LockKeyhole, Mail, Scissors } from "lucide-react";
import {
  brandCornerClass,
  brandVariables,
  DEFAULT_LOGIN_IMAGE,
  type BrandCornerStyle,
  type BrandLoginLayout,
} from "@/lib/shop/branding";
import { BrandFontFace } from "./BrandFontFace";

export type LoginScreenPreviewProps = {
  layout: BrandLoginLayout;
  shopName: string;
  logoUrl?: string | null;
  logoBackgroundColor?: string | null;
  loginImageUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  customFontUrl?: string | null;
  headerFontWeight: number;
  headerFontStyle: string;
  cornerStyle: BrandCornerStyle;
  /** Encaixa a tela numa moldura do editor (sem 100dvh). */
  framed?: boolean;
  className?: string;
};

/**
 * Réplica visual da página /auth com a identidade em rascunho.
 * Só para prévia: campos e botões não enviam nada.
 */
export function LoginScreenPreview({
  layout,
  shopName,
  logoUrl,
  logoBackgroundColor,
  loginImageUrl,
  primaryColor,
  accentColor,
  fontFamily,
  customFontUrl,
  headerFontWeight,
  headerFontStyle,
  cornerStyle,
  framed = false,
  className = "",
}: LoginScreenPreviewProps) {
  const style = brandVariables(
    primaryColor,
    accentColor,
    fontFamily,
    customFontUrl,
    headerFontWeight,
    headerFontStyle,
    cornerStyle,
  ) as CSSProperties;

  const photo = loginImageUrl || DEFAULT_LOGIN_IMAGE;
  const showPhotoCopy = layout !== "card";
  const showPanelBrand = layout === "card";

  return (
    <div
      className={`login-screen-preview ${framed ? "login-screen-preview-framed" : "login-screen-preview-full"} ${className}`}
      aria-hidden="true"
    >
      <main
        className={`auth-workspace auth-layout-${layout} ${brandCornerClass(cornerStyle)}`}
        style={style}
      >
        <BrandFontFace url={customFontUrl} />
        <div className="auth-photo-layer">
          <img src={photo} alt="" />
          <span />
        </div>

        {showPhotoCopy && (
          <section className="auth-photo-copy">
            <div
              className="auth-photo-copy-logo"
              style={{ backgroundColor: logoBackgroundColor ?? "rgba(255,255,255,.92)" }}
            >
              {logoUrl ? <img src={logoUrl} alt="" /> : <Scissors className="size-7" />}
            </div>
            <p className="auth-brand-name">{shopName}</p>
            <h2>Seu cuidado começa aqui.</h2>
            <p>Agende, acompanhe seus horários e aproveite os benefícios da sua barbearia.</p>
          </section>
        )}

        <div className="auth-brand-panel mb-panel w-full max-w-md overflow-hidden border border-border/70 bg-card shadow-[0_24px_60px_color-mix(in_oklch,#1c1d19_14%,transparent)]">
          <div className="auth-brand-header px-6 pt-8 sm:px-8 sm:pt-10">
            {showPanelBrand && (
              <div className="auth-brand-identity flex items-center gap-3 pb-4">
                <div
                  className="auth-brand-logo flex size-11 shrink-0 items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor:
                      logoBackgroundColor ??
                      "color-mix(in oklch, var(--brand-primary) 8%, white)",
                  }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="size-full object-contain p-2" />
                  ) : (
                    <Scissors className="size-5 text-gold" />
                  )}
                </div>
                <p className="auth-brand-name min-w-0 truncate text-sm font-bold">{shopName}</p>
              </div>
            )}
            <p className="auth-eyebrow text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Bem-vindo de volta
            </p>
            <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
              Acesse sua conta
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Acesso do cliente, da barbearia ou da plataforma.
            </p>
            <div
              className="auth-mode-tabs auth-brand-control mt-5 grid grid-cols-2 gap-1 bg-muted/70 p-1"
              role="presentation"
            >
              <span className="auth-brand-button flex min-h-11 items-center justify-center bg-card text-sm font-semibold text-foreground shadow-sm">
                Entrar
              </span>
              <span className="auth-brand-button flex min-h-11 items-center justify-center text-sm font-semibold text-muted-foreground">
                Cadastrar
              </span>
            </div>
          </div>

          <div className="auth-form-body space-y-4 px-6 pb-8 pt-5 sm:px-8">
            <label className="block space-y-2 text-sm font-semibold text-foreground/85">
              <span>Email</span>
              <span className="auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70">
                <Mail className="ml-4 size-[18px] shrink-0 text-muted-foreground" />
                <span className="px-3 text-[15px] text-muted-foreground/70">voce@email.com</span>
              </span>
            </label>
            <div className="space-y-1">
              <label className="block space-y-2 text-sm font-semibold text-foreground/85">
                <span>Senha</span>
                <span className="auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70">
                  <LockKeyhole className="ml-4 size-[18px] shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 px-3 text-[15px] text-muted-foreground/70">
                    ••••••••
                  </span>
                  <span className="auth-brand-button mr-1.5 flex size-11 items-center justify-center text-muted-foreground">
                    <Eye className="size-[18px]" />
                  </span>
                </span>
              </label>
              <div className="auth-forgot-password">
                <span className="inline-flex min-h-9 items-center px-1 text-xs font-semibold text-primary">
                  Esqueci a senha
                </span>
              </div>
            </div>
            <span className="auth-primary-action auth-brand-button mt-1 flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-primary px-4 text-[15px] font-semibold text-primary-foreground">
              Entrar
              <ArrowRight className="size-4" />
            </span>
            <p className="auth-panel-footer text-center text-[11px] text-muted-foreground">
              Ambiente protegido · Prévia
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
