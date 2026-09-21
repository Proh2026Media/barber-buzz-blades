import { LockKeyhole, Mail, Scissors } from "lucide-react";
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
        <span className="login-model-preview-title">Bem-vindo</span>
        <span className="login-model-preview-field">
          <Mail /> <i />
        </span>
        <span className="login-model-preview-field">
          <LockKeyhole /> <i />
        </span>
        <span className="login-model-preview-button">Entrar</span>
      </div>
    </div>
  );
}
