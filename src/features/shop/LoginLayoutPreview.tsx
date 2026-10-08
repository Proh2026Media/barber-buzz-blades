import { LockKeyhole, Mail, Scissors } from "lucide-react";
import { GoogleMark } from "@/features/auth/entry";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_LOGIN_IMAGE, type BrandLoginLayout } from "@/lib/shop/branding";

export function LoginLayoutPreview({
  layout,
  imageUrl,
  logoUrl,
  logoBackgroundColor,
  shopName,
  compact = false,
}: {
  layout: BrandLoginLayout;
  imageUrl?: string | null;
  logoUrl?: string | null;
  logoBackgroundColor?: string | null;
  shopName: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`login-model-preview login-model-preview-${layout} ${compact ? "is-compact" : ""}`}
      aria-hidden="true"
    >
      <img src={imageUrl || DEFAULT_LOGIN_IMAGE} alt="" className="login-model-preview-photo" />
      <div className="login-model-preview-shade" />
      <div className="login-model-preview-brand">
        <span
          className="login-model-preview-logo"
          style={{ backgroundColor: logoBackgroundColor || "rgba(255,255,255,.92)" }}
        >
          {logoUrl ? <img src={logoUrl} alt="" /> : <Scissors className="size-3.5" />}
        </span>
        <span>{shopName}</span>
      </div>
      <div className="login-model-preview-form">
        {/* Os blocos do /auth atual, em miniatura: título, campos, Entrar e Google. */}
        {compact ? (
          // Na miniatura o título vira uma barra: o texto inteiro não cabe e empurrava o resto.
          <span className="block h-1 w-4/5 rounded-full bg-[#25251f]" />
        ) : (
          <span className="login-model-preview-title">{t("auth.title.signin")}</span>
        )}
        <span className="login-model-preview-field">
          <Mail /> <i />
        </span>
        <span className="login-model-preview-field">
          <LockKeyhole /> <i />
        </span>
        <span className="login-model-preview-button">{t("auth.tab.signin")}</span>
        <span className="login-model-preview-field justify-center">
          <GoogleMark className="h-auto" />
        </span>
      </div>
    </div>
  );
}
