import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Link2,
  MailCheck,
  MessageCircle,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { shopPublicOrigin } from "@/lib/shop/host";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { friendlyAuthError, readErrorCode, serverError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { DPA_VERSION, PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";
import {
  brPhoneE164,
  looksLikeEmail,
  maskBrPhone,
  slugifyShopName,
} from "@/features/register-owner/owner-signup";
import { clockInTimeZone, detectDeviceTimeZone } from "@/features/register-owner/timezones";
import { TimeZoneSelect, useTimeZoneName } from "@/features/register-owner/TimeZonePicker";

type Step = "dados" | "otp" | "conta";
type Field = "shopName" | "fullName" | "email" | "password" | "whatsapp" | "terms";
type FieldErrors = Partial<Record<Field, string>>;

/** Ordem dos campos na tela: o primeiro com erro recebe o foco. */
const FIELD_ORDER: Field[] = ["shopName", "fullName", "email", "password", "whatsapp", "terms"];

/** Erro do servidor que pertence a um campo: aparece ao lado dele. */
const SERVER_FIELD: Record<string, Field> = {
  invalid_whatsapp: "whatsapp",
  phone_in_use: "whatsapp",
  email_invalid: "email",
  email_in_use: "email",
  password_too_short: "password",
  terms_required: "terms",
};

export const Route = createFileRoute("/cadastrar")({
  ssr: false,
  component: CadastrarPage,
});

async function callRegisterShop(body: Record<string, unknown>) {
  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/register-shop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    error_code?: string;
    message?: string;
    destination?: string;
    verification_token?: string;
    email?: string;
    shop_slug?: string;
  };
  if (!response.ok) throw serverError(payload, tNow("register.failed"));
  return payload;
}

const STEPS: { id: Step; label: MessageKey }[] = [
  { id: "dados", label: "register.step.data" },
  { id: "otp", label: "register.step.whatsapp" },
  { id: "conta", label: "register.step.done" },
];

/** Endereço público da loja sem o "https://", como o dono vê em Ajustes. */
function shopLinkLabel(slug: string) {
  return shopPublicOrigin({ slug }).replace(/^https?:\/\//, "");
}

/** Troca {chave} do texto traduzido por elementos (links dentro da frase). */
function withSlots(text: string, slots: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name && name in slots ? slots[name] : part}</Fragment>;
  });
}

const fieldErrorClass = "m-0 text-[0.8rem] font-semibold leading-snug text-[#a33b2d]";
const chipBase =
  "min-h-11 rounded-[var(--control-radius,0.75rem)] border px-3 py-2 text-sm font-semibold";
// O painel do cadastro é sempre claro (styles.css): cores fixas, não os tokens do tema,
// para o escolhido continuar legível no tema escuro (lá o --primary é quase branco).
const chipOn = "border-[#1c1b18] bg-[#1c1b18] text-[#f4f1ea]";
const chipOff = "border-[color-mix(in_oklch,#1c1b18_14%,transparent)] bg-white text-[#3f3b35]";

function CadastrarPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>("dados");
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  // Padrão "Sim": o número confirmado também vira o WhatsApp público da loja.
  const [shopWhatsappSame, setShopWhatsappSame] = useState(true);
  const [hasSociety, setHasSociety] = useState(false);
  const [societyType, setSocietyType] = useState<"majority" | "equal" | "minority">("majority");
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Fuso da loja: começa pelo do aparelho (a página não roda no servidor: ssr false).
  const [detectedTimeZone] = useState(() => detectDeviceTimeZone());
  const [timeZone, setTimeZone] = useState(detectedTimeZone);
  const [timeZoneOpen, setTimeZoneOpen] = useState(false);
  const timeZoneName = useTimeZoneName();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [otpCode, setOtpCode] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  // WhatsApp já confirmado: o token segue válido no servidor até a conta ser criada.
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [registerFailed, setRegisterFailed] = useState(false);
  // Conta criada: endereço devolvido pelo servidor e se a sessão já abriu.
  const [created, setCreated] = useState<{ slug: string; signedIn: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const stepIndex = created ? STEPS.length : STEPS.findIndex((row) => row.id === step);
  const previewSlug = shopName.trim() ? slugifyShopName(shopName) : "";
  const whatsappE164 = brPhoneE164(whatsapp);

  function clearFieldError(field: Field) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showFieldErrors(errors: FieldErrors) {
    setFieldErrors(errors);
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      window.setTimeout(() => document.getElementById(`cad-${first}`)?.focus(), 0);
    }
  }

  /** Confere cada campo; devolve os erros por campo (vazio = tudo certo). */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!shopName.trim()) errors.shopName = t("cad.dono.errShopName");
    if (fullName.trim().length < 2) errors.fullName = t("cad.dono.errFullName");
    if (!looksLikeEmail(email)) errors.email = t("cad.dono.errEmail");
    if (password.length < 6) errors.password = t("errors.passwordShort");
    if (!whatsapp.trim()) errors.whatsapp = t("register.errorWhatsapp");
    else if (!whatsappE164) errors.whatsapp = t("cad.dono.errWhatsappInvalid");
    if (!termsAccepted) errors.terms = t("cad.dono.errTerms");
    return errors;
  }

  /** Erro do servidor: vai para o campo certo quando houver um; senão, aviso geral. */
  function handleServerError(err: unknown, fallback: MessageKey): boolean {
    const code = readErrorCode(err);
    const field = code ? SERVER_FIELD[code] : undefined;
    if (!field) {
      setError(friendlyAuthError(err, t(fallback)));
      return false;
    }
    setError(null);
    showFieldErrors({
      [field]: code === "terms_required" ? t("cad.dono.errTerms") : friendlyAuthError(err),
    });
    return true;
  }

  async function requestOtp(fromResend = false) {
    if (busy) return;
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError(null);
    setFieldErrors({});
    if (!fromResend) setInfo(null);
    try {
      const number = whatsappE164 ?? whatsapp.trim();
      const payload = await callRegisterShop({
        action: "request",
        destination: number,
      });
      setDestination(payload.destination || number);
      setInfo(t("register.codeSent"));
      setStep("otp");
      setResendIn(60);
    } catch (err) {
      if (handleServerError(err, "register.errorSendCode")) setStep("dados");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (verificationToken) {
      // Dados corrigidos depois de uma falha: reaproveita a confirmação do WhatsApp.
      if (busy) return;
      const errors = validate();
      if (Object.keys(errors).length > 0) {
        showFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      setInfo(t("register.confirmedFinishing"));
      setStep("conta");
      await finishRegister(verificationToken);
      return;
    }
    await requestOtp(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const payload = await callRegisterShop({
        action: "verify",
        destination: destination || whatsappE164 || whatsapp.trim(),
        code: otpCode.trim(),
      });
      if (!payload.verification_token) throw new Error(t("register.errorIncomplete"));
      setVerificationToken(payload.verification_token);
      setInfo(t("register.confirmedFinishing"));
      setStep("conta");
      await finishRegister(payload.verification_token);
    } catch (err) {
      setError(friendlyAuthError(err, t("register.errorInvalidCode")));
      setBusy(false);
    }
  }

  async function finishRegister(token: string) {
    setBusy(true);
    setError(null);
    setRegisterFailed(false);
    try {
      // Campos do aceite e do WhatsApp da loja: o register-shop antigo os ignora.
      const payload = await callRegisterShop({
        action: "register",
        verification_token: token,
        shop_name: shopName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        society_intent: hasSociety ? societyType : "single",
        terms_accepted: termsAccepted,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        dpa_version: DPA_VERSION,
        shop_whatsapp_same: shopWhatsappSame,
        timezone: timeZone,
      });
      const slug = payload.shop_slug || previewSlug;
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: payload.email || email.trim(),
        password,
      });
      setInfo(signError ? t("register.createdSignIn") : null);
      setCreated({ slug, signedIn: !signError });
    } catch (err) {
      setInfo(null);
      if (handleServerError(err, "register.errorCreate")) {
        // Erro de um campo (e-mail já usado, número em outra conta…): volta ao formulário.
        setStep("dados");
        return;
      }
      setRegisterFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyShopLink(slug: string) {
    try {
      await navigator.clipboard.writeText(shopPublicOrigin({ slug }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /** Props comuns de acessibilidade do campo com erro. */
  function fieldA11y(field: Field, hintId?: string) {
    const describedBy = [fieldErrors[field] ? `cad-${field}-error` : null, hintId]
      .filter(Boolean)
      .join(" ");
    return {
      id: `cad-${field}`,
      "aria-invalid": fieldErrors[field] ? true : undefined,
      "aria-describedby": describedBy || undefined,
    } as const;
  }

  function fieldError(field: Field) {
    const message = fieldErrors[field];
    if (!message) return null;
    return (
      <p id={`cad-${field}-error`} className={fieldErrorClass}>
        {message}
      </p>
    );
  }

  const invalidInput = "border-[#a33b2d]";

  const termsSentence = withSlots(t("cad.dono.termsText"), {
    terms: (
      <a
        href={`/termos?lang=${encodeURIComponent(locale)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold underline"
      >
        {t("cad.dono.termsLink")}
        <span className="sr-only"> {t("cad.dono.newTab")}</span>
      </a>
    ),
    privacy: (
      <a
        href={`/privacidade?lang=${encodeURIComponent(locale)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold underline"
      >
        {t("cad.dono.privacyLink")}
        <span className="sr-only"> {t("cad.dono.newTab")}</span>
      </a>
    ),
    dpa: (
      <a
        href={`/acordo-de-dados?lang=${encodeURIComponent(locale)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold underline"
      >
        {t("cad.dono.dpaLink")}
        <span className="sr-only"> {t("cad.dono.newTab")}</span>
      </a>
    ),
  });

  return (
    <main className="platform-register mb-page min-h-dvh text-foreground">
      <div className="platform-register-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      <div className="platform-register-stage">
        <div className="platform-register-top">
          <Link to="/" className="platform-register-back">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("common.back")}
          </Link>
          <LanguageSwitcher buttonClassName="app-icon-button hero-icon-button" />
        </div>

        <div className="platform-register-panel">
          <div className="platform-register-brand">
            <span className="platform-landing-mark" aria-hidden="true">
              <Scissors className="size-5" />
            </span>
            <div>
              <p className="platform-register-brand-name">Barba &amp; Cabelo</p>
              <p className="text-xs text-[#6b675f]">{t("register.subtitle")}</p>
            </div>
          </div>

          <ol className="platform-register-steps" aria-label={t("register.stepsLabel")}>
            {STEPS.map((row, index) => {
              const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
              return (
                <li key={row.id} data-state={state}>
                  <span aria-hidden="true">{index + 1}</span>
                  {t(row.label)}
                </li>
              );
            })}
          </ol>

          <h1 className="platform-register-title">
            {step === "dados" && t("register.title.data")}
            {step === "otp" && t("register.title.otp")}
            {step === "conta" && (created ? t("cad.dono.doneTitle") : t("register.title.done"))}
          </h1>
          <p className="platform-register-lead">
            {step === "dados" && t("register.lead.data")}
            {step === "otp" && t("register.lead.otp")}
            {step === "conta" && (created ? t("cad.dono.doneLead") : t("register.lead.done"))}
          </p>

          {step === "dados" && (
            <form onSubmit={sendCode} className="platform-register-form" noValidate>
              <div className="grid gap-1.5">
                <label className="platform-register-label" htmlFor="cad-shopName">
                  {t("register.shopName")}
                </label>
                <input
                  {...fieldA11y("shopName", previewSlug ? "cad-shopName-link" : undefined)}
                  required
                  value={shopName}
                  onChange={(e) => {
                    setShopName(e.target.value);
                    clearFieldError("shopName");
                  }}
                  className={`platform-register-input ${fieldErrors.shopName ? invalidInput : ""}`}
                  placeholder={t("register.shopNamePlaceholder")}
                />
                {fieldError("shopName")}
                {previewSlug && (
                  <div id="cad-shopName-link" className="grid gap-0.5" aria-live="polite">
                    <p className="m-0 flex items-start gap-1.5 text-[0.8rem] text-[#3f3b35]">
                      <Link2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="break-all">
                        {withSlots(t("cad.dono.linkPreview"), {
                          link: <strong>{shopLinkLabel(previewSlug)}</strong>,
                        })}
                      </span>
                    </p>
                    <p className="m-0 text-xs text-[#6b675f]">{t("cad.dono.linkHint")}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-1.5">
                <label className="platform-register-label" htmlFor="cad-fullName">
                  {t("register.fullName")}
                </label>
                <input
                  {...fieldA11y("fullName")}
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearFieldError("fullName");
                  }}
                  className={`platform-register-input ${fieldErrors.fullName ? invalidInput : ""}`}
                  placeholder={t("register.fullNamePlaceholder")}
                />
                {fieldError("fullName")}
              </div>

              <div className="grid gap-1.5">
                <label className="platform-register-label" htmlFor="cad-email">
                  {t("register.email")}
                </label>
                <input
                  {...fieldA11y("email", looksLikeEmail(email) ? "cad-email-check" : undefined)}
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  className={`platform-register-input ${fieldErrors.email ? invalidInput : ""}`}
                />
                {fieldError("email")}
                {looksLikeEmail(email) && !fieldErrors.email && (
                  <p
                    id="cad-email-check"
                    className="m-0 flex items-start gap-1.5 text-[0.8rem] text-[#3f3b35]"
                  >
                    <MailCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="break-all">
                      {withSlots(t("cad.dono.emailCheck"), {
                        email: <strong>{email.trim().toLowerCase()}</strong>,
                      })}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <label className="platform-register-label" htmlFor="cad-password">
                  {t("register.password")}
                </label>
                <div className="relative">
                  <input
                    {...fieldA11y("password")}
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                    }}
                    className={`platform-register-input pr-14 ${
                      fieldErrors.password ? invalidInput : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-1 my-auto flex size-11 items-center justify-center rounded-[var(--button-radius,0.75rem)] text-[#5f5a52] hover:bg-black/5"
                    aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                    aria-pressed={showPassword}
                    aria-controls="cad-password"
                  >
                    {showPassword ? (
                      <EyeOff className="size-[18px]" aria-hidden="true" />
                    ) : (
                      <Eye className="size-[18px]" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldError("password")}
              </div>

              <div className="grid gap-1.5">
                <label className="platform-register-label" htmlFor="cad-whatsapp">
                  {t("register.whatsapp")}
                </label>
                <input
                  {...fieldA11y("whatsapp", "cad-whatsapp-note")}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(maskBrPhone(e.target.value));
                    clearFieldError("whatsapp");
                    // Outro número precisa de outro código.
                    setVerificationToken(null);
                  }}
                  onBlur={() => {
                    if (whatsapp.trim() && !brPhoneE164(whatsapp)) {
                      setFieldErrors((current) => ({
                        ...current,
                        whatsapp: t("cad.dono.errWhatsappInvalid"),
                      }));
                    }
                  }}
                  className={`platform-register-input ${fieldErrors.whatsapp ? invalidInput : ""}`}
                  placeholder="(11) 99999-0000"
                />
                {fieldError("whatsapp")}
                <p id="cad-whatsapp-note" className="platform-register-note">
                  <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  {t("register.whatsappNote")}
                </p>
              </div>

              <fieldset className="grid gap-2">
                <legend className="platform-register-label mb-1.5">
                  {t("cad.dono.shopWhatsappQuestion")}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={shopWhatsappSame}
                    onClick={() => setShopWhatsappSame(true)}
                    className={`${chipBase} ${shopWhatsappSame ? chipOn : chipOff}`}
                  >
                    {t("cad.dono.shopWhatsappYes")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={!shopWhatsappSame}
                    onClick={() => setShopWhatsappSame(false)}
                    className={`${chipBase} ${!shopWhatsappSame ? chipOn : chipOff}`}
                  >
                    {t("cad.dono.shopWhatsappNo")}
                  </button>
                </div>
                <p className="m-0 text-xs text-[#6b675f]" aria-live="polite">
                  {shopWhatsappSame
                    ? t("cad.dono.shopWhatsappYesHint")
                    : t("cad.dono.shopWhatsappNoHint")}
                </p>
              </fieldset>

              <div className="grid gap-1.5">
                <p
                  id="cad-timezone-summary"
                  className="m-0 flex items-start gap-x-1.5 text-[0.85rem] text-[#3f3b35]"
                  aria-live="polite"
                >
                  <Clock className="mt-[0.2rem] size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {withSlots(t("dec.tz.signupLine"), {
                      zone: <strong>{timeZoneName(timeZone)}</strong>,
                    })}
                    {!timeZoneOpen && " "}
                    {!timeZoneOpen && (
                      <button
                        type="button"
                        aria-expanded={false}
                        aria-controls="cad-timezone"
                        onClick={() => {
                          setTimeZoneOpen(true);
                          // O botão some ao abrir: leva o foco para o seletor, sem perdê-lo.
                          window.requestAnimationFrame(() =>
                            document.getElementById("cad-timezone")?.focus(),
                          );
                        }}
                        className="platform-register-linkish -my-3 inline-flex items-center align-baseline"
                      >
                        {t("dec.tz.change")}
                      </button>
                    )}
                  </span>
                </p>
                {timeZoneOpen && (
                  <div className="grid gap-1.5">
                    <label className="platform-register-label" htmlFor="cad-timezone">
                      {t("dec.tz.label")}
                    </label>
                    <TimeZoneSelect
                      id="cad-timezone"
                      value={timeZone}
                      onChange={setTimeZone}
                      keep={[detectedTimeZone]}
                      describedBy="cad-timezone-hint"
                      className="platform-register-input"
                    />
                    <p id="cad-timezone-hint" className="m-0 text-xs text-[#6b675f]">
                      {t("dec.tz.signupHint", { time: clockInTimeZone(timeZone) })}
                    </p>
                  </div>
                )}
              </div>

              <fieldset className="grid gap-2">
                <legend className="platform-register-label mb-1.5">{t("register.society")}</legend>
                {!hasSociety ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm text-[#3f3b35]">{t("cad.dono.societySummary")}</p>
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-controls="cad-society-options"
                      onClick={() => setHasSociety(true)}
                      className={`${chipBase} ${chipOff}`}
                    >
                      {t("cad.dono.societyOpen")}
                    </button>
                  </div>
                ) : (
                  <div id="cad-society-options" className="grid gap-2">
                    <p className="m-0 text-xs text-[#6b675f]">{t("register.societyHint")}</p>
                    {(
                      [
                        {
                          id: "majority" as const,
                          label: t("register.society.majority"),
                          hint: t("register.society.majorityHint"),
                        },
                        {
                          id: "equal" as const,
                          label: t("register.society.equal"),
                          hint: t("register.society.equalHint"),
                        },
                        {
                          id: "minority" as const,
                          label: t("register.society.minority"),
                          hint: t("register.society.minorityHint"),
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={societyType === option.id}
                        onClick={() => setSocietyType(option.id)}
                        className={`flex min-h-11 w-full flex-col rounded-[var(--control-radius,0.75rem)] border px-3 py-2 text-left ${
                          societyType === option.id
                            ? "border-[#1c1b18] bg-[#f1ede4] text-[#171512] ring-1 ring-[#1c1b18]"
                            : chipOff
                        }`}
                      >
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="text-xs text-[#5f5a52]">{option.hint}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-expanded
                      aria-controls="cad-society-options"
                      onClick={() => setHasSociety(false)}
                      className="platform-register-linkish justify-self-start"
                    >
                      {t("cad.dono.societyClose")}
                    </button>
                  </div>
                )}
              </fieldset>

              <div className="grid gap-1.5">
                <div
                  className={`flex items-start gap-3 rounded-[var(--control-radius,0.75rem)] border bg-white p-3 ${
                    fieldErrors.terms
                      ? "border-[#a33b2d]"
                      : "border-[color-mix(in_oklch,#1c1b18_14%,transparent)]"
                  }`}
                >
                  <input
                    {...fieldA11y("terms")}
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      clearFieldError("terms");
                    }}
                    className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[#1c1b18]"
                  />
                  <label
                    htmlFor="cad-terms"
                    className="cursor-pointer text-[0.85rem] leading-snug text-[#1c1b18]"
                  >
                    {termsSentence}
                  </label>
                </div>
                {fieldError("terms")}
              </div>

              <button
                type="submit"
                disabled={busy || !termsAccepted}
                aria-describedby={!termsAccepted ? "cad-terms-needed" : undefined}
                className="platform-register-submit"
              >
                {verificationToken
                  ? busy
                    ? t("register.creating")
                    : t("register.confirm")
                  : busy
                    ? t("register.sending")
                    : t("register.sendCode")}
              </button>
              {!termsAccepted && (
                <p id="cad-terms-needed" className="m-0 text-center text-xs text-[#6b675f]">
                  {t("cad.dono.termsNeeded")}
                </p>
              )}
              {verificationToken && (
                <button
                  type="button"
                  disabled={busy}
                  className="platform-register-linkish min-h-11"
                  onClick={() => {
                    setVerificationToken(null);
                    void requestOtp(false);
                  }}
                >
                  {t("register.resend")}
                </button>
              )}
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyCode} className="platform-register-form">
              <p className="platform-register-otp-dest">
                {t("register.codeSentTo")}{" "}
                <span className="font-semibold text-[#171512]">{maskBrPhone(destination)}</span>
              </p>
              <p className="m-0 flex items-start gap-1.5 text-[0.8rem] text-[#3f3b35]">
                <MailCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="break-all">
                  {withSlots(t("cad.dono.otpEmailCheck"), {
                    email: <strong>{email.trim().toLowerCase()}</strong>,
                  })}
                </span>
              </p>
              <label className="platform-register-label">
                {t("register.otp")}
                <input
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="platform-register-input platform-register-otp"
                  autoComplete="one-time-code"
                />
              </label>
              <button
                type="submit"
                disabled={busy || otpCode.length !== 6}
                className="platform-register-submit"
              >
                {busy ? t("register.confirming") : t("register.confirm")}
              </button>
              <button
                type="button"
                disabled={busy || resendIn > 0}
                className="platform-register-linkish min-h-11"
                onClick={() => void requestOtp(true)}
              >
                {resendIn > 0
                  ? t("register.resendIn", { seconds: resendIn })
                  : t("register.resend")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="platform-register-linkish min-h-11"
                onClick={() => {
                  setStep("dados");
                  setOtpCode("");
                  setResendIn(0);
                }}
              >
                {t("register.backToData")}
              </button>
            </form>
          )}

          {step === "conta" && !created && (
            <div className="platform-register-finishing" role="status">
              <ShieldCheck className="size-8 text-gold" aria-hidden="true" />
              <p>{busy ? t("register.creating") : info}</p>
              {!busy && registerFailed && (
                <div className="mt-2 flex w-full flex-col gap-2">
                  {verificationToken && (
                    <button
                      type="button"
                      className="platform-register-submit"
                      onClick={() => void finishRegister(verificationToken)}
                    >
                      {t("common.retry")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="platform-register-linkish min-h-11"
                    onClick={() => {
                      setError(null);
                      setRegisterFailed(false);
                      setStep("dados");
                    }}
                  >
                    {t("register.backToData")}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "conta" && created && (
            <div className="platform-register-finishing" role="status">
              <ShieldCheck className="size-8 text-gold" aria-hidden="true" />
              {created.slug && (
                <div className="grid w-full gap-2 rounded-[var(--control-radius,0.75rem)] border border-[color-mix(in_oklch,#1c1b18_14%,transparent)] bg-white p-3 text-left">
                  <p className="m-0 text-xs font-bold text-[#3f3b35]">{t("cad.dono.yourLink")}</p>
                  <p className="m-0 break-all text-sm font-semibold text-[#171512]">
                    {shopLinkLabel(created.slug)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyShopLink(created.slug)}
                    className={`${chipBase} ${chipOff} flex items-center justify-center gap-2`}
                  >
                    {copied ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                    {t(copied ? "landingEditor.copied" : "landingEditor.copy")}
                  </button>
                </div>
              )}
              {info && <p className="m-0">{info}</p>}
              {created.signedIn ? (
                <button
                  type="button"
                  className="platform-register-submit"
                  onClick={() => void navigate({ to: "/shop" })}
                >
                  {t("cad.dono.openPanel")}
                </button>
              ) : (
                <button
                  type="button"
                  className="platform-register-submit"
                  onClick={() => void navigate({ to: "/auth", search: { next: "/shop" } })}
                >
                  {t("register.signin")}
                </button>
              )}
            </div>
          )}

          {info && step !== "conta" && (
            <p className="platform-register-info" role="status">
              {info}
            </p>
          )}
          {error && (
            <p className="platform-register-error" role="alert">
              {error}
            </p>
          )}

          {!created && (
            <p className="platform-register-footer">
              {t("register.haveAccount")}{" "}
              <Link to="/auth" search={{ next: "/shop" }}>
                {t("register.signin")}
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
