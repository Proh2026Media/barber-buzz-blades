import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageCircle,
  Scissors,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/auth/session";
import { friendlyAuthError, ServerError, serverError } from "@/lib/auth/friendly-error";
import {
  AUTH_POPUP_MESSAGE,
  buildPlatformAuthUrl,
  clearAuthBridge,
  consumeBridgedHashTokens,
  currentOrigin,
  finishPopupOAuthAndNotifyOpener,
  handoffSessionSameOrigin,
  isAllowedReturnOrigin,
  isAuthPopupMessage,
  isSafeReturnOriginShape,
  markPopupOAuthStarted,
  needsAuthOriginBridge,
  peekAuthBridge,
  platformAuthOrigin,
  platformOAuthCallbackUrl,
  resolveAuthBridge,
  stashAuthBridge,
} from "@/lib/auth/return-origin";
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
import { useShopFavicon } from "@/lib/shop/favicon";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { t as tNow, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Switch } from "@/components/ui/switch";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";
import { callOptionalRpc } from "@/lib/auth/optional-rpc";
import { checkSignupPhone, nextMaskedPhone } from "@/lib/auth/signup-phone";

/** verifyPhone: logo após o cadastro com WhatsApp, confirma o número por código. */
type AuthMode = "signin" | "signup" | "forgot" | "recovery" | "verifyPhone";
type RecoveryChannel = "email" | "whatsapp";

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
  ): {
    next: string;
    recovery?: boolean;
    shop?: string;
    demo?: boolean;
    return_origin?: string;
    oauth?: "google";
    bridged?: boolean;
    popup?: boolean;
    from_email?: boolean;
  } => {
    const recovery = s.recovery === "1" || s.recovery === true || s.recovery === "true";
    const demo = s.demo === "1" || s.demo === true || s.demo === "true";
    const bridged = s.bridged === "1" || s.bridged === true || s.bridged === "true";
    const popup = s.popup === "1" || s.popup === true || s.popup === "true";
    const fromEmail = s.from_email === "1" || s.from_email === true || s.from_email === "true";
    const returnOrigin =
      typeof s.return_origin === "string" && isSafeReturnOriginShape(s.return_origin.trim())
        ? s.return_origin.trim()
        : undefined;
    const oauth = s.oauth === "google" ? ("google" as const) : undefined;
    return {
      next: typeof s.next === "string" ? s.next : "",
      ...(recovery ? { recovery: true as const } : {}),
      ...(typeof s.shop === "string" && s.shop.trim() ? { shop: s.shop.trim() } : {}),
      ...(demo ? { demo: true as const } : {}),
      ...(returnOrigin ? { return_origin: returnOrigin } : {}),
      ...(oauth ? { oauth } : {}),
      ...(bridged ? { bridged: true as const } : {}),
      ...(popup ? { popup: true as const } : {}),
      ...(fromEmail ? { from_email: true as const } : {}),
    };
  },
  component: AuthPage,
});

type VerifyPhonePayload = {
  ok?: boolean;
  error?: string;
  error_code?: string;
  attempts_left?: number;
  already_verified?: boolean;
  resend_after_seconds?: number;
  whatsapp_opt_in_at?: string | null;
};

/** Nome no cadastro: "Como você quer ser chamado?". */
const NAME_MIN = 2;
const NAME_MAX = 80;

/** Conta Google criada há pouco (sem aceite registrado) grava o aceite mostrado junto ao botão. */
const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

/** WhatsApp do cadastro que ficou só nos metadados (confirmação do e-mail): vale por 7 dias. */
const SIGNUP_WHATSAPP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SignupFieldErrors = { name?: string; whatsapp?: string };

/** Espera sugerida antes de reenviar o código, se o servidor não informar. */
const PHONE_RESEND_SECONDS = 60;

/** +5511999990000 ou 11999990000 → (11) 99999-0000 para leitura no celular. */
function formatBrPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

/**
 * auth-otp com purpose 'verify_phone', usando a sessão aberta pelo cadastro.
 * Resposta de erro vira ServerError (guarda error_code e attempts_left).
 */
async function callVerifyPhone(body: Record<string, unknown>): Promise<VerifyPhonePayload> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ServerError(tNow("errors.sessionExpired"), "unauthorized");
  }
  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/auth-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ purpose: "verify_phone", channel: "whatsapp", ...body }),
  });
  let payload: VerifyPhonePayload = {};
  try {
    payload = (await response.json()) as VerifyPhonePayload;
  } catch {
    payload = {};
  }
  if (!response.ok) {
    if (!payload.error_code) {
      payload.error_code = response.status === 429 ? "rate_limited" : "internal_error";
    }
    throw serverError(payload, tNow("fix3.auth.phoneError"));
  }
  return payload;
}

/** Frase do erro da confirmação do WhatsApp, pelo error_code. */
function phoneErrorText(err: unknown) {
  if (err instanceof ServerError) {
    switch (err.errorCode) {
      case "otp_invalid": {
        const left = err.payload.attempts_left;
        return typeof left === "number" && left > 0
          ? tNow("fix2.whats.errInvalidLeft", { count: left })
          : tNow("fix2.whats.errInvalid");
      }
      case "otp_expired":
        return tNow("fix2.whats.errExpired");
      case "otp_too_many_attempts":
        return tNow("fix2.whats.errTooManyAttempts");
      case "rate_limited":
        return tNow("fix2.whats.errRateLimited");
      case "whatsapp_unavailable":
        return tNow("fix2.whats.errUnavailable");
      case "phone_in_use":
        return tNow("fix2.whats.errPhoneInUse");
      case "invalid_whatsapp":
        return tNow("fix2.whats.errInvalidNumber");
    }
  }
  return friendlyAuthError(err, tNow("fix3.auth.phoneError"));
}

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
  const {
    next,
    recovery,
    shop,
    demo,
    return_origin: returnOrigin,
    oauth,
    bridged,
    popup,
    from_email: fromEmail,
  } = useSearch({
    from: "/auth",
  });
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<AuthMode>(recovery ? "recovery" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recoveryChannel, setRecoveryChannel] = useState<RecoveryChannel>("email");
  const [whatsapp, setWhatsapp] = useState("");
  // Cadastro do cliente: nome, aceite de avisos por WhatsApp e erros ao lado de cada campo.
  const [fullName, setFullName] = useState("");
  const [phoneOptIn, setPhoneOptIn] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const signupPhoneRef = useRef<HTMLInputElement>(null);
  // Conferências do primeiro acesso (aceite e WhatsApp guardado no cadastro): uma vez por tela.
  const firstAccessCheckedRef = useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  // Confirmação do WhatsApp logo após o cadastro.
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneUnavailable, setPhoneUnavailable] = useState(false);
  const [phoneResendIn, setPhoneResendIn] = useState(0);
  const shopContext = resolveShopContext(next, shop, demo);
  const [hostShopSlug, setHostShopSlug] = useState<string | null>(null);
  const effectiveShopRef = shopContext.shopRef || hostShopSlug;
  const [brand, setBrand] = useState<AuthBrand>(
    shopContext.demo ? DEMO_AUTH_BRAND : DEFAULT_AUTH_BRAND,
  );
  const [brandLoading, setBrandLoading] = useState(
    Boolean(shopContext.shopRef) || typeof window !== "undefined",
  );
  const [bridgeReady, setBridgeReady] = useState(!bridged);
  // Aba da loja aplicando a sessão vinda do pop-up: o vigia do pop-up não deve soltar a tela.
  const sessionApplyingRef = useRef(false);
  const popupWatchRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (popupWatchRef.current !== null) window.clearInterval(popupWatchRef.current);
    },
    [],
  );

  useShopFavicon(brand.logoUrl);

  useEffect(() => {
    if (phoneResendIn <= 0) return;
    const timer = window.setTimeout(() => setPhoneResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phoneResendIn]);

  const preferredNext = isSafeNext(next) ? next : "";

  // No apex (pop-up): grava destino da loja antes do Google.
  useEffect(() => {
    if (bridged) return;
    if (needsAuthOriginBridge()) return;
    const bridge = resolveAuthBridge({
      returnOrigin,
      shop: shop || effectiveShopRef,
      next: preferredNext || "/app",
      popup: Boolean(popup),
    });
    if (!bridge) return;
    let cancelled = false;
    // Só a plataforma e domínios de lojas cadastradas podem receber a sessão.
    void isAllowedReturnOrigin(bridge.returnOrigin).then((allowed) => {
      if (cancelled) return;
      if (allowed) stashAuthBridge({ ...bridge, popup: Boolean(popup) || bridge.popup });
      else clearAuthBridge();
    });
    return () => {
      cancelled = true;
    };
  }, [returnOrigin, shop, effectiveShopRef, preferredNext, bridged, popup]);

  // Apex: link de e-mail (confirmação ou nova senha) pedido no domínio da loja.
  // O código só pode ser trocado lá (PKCE), então repassa ao domínio de origem.
  useEffect(() => {
    if (popup || bridged || !returnOrigin) return;
    if (needsAuthOriginBridge()) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    let cancelled = false;
    void (async () => {
      if (!(await isAllowedReturnOrigin(returnOrigin)) || cancelled) return;
      clearAuthBridge();
      const target = new URL(`${returnOrigin}/auth`);
      target.searchParams.set("code", code);
      target.searchParams.set("from_email", "1");
      const shopRef = shop || shopContext.shopRef;
      if (shopRef) target.searchParams.set("shop", shopRef);
      if (preferredNext) target.searchParams.set("next", preferredNext);
      if (recovery) target.searchParams.set("recovery", "1");
      window.location.replace(target.toString());
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Domínio da loja, de volta do link de cadastro: entra direto se a confirmação abriu a sessão.
  useEffect(() => {
    if (!fromEmail || recovery || popup) return;
    if (!needsAuthOriginBridge()) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        await goAfterAuthLocal();
        return;
      }
      setInfo(tNow("fix.auth-rotas.emailConfirmedSignIn"));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromEmail]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (shopContext.shopRef || shopContext.demo) return;
      const { resolveShopFromCurrentHost, maybeRedirectToCanonical } =
        await import("@/lib/shop/host");
      const resolved = await resolveShopFromCurrentHost();
      if (cancelled) return;
      if (maybeRedirectToCanonical(resolved)) return;
      if (resolved?.shop_slug) setHostShopSlug(resolved.shop_slug);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopContext.demo, shopContext.shopRef]);

  useEffect(() => {
    let cancelled = false;
    const fallback = shopContext.demo ? DEMO_AUTH_BRAND : DEFAULT_AUTH_BRAND;
    setBrand(fallback);

    if (!effectiveShopRef) {
      setBrandLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBrandLoading(true);
    void (async () => {
      try {
        const modern = await supabase.rpc("get_public_shop_branding_v2", {
          p_shop_ref: effectiveShopRef,
        });
        let row = modern.data?.[0];
        let brandingError = modern.error;
        if (brandingError) {
          const legacy = await supabase.rpc("get_public_shop_branding", {
            p_shop_ref: effectiveShopRef,
          });
          row = legacy.data?.[0]
            ? { ...legacy.data[0], login_layout: null, login_image_url: null }
            : undefined;
          brandingError = legacy.error;
        }
        if (cancelled) return;
        if (brandingError || !row) {
          setBrand(fallback);
          return;
        }
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
      } catch {
        if (!cancelled) setBrand(fallback);
      } finally {
        if (!cancelled) setBrandLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopContext.demo, effectiveShopRef]);

  useEffect(() => {
    if (recovery) setMode("recovery");
  }, [recovery]);

  // Domínio da loja: recebe tokens do pop-up (postMessage / BroadcastChannel / storage).
  useEffect(() => {
    if (popup || !needsAuthOriginBridge()) return;

    async function applySession(data: { access_token: string; refresh_token: string }) {
      sessionApplyingRef.current = true;
      setBusy(true);
      setInfo(tNow("auth.info.signingIn"));
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) {
        sessionApplyingRef.current = false;
        setError(friendlyAuthError(sessionError, tNow("auth.error.signinFailed")));
        setBusy(false);
        return;
      }
      await goAfterAuthLocal();
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== platformAuthOrigin() && event.origin !== window.location.origin) return;
      if (!isAuthPopupMessage(event.data)) return;
      void applySession(event.data);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== "mb_auth_handoff_v1" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as unknown;
        if (isAuthPopupMessage(parsed)) void applySession(parsed);
      } catch {
        /* ignore */
      }
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(AUTH_POPUP_MESSAGE);
      channel.onmessage = (event) => {
        if (isAuthPopupMessage(event.data)) void applySession(event.data);
      };
    } catch {
      channel = null;
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, preferredNext, effectiveShopRef]);

  // Fallback: pop-up chegou ao domínio da loja com tokens na hash (Google zerou opener).
  useEffect(() => {
    if (!bridged) {
      setBridgeReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const tokens = consumeBridgedHashTokens();
        if (!tokens) {
          if (!cancelled) setBridgeReady(true);
          return;
        }
        setBusy(true);
        setInfo(tNow("auth.info.signingIn"));
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (sessionError) throw sessionError;
        // Avisa a aba principal (mesmo domínio) e fecha o pop-up se houver opener.
        handoffSessionSameOrigin(tokens);
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(tokens, window.location.origin);
          } catch {
            /* ignore */
          }
          window.setTimeout(() => window.close(), 200);
          return;
        }
        if (!cancelled) await goAfterAuthLocal();
      } catch (err) {
        if (!cancelled) {
          setError(friendlyAuthError(err, tNow("auth.error.loginNotCompleted")));
          setBusy(false);
          setBridgeReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridged]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setError(null);
        setInfo(tNow("auth.info.setNewPassword"));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Link de e-mail já usado ou vencido: o Auth devolve o erro no endereço.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const errorCode = url.searchParams.get("error_code") || hash.get("error_code");
    const errorName = url.searchParams.get("error") || hash.get("error");
    if (errorCode !== "otp_expired" && !(recovery && errorName)) return;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      for (const key of ["error", "error_code", "error_description"]) url.searchParams.delete(key);
      url.hash = "";
      if (data.session && recovery) {
        window.history.replaceState(window.history.state, "", url.toString());
        setMode("recovery");
        setError(null);
        setInfo(tNow("auth.info.setNewPassword"));
        return;
      }
      url.searchParams.delete("recovery");
      window.history.replaceState(window.history.state, "", url.toString());
      setMode("forgot");
      setInfo(null);
      setError(tNow("auth.error.linkExpired"));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bridged) setBridgeReady(true);
  }, [bridged]);

  // Pop-up no apex: inicia Google.
  useEffect(() => {
    if (oauth !== "google") return;
    if (needsAuthOriginBridge()) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setInfo(tNow("auth.info.openingGoogle"));
      try {
        const bridge = resolveAuthBridge({
          returnOrigin,
          shop: effectiveShopRef,
          next: preferredNext || "/app",
          popup: Boolean(popup),
        });
        if (bridge) {
          // Domínio fora da plataforma e das lojas cadastradas: não abre o Google.
          if (!(await isAllowedReturnOrigin(bridge.returnOrigin))) {
            clearAuthBridge();
            if (!cancelled) {
              setError(tNow("auth.error.googlePopup"));
              setInfo(null);
              setBusy(false);
            }
            return;
          }
          stashAuthBridge({ ...bridge, popup: Boolean(popup) || bridge.popup });
          if (Boolean(popup) || bridge.popup) markPopupOAuthStarted();
        }
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: platformOAuthCallbackUrl(Boolean(popup) || bridge?.popup) },
        });
        if (oauthError) throw oauthError;
      } catch (err) {
        if (!cancelled) {
          setError(friendlyAuthError(err, tNow("auth.error.google")));
          setBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oauth, preferredNext, effectiveShopRef, returnOrigin, popup]);

  // Após Google no pop-up: notifica a aba da loja e fecha.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bridgeReady) return;
      if (mode === "recovery" || mode === "forgot") return;
      // Conta recém-criada confirmando o WhatsApp: só sai pelo botão do passo.
      if (mode === "verifyPhone") return;
      if (oauth === "google") return;

      const hasCode =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).has("code");
      const inPopup = Boolean(popup || peekAuthBridge()?.popup);

      if (inPopup && (hasCode || peekAuthBridge())) {
        setInfo(tNow("auth.info.finishingLogin"));
        const result = await finishPopupOAuthAndNotifyOpener({
          returnOrigin,
          shop: effectiveShopRef,
          next: preferredNext || "/app",
          popup: true,
        });
        if (cancelled) return;
        if (result === "notified") {
          setInfo(tNow("auth.info.canClose"));
          return;
        }
        if (result === "error") {
          setError(tNow("auth.error.googlePopup"));
          setBusy(false);
          return;
        }
      }

      // Apex sem pop-up (uso direto em beauty…): fluxo normal.
      if (needsAuthOriginBridge()) return;
      if (inPopup) return;
      // Link de e-mail da loja: o código segue para o domínio de origem (efeito acima).
      if (returnOrigin && hasCode) return;

      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      await goAfterAuthLocal();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredNext, mode, effectiveShopRef, returnOrigin, oauth, bridgeReady, popup]);

  /**
   * Primeiro acesso com sessão aberta (e-mail confirmado, Google ou entrar):
   * 1. grava o aceite dos Termos quando o perfil ainda não tem (metadados do cadastro ou
   *    conta Google nova que viu o aviso junto ao botão);
   * 2. WhatsApp informado no cadastro que não chegou ao perfil (o e-mail precisava de
   *    confirmação): grava e abre a confirmação por código.
   * Devolve true quando abriu o passo do WhatsApp. Banco antigo (RPC ou coluna ausente)
   * não atrapalha a entrada.
   */
  async function runFirstAccessChecks(): Promise<boolean> {
    if (firstAccessCheckedRef.current) return false;
    firstAccessCheckedRef.current = true;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return false;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) return false;
      const row = profile as unknown as Record<string, unknown>;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

      // Banco já com as colunas de aceite (senão a chave nem vem no perfil).
      if ("terms_accepted_at" in row && !row.terms_accepted_at) {
        const metaTerms = typeof meta.terms_version === "string" ? meta.terms_version : null;
        const metaPrivacy = typeof meta.privacy_version === "string" ? meta.privacy_version : null;
        const provider = (user.app_metadata as { provider?: string } | undefined)?.provider;
        const createdAt = Date.parse(user.created_at ?? "");
        const newGoogleAccount =
          provider === "google" &&
          Number.isFinite(createdAt) &&
          Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
        if (metaTerms || newGoogleAccount) {
          await callOptionalRpc("record_my_terms_acceptance", {
            p_terms_version: metaTerms ?? TERMS_VERSION,
            p_privacy_version: metaPrivacy ?? PRIVACY_VERSION,
            p_age_confirmed: true,
          });
        }
      }

      // Só cadastro feito por esta tela (metadados novos, com terms_version) e recente:
      // conta antiga sem número, ou quem apagou o número em Meu perfil, não é incomodada.
      // Uma tentativa por conta neste aparelho, para nunca virar repetição a cada entrada.
      const metaWhatsapp = typeof meta.whatsapp === "string" ? meta.whatsapp.trim() : "";
      if (profile.whatsapp_e164 || !/^\d{10,15}$/.test(metaWhatsapp)) return false;
      if (typeof meta.terms_version !== "string") return false;
      const signupAt = Date.parse(user.created_at ?? "");
      if (!Number.isFinite(signupAt) || Date.now() - signupAt > SIGNUP_WHATSAPP_WINDOW_MS) {
        return false;
      }
      const attemptKey = `mb_signup_whatsapp_synced:${user.id}`;
      try {
        if (window.localStorage.getItem(attemptKey)) return false;
        window.localStorage.setItem(attemptKey, "1");
      } catch {
        /* sem armazenamento: segue (o número gravado já impede a repetição) */
      }
      const raw = `+${metaWhatsapp}`;
      const optIn = meta.whatsapp_opt_in !== false;
      const { error: saveError } = await supabase.rpc("save_my_whatsapp", {
        p_raw: raw,
        p_opt_in: optIn,
      });
      if (saveError) return false;
      setPassword("");
      setPhoneNumber(raw);
      setPhoneOptIn(optIn);
      setPhoneCode("");
      setPhoneUnavailable(false);
      setMode("verifyPhone");
      await requestPhoneCode(raw);
      return true;
    } catch {
      return false;
    }
  }

  async function goAfterAuthLocal() {
    if (await runFirstAccessChecks()) {
      sessionApplyingRef.current = false;
      setBusy(false);
      return;
    }
    const path = await resolvePostAuthPath(preferredNext);
    if (effectiveShopRef && (path === "/app" || path.startsWith("/app"))) {
      const url = new URL(path, window.location.origin);
      if (!url.searchParams.get("shop")) url.searchParams.set("shop", effectiveShopRef);
      url.searchParams.set("join", "1");
      window.location.href = `${url.pathname}${url.search}`;
      return;
    }
    window.location.href = path;
  }

  async function goAfterAuth() {
    await goAfterAuthLocal();
  }

  /**
   * Pede o código de confirmação do WhatsApp (auth-otp, verify_phone). WhatsApp
   * da plataforma indisponível não trava o cadastro: o passo mostra o aviso e
   * deixa seguir, com a confirmação para depois em Meu perfil.
   */
  async function requestPhoneCode(number: string) {
    setError(null);
    setInfo(null);
    try {
      const payload = await callVerifyPhone({ action: "request", destination: number });
      if (payload.already_verified) {
        setInfo(tNow("fix2.whats.verified"));
        await goAfterAuth();
        return;
      }
      setPhoneUnavailable(false);
      setPhoneResendIn(payload.resend_after_seconds ?? PHONE_RESEND_SECONDS);
      setInfo(tNow("fix2.whats.codeSent", { number: formatBrPhone(number) }));
    } catch (err) {
      if (err instanceof ServerError && err.errorCode === "whatsapp_unavailable") {
        setPhoneUnavailable(true);
        setInfo(tNow("fix3.auth.phoneUnavailable"));
        return;
      }
      setError(phoneErrorText(err));
    }
  }

  async function resendPhoneCode() {
    if (busy || phoneResendIn > 0) return;
    setBusy(true);
    setPhoneCode("");
    try {
      await requestPhoneCode(phoneNumber);
    } finally {
      setBusy(false);
    }
  }

  async function skipPhoneVerification() {
    setBusy(true);
    setError(null);
    setInfo(tNow("fix3.auth.phoneSkipped"));
    try {
      await goAfterAuth();
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "verifyPhone") {
        if (phoneUnavailable) {
          setInfo(tNow("fix3.auth.phoneSkipped"));
          await goAfterAuth();
          return;
        }
        if (!/^\d{6}$/.test(phoneCode)) {
          setError(tNow("fix3.auth.phoneCodeIncomplete"));
          return;
        }
        let verified: VerifyPhonePayload;
        try {
          verified = await callVerifyPhone({
            action: "verify",
            destination: phoneNumber,
            code: phoneCode,
            opt_in: phoneOptIn,
          });
        } catch (err) {
          setError(phoneErrorText(err));
          if (err instanceof ServerError && err.errorCode === "otp_invalid") setPhoneCode("");
          return;
        }
        setInfo(
          verified.whatsapp_opt_in_at
            ? tNow("fix2.whats.verifiedOptIn")
            : tNow("fix2.whats.verified"),
        );
        await goAfterAuth();
        return;
      }

      if (mode === "forgot") {
        if (recoveryChannel === "whatsapp" && effectiveShopRef) {
          const base = import.meta.env.VITE_SUPABASE_URL || "";
          if (!otpSent) {
            const response = await fetch(`${base}/functions/v1/auth-otp`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
              },
              body: JSON.stringify({
                action: "request",
                shop: effectiveShopRef,
                channel: "whatsapp",
                purpose: "recovery",
                destination: whatsapp,
              }),
            });
            const payload = (await response.json().catch(() => ({}))) as {
              error?: string;
              error_code?: string;
              message?: string;
            };
            if (!response.ok) throw serverError(payload, tNow("auth.error.sendCode"));
            setOtpSent(true);
            setInfo(tNow("auth.info.codeSentIfAccount"));
            return;
          }

          const response = await fetch(`${base}/functions/v1/auth-otp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            },
            body: JSON.stringify({
              action: "verify",
              shop: effectiveShopRef,
              channel: "whatsapp",
              purpose: "recovery",
              destination: whatsapp,
              code: otpCode,
            }),
          });
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            error_code?: string;
            email?: string;
            hashed_token?: string | null;
            verification_type?: string;
          };
          if (!response.ok) throw serverError(payload, tNow("auth.error.invalidCode"));
          if (!payload.hashed_token) throw new Error(tNow("auth.error.validateCode"));
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: payload.hashed_token,
            type: "recovery",
          });
          if (verifyError) throw verifyError;
          setMode("recovery");
          setInfo(tNow("auth.info.codeConfirmed"));
          setOtpSent(false);
          setOtpCode("");
          return;
        }

        const redirectTo = needsAuthOriginBridge()
          ? buildPlatformAuthUrl({
              shop: effectiveShopRef,
              next: preferredNext || undefined,
              returnOrigin: currentOrigin(),
              recovery: true,
            })
          : `${window.location.origin}/auth?recovery=1${
              preferredNext ? `&next=${encodeURIComponent(preferredNext)}` : ""
            }${effectiveShopRef ? `&shop=${encodeURIComponent(effectiveShopRef)}` : ""}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setInfo(tNow("auth.info.resetLinkSent"));
        return;
      }

      if (mode === "recovery") {
        if (password.length < 6) throw new Error(tNow("errors.passwordShort"));
        if (password !== passwordConfirm) throw new Error(tNow("auth.error.passwordMismatch"));
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setPasswordConfirm("");
        setInfo(tNow("auth.info.passwordUpdated"));
        await goAfterAuth();
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goAfterAuth();
        return;
      }

      // Cadastro: confere nome e WhatsApp antes de criar a conta (erro ao lado do campo).
      const signupName = fullName.trim().replace(/\s+/g, " ");
      const phoneCheck = checkSignupPhone(whatsapp, locale);
      const nextErrors: SignupFieldErrors = {};
      if (signupName.length < NAME_MIN || signupName.length > NAME_MAX) {
        nextErrors.name = tNow("cad.cliente.nameError");
      }
      if (!phoneCheck.ok) {
        if (phoneCheck.reason === "ddd") nextErrors.whatsapp = tNow("cad.cliente.phoneDddError");
        else if (phoneCheck.reason === "length")
          nextErrors.whatsapp = tNow("cad.cliente.phoneLengthError");
        else if (effectiveShopRef) nextErrors.whatsapp = tNow("cad.cliente.phoneRequired");
      }
      setFieldErrors(nextErrors);
      if (nextErrors.name || nextErrors.whatsapp) {
        if (nextErrors.name) nameInputRef.current?.focus();
        else signupPhoneRef.current?.focus();
        return;
      }
      // Nome e WhatsApp primeiro (mensagem traduzida ao lado do campo); depois o navegador
      // confere e-mail e senha. O formulário de cadastro usa noValidate para esta ordem.
      if (!form.reportValidity()) return;
      const signupPhone = phoneCheck.ok ? phoneCheck : null;
      const signupOptIn = Boolean(signupPhone) && phoneOptIn;

      const emailRedirectTo = needsAuthOriginBridge()
        ? buildPlatformAuthUrl({
            shop: effectiveShopRef,
            next: preferredNext || undefined,
            returnOrigin: currentOrigin(),
          })
        : `${window.location.origin}/auth${
            preferredNext || effectiveShopRef
              ? `?${new URLSearchParams({
                  ...(preferredNext ? { next: preferredNext } : {}),
                  ...(effectiveShopRef ? { shop: effectiveShopRef } : {}),
                }).toString()}`
              : ""
          }`;

      // Contrato com handle_new_user: nome, WhatsApp (só dígitos com DDI, ainda não
      // confirmado), escolha de avisos e o aceite mostrado acima do botão.
      const signupWhatsapp = signupPhone?.e164 ?? "";
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: signupName,
            ...(effectiveShopRef ? { shop: effectiveShopRef } : {}),
            ...(signupPhone ? { whatsapp: signupPhone.digits } : {}),
            whatsapp_opt_in: signupOptIn,
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            terms_accepted_at: new Date().toISOString(),
            age_confirmed: true,
          },
          emailRedirectTo,
        },
      });
      if (error) {
        const msg = error.message || "";
        if (/confirmação|confirmation|sending.*email|enviando e-mail/i.test(msg)) {
          throw new Error(tNow("auth.error.confirmationEmail"));
        }
        throw error;
      }

      // Com autoconfirm, a sessão já vem: grava o WhatsApp (ainda não confirmado)
      // e abre o passo de confirmação por código. Sem confirmar, o número não
      // serve para entrar nem recuperar a senha pelo WhatsApp.
      if (signUpData.session) {
        // Já entrou: as conferências do primeiro acesso não precisam repetir o WhatsApp.
        firstAccessCheckedRef.current = true;
        // Banco antigo ignora os metadados de aceite; com a RPC nova, grava aqui.
        await callOptionalRpc("record_my_terms_acceptance", {
          p_terms_version: TERMS_VERSION,
          p_privacy_version: PRIVACY_VERSION,
          p_age_confirmed: true,
        });
      }

      if (signUpData.session && signupWhatsapp) {
        const { error: waError } = await supabase.rpc("save_my_whatsapp", {
          p_raw: signupWhatsapp,
          p_opt_in: signupOptIn,
        });
        if (waError) {
          setInfo(tNow("auth.info.createdSaveWhatsapp"));
          await goAfterAuth();
          return;
        }
        setPassword("");
        setPhoneNumber(signupWhatsapp);
        setPhoneOptIn(signupOptIn);
        setPhoneCode("");
        setPhoneUnavailable(false);
        setMode("verifyPhone");
        await requestPhoneCode(signupWhatsapp);
        return;
      }

      if (signUpData.session) {
        setInfo(tNow("auth.info.createdNoWhatsapp"));
        await goAfterAuth();
        return;
      }

      setInfo(
        signupWhatsapp ? tNow("cad.cliente.confirmEmailWhatsapp") : tNow("auth.info.confirmEmail"),
      );
      setMode("signin");
    } catch (err) {
      setError(friendlyAuthError(err, tNow("auth.error.signinFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      // Domínio da loja: pop-up no apex. A aba principal permanece no domínio personalizado.
      if (needsAuthOriginBridge()) {
        let shopRef = effectiveShopRef;
        if (!shopRef) {
          try {
            const { resolveShopFromCurrentHost } = await import("@/lib/shop/host");
            const resolved = await resolveShopFromCurrentHost();
            shopRef = resolved?.shop_slug ?? null;
          } catch {
            shopRef = null;
          }
        }
        const returnOriginValue = currentOrigin();
        const popupUrl = buildPlatformAuthUrl({
          shop: shopRef,
          next: preferredNext || "/app",
          returnOrigin: returnOriginValue,
          oauth: "google",
          popup: true,
        });
        const popupWin = window.open(
          popupUrl,
          "mb-google-auth",
          "width=480,height=720,menubar=no,toolbar=no,status=no",
        );
        if (!popupWin) {
          setError(tNow("auth.error.allowPopups"));
          setBusy(false);
          return;
        }
        setInfo(tNow("auth.info.finishGooglePopup"));
        sessionApplyingRef.current = false;
        if (popupWatchRef.current !== null) window.clearInterval(popupWatchRef.current);
        const timer = window.setInterval(() => {
          if (popupWin.closed) {
            window.clearInterval(timer);
            if (popupWatchRef.current === timer) popupWatchRef.current = null;
            // A sessão chegou e está sendo aplicada: mantém "Entrando…" até sair da tela.
            if (sessionApplyingRef.current) return;
            setBusy(false);
            setInfo(null);
          }
        }, 600);
        popupWatchRef.current = timer;
        return;
      }
      // Apex beauty…: OAuth na mesma aba.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: platformOAuthCallbackUrl(false) },
      });
      if (error) throw error;
    } catch (err) {
      setError(friendlyAuthError(err, tNow("auth.error.google")));
      setBusy(false);
    }
  }

  const eyebrow =
    mode === "verifyPhone"
      ? t("fix3.auth.phoneEyebrow")
      : mode === "signup"
        ? t("auth.eyebrow.signup")
        : mode === "forgot"
          ? t("auth.eyebrow.forgot")
          : mode === "recovery"
            ? t("auth.eyebrow.recovery")
            : t("auth.eyebrow.signin");

  const title =
    mode === "verifyPhone"
      ? t("fix3.auth.phoneTitle")
      : mode === "signup"
        ? t("auth.title.signup")
        : mode === "forgot"
          ? t("auth.title.forgot")
          : mode === "recovery"
            ? t("auth.title.recovery")
            : t("auth.title.signin");

  const subtitle =
    mode === "verifyPhone"
      ? t("fix3.auth.phoneSubtitle", { number: formatBrPhone(phoneNumber) })
      : mode === "signup"
        ? effectiveShopRef
          ? t("auth.subtitle.signupShop")
          : t("auth.subtitle.signup")
        : mode === "forgot"
          ? recoveryChannel === "whatsapp"
            ? t("auth.subtitle.forgotWhatsapp")
            : t("auth.subtitle.forgotEmail")
          : mode === "recovery"
            ? t("auth.subtitle.recovery")
            : t("auth.subtitle.signin");

  // Termos e Política abrem em nova aba, no idioma atual (?lang=), sem perder o cadastro.
  const legalLinkClass =
    "-my-3 inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-2";
  const legalLinks = (
    <>
      <Link
        to="/termos"
        search={{ lang: locale }}
        target="_blank"
        rel="noopener noreferrer"
        className={legalLinkClass}
      >
        {t("auth.terms.link")}
        <span className="sr-only"> {t("cad.cliente.newTab")}</span>
      </Link>{" "}
      {t("auth.terms.and")}{" "}
      <Link
        to="/privacidade"
        search={{ lang: locale }}
        target="_blank"
        rel="noopener noreferrer"
        className={legalLinkClass}
      >
        {t("auth.privacy.link")}
        <span className="sr-only"> {t("cad.cliente.newTab")}</span>
      </Link>
    </>
  );

  const fieldClass =
    "auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10";
  const inputClass =
    "min-h-[3.25rem] min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60";
  const labelClass = "block space-y-2 text-sm font-semibold text-foreground/85";

  if (popup) {
    return (
      <main className="mb-page flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
        <div className="mb-panel w-full max-w-sm space-y-3 border border-border/70 bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground/80">{t("auth.popup.title")}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {error ? t("auth.popup.failed") : info || t("auth.popup.connecting")}
          </h1>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!error ? (
            <p className="text-sm text-muted-foreground">{t("auth.popup.autoClose")}</p>
          ) : (
            <button
              type="button"
              className="auth-brand-control mt-2 inline-flex min-h-11 w-full items-center justify-center bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={() => window.close()}
            >
              {t("common.close")}
            </button>
          )}
        </div>
      </main>
    );
  }

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
      <div className="auth-theme-toggle">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="auth-photo-layer" aria-hidden="true">
        <img src={brand.loginImageUrl || DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>
      <section
        className="auth-photo-copy"
        aria-label={t("auth.welcomeRegion", { name: brand.displayName })}
      >
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
        <h2>{t("auth.hero.title")}</h2>
        <p>{t("auth.hero.text")}</p>
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
                  alt={t("auth.logoAlt", { name: brand.displayName })}
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
                {t("common.demo")}
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
              aria-label={t("auth.modeTabs")}
            >
              {(
                [
                  ["signin", t("auth.tab.signin")],
                  ["signup", t("auth.tab.signup")],
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
                    setFieldErrors({});
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

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate={mode === "signup"}
            className="space-y-5"
          >
            {mode === "forgot" && effectiveShopRef && (
              <div
                className="auth-brand-control grid grid-cols-2 gap-1 bg-muted p-1"
                role="tablist"
                aria-label={t("auth.recoveryChannel")}
              >
                {(
                  [
                    { id: "email" as const, label: t("auth.channel.email"), icon: Mail },
                    {
                      id: "whatsapp" as const,
                      label: t("auth.channel.whatsapp"),
                      icon: MessageCircle,
                    },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={recoveryChannel === id}
                    onClick={() => {
                      setRecoveryChannel(id);
                      setOtpSent(false);
                      setOtpCode("");
                      setError(null);
                      setInfo(null);
                    }}
                    className={`auth-brand-button flex min-h-11 items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                      recoveryChannel === id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className={labelClass}>
                  <span>{t("cad.cliente.nameLabel")}</span>
                  <span className={fieldClass}>
                    <UserRound
                      className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      ref={nameInputRef}
                      type="text"
                      // Sem validação nativa: o erro traduzido aparece ao lado do campo.
                      aria-required="true"
                      maxLength={NAME_MAX}
                      autoComplete="name"
                      autoCapitalize="words"
                      placeholder={t("cad.cliente.namePlaceholder")}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (fieldErrors.name)
                          setFieldErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
                      className={inputClass}
                    />
                  </span>
                </label>
                {fieldErrors.name && (
                  <p id="signup-name-error" role="alert" className="text-sm text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            {mode !== "recovery" &&
              mode !== "verifyPhone" &&
              !(mode === "forgot" && recoveryChannel === "whatsapp" && effectiveShopRef) && (
                <label className={labelClass}>
                  <span>{t("auth.field.email")}</span>
                  <span className={fieldClass}>
                    <Mail
                      className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder={t("auth.field.emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </span>
                </label>
              )}

            {mode === "forgot" && recoveryChannel === "whatsapp" && effectiveShopRef && (
              <>
                <label className={labelClass}>
                  <span>{t("auth.field.whatsapp")}</span>
                  <span className={fieldClass}>
                    <MessageCircle
                      className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      type="tel"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(11) 99999-0000"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className={inputClass}
                    />
                  </span>
                </label>
                {otpSent && (
                  <label className={labelClass}>
                    <span>{t("auth.field.otp")}</span>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      containerClassName="justify-between"
                    >
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="auth-brand-control size-11 border border-border/70 text-base"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </label>
                )}
              </>
            )}

            {mode === "verifyPhone" && !phoneUnavailable && (
              <label className={labelClass}>
                <span>{t("fix2.whats.codeLabel")}</span>
                <InputOTP
                  maxLength={6}
                  value={phoneCode}
                  onChange={(value) => {
                    setPhoneCode(value);
                    setError(null);
                  }}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-describedby="phone-code-hint"
                  containerClassName="justify-between"
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="auth-brand-control size-11 border border-border/70 text-base"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <span
                  id="phone-code-hint"
                  className="block text-xs font-normal text-muted-foreground"
                >
                  {t("fix2.whats.codeHint")}
                </span>
              </label>
            )}

            {mode === "verifyPhone" && (
              <p className="auth-brand-control flex gap-2.5 border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                <span>{t("fix3.auth.phoneLaterHint")}</span>
              </p>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <label className={labelClass}>
                  <span>
                    {effectiveShopRef
                      ? t("auth.field.whatsappSignupShop")
                      : t("auth.field.whatsappSignupOptional")}
                  </span>
                  <span className={fieldClass}>
                    <MessageCircle
                      className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <input
                      ref={signupPhoneRef}
                      type="tel"
                      aria-required={effectiveShopRef ? "true" : undefined}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={locale === "pt-PT" ? "+351 912 345 678" : "(11) 99999-0000"}
                      value={whatsapp}
                      onChange={(e) => {
                        setWhatsapp(nextMaskedPhone(whatsapp, e.target.value, locale));
                        if (fieldErrors.whatsapp)
                          setFieldErrors((prev) => ({ ...prev, whatsapp: undefined }));
                      }}
                      aria-invalid={fieldErrors.whatsapp ? true : undefined}
                      aria-describedby={
                        fieldErrors.whatsapp
                          ? "signup-whatsapp-error signup-whatsapp-hint"
                          : "signup-whatsapp-hint"
                      }
                      className={inputClass}
                    />
                  </span>
                </label>
                {fieldErrors.whatsapp && (
                  <p id="signup-whatsapp-error" role="alert" className="text-sm text-destructive">
                    {fieldErrors.whatsapp}
                  </p>
                )}
                <p
                  id="signup-whatsapp-hint"
                  className="text-xs font-normal leading-relaxed text-muted-foreground"
                >
                  {t("cad.cliente.whatsappHint")}
                </p>
                {whatsapp.replace(/\D/g, "").length > 0 && (
                  <label className="auth-brand-control flex min-h-11 cursor-pointer items-center justify-between gap-3 border border-border/70 px-3.5 py-2.5 text-sm text-foreground">
                    <span className="min-w-0">{t("cad.cliente.optInLabel")}</span>
                    <Switch
                      checked={phoneOptIn}
                      onCheckedChange={setPhoneOptIn}
                      aria-label={t("cad.cliente.optInLabel")}
                    />
                  </label>
                )}
              </div>
            )}

            {(mode === "signin" || mode === "signup" || mode === "recovery") && (
              <div className="space-y-1">
                <label className={labelClass}>
                  <span>
                    {mode === "recovery" ? t("auth.field.newPassword") : t("auth.field.password")}
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
                      placeholder={t("auth.field.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="auth-brand-button mr-1.5 flex size-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
                {mode === "signin" && (
                  <div className="auth-forgot-password">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setInfo(null);
                        setPassword("");
                      }}
                      className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-primary underline-offset-4 transition-colors hover:underline"
                    >
                      {t("auth.forgot")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "recovery" && (
              <label className={labelClass}>
                <span>{t("auth.field.confirmPassword")}</span>
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
                    placeholder={t("auth.field.confirmPlaceholder")}
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

            {mode === "signup" && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("cad.cliente.terms.before")} {legalLinks} {t("cad.cliente.terms.age")}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="auth-primary-action auth-brand-button mt-1 flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-primary px-4 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklch,var(--brand-primary)_22%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_28px_color-mix(in_oklch,var(--brand-primary)_28%,transparent)] active:translate-y-0 active:scale-[0.99] disabled:opacity-50"
            >
              <span>
                {busy
                  ? t("common.wait")
                  : mode === "verifyPhone"
                    ? phoneUnavailable
                      ? t("fix3.auth.phoneContinue")
                      : t("fix2.whats.confirm")
                    : mode === "forgot"
                      ? recoveryChannel === "whatsapp" && effectiveShopRef
                        ? otpSent
                          ? t("auth.submit.confirmCode")
                          : t("auth.submit.sendCode")
                        : t("auth.submit.sendLink")
                      : mode === "recovery"
                        ? t("auth.submit.saveNewPassword")
                        : mode === "signup"
                          ? t("auth.submit.signup")
                          : t("auth.submit.signin")}
              </span>
              {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
            {mode === "verifyPhone" && !phoneUnavailable && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy || phoneResendIn > 0}
                  onClick={() => void resendPhoneCode()}
                  className="auth-brand-button flex min-h-11 w-full items-center justify-center border border-border px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {phoneResendIn > 0
                    ? t("fix2.whats.resendIn", { seconds: phoneResendIn })
                    : t("fix2.whats.resend")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void skipPhoneVerification()}
                  className="auth-brand-button flex min-h-11 w-full items-center justify-center border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {t("fix3.auth.phoneSkip")}
                </button>
              </div>
            )}
            {mode === "forgot" && recoveryChannel === "whatsapp" && effectiveShopRef && otpSent && (
              <button
                type="button"
                disabled={busy}
                className="auth-brand-button mt-2 flex min-h-11 w-full items-center justify-center border border-border px-4 text-sm font-semibold disabled:opacity-50"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode("");
                  setError(null);
                  setInfo(t("auth.info.resendHint"));
                }}
              >
                {t("auth.resendCode")}
              </button>
            )}
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
              {t("auth.backToSignin")}
            </button>
          )}

          {(mode === "signin" || mode === "signup") && (
            <>
              <div className="relative text-center text-xs font-medium text-muted-foreground">
                <span className="auth-divider-label relative z-10 px-3">
                  {t("auth.orContinue")}
                </span>
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
              </div>

              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={busy}
                className="auth-brand-button auth-google-action flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/50 disabled:opacity-50"
              >
                <GoogleMark />
                {t("auth.google")}
              </button>
              <p className="-mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                {t("auth.terms.before")} {legalLinks} {t("cad.cliente.terms.age")}
              </p>
            </>
          )}

          {mode === "signup" && (
            <p className="border-t border-border/70 pt-5 text-center text-sm text-muted-foreground">
              {t("cad.cliente.ownerQuestion")}{" "}
              <Link
                to="/cadastrar"
                className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t("cad.cliente.ownerLink")}
              </Link>
            </p>
          )}

          <div className="auth-panel-footer space-y-2 text-center text-xs text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5 font-medium">
              <ShieldCheck className="size-3.5 text-gold" aria-hidden="true" />
              {t("auth.protected")}
            </p>
            {mode !== "signin" && mode !== "signup" && (
              <p>
                {t("auth.terms.before")} {legalLinks}.
              </p>
            )}
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
