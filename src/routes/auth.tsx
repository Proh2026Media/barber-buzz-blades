import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Scissors, ShieldCheck } from "lucide-react";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/auth/session";
import {
  brandCornerClass,
  brandVariables,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CORNER_STYLE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_HEADER_FONT_STYLE,
  DEFAULT_HEADER_FONT_WEIGHT,
  DEFAULT_LOGIN_IMAGE,
  DEFAULT_LOGIN_LAYOUT,
  DEFAULT_PRIMARY_COLOR,
  normalizeLoginLayout,
  type BrandLoginLayout,
} from "@/lib/shop/branding";
import { BrandFontFace } from "@/features/shop/BrandFontFace";

type AuthMode = "signin" | "signup" | "forgot" | "recovery";

type AuthBrand = {
  shopId: string | null;
  shopName: string;
  displayName: string;
  logoUrl: string | null;
  logoBackgroundColor: string | null;
  fontFamily: string;
  customFontUrl: string | null;
  headerFontWeight: number;
  headerFontStyle: string;
  cornerStyle: string;
  primaryColor: string;
  accentColor: string;
  loginLayout: BrandLoginLayout;
  loginImageUrl: string | null;
};

const DEFAULT_AUTH_BRAND: AuthBrand = {
  shopId: null,
  shopName: "Barba & Cabelo",
  displayName: "Barba & Cabelo",
  logoUrl: null,
  logoBackgroundColor: null,
  fontFamily: DEFAULT_FONT_FAMILY,
  customFontUrl: null,
  headerFontWeight: DEFAULT_HEADER_FONT_WEIGHT,
  headerFontStyle: DEFAULT_HEADER_FONT_STYLE,
  cornerStyle: DEFAULT_CORNER_STYLE,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
  loginLayout: DEFAULT_LOGIN_LAYOUT,
  loginImageUrl: null,
};

const DEMO_AUTH_BRAND: AuthBrand = {
  ...DEFAULT_AUTH_BRAND,
  shopName: "Arena Barber",
  displayName: "Arena Barber",
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next: string; recovery?: boolean; shop?: string; demo?: boolean } => {
    const recovery = s.recovery === "1" || s.recovery === true || s.recovery === "true";
    const demo = s.demo === "1" || s.demo === true || s.demo === "true";
    return {
      next: typeof s.next === "string" ? s.next : "",
      ...(recovery ? { recovery: true as const } : {}),
      ...(typeof s.shop === "string" && s.shop.trim() ? { shop: s.shop.trim() } : {}),
      ...(demo ? { demo: true as const } : {}),
    };
  },
  component: AuthPage,
});

function isSafeNext(value: string): value is string {
  return value.startsWith("/") && !value.startsWith("//");
}

function resolveShopContext(next: string, directShop?: string, directDemo?: boolean) {
  let shopRef = directShop?.trim() || null;
  let demo = directDemo === true;
  if (!isSafeNext(next)) return { shopRef, demo };

  try {
    const target = new URL(next, "https://barba-e-cabelo.local");
    shopRef ||= target.searchParams.get("shop")?.trim() || null;
    demo ||= target.pathname === "/demo";
  } catch {
    // Um destino malformado nunca deve impedir o acesso à tela de autenticação.
  }
  return { shopRef, demo };
}

function AuthPage() {
  const { next, recovery, shop, demo } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<AuthMode>(recovery ? "recovery" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const shopContext = resolveShopContext(next, shop, demo);
  const [brand, setBrand] = useState<AuthBrand>(
    shopContext.demo ? DEMO_AUTH_BRAND : DEFAULT_AUTH_BRAND,
  );
  const [brandLoading, setBrandLoading] = useState(Boolean(shopContext.shopRef));

  const preferredNext = isSafeNext(next) ? next : "";

  useEffect(() => {
    let cancelled = false;
    const fallback = shopContext.demo ? DEMO_AUTH_BRAND : DEFAULT_AUTH_BRAND;
    setBrand(fallback);

    if (!shopContext.shopRef) {
      setBrandLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBrandLoading(true);
    void (async () => {
      try {
        const modern = await supabase.rpc("get_public_shop_branding_v2", {
          p_shop_ref: shopContext.shopRef!,
        });
        let row = modern.data?.[0];
        let brandingError = modern.error;
        if (brandingError) {
          const legacy = await supabase.rpc("get_public_shop_branding", {
            p_shop_ref: shopContext.shopRef!,
          });
          row = legacy.data?.[0]
            ? { ...legacy.data[0], login_layout: null, login_image_url: null }
            : undefined;
          brandingError = legacy.error;
        }
        if (cancelled) return;
        if (!brandingError && row) {
          setBrand({
            shopId: row.shop_id,
            shopName: row.shop_name,
            displayName: row.display_name?.trim() || row.shop_name,
            logoUrl: row.logo_url,
            logoBackgroundColor: row.logo_background_color,
            fontFamily: row.font_family || DEFAULT_FONT_FAMILY,
            customFontUrl: row.custom_font_url,
            headerFontWeight: row.header_font_weight ?? DEFAULT_HEADER_FONT_WEIGHT,
            headerFontStyle: row.header_font_style || DEFAULT_HEADER_FONT_STYLE,
            cornerStyle: row.corner_style || DEFAULT_CORNER_STYLE,
            primaryColor: row.primary_color || DEFAULT_PRIMARY_COLOR,
            accentColor: row.accent_color || DEFAULT_ACCENT_COLOR,
            loginLayout: normalizeLoginLayout(row.login_layout),
            loginImageUrl: row.login_image_url,
          });
        }
      } catch {
        // Mantém a identidade segura de fallback se a loja não puder ser consultada.
      } finally {
        if (!cancelled) setBrandLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shopContext.demo, shopContext.shopRef]);

  useEffect(() => {
    if (recovery) setMode("recovery");
  }, [recovery]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError(null);
        setInfo("Defina uma nova senha para continuar.");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === "recovery" || mode === "forgot") return;
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const path = await resolvePostAuthPath(preferredNext);
      if (!cancelled) window.location.href = path;
    })();
    return () => {
      cancelled = true;
    };
  }, [preferredNext, mode]);

  async function goAfterAuth() {
    const path = await resolvePostAuthPath(preferredNext);
    window.location.href = path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/auth?recovery=1${
          preferredNext ? `&next=${encodeURIComponent(preferredNext)}` : ""
        }`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setInfo("Se existir uma conta com este email, enviamos o link para redefinir a senha.");
        return;
      }

      if (mode === "recovery") {
        if (password.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        if (password !== passwordConfirm) throw new Error("As senhas não coincidem.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setPasswordConfirm("");
        setInfo("Senha atualizada. Entrando…");
        await goAfterAuth();
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goAfterAuth();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            window.location.origin +
            "/auth" +
            (preferredNext ? `?next=${encodeURIComponent(preferredNext)}` : ""),
        },
      });
      if (error) throw error;
      setInfo("Confirme seu email e entre na conta.");
      setMode("signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const redirectTo =
        window.location.origin +
        "/auth" +
        (preferredNext ? `?next=${encodeURIComponent(preferredNext)}` : "");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no Google");
      setBusy(false);
    }
  }

  const eyebrow =
    mode === "signup"
      ? "Comece hoje"
      : mode === "forgot"
        ? "Recuperar acesso"
        : mode === "recovery"
          ? "Quase lá"
          : "Bem-vindo de volta";

  const title =
    mode === "signup"
      ? "Crie sua conta"
      : mode === "forgot"
        ? "Redefinir senha"
        : mode === "recovery"
          ? "Nova senha"
          : "Acesse sua conta";

  const subtitle =
    mode === "signup"
      ? "Leva menos de um minuto. Depois é só agendar e acompanhar seus horários."
      : mode === "forgot"
        ? "Informe o email da conta. Enviaremos um link seguro para você."
        : mode === "recovery"
          ? "Escolha uma senha nova para voltar a acessar o app."
          : "Acesso do cliente, da barbearia ou da plataforma.";

  const fieldClass =
    "auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10";
  const inputClass =
    "min-h-[3.25rem] min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60";
  const labelClass = "block space-y-2 text-sm font-semibold text-foreground/85";

  return (
    <main
      className={`auth-workspace auth-layout-${brand.loginLayout} mb-page min-h-dvh text-foreground ${brandCornerClass(brand.cornerStyle)}`}
      style={
        brandVariables(
          brand.primaryColor,
          brand.accentColor,
          brand.fontFamily,
          brand.customFontUrl,
          brand.headerFontWeight,
          brand.headerFontStyle,
          brand.cornerStyle,
        ) as CSSProperties
      }
      data-brand-shop={brand.shopId ?? undefined}
    >
      <BrandFontFace url={brand.customFontUrl} />
      <div className="auth-photo-layer" aria-hidden="true">
        <img src={brand.loginImageUrl || DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>
      <section className="auth-photo-copy" aria-label={`Boas-vindas de ${brand.displayName}`}>
        <div
          className="auth-photo-copy-logo"
          style={{
            backgroundColor: brand.logoBackgroundColor ?? "rgba(255,255,255,.92)",
          }}
        >
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="" />
          ) : (
            <Scissors className="size-7" aria-hidden="true" />
          )}
        </div>
        <p className="auth-brand-name">{brand.displayName}</p>
        <h2>Seu cuidado começa aqui.</h2>
        <p>Agende, acompanhe seus horários e aproveite os benefícios da sua barbearia.</p>
      </section>
      <div className="auth-brand-panel mb-panel w-full max-w-md overflow-hidden border border-border/70 bg-card shadow-[0_24px_60px_color-mix(in_oklch,#1c1d19_14%,transparent)]">
        <div className="auth-brand-header px-6 pt-8 sm:px-10 sm:pt-12">
          <div className="auth-brand-identity flex items-center gap-3">
            <div
              className="auth-brand-logo flex size-11 shrink-0 items-center justify-center overflow-hidden"
              style={{
                backgroundColor:
                  brand.logoBackgroundColor ??
                  "color-mix(in oklch, var(--brand-primary) 8%, white)",
              }}
            >
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`Logo de ${brand.displayName}`}
                  className="size-full object-contain p-2"
                />
              ) : (
                <Scissors className="size-5 text-gold" aria-hidden="true" />
              )}
            </div>
            <p
              className="auth-brand-name min-w-0 truncate text-sm font-bold"
              aria-live="polite"
              aria-busy={brandLoading}
            >
              {brand.displayName}
            </p>
          </div>

          <div className="auth-eyebrow mt-8 flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
            {shopContext.demo && (
              <span className="auth-brand-control border border-border/70 bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Demonstração
              </span>
            )}
          </div>
          <h1 className="auth-title mt-2 text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground sm:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-[26rem] text-[15px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <div className="auth-form-body space-y-7 px-6 pb-8 pt-8 sm:px-10 sm:pb-10">
          {(mode === "signin" || mode === "signup") && (
            <div
              className="auth-mode-tabs auth-brand-control grid grid-cols-2 gap-1 bg-muted/70 p-1"
              role="tablist"
              aria-label="Modo de acesso"
            >
              {(
                [
                  ["signin", "Entrar"],
                  ["signup", "Cadastrar"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => {
                    setMode(id);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`auth-brand-button min-h-11 px-3 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-300 ease-out ${
                    mode === id
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            {mode !== "recovery" && (
              <label className={labelClass}>
                <span>Email</span>
                <span className={fieldClass}>
                  <Mail
                    className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
            )}

            {(mode === "signin" || mode === "signup" || mode === "recovery") && (
              <label className={labelClass}>
                <span className="flex items-center justify-between gap-3">
                  <span>{mode === "recovery" ? "Nova senha" : "Senha"}</span>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setInfo(null);
                        setPassword("");
                      }}
                      className="-my-3 inline-flex min-h-11 items-center px-1 text-xs font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                    >
                      Esqueci a senha
                    </button>
                  )}
                </span>
                <span className={fieldClass}>
                  <LockKeyhole
                    className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="auth-brand-button mr-1.5 flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="size-[18px]" aria-hidden="true" />
                    ) : (
                      <Eye className="size-[18px]" aria-hidden="true" />
                    )}
                  </button>
                </span>
              </label>
            )}

            {mode === "recovery" && (
              <label className={labelClass}>
                <span>Confirmar nova senha</span>
                <span className={fieldClass}>
                  <LockKeyhole
                    className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={inputClass}
                  />
                </span>
              </label>
            )}

            {error && (
              <p
                className="auth-brand-control border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            {info && (
              <p
                className="auth-brand-control border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-foreground"
                role="status"
              >
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="auth-primary-action auth-brand-button mt-1 flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-primary px-4 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklch,var(--brand-primary)_22%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_28px_color-mix(in_oklch,var(--brand-primary)_28%,transparent)] active:translate-y-0 active:scale-[0.99] disabled:opacity-50"
            >
              <span>
                {busy
                  ? "Aguarde…"
                  : mode === "forgot"
                    ? "Enviar link"
                    : mode === "recovery"
                      ? "Salvar nova senha"
                      : mode === "signup"
                        ? "Criar conta"
                        : "Entrar"}
              </span>
              {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
          </form>

          {(mode === "forgot" || mode === "recovery") && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
                setPassword("");
                setPasswordConfirm("");
              }}
              className="auth-brand-button min-h-11 w-full text-center text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Voltar ao entrar
            </button>
          )}

          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="relative text-center text-xs font-medium text-muted-foreground">
                <span className="auth-divider-label relative z-10 px-3">ou continue com</span>
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
              </div>

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={busy}
                className="auth-brand-button auth-google-action flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/50 disabled:opacity-50"
              >
                <GoogleMark />
                Continuar com Google
              </button>
            </>
          )}

          <div className="auth-panel-footer space-y-2 text-center text-xs text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5 font-medium">
              <ShieldCheck className="size-3.5 text-gold" aria-hidden="true" />
              Ambiente protegido
            </p>
            <p>
              Ao continuar, você concorda com a{" "}
              <Link
                to="/politica"
                className="-my-3 inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-2 hover:underline"
              >
                política de privacidade
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.66Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.35v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.31A7.2 7.2 0 0 1 4.97 12c0-.8.14-1.58.38-2.31V6.6H1.35A12 12 0 0 0 0 12c0 1.94.46 3.77 1.35 5.4l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.35 6.6l4 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  );
}
