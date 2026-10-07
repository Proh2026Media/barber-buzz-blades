import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Eye,
  EyeOff,
  Hourglass,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  MailOpen,
  MessageCircle,
  MousePointerClick,
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
import { Switch } from "@/components/ui/switch";
import {
  announce,
  FieldMessage,
  Hint,
  Notice,
  StatusBadge,
  Steps,
  type StepItem,
  type Tone,
} from "@/components/visual";
import {
  CodeInput,
  CodeSentCard,
  ConsentNote,
  ExampleBubble,
  GoogleMark,
  PasswordRules,
  ResendButton,
  ResultHero,
} from "@/features/auth/entry";
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

type SignupFieldErrors = { name?: string; email?: string; whatsapp?: string; password?: string };

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
  // Aviso da tela com o tom do estado (ícone e cor): andamento, sucesso ou informação.
  const [notice, setNotice] = useState<{ text: string; tone: Tone } | null>(null);
  const info = notice?.text ?? null;
  function setInfo(text: string | null, tone: Tone = "info") {
    setNotice(text ? { text, tone } : null);
  }
  // Resultado que troca o formulário: "Confira seu e-mail" (cadastro) ou "Link enviado" (senha).
  const [emailResult, setEmailResult] = useState<{
    kind: "signup" | "reset";
    email: string;
    withWhatsapp: boolean;
  } | null>(null);
  const [resetResendIn, setResetResendIn] = useState(0);
  const [recoveryResendIn, setRecoveryResendIn] = useState(0);
  const [linkExpired, setLinkExpired] = useState(false);
  // Google em janela separada: a tela espera, com saída "Fechei a janela".
  const [googleWaiting, setGoogleWaiting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Janela de entrar com Google: o botão de fechar aparece se demorar.
  const [popupSlow, setPopupSlow] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [recoveryChannel, setRecoveryChannel] = useState<RecoveryChannel>("email");
  const [whatsapp, setWhatsapp] = useState("");
  // Cadastro do cliente: nome, aceite de avisos por WhatsApp e erros ao lado de cada campo.
  const [fullName, setFullName] = useState("");
  const [phoneOptIn, setPhoneOptIn] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
  const signupPhoneRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (resetResendIn <= 0) return;
    const timer = window.setTimeout(() => setResetResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resetResendIn]);

  useEffect(() => {
    if (recoveryResendIn <= 0) return;
    const timer = window.setTimeout(() => setRecoveryResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [recoveryResendIn]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopupSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [popup]);

  // Resultado novo (e-mail enviado): o foco vai para o título, que diz o que aconteceu.
  useEffect(() => {
    if (emailResult) titleRef.current?.focus();
  }, [emailResult]);

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
      setInfo(tNow("fix.auth-rotas.emailConfirmedSignIn"), "success");
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
      setGoogleWaiting(false);
      setInfo(tNow("auth.info.signingIn"), "progress");
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
        setInfo(tNow("auth.info.signingIn"), "progress");
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
        setEmailResult(null);
        setNotice({ text: tNow("auth.info.setNewPassword"), tone: "info" });
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
      setError(null);
      setLinkExpired(true);
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
      setNotice({ text: tNow("auth.info.openingGoogle"), tone: "progress" });
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
              setNotice(null);
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
        setInfo(tNow("auth.info.finishingLogin"), "progress");
        const result = await finishPopupOAuthAndNotifyOpener({
          returnOrigin,
          shop: effectiveShopRef,
          next: preferredNext || "/app",
          popup: true,
        });
        if (cancelled) return;
        if (result === "notified") {
          setInfo(tNow("auth.info.canClose"), "success");
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
        setInfo(tNow("fix2.whats.verified"), "success");
        await goAfterAuth();
        return;
      }
      setPhoneUnavailable(false);
      setPhoneResendIn(payload.resend_after_seconds ?? PHONE_RESEND_SECONDS);
      // O número e o exemplo da mensagem aparecem no cartão do código; aqui só o anúncio.
      announce(tNow("fix2.whats.codeSent", { number: formatBrPhone(number) }));
    } catch (err) {
      if (err instanceof ServerError && err.errorCode === "whatsapp_unavailable") {
        // Tela de resultado: conta criada, WhatsApp para confirmar depois.
        setPhoneUnavailable(true);
        announce(tNow("fix3.auth.phoneUnavailable"));
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
    setInfo(tNow("fix3.auth.phoneSkipped"), "success");
    try {
      await goAfterAuth();
    } finally {
      setBusy(false);
    }
  }

  /** Esqueci a senha pelo WhatsApp: pede o código (o mesmo pedido do primeiro envio). */
  async function requestRecoveryCode() {
    const base = import.meta.env.VITE_SUPABASE_URL || "";
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
    setRecoveryResendIn(PHONE_RESEND_SECONDS);
    setInfo(tNow("auth.info.codeSentIfAccount"));
  }

  /** Esqueci a senha por e-mail: envia o link e mostra a tela "Link enviado". */
  async function sendResetLink() {
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
    setLinkExpired(false);
    setResetResendIn(PHONE_RESEND_SECONDS);
    setEmailResult({ kind: "reset", email: email.trim(), withWhatsapp: false });
    announce(tNow("auth.info.resetLinkSent"));
  }

  /** "Reenviar código" / "Enviar de novo": repete o mesmo envio, com espera à vista. */
  async function resendFromForgot(kind: "code" | "link") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "code") {
        setOtpCode("");
        await requestRecoveryCode();
      } else {
        await sendResetLink();
      }
    } catch (err) {
      setError(
        friendlyAuthError(err, tNow(kind === "code" ? "auth.error.sendCode" : "errors.generic")),
      );
    } finally {
      setBusy(false);
    }
  }

  /** Troca de modo limpando avisos, senha e o resultado na tela (o e-mail fica). */
  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setFieldErrors({});
    setEmailResult(null);
    setLinkExpired(false);
    setPassword("");
    setPasswordConfirm("");
    setOtpSent(false);
    setOtpCode("");
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
          setInfo(tNow("fix3.auth.phoneSkipped"), "success");
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
          "success",
        );
        await goAfterAuth();
        return;
      }

      if (mode === "forgot") {
        if (recoveryChannel === "whatsapp" && effectiveShopRef) {
          const base = import.meta.env.VITE_SUPABASE_URL || "";
          if (!otpSent) {
            await requestRecoveryCode();
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
          setInfo(tNow("auth.info.codeConfirmed"), "success");
          setOtpSent(false);
          setOtpCode("");
          return;
        }

        await sendResetLink();
        return;
      }

      if (mode === "recovery") {
        if (password.length < 6) throw new Error(tNow("errors.passwordShort"));
        if (password !== passwordConfirm) throw new Error(tNow("auth.error.passwordMismatch"));
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setPasswordConfirm("");
        setInfo(tNow("auth.info.passwordUpdated"), "success");
        await goAfterAuth();
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goAfterAuth();
        return;
      }

      // Cadastro: confere todos os campos antes de criar a conta (erro ao lado de cada um).
      // E-mail e senha seguem a mesma regra do navegador (type=email, 6+ caracteres), mas a
      // mensagem aparece junto do campo, com ícone, no idioma escolhido.
      const signupName = fullName.trim().replace(/\s+/g, " ");
      const phoneCheck = checkSignupPhone(whatsapp, locale);
      const nextErrors: SignupFieldErrors = {};
      if (signupName.length < NAME_MIN || signupName.length > NAME_MAX) {
        nextErrors.name = tNow("cad.cliente.nameError");
      }
      if (!email.trim() || emailInputRef.current?.validity.typeMismatch) {
        nextErrors.email = tNow("cad.dono.errEmail");
      }
      if (!phoneCheck.ok) {
        if (phoneCheck.reason === "ddd") nextErrors.whatsapp = tNow("cad.cliente.phoneDddError");
        else if (phoneCheck.reason === "length")
          nextErrors.whatsapp = tNow("cad.cliente.phoneLengthError");
        else nextErrors.whatsapp = tNow("cad.cliente.phoneRequired");
      }
      if (password.length < 6) nextErrors.password = tNow("errors.passwordShort");
      setFieldErrors(nextErrors);
      // Foco no primeiro campo com erro, na ordem da tela.
      const firstInvalid = nextErrors.name
        ? nameInputRef.current
        : nextErrors.email
          ? emailInputRef.current
          : nextErrors.whatsapp
            ? signupPhoneRef.current
            : nextErrors.password
              ? passwordInputRef.current
              : null;
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }
      // Rede de segurança: qualquer outra regra nativa que tenha passado.
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
          setInfo(tNow("auth.info.createdSaveWhatsapp"), "success");
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
        setInfo(tNow("auth.info.createdNoWhatsapp"), "success");
        await goAfterAuth();
        return;
      }

      // Conta criada, falta confirmar o e-mail: tela "Confira seu e-mail" com os próximos passos.
      setPassword("");
      setEmailResult({
        kind: "signup",
        email: email.trim(),
        withWhatsapp: Boolean(signupWhatsapp),
      });
      announce(
        signupWhatsapp ? tNow("cad.cliente.confirmEmailWhatsapp") : tNow("auth.info.confirmEmail"),
      );
    } catch (err) {
      setError(friendlyAuthError(err, tNow("auth.error.signinFailed")));
    } finally {
      setBusy(false);
    }
  }

  /** "Fechei a janela": solta a tela se a janela do Google foi fechada sem concluir. */
  function stopWaitingGoogle() {
    if (popupWatchRef.current !== null) window.clearInterval(popupWatchRef.current);
    popupWatchRef.current = null;
    if (sessionApplyingRef.current) return;
    setGoogleWaiting(false);
    setGoogleBusy(false);
    setBusy(false);
    setInfo(null);
  }

  async function handleGoogle() {
    setBusy(true);
    setGoogleBusy(true);
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
          setGoogleBusy(false);
          return;
        }
        setGoogleWaiting(true);
        announce(tNow("auth.info.finishGooglePopup"));
        sessionApplyingRef.current = false;
        if (popupWatchRef.current !== null) window.clearInterval(popupWatchRef.current);
        const timer = window.setInterval(() => {
          if (popupWin.closed) {
            window.clearInterval(timer);
            if (popupWatchRef.current === timer) popupWatchRef.current = null;
            // A sessão chegou e está sendo aplicada: mantém "Entrando…" até sair da tela.
            if (sessionApplyingRef.current) return;
            setBusy(false);
            setGoogleBusy(false);
            setGoogleWaiting(false);
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
      setGoogleBusy(false);
    }
  }

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

  // Esqueci a senha pelo WhatsApp (só no login de uma barbearia).
  const whatsappRecovery = recoveryChannel === "whatsapp" && Boolean(effectiveShopRef);
  // Etapa de digitar o código: o erro aparece logo abaixo das caixas.
  const codeStep =
    (mode === "verifyPhone" && !phoneUnavailable) ||
    (mode === "forgot" && whatsappRecovery && otpSent);
  // Tela de resultado no lugar do formulário: o título fica no resultado.
  const resultScreen = Boolean(emailResult) || (mode === "verifyPhone" && phoneUnavailable);

  /** Etapas mostradas sob o título: onde a pessoa está no fluxo. */
  const flowSteps: StepItem[] | null = (() => {
    const state = (index: number, current: number): StepItem["status"] =>
      index < current ? "done" : index === current ? "current" : "upcoming";
    if (mode === "signup") {
      return [
        { key: "data", label: t("entry.signup.step.data"), status: "current" },
        // "Confirmar contato": vale para o código no WhatsApp e para o link no e-mail.
        { key: "confirm", label: t("entry.signup.step.confirm"), status: "upcoming" },
      ];
    }
    if (mode === "verifyPhone") {
      return [
        { key: "created", label: t("entry.phone.step.created"), status: "done" },
        { key: "confirm", label: t("entry.phone.step.confirm"), status: "current" },
        { key: "done", label: t("entry.phone.step.done"), status: "upcoming" },
      ];
    }
    if (mode === "forgot" || mode === "recovery") {
      const current = mode === "recovery" ? 2 : whatsappRecovery && otpSent ? 1 : 0;
      const labels = whatsappRecovery
        ? [t("entry.forgot.step.whatsapp"), t("entry.forgot.step.code")]
        : [t("entry.forgot.step.email"), t("entry.forgot.step.link")];
      return [...labels, t("entry.forgot.step.password")].map((label, index) => ({
        key: String(index),
        label,
        status: state(index, current),
      }));
    }
    return null;
  })();

  /** Botão principal: verbo do que acontece, ícone e o verbo no gerúndio enquanto espera. */
  const submit = (() => {
    if (mode === "verifyPhone") {
      return phoneUnavailable
        ? { label: t("entry.phone.enterApp"), busy: t("auth.info.signingIn"), icon: ArrowRight }
        : { label: t("fix2.whats.confirm"), busy: t("fix2.whats.verifying"), icon: ShieldCheck };
    }
    if (mode === "forgot") {
      if (whatsappRecovery) {
        return otpSent
          ? {
              label: t("auth.submit.confirmCode"),
              busy: t("fix2.whats.verifying"),
              icon: ShieldCheck,
            }
          : {
              label: t("auth.submit.sendCode"),
              busy: t("fix2.whats.sending"),
              icon: MessageCircle,
            };
      }
      return { label: t("auth.submit.sendLink"), busy: t("entry.busy.sendLink"), icon: Mail };
    }
    if (mode === "recovery") {
      return {
        label: t("auth.submit.saveNewPassword"),
        busy: t("entry.busy.savePassword"),
        icon: KeyRound,
      };
    }
    if (mode === "signup") {
      return { label: t("auth.submit.signup"), busy: t("entry.busy.signup"), icon: ArrowRight };
    }
    return { label: t("auth.submit.signin"), busy: t("auth.info.signingIn"), icon: ArrowRight };
  })();
  const SubmitIcon = submit.icon;

  // Frase do aceite com os nomes dos documentos em texto; os links ficam logo abaixo, em pílulas.
  const docNames = (
    <>
      <strong className="font-semibold text-foreground">{t("auth.terms.link")}</strong>{" "}
      {t("auth.terms.and")}{" "}
      <strong className="font-semibold text-foreground">{t("auth.privacy.link")}</strong>
    </>
  );

  // Caminho de volta: à página da barbearia (ou ao início da plataforma).
  const backTarget = shopContext.demo
    ? null
    : shopContext.shopRef
      ? { href: `/b/${encodeURIComponent(shopContext.shopRef)}`, label: t("entry.back.shop") }
      : hostShopSlug
        ? { href: "/", label: t("entry.back.shop") }
        : { href: "/", label: t("entry.back.home") };

  const fieldClass =
    "auth-input-wrap auth-brand-control flex min-h-[3.25rem] items-center border border-border/70 transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10";
  const inputClass =
    "min-h-[3.25rem] min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60";
  const labelClass = "block space-y-2 text-sm font-semibold text-foreground/85";
  // Botão principal do /auth (enviar e telas de resultado): sempre na cor da marca da loja.
  const primaryActionClass =
    "auth-primary-action auth-brand-button flex min-h-[3.25rem] w-full items-center justify-center gap-2 bg-primary px-4 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklch,var(--brand-primary)_22%,transparent)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_28px_color-mix(in_oklch,var(--brand-primary)_28%,transparent)] active:translate-y-0 active:scale-[0.99] aria-busy:cursor-wait [&:disabled:not([aria-busy=true])]:opacity-60";

  if (popup) {
    return (
      <main className="mb-page flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <div className="entry-result-card w-full max-w-sm space-y-5 p-6 sm:p-8">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            <GoogleMark />
            {t("entry.popup.title")}
          </p>
          {error ? (
            <ResultHero tone="danger" title={t("auth.popup.failed")}>
              {error}
            </ResultHero>
          ) : (
            <ResultHero
              tone={notice?.tone === "success" ? "success" : "progress"}
              title={info || t("auth.popup.connecting")}
            >
              {t("auth.popup.autoClose")}
            </ResultHero>
          )}
          {(error || popupSlow) && (
            <button
              type="button"
              className="action-button entry-submit"
              onClick={() => window.close()}
            >
              {t("entry.popup.close")}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      className={`auth-workspace auth-page brand-page auth-layout-${brand.loginLayout} mb-page min-h-dvh text-foreground ${brandCornerClass(brand.cornerStyle)}`}
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
                  "color-mix(in oklab, var(--brand-primary) 8%, white)",
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
              className="auth-brand-name min-w-0 flex-1 truncate text-sm font-bold"
              aria-live="polite"
              aria-busy={brandLoading}
            >
              {brand.displayName}
            </p>
          </div>

          {!resultScreen && (
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1
                ref={titleRef}
                tabIndex={-1}
                className="auth-title text-[1.85rem] font-bold leading-[1.05] tracking-tight text-foreground outline-none sm:text-[2.2rem]"
              >
                {title}
              </h1>
              {shopContext.demo && (
                <StatusBadge tone="highlight" size="sm" label={t("common.demo")} />
              )}
            </div>
          )}
          {!resultScreen && flowSteps && mode !== "signup" && (
            <Steps
              steps={flowSteps}
              label={
                mode === "verifyPhone" ? t("entry.phone.stepsLabel") : t("entry.forgot.stepsLabel")
              }
              className="mt-5"
            />
          )}
        </div>

        <div className="auth-form-body auth-form-stack px-6 pb-8 pt-8 sm:px-10 sm:pb-10">
          {!resultScreen && (mode === "signin" || mode === "signup") && (
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
                  onClick={() => switchMode(id)}
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

          {emailResult && (
            <section className="grid gap-5" aria-labelledby="auth-result-title">
              <ResultHero
                ref={titleRef}
                id="auth-result-title"
                tone="success"
                icon={MailCheck}
                title={
                  emailResult.kind === "signup" ? t("entry.email.title") : t("entry.reset.title")
                }
              >
                {emailResult.kind === "reset" && <p>{t("entry.reset.line")}</p>}
                <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                  <Mail className="size-4 shrink-0 text-gold" aria-hidden="true" />
                  {emailResult.email}
                </p>
              </ResultHero>
              <Steps
                orientation="vertical"
                label={t("entry.email.stepsLabel")}
                className="rounded-2xl border border-border bg-background/60 p-4"
                steps={[
                  {
                    key: "open",
                    label: t("entry.email.stepOpen"),
                    icon: MailOpen,
                    status: "upcoming",
                  },
                  {
                    key: "tap",
                    label: t("entry.email.stepTap"),
                    icon: MousePointerClick,
                    status: "upcoming",
                  },
                  ...(emailResult.kind === "reset"
                    ? [
                        {
                          key: "new",
                          label: t("entry.reset.stepNew"),
                          icon: KeyRound,
                          status: "upcoming" as const,
                        },
                      ]
                    : emailResult.withWhatsapp
                      ? [
                          {
                            key: "code",
                            label: t("entry.email.stepCode"),
                            icon: MessageCircle,
                            status: "upcoming" as const,
                          },
                        ]
                      : []),
                ]}
              />
              <Hint>{t("entry.email.spam")}</Hint>
              {error && <Notice tone="danger" title={error} />}
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={primaryActionClass}
                >
                  {emailResult.kind === "signup"
                    ? t("entry.email.confirmed")
                    : t("auth.backToSignin")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                {emailResult.kind === "signup" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="entry-link-button"
                  >
                    {t("entry.email.other")}
                  </button>
                ) : (
                  <ResendButton
                    className="justify-center"
                    secondsLeft={resetResendIn}
                    totalSeconds={PHONE_RESEND_SECONDS}
                    busy={busy}
                    onClick={() => void resendFromForgot("link")}
                    label={t("entry.reset.resend")}
                    waitLabel={t("entry.reset.resendIn", { seconds: resetResendIn })}
                    busyLabel={t("entry.busy.sendLink")}
                  />
                )}
              </div>
            </section>
          )}

          {mode === "verifyPhone" && phoneUnavailable && (
            <section className="grid gap-5" aria-labelledby="auth-result-title">
              <ResultHero
                ref={titleRef}
                id="auth-result-title"
                tone="success"
                title={t("entry.phone.step.created")}
              >
                <StatusBadge
                  tone="pending"
                  icon={Hourglass}
                  label={t("entry.phone.unavailableBadge")}
                />
                <p className="mt-2">{t("entry.phone.unavailableLine")}</p>
              </ResultHero>
              {error && <Notice tone="danger" title={error} />}
              <button
                type="button"
                disabled={busy}
                onClick={() => void skipPhoneVerification()}
                aria-busy={busy ? true : undefined}
                className={primaryActionClass}
              >
                {busy ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : null}
                {busy ? t("auth.info.signingIn") : t("entry.phone.enterApp")}
                {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
              </button>
            </section>
          )}

          {!resultScreen && mode === "signup" && (
            <div className="grid gap-3">
              {/* Um só aceite, antes dos dois caminhos ("Ao continuar…" cobre Google e e-mail). */}
              <ConsentNote>
                {t("auth.terms.before")} {docNames} {t("cad.cliente.terms.age")}
              </ConsentNote>
              <button
                type="button"
                onClick={() => void handleGoogle()}
                disabled={busy}
                className="auth-brand-button auth-google-action flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/50 disabled:opacity-60"
              >
                {googleBusy ? (
                  <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <GoogleMark />
                )}
                {t("entry.signup.google")}
              </button>
              {googleWaiting && (
                <Notice
                  tone="progress"
                  title={t("entry.google.waitTitle")}
                  action={{ label: t("entry.google.waitClosed"), onClick: stopWaitingGoogle }}
                />
              )}
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span>{t("entry.signup.orEmail")}</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              {flowSteps && <Steps steps={flowSteps} label={t("entry.signup.stepsLabel")} />}
            </div>
          )}

          {!resultScreen && (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              noValidate={mode === "signup"}
              className={`auth-form-fields${mode === "signup" ? " is-signup" : ""}`}
            >
              {mode === "forgot" && linkExpired && (
                <Notice
                  tone="warning"
                  title={t("entry.link.expiredTitle")}
                  action={{
                    label: t("entry.link.expiredAction"),
                    onClick: () => {
                      setRecoveryChannel("email");
                      window.requestAnimationFrame(() => emailInputRef.current?.focus());
                    },
                  }}
                >
                  {t("entry.link.expiredDetail")}
                </Notice>
              )}
              {mode === "forgot" && effectiveShopRef && (
                <div
                  className="entry-channel-tabs auth-brand-control grid grid-cols-2 gap-1 bg-muted p-1"
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
                        setRecoveryResendIn(0);
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
                <div className="auth-field-name space-y-1.5">
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
                    <FieldMessage id="signup-name-error" tone="error">
                      <span role="alert">{fieldErrors.name}</span>
                    </FieldMessage>
                  )}
                </div>
              )}

              {mode !== "recovery" &&
                mode !== "verifyPhone" &&
                !(mode === "forgot" && recoveryChannel === "whatsapp" && effectiveShopRef) && (
                  <div className="auth-field-email space-y-1.5">
                    <label className={labelClass}>
                      <span>{t("auth.field.email")}</span>
                      <span className={fieldClass}>
                        <Mail
                          className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <input
                          ref={emailInputRef}
                          type="email"
                          required
                          autoComplete="email"
                          placeholder={t("auth.field.emailPlaceholder")}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email)
                              setFieldErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          aria-invalid={mode === "signup" && fieldErrors.email ? true : undefined}
                          aria-describedby={
                            mode === "signup" && fieldErrors.email
                              ? "signup-email-error"
                              : undefined
                          }
                          className={inputClass}
                        />
                      </span>
                    </label>
                    {mode === "signup" && fieldErrors.email && (
                      <FieldMessage id="signup-email-error" tone="error">
                        <span role="alert">{fieldErrors.email}</span>
                      </FieldMessage>
                    )}
                  </div>
                )}

              {mode === "forgot" && whatsappRecovery && !otpSent && (
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
              )}

              {mode === "forgot" && whatsappRecovery && otpSent && (
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border bg-background/60 p-3 text-sm">
                    <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden="true" />
                    <span className="rounded-xl border border-border bg-card px-2 py-0.5 font-bold tabular-nums">
                      {formatBrPhone(whatsapp)}
                    </span>
                    <button
                      type="button"
                      className="entry-link-button ms-auto"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode("");
                        setError(null);
                        setInfo(null);
                      }}
                    >
                      {t("fix2.whats.changeNumber")}
                    </button>
                    {info && <p className="w-full text-xs text-muted-foreground">{info}</p>}
                  </div>
                  <label
                    htmlFor="recovery-code"
                    className="text-sm font-semibold text-foreground/85"
                  >
                    {t("auth.field.otp")}
                  </label>
                  <CodeInput
                    id="recovery-code"
                    value={otpCode}
                    onChange={(value) => {
                      setOtpCode(value);
                      setError(null);
                    }}
                    autoFocus
                    invalid={Boolean(error)}
                    describedBy={error ? "auth-code-error" : undefined}
                  />
                  {error && <Notice id="auth-code-error" tone="danger" title={error} />}
                  <ResendButton
                    className="justify-self-start"
                    secondsLeft={recoveryResendIn}
                    totalSeconds={PHONE_RESEND_SECONDS}
                    busy={busy}
                    onClick={() => void resendFromForgot("code")}
                    label={t("fix2.whats.resend")}
                    waitLabel={t("fix2.whats.resendIn", { seconds: recoveryResendIn })}
                    busyLabel={t("fix2.whats.sending")}
                  />
                </div>
              )}

              {mode === "verifyPhone" && !phoneUnavailable && (
                <div className="grid gap-3">
                  <CodeSentCard
                    toLabel={t("entry.code.sentTo")}
                    number={formatBrPhone(phoneNumber)}
                    sender={brand.displayName}
                    message={t("entry.code.example")}
                    exampleLabel={t("entry.example")}
                    hideExample={phoneCode.length > 0}
                  />
                  <label htmlFor="phone-code" className="text-sm font-semibold text-foreground/85">
                    {t("fix2.whats.codeLabel")}
                  </label>
                  <CodeInput
                    id="phone-code"
                    value={phoneCode}
                    onChange={(value) => {
                      setPhoneCode(value);
                      setError(null);
                    }}
                    autoFocus
                    invalid={Boolean(error)}
                    describedBy={error ? "auth-code-error" : "phone-code-hint"}
                  />
                  {error ? (
                    <Notice id="auth-code-error" tone="danger" title={error} />
                  ) : (
                    <Hint icon={Hourglass} className="text-xs">
                      <span id="phone-code-hint">{t("fix2.whats.codeHint")}</span>
                    </Hint>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <div className="auth-whatsapp-group">
                  <label className={labelClass}>
                    <span>{t("auth.field.whatsappSignupShop")}</span>
                    <span className={fieldClass}>
                      <MessageCircle
                        className="ml-4 size-[18px] shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <input
                        ref={signupPhoneRef}
                        type="tel"
                        aria-required="true"
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
                    <FieldMessage
                      id="signup-whatsapp-error"
                      tone="error"
                      className="auth-whatsapp-error"
                    >
                      <span role="alert">{fieldErrors.whatsapp}</span>
                    </FieldMessage>
                  )}
                  <p id="signup-whatsapp-hint" className="sr-only">
                    {t("cad.cliente.whatsappHint")}
                  </p>
                  <div className="auth-whatsapp-optin auth-brand-control grid gap-3 border border-border/70 bg-background/50 px-3.5 py-3">
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <Bell className="size-4 shrink-0 text-gold" aria-hidden="true" />
                        {t("entry.reminders.title")}
                      </span>
                      <Switch
                        checked={phoneOptIn}
                        onCheckedChange={setPhoneOptIn}
                        aria-label={t("cad.cliente.optInLabel")}
                      />
                    </label>
                    {phoneOptIn && (
                      <ExampleBubble
                        sender={brand.displayName}
                        message={t("entry.reminders.example")}
                        exampleLabel={t("entry.example")}
                      />
                    )}
                  </div>
                </div>
              )}

              {(mode === "signin" || mode === "signup" || mode === "recovery") && (
                <div className="auth-field-password">
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
                        placeholder={
                          mode === "signin"
                            ? t("entry.signin.passwordPlaceholder")
                            : t("entry.newPasswordPlaceholder")
                        }
                        ref={passwordInputRef}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password)
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }}
                        aria-invalid={mode === "signup" && fieldErrors.password ? true : undefined}
                        aria-describedby={
                          mode === "signup"
                            ? fieldErrors.password
                              ? "signup-password-error auth-password-rules"
                              : "auth-password-rules"
                            : undefined
                        }
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
                  {mode === "signup" && fieldErrors.password && (
                    <FieldMessage id="signup-password-error" tone="error" className="mt-1.5">
                      <span role="alert">{fieldErrors.password}</span>
                    </FieldMessage>
                  )}
                  {mode === "signup" && (
                    <PasswordRules
                      id="auth-password-rules"
                      password={password}
                      showErrors={Boolean(fieldErrors.password)}
                      className="mt-2"
                    />
                  )}
                  {mode === "signin" && (
                    <div className="auth-forgot-password">
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
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
                      aria-describedby="auth-password-rules"
                      className={inputClass}
                    />
                  </span>
                </label>
              )}
              {mode === "recovery" && (
                <PasswordRules
                  id="auth-password-rules"
                  password={password}
                  confirm={passwordConfirm}
                  className="-mt-1"
                />
              )}

              {/* Resultado da ação logo acima do botão (no código, ele fica sob as caixas). */}
              {error && !codeStep && <Notice tone="danger" title={error} />}
              {notice && !(mode === "forgot" && whatsappRecovery && otpSent) && (
                <Notice tone={notice.tone} title={notice.text} />
              )}

              <button
                type="submit"
                disabled={busy}
                aria-busy={busy && !googleBusy ? true : undefined}
                className={`${primaryActionClass} mt-1`}
              >
                {busy && !googleBusy && (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                )}
                <span>{busy && !googleBusy ? submit.busy : submit.label}</span>
                {!(busy && !googleBusy) && <SubmitIcon className="size-4" aria-hidden="true" />}
              </button>
              {mode === "verifyPhone" && !phoneUnavailable && (
                <div className="grid justify-items-center gap-1">
                  <ResendButton
                    secondsLeft={phoneResendIn}
                    totalSeconds={PHONE_RESEND_SECONDS}
                    busy={busy}
                    onClick={() => void resendPhoneCode()}
                    label={t("fix2.whats.resend")}
                    waitLabel={t("fix2.whats.resendIn", { seconds: phoneResendIn })}
                    busyLabel={t("fix2.whats.sending")}
                  />
                  {/* Uma só saída: "Confirmar depois" entra no app. Número errado também passa
                      por aqui (a troca é feita em Meu perfil), dito na legenda e não num link
                      com cara de edição local. */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void skipPhoneVerification()}
                    aria-describedby="phone-later-notes"
                    className="entry-link-button text-muted-foreground"
                  >
                    {t("fix3.auth.phoneSkip")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                  <div id="phone-later-notes" className="grid gap-1">
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <UserRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {t("entry.phone.wrongNumber")}
                    </p>
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {t("entry.phone.laterNote")}
                    </p>
                  </div>
                </div>
              )}
            </form>
          )}

          {!resultScreen && (mode === "forgot" || mode === "recovery") && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="entry-link-button w-full text-muted-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("auth.backToSignin")}
            </button>
          )}

          {!resultScreen && mode === "signin" && (
            <>
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span>{t("auth.orContinue")}</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => void handleGoogle()}
                  disabled={busy}
                  className="auth-brand-button auth-google-action flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold text-foreground transition-colors hover:border-foreground/25 hover:bg-muted/50 disabled:opacity-60"
                >
                  {googleBusy ? (
                    <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" />
                  ) : (
                    <GoogleMark />
                  )}
                  {t("auth.google")}
                </button>
                {googleWaiting && (
                  <Notice
                    tone="progress"
                    title={t("entry.google.waitTitle")}
                    action={{ label: t("entry.google.waitClosed"), onClick: stopWaitingGoogle }}
                  />
                )}
                <ConsentNote>
                  {t("auth.terms.before")} {docNames} {t("cad.cliente.terms.age")}
                </ConsentNote>
              </div>
            </>
          )}

          {!resultScreen && mode === "signup" && !effectiveShopRef && (
            <p className="flex flex-wrap items-center justify-center gap-x-1 border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
              {t("cad.cliente.ownerQuestion")}
              <Link to="/cadastrar" className="entry-link-button font-semibold text-primary">
                <Scissors className="size-4" aria-hidden="true" />
                {t("cad.cliente.ownerLink")}
              </Link>
            </p>
          )}

          {(mode === "forgot" || mode === "recovery") && !emailResult && (
            <ConsentNote className="auth-panel-footer">
              {t("auth.terms.before")} {docNames}.
            </ConsentNote>
          )}
          {backTarget && (mode === "signin" || mode === "signup") && (
            <a
              href={backTarget.href}
              className="entry-link-button auth-panel-footer self-center text-muted-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backTarget.label}
            </a>
          )}
          {mode === "signup" && effectiveShopRef && (
            <p className="auth-panel-footer flex flex-wrap items-center justify-center gap-x-1 text-center text-xs text-muted-foreground">
              {t("cad.cliente.ownerQuestion")}
              <Link to="/cadastrar" className="entry-link-button text-xs">
                {t("cad.cliente.ownerLink")}
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
