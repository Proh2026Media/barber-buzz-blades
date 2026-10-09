import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Hourglass,
  Loader2,
  Mail,
  MessageCircle,
  Palette,
  RotateCcw,
  Scissors,
  Store,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  announce,
  ChoiceCards,
  CopyField,
  FieldMessage,
  Hint,
  IconList,
  IconTile,
  Notice,
  StatusBadge,
  Steps,
  type StepItem,
} from "@/components/visual";
import {
  CodeInput,
  CodeSentCard,
  LegalDocLinks,
  LinkPill,
  MissingChecklist,
  PasswordRules,
  ResendButton,
  ResultHero,
  SharePie,
  type MissingItem,
} from "@/features/auth/entry";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
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

/** Barbearia → Seu acesso → Código no WhatsApp → Pronto (o código só é pedido no fim). */
type Step = "loja" | "acesso" | "otp" | "conta";
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
  const response = await guardedFetch(`${base}/functions/v1/register-shop`, {
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
  { id: "loja", label: "entry.cad.step.shop" },
  { id: "acesso", label: "entry.cad.step.access" },
  { id: "otp", label: "register.step.whatsapp" },
  { id: "conta", label: "register.step.done" },
];

/**
 * Itens do guia do painel mostrados como "o que vem depois" quando a barbearia é criada. O
 * "Copiar o link" do guia fica de fora: o link com Copiar/Enviar aparece logo acima.
 */
const NEXT_STEPS: { key: MessageKey; icon: LucideIcon }[] = [
  { key: "cad.guia.hoursTitle", icon: Clock },
  { key: "cad.guia.serviceTitle", icon: Scissors },
  { key: "cad.guia.contactTitle", icon: MessageCircle },
  { key: "cad.guia.brandTitle", icon: Palette },
];

/** Troca {chave} do texto traduzido por elementos (links dentro da frase). */
function withSlots(text: string, slots: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/g).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{name && name in slots ? slots[name] : part}</Fragment>;
  });
}

function CadastrarPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("loja");
  const titleRef = useRef<HTMLSpanElement>(null);
  const firstStepRender = useRef(true);
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

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // Nova etapa: o foco vai para o título, que diz onde a pessoa está (leitor de tela e teclado).
  const isCreated = created !== null;
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    (document.getElementById("cad-result-title") ?? titleRef.current)?.focus({
      preventScroll: true,
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [step, isCreated]);

  const stepIndex = created ? STEPS.length : STEPS.findIndex((row) => row.id === step);
  const previewSlug = shopName.trim() ? slugifyShopName(shopName) : "";
  const whatsappE164 = brPhoneE164(whatsapp);
  const creating = step === "conta" && !created && !registerFailed;
  // Volta a uma etapa feita (pelos círculos ou pelo "Etapa anterior"), mantendo os campos.
  const canGoBack = !busy && !created && (step !== "conta" || registerFailed);

  function goToStep(next: Step) {
    if (!canGoBack) return;
    setError(null);
    setInfo(null);
    if (step === "otp" || step === "conta") {
      setOtpCode("");
      setResendIn(0);
      setRegisterFailed(false);
    }
    setStep(next);
  }

  const flowSteps: StepItem[] = STEPS.map((row, index) => ({
    key: row.id,
    label: t(row.label),
    status:
      index < stepIndex
        ? "done"
        : index === stepIndex
          ? registerFailed && row.id === "conta"
            ? "error"
            : // Enquanto cria, "Pronto" ainda não chegou: só vira feito com a barbearia criada.
              creating && row.id === "conta"
              ? "upcoming"
              : "current"
          : "upcoming",
  }));

  const missing: MissingItem[] = [
    {
      key: "fullName",
      label: t("register.fullName"),
      done: fullName.trim().length >= 2,
      targetId: "cad-fullName",
    },
    {
      key: "email",
      label: t("register.email"),
      done: looksLikeEmail(email),
      targetId: "cad-email",
    },
    {
      key: "password",
      label: t("register.password"),
      done: password.length >= 6,
      targetId: "cad-password",
    },
    {
      key: "whatsapp",
      label: t("auth.channel.whatsapp"),
      done: Boolean(whatsappE164),
      targetId: "cad-whatsapp",
    },
    {
      key: "terms",
      label: t("entry.cad.missingTerms"),
      done: termsAccepted,
      targetId: "cad-terms",
    },
  ];
  const errorCount = Object.keys(fieldErrors).length;

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
      // O nome da barbearia fica na primeira etapa; os demais campos, em "Seu acesso".
      setStep(first === "shopName" ? "loja" : "acesso");
      window.setTimeout(() => {
        const field = document.getElementById(`cad-${first}`);
        field?.scrollIntoView({ block: "center" });
        field?.focus({ preventScroll: true });
      }, 60);
    }
  }

  /** "Continuar" da etapa Barbearia: só confere o nome, no aparelho. */
  function continueToAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!shopName.trim()) {
      showFieldErrors({ shopName: t("cad.dono.errShopName") });
      return;
    }
    clearFieldError("shopName");
    setStep("acesso");
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
      // O número e o exemplo da mensagem aparecem no cartão do código; aqui só o anúncio.
      announce(t("register.codeSent"));
      setStep("otp");
      setResendIn(60);
    } catch (err) {
      // Erro de um campo leva de volta a ele (showFieldErrors troca a etapa).
      handleServerError(err, "register.errorSendCode");
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
        // Erro de um campo (e-mail já usado, número em outra conta…): showFieldErrors volta
        // à etapa do campo.
        return;
      }
      setRegisterFailed(true);
    } finally {
      setBusy(false);
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
      <FieldMessage id={`cad-${field}-error`} tone="error">
        {message}
      </FieldMessage>
    );
  }

  // Frase do aceite igual à de sempre, com os nomes em texto: os links ficam nas pílulas abaixo.
  const termsSentence = withSlots(t("cad.dono.termsText"), {
    terms: <strong className="font-semibold">{t("cad.dono.termsLink")}</strong>,
    privacy: <strong className="font-semibold">{t("cad.dono.privacyLink")}</strong>,
    dpa: <strong className="font-semibold">{t("cad.dono.dpaLink")}</strong>,
  });

  const zoneName = timeZoneName(timeZone);
  const backLabel = step === "loja" ? t("entry.back.home") : t("entry.cad.prevStep");
  const previousStep: Step | null =
    step === "acesso" ? "loja" : step === "otp" || step === "conta" ? "acesso" : null;

  const titleText =
    step === "loja"
      ? t("entry.cad.shopTitle")
      : step === "acesso"
        ? t("entry.cad.accessTitle")
        : t("register.title.otp");

  /** Botão principal com ícone que diz o efeito e o verbo no gerúndio enquanto espera. */
  function submitContent(label: string, busyLabel: string, Icon: typeof ArrowRight) {
    return busy ? (
      <>
        <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
        {busyLabel}
      </>
    ) : (
      <>
        <Icon aria-hidden="true" />
        {label}
      </>
    );
  }

  // Resumo ao vivo (computador): o que já foi preenchido, ligado ao efeito na página.
  const summary = (
    <div className="entry-result-card grid gap-3 p-4 text-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {t("entry.cad.summaryTitle")}
      </p>
      {shopName.trim() ? (
        <>
          <p className="flex items-center gap-2 text-lg font-bold">
            <Store className="size-5 shrink-0 text-gold" aria-hidden="true" />
            {shopName.trim()}
          </p>
          {previewSlug && <LinkPill url={shopPublicOrigin({ slug: previewSlug })} />}
          <p className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4 shrink-0 text-gold" aria-hidden="true" />
            {clockInTimeZone(timeZone)} · {zoneName}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            {hasSociety ? (
              <Users className="size-4 shrink-0 text-gold" aria-hidden="true" />
            ) : (
              <UserRound className="size-4 shrink-0 text-gold" aria-hidden="true" />
            )}
            {hasSociety ? t("entry.cad.partners") : t("entry.cad.solo")}
          </p>
          {whatsappE164 && shopWhatsappSame && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="size-4 shrink-0 text-gold" aria-hidden="true" />
              {maskBrPhone(whatsapp)}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">{t("entry.cad.summaryEmpty")}</p>
      )}
    </div>
  );

  return (
    <main className="platform-register mb-page min-h-dvh text-foreground">
      <div className="platform-register-photo" aria-hidden="true">
        <img src={DEFAULT_LOGIN_IMAGE} alt="" />
        <span />
      </div>

      <div className="platform-register-stage">
        <div className="platform-register-top">
          {step === "loja" ? (
            <Link to="/" className="platform-register-back">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backLabel}
            </Link>
          ) : previousStep && canGoBack ? (
            <button
              type="button"
              className="platform-register-back"
              onClick={() => goToStep(previousStep)}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backLabel}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <LanguageSwitcher buttonClassName="app-icon-button hero-icon-button" />
        </div>

        <div className="entry-cad-layout">
          <aside className="entry-cad-aside" aria-label={t("entry.cad.summaryTitle")}>
            <p className="text-3xl font-extrabold leading-tight tracking-tight text-[#faf8f4]">
              {t("register.subtitle")}
            </p>
            {!created && summary}
          </aside>

          <div className="platform-register-panel">
            <div className="platform-register-brand">
              <span className="platform-landing-mark" aria-hidden="true">
                <Scissors className="size-5" />
              </span>
              <div>
                <p className="platform-register-brand-name">Barba &amp; Cabelo</p>
                <p className="text-xs text-muted-foreground">{t("register.subtitle")}</p>
              </div>
            </div>

            {/* Abaixo de 360 px os nomes das 4 etapas não cabem sem quebrar a palavra: mostra
                só os círculos e "Etapa 2 de 4 · Acesso". */}
            {[true, false].map((compact) => (
              <Steps
                key={compact ? "compact" : "full"}
                compact={compact}
                steps={flowSteps}
                label={t("entry.cad.stepsLabel")}
                onStepClick={
                  canGoBack
                    ? (index) => {
                        const target = STEPS[index]?.id;
                        if (target === "loja" || target === "acesso") goToStep(target);
                      }
                    : undefined
                }
                className={compact ? "mb-5 min-[360px]:hidden" : "mb-5 hidden min-[360px]:block"}
              />
            ))}

            {step !== "conta" && (
              <div className="flex items-start gap-3">
                <IconTile
                  icon={step === "loja" ? Store : step === "acesso" ? UserRound : MessageCircle}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="platform-register-title">
                    <span ref={titleRef} tabIndex={-1} className="outline-none">
                      {titleText}
                    </span>
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {step === "loja"
                      ? t("entry.cad.shopLead")
                      : step === "acesso"
                        ? t("entry.cad.accessLead")
                        : t("register.lead.otp")}
                  </p>
                </div>
              </div>
            )}

            {step === "loja" && (
              <form onSubmit={continueToAccess} className="platform-register-form" noValidate>
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
                    className="platform-register-input"
                    placeholder={t("register.shopNamePlaceholder")}
                  />
                  {fieldError("shopName")}
                  {previewSlug && (
                    <LinkPill
                      id="cad-shopName-link"
                      url={shopPublicOrigin({ slug: previewSlug })}
                      label={t("entry.cad.linkLabel")}
                      note={withSlots(t("entry.cad.linkNote"), {
                        slug: (
                          <strong className="font-semibold text-foreground [overflow-wrap:anywhere]">
                            {previewSlug}-2
                          </strong>
                        ),
                      })}
                    />
                  )}
                </div>

                <div className="grid gap-1.5">
                  <p className="platform-register-label">{t("entry.cad.clockLabel")}</p>
                  <div
                    id="cad-timezone-summary"
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white px-3 py-1.5 text-sm"
                    aria-live="polite"
                  >
                    <Clock className="size-4 shrink-0 text-gold" aria-hidden="true" />
                    <span className="font-bold tabular-nums">{clockInTimeZone(timeZone)}</span>
                    <span className="min-w-0 flex-1 text-muted-foreground">{zoneName}</span>
                    {!timeZoneOpen && (
                      <button
                        type="button"
                        aria-expanded={false}
                        aria-controls="cad-timezone"
                        aria-label={`${t("entry.cad.change")}: ${t("dec.tz.label")}`}
                        onClick={() => {
                          setTimeZoneOpen(true);
                          // O botão some ao abrir: leva o foco para o seletor, sem perdê-lo.
                          window.requestAnimationFrame(() =>
                            document.getElementById("cad-timezone")?.focus(),
                          );
                        }}
                        className="entry-link-button -me-1"
                      >
                        {t("entry.cad.change")}
                      </button>
                    )}
                  </div>
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
                      <p id="cad-timezone-hint" className="m-0 text-xs text-muted-foreground">
                        {t("dec.tz.signupHint", { time: clockInTimeZone(timeZone) })}
                      </p>
                    </div>
                  )}
                </div>

                <ChoiceCards
                  legend={t("entry.cad.ownersLegend")}
                  showLegend
                  columns={2}
                  value={hasSociety ? "partners" : "solo"}
                  onChange={(value) => setHasSociety(value === "partners")}
                  options={[
                    {
                      value: "solo",
                      title: t("entry.cad.solo"),
                      description: t("entry.cad.soloText"),
                      icon: UserRound,
                    },
                    {
                      value: "partners",
                      title: t("entry.cad.partners"),
                      description: t("entry.cad.partnersText"),
                      icon: Users,
                    },
                  ]}
                />
                {hasSociety && (
                  <div id="cad-society-options" className="grid gap-2">
                    <ChoiceCards
                      legend={t("entry.cad.splitLegend")}
                      showLegend
                      columns={1}
                      value={societyType}
                      onChange={setSocietyType}
                      options={(
                        [
                          ["majority", 0.7, "entry.cad.majority", "entry.cad.majorityText"],
                          ["equal", 0.5, "entry.cad.equal", "entry.cad.equalText"],
                          ["minority", 0.3, "entry.cad.minority", "entry.cad.minorityText"],
                        ] as const
                      ).map(([value, share, title, text]) => ({
                        value,
                        title: t(title),
                        description: t(text),
                        media: <SharePie share={share} />,
                      }))}
                    />
                    <Hint icon={Users}>{t("entry.cad.inviteLater")}</Hint>
                  </div>
                )}

                <button type="submit" className="action-button action-confirm entry-submit">
                  {t("entry.cad.continue")}
                  <ArrowRight aria-hidden="true" />
                </button>
              </form>
            )}

            {step === "acesso" && (
              <form onSubmit={sendCode} className="platform-register-form" noValidate>
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
                    className="platform-register-input"
                    placeholder={t("register.fullNamePlaceholder")}
                  />
                  {fieldError("fullName")}
                </div>

                <div className="grid gap-1.5">
                  <label className="platform-register-label" htmlFor="cad-email">
                    {t("register.email")}
                  </label>
                  <div className="relative">
                    <input
                      {...fieldA11y("email")}
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
                      className="platform-register-input pr-11"
                      placeholder={t("auth.field.emailPlaceholder")}
                    />
                    {looksLikeEmail(email) && !fieldErrors.email && (
                      <CheckCircle2
                        className="tone-success pointer-events-none absolute inset-y-0 right-3 my-auto size-5 text-[color:var(--tone-ink)]"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  {fieldError("email")}
                </div>

                <div className="grid gap-1.5">
                  <label className="platform-register-label" htmlFor="cad-password">
                    {t("register.password")}
                  </label>
                  <div className="relative">
                    <input
                      {...fieldA11y("password", "cad-password-rules")}
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={6}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError("password");
                      }}
                      className="platform-register-input pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-1 my-auto flex size-11 items-center justify-center rounded-[var(--button-radius,0.75rem)] text-muted-foreground hover:bg-black/5"
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
                  <PasswordRules
                    id="cad-password-rules"
                    password={password}
                    showErrors={Boolean(fieldErrors.password)}
                  />
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
                    className="platform-register-input"
                    placeholder="(11) 99999-0000"
                  />
                  {fieldError("whatsapp")}
                  <p id="cad-whatsapp-note" className="platform-register-note">
                    <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    {t("register.whatsappNote")}
                  </p>
                </div>

                <ChoiceCards
                  legend={t("cad.dono.shopWhatsappQuestion")}
                  showLegend
                  columns={2}
                  className="min-w-0"
                  value={shopWhatsappSame ? "same" : "later"}
                  onChange={(value) => setShopWhatsappSame(value === "same")}
                  options={[
                    {
                      value: "same",
                      title: t("entry.cad.shopWhatsYes"),
                      description: t("cad.dono.shopWhatsappYesHint"),
                      icon: MessageCircle,
                      // Sem nowrap/truncate: o número desce de linha em vez de alargar o
                      // formulário (o min-content da prévia empurrava os campos para fora).
                      content: (
                        <span
                          className="inline-flex max-w-full items-start gap-1.5 rounded-xl bg-[#15803d] px-3 py-1.5 text-xs font-semibold text-white"
                          aria-hidden="true"
                        >
                          <MessageCircle className="mt-px size-3.5 shrink-0" />
                          <span className="flex min-w-0 flex-wrap gap-x-1">
                            <span>{t("entry.cad.whatsButton")}</span>
                            {whatsappE164 && (
                              <span className="whitespace-nowrap tabular-nums">
                                · {maskBrPhone(whatsapp)}
                              </span>
                            )}
                          </span>
                        </span>
                      ),
                    },
                    {
                      value: "later",
                      title: t("entry.cad.shopWhatsNo"),
                      description: t("entry.cad.whatsLater"),
                      icon: Hourglass,
                    },
                  ]}
                />

                <div className="grid gap-2">
                  <div
                    className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
                      fieldErrors.terms ? "border-destructive" : "border-border"
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
                      className="cursor-pointer text-[0.85rem] leading-snug text-foreground"
                    >
                      {termsSentence}
                    </label>
                  </div>
                  {fieldError("terms")}
                  <LegalDocLinks withDpa />
                </div>

                {errorCount > 0 ? (
                  <Notice
                    tone="danger"
                    title={
                      errorCount === 1
                        ? t("entry.cad.fixOne")
                        : t("entry.cad.fixMany", { count: errorCount })
                    }
                  />
                ) : (
                  <MissingChecklist items={missing} doneText={t("entry.cad.allSet")} />
                )}
                {error && <Notice tone="danger" title={error} />}

                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy || undefined}
                  className="action-button action-confirm entry-submit"
                >
                  {verificationToken
                    ? submitContent(t("entry.cad.create"), t("register.creating"), CheckCircle2)
                    : submitContent(t("entry.cad.sendCode"), t("register.sending"), MessageCircle)}
                </button>
                {verificationToken && (
                  <button
                    type="button"
                    disabled={busy}
                    className="entry-link-button"
                    onClick={() => {
                      setVerificationToken(null);
                      void requestOtp(false);
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t("fix2.whats.resend")}
                  </button>
                )}
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={verifyCode} className="platform-register-form">
                <CodeSentCard
                  toLabel={t("entry.code.sentTo")}
                  number={maskBrPhone(destination)}
                  sender="Barba & Cabelo"
                  message={t("entry.code.example")}
                  exampleLabel={t("entry.example")}
                  hideExample={otpCode.length > 0}
                >
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Mail className="mt-px size-3.5 shrink-0 text-gold" aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {withSlots(t("cad.dono.otpEmailCheck"), {
                        email: (
                          <strong className="text-foreground">{email.trim().toLowerCase()}</strong>
                        ),
                      })}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    className="entry-link-button -ms-2 text-xs"
                    onClick={() => goToStep("acesso")}
                  >
                    {t("entry.cad.wrongNumberBack")}
                  </button>
                </CodeSentCard>
                <div className="grid gap-2">
                  <label className="platform-register-label" htmlFor="cad-otp">
                    {t("register.otp")}
                  </label>
                  <CodeInput
                    id="cad-otp"
                    value={otpCode}
                    onChange={(value) => {
                      setOtpCode(value);
                      setError(null);
                    }}
                    autoFocus
                    invalid={Boolean(error)}
                    describedBy={error ? "cad-otp-error" : undefined}
                  />
                  {error && <Notice id="cad-otp-error" tone="danger" title={error} />}
                </div>
                <button
                  type="submit"
                  disabled={busy || otpCode.length !== 6}
                  aria-busy={busy || undefined}
                  className="action-button action-confirm entry-submit"
                >
                  {submitContent(t("entry.cad.create"), t("register.confirming"), CheckCircle2)}
                </button>
                <ResendButton
                  className="justify-self-center"
                  secondsLeft={resendIn}
                  totalSeconds={60}
                  busy={busy}
                  onClick={() => void requestOtp(true)}
                  label={t("fix2.whats.resend")}
                  waitLabel={t("fix2.whats.resendIn", { seconds: resendIn })}
                  busyLabel={t("fix2.whats.sending")}
                />
              </form>
            )}

            {creating && (
              <section className="grid gap-5" aria-busy="true">
                <ResultHero
                  id="cad-result-title"
                  tone="progress"
                  title={t("entry.cad.creatingTitle")}
                />
                <Steps
                  orientation="vertical"
                  label={t("entry.cad.stepsLabel")}
                  className="rounded-2xl border border-border bg-white/70 p-4"
                  steps={[
                    { key: "ok", label: t("entry.cad.stepConfirmed"), status: "done" },
                    { key: "shop", label: t("entry.cad.stepCreating"), status: "current" },
                    { key: "enter", label: t("entry.cad.stepEnter"), status: "upcoming" },
                  ]}
                />
              </section>
            )}

            {step === "conta" && !created && registerFailed && (
              <section className="grid gap-4">
                <ResultHero id="cad-result-title" tone="danger" title={t("entry.cad.failTitle")}>
                  {/* A frase genérica repete o título: só mostra o motivo quando há um. */}
                  {error && error !== t("register.errorCreate") ? error : null}
                </ResultHero>
                {verificationToken && (
                  <StatusBadge
                    tone="success"
                    className="justify-self-center"
                    label={t("entry.cad.failKeep")}
                  />
                )}
                <div className="grid gap-2">
                  {verificationToken && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-busy={busy || undefined}
                      className="action-button action-confirm entry-submit"
                      onClick={() => void finishRegister(verificationToken)}
                    >
                      {submitContent(t("visual.retry"), t("register.creating"), RotateCcw)}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    className="entry-link-button"
                    onClick={() => goToStep("acesso")}
                  >
                    {t("entry.cad.fixData")}
                  </button>
                </div>
              </section>
            )}

            {step === "conta" && created && (
              <section className="grid gap-5">
                <ResultHero id="cad-result-title" tone="success" title={t("cad.dono.doneTitle")}>
                  {shopName.trim()}
                </ResultHero>
                {created.slug && (
                  // O CopyField já quebra o endereço só depois de "/", "." e "-".
                  <CopyField
                    value={shopPublicOrigin({ slug: created.slug })}
                    label={t("cad.dono.yourLink")}
                    shareTitle={shopName.trim()}
                  />
                )}
                {/* O que vem no painel: lista com ícone (não são botões); copiar o link já
                    está logo acima. */}
                <div className="grid gap-2">
                  <p className="text-sm font-bold" aria-hidden="true">
                    {t("entry.cad.nextTitle")}
                  </p>
                  <IconList
                    label={t("entry.cad.nextTitle")}
                    size="md"
                    items={NEXT_STEPS.map((row) => ({
                      key: row.key,
                      icon: row.icon,
                      text: t(row.key),
                    }))}
                  />
                </div>
                {info && <Notice tone="info" title={info} />}
                {created.signedIn ? (
                  <button
                    type="button"
                    className="action-button action-confirm entry-submit"
                    onClick={() => void navigate({ to: "/shop" })}
                  >
                    {t("cad.dono.openPanel")}
                    <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="action-button action-confirm entry-submit"
                    onClick={() => void navigate({ to: "/auth", search: { next: "/shop" } })}
                  >
                    {t("register.signin")}
                    <ArrowRight aria-hidden="true" />
                  </button>
                )}
              </section>
            )}

            {step !== "conta" && (
              <p className="platform-register-footer">
                {t("register.haveAccount")}{" "}
                <Link to="/auth" search={{ next: "/shop" }}>
                  {t("register.signin")}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
