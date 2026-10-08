import type { CSSProperties } from "react";
import { ArrowRight, Eye, Lock, LockKeyhole, Mail, Scissors } from "lucide-react";
import { GoogleMark } from "@/features/auth/entry";
import {
  brandCornerClass,
  brandVariables,
  DEFAULT_LOGIN_IMAGE,
  type BrandCornerStyle,
  type BrandLoginLayout,
} from "@/lib/shop/branding";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
            <h2>{t("auth.hero.title")}</h2>
            <p>{t("auth.hero.text")}</p>
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
                      logoBackgroundColor ?? "color-mix(in oklab, var(--brand-primary) 8%, white)",
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
            {/* Igual ao /auth atual: só o título (sem sobretítulo nem subtítulo). */}
            <h3 className="auth-title text-[1.6rem] font-bold leading-[1.05] tracking-tight text-foreground">
              {t("auth.title.signin")}
            </h3>
          </div>

          <div className="auth-form-body space-y-4 px-6 pb-8 pt-5 sm:px-8">
            <div
              className="auth-mode-tabs auth-brand-control grid grid-cols-2 gap-1 bg-muted/70 p-1"
              role="presentation"
            >
              <span className="auth-brand-button flex min-h-11 items-center justify-center bg-card text-sm font-semibold text-foreground shadow-sm">
                {t("auth.tab.signin")}
              </span>
              <span className="auth-brand-button flex min-h-11 items-center justify-center text-sm font-semibold text-muted-foreground">
                {t("auth.tab.signup")}
              </span>
            </div>
            <label className="block space-y-2 text-sm font-semibold text-foreground/85">
              <span>{t("auth.field.email")}</span>
              <span className="auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70">
                <Mail className="ml-4 size-[18px] shrink-0 text-muted-foreground" />
                <span className="px-3 text-[15px] text-muted-foreground/70">
                  {t("auth.field.emailPlaceholder")}
                </span>
              </span>
            </label>
            <div className="block space-y-2 text-sm font-semibold text-foreground/85">
              {/* "Esqueci a senha" na linha do rótulo, como no /auth. */}
              <span className="flex items-end justify-between gap-2">
                <span>{t("auth.field.password")}</span>
                <span className="text-xs font-semibold text-primary">{t("auth.forgot")}</span>
              </span>
              <span className="auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70">
                <LockKeyhole className="ml-4 size-[18px] shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 px-3 text-[15px] text-muted-foreground/70">
                  {t("entry.signin.passwordPlaceholder")}
                </span>
                <span className="auth-brand-button mr-1.5 flex size-11 items-center justify-center text-muted-foreground">
                  <Eye className="size-[18px]" />
                </span>
              </span>
            </div>
            <span className="auth-primary-action auth-brand-button mt-1 flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-primary px-4 text-[15px] font-semibold text-primary-foreground">
              {t("auth.submit.signin")}
              <ArrowRight className="size-4" />
            </span>
            <span className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>{t("auth.orContinue")}</span>
              <span className="h-px flex-1 bg-border" />
            </span>
            <span className="auth-brand-button auth-google-action flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold text-foreground">
              <GoogleMark />
              {t("auth.google")}
            </span>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-gold" />
              <span className="min-w-0">
                {t("auth.terms.before")}{" "}
                <strong className="font-semibold text-foreground">{t("auth.terms.link")}</strong>{" "}
                {t("auth.terms.and")}{" "}
                <strong className="font-semibold text-foreground">{t("auth.privacy.link")}</strong>{" "}
                {t("cad.cliente.terms.age")}
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
