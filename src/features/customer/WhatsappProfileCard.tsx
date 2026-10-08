import { useEffect, useId, useState } from "react";
import {
  Bell,
  KeyRound,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  ActionResult,
  FieldMessage,
  IconList,
  IconTile,
  Notice,
  SectionHeader,
  SettingRow,
  STATE,
  StatusBadge,
  Steps,
  type ActionState,
} from "@/components/visual";
import { CodeInput, ResendButton } from "@/features/auth/entry";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";

/**
 * WhatsApp do perfil com confirmação por código.
 *
 * Número novo ou ainda não confirmado → auth-otp (purpose 'verify_phone') envia
 * um código de 6 dígitos pelo WhatsApp da plataforma; ao confirmar, o servidor
 * grava o número como verificado. Só ligar/desligar avisos ou apagar o número
 * continua pela RPC save_my_whatsapp (sem código).
 */

export type WhatsappStatus = { number: string; verified: boolean; optIn: boolean };

type Props = {
  demo: boolean;
  disabled: boolean;
  initialNumber: string;
  initialOptIn: boolean;
  initialVerified: boolean;
  /** Avisa a tela de fora (resumo da Conta) quando número, confirmação ou lembretes mudam. */
  onStatusChange?: (status: WhatsappStatus) => void;
  /** id do cartão, para os atalhos do resumo da Conta. */
  id?: string;
  /** Dentro de uma janela: sem moldura e sem cabeçalho próprio (o título é o da janela). */
  bare?: boolean;
};

type OtpPayload = {
  ok?: boolean;
  error?: string;
  error_code?: string;
  attempts_left?: number;
  already_verified?: boolean;
  resend_after_seconds?: number;
  whatsapp_e164?: string | null;
  whatsapp_opt_in_at?: string | null;
};

const RESEND_SECONDS = 60;

/** Dígitos com DDI 55 (comparação aproximada; o servidor normaliza de verdade). */
function brDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** +5511999990000 → (11) 99999-0000 para leitura no celular. */
function formatBr(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

async function callVerifyPhone(body: Record<string, unknown>): Promise<OtpPayload> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Sessão expirada", error_code: "unauthorized" };
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
  let payload: OtpPayload = {};
  try {
    payload = (await response.json()) as OtpPayload;
  } catch {
    payload = {};
  }
  if (!response.ok && !payload.error_code) {
    payload.error_code = response.status === 429 ? "rate_limited" : "internal_error";
  }
  if (!response.ok) payload.ok = false;
  return payload;
}

export function WhatsappProfileCard({
  demo,
  disabled,
  initialNumber,
  initialOptIn,
  initialVerified,
  onStatusChange,
  id,
  bare = false,
}: Props) {
  const { t } = useI18n();
  const uid = useId();
  const titleId = `${uid}-title`;
  const numberId = `${uid}-number`;
  const optInId = `${uid}-optin`;
  const codeId = `${uid}-code`;
  const codeMsgId = `${uid}-code-msg`;
  const [whatsapp, setWhatsapp] = useState(initialNumber ? formatBr(initialNumber) : "");
  const [savedNumber, setSavedNumber] = useState(initialNumber);
  const [verified, setVerified] = useState(initialVerified);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [step, setStep] = useState<"edit" | "code">("edit");
  // Com número gravado, o cartão mostra o resumo; "Trocar número" abre o campo.
  const [editing, setEditing] = useState(false);
  const [pendingNumber, setPendingNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"save" | "send" | "verify" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [result, setResult] = useState<{ state: ActionState; text: string } | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [toggleState, setToggleState] = useState<ActionState | null>(null);
  const [toggleText, setToggleText] = useState<string | undefined>(undefined);
  // Acabou de confirmar por código nesta tela: as três etapas aparecem concluídas.
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    onStatusChange?.({ number: savedNumber, verified, optIn });
  }, [onStatusChange, savedNumber, verified, optIn]);

  function showResult(state: ActionState, text: string, again?: () => void) {
    setResult({ state, text });
    setRetry(() => again ?? null);
  }

  function errorText(payload: OtpPayload | null, err?: unknown) {
    switch (payload?.error_code) {
      case "otp_invalid":
        return typeof payload.attempts_left === "number" && payload.attempts_left > 0
          ? t("fix2.whats.errInvalidLeft", { count: payload.attempts_left })
          : t("fix2.whats.errInvalid");
      case "otp_expired":
        return t("fix2.whats.errExpired");
      case "otp_too_many_attempts":
        return t("fix2.whats.errTooManyAttempts");
      case "rate_limited":
        return t("fix2.whats.errRateLimited");
      case "whatsapp_unavailable":
        return t("fix2.whats.errUnavailable");
      case "phone_in_use":
        return t("fix2.whats.errPhoneInUse");
      case "invalid_whatsapp":
        return t("fix2.whats.errInvalidNumber");
      case "unauthorized":
        return t("errors.sessionExpired");
      default:
        return friendlyAuthError(err ?? payload?.error ?? null, t("profile.errorWhatsapp"));
    }
  }

  /** Liga/desliga avisos ou apaga o número (sem código). */
  async function saveWithoutCode(raw: string, nextOptIn: boolean) {
    const { data, error: rpcError } = await supabase.rpc("save_my_whatsapp", {
      p_raw: raw,
      p_opt_in: nextOptIn,
    });
    if (rpcError) {
      if (rpcError.code === "23505") throw { error_code: "phone_in_use" } as OtpPayload;
      throw rpcError;
    }
    const number = data?.whatsapp_e164 ?? "";
    setSavedNumber(number);
    setWhatsapp(number ? formatBr(number) : "");
    setOptIn(Boolean(data?.whatsapp_opt_in_at));
    if (!number) setVerified(false);
    return data;
  }

  async function sendCode(number: string) {
    setBusy("send");
    setCodeError(null);
    setResult(null);
    setJustVerified(false);
    try {
      const payload = await callVerifyPhone({ action: "request", destination: number });
      if (!payload.ok) {
        showResult("error", errorText(payload), () => void sendCode(number));
        return;
      }
      if (payload.already_verified) {
        // Mesmo número já confirmado: só grava a preferência de avisos.
        const data = await saveWithoutCode(number, optIn);
        setVerified(true);
        setStep("edit");
        setEditing(false);
        showResult(
          "saved",
          data?.whatsapp_opt_in_at ? t("profile.whatsappSavedOptIn") : t("profile.whatsappSaved"),
        );
        return;
      }
      setPendingNumber(number);
      setCode("");
      setAttemptsLeft(null);
      setStep("code");
      setCooldown(payload.resend_after_seconds ?? RESEND_SECONDS);
    } catch (err) {
      showResult("error", errorText(err as OtpPayload, err), () => void sendCode(number));
    } finally {
      setBusy(null);
    }
  }

  async function submitNumber(event: React.FormEvent) {
    event.preventDefault();
    if (demo) {
      showResult("saved", t("profile.whatsappDemo"));
      return;
    }
    const raw = whatsapp.trim();
    // Campo vazio com número gravado: apaga o número (sem código).
    if (!raw) {
      setBusy("save");
      setResult(null);
      try {
        const data = await saveWithoutCode("", optIn);
        setEditing(false);
        showResult(
          "saved",
          data?.whatsapp_opt_in_at ? t("profile.whatsappSavedOptIn") : t("profile.whatsappSaved"),
        );
      } catch (err) {
        showResult("error", errorText(err as OtpPayload, err));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (brDigits(raw).length < 12) {
      showResult("error", t("fix2.whats.errInvalidNumber"));
      return;
    }
    await sendCode(raw);
  }

  /** Interruptor dos lembretes no resumo: grava na hora quando não precisa de código. */
  async function changeOptIn(next: boolean) {
    setToggleState(null);
    setToggleText(undefined);
    if (demo || !savedNumber || editing || (next && !verified)) {
      // Sem número, editando, ou ligando num número sem confirmar: nada é gravado agora; o
      // pedido vai junto com o código. A linha mostra "pendente" (optInPending), não "salvo".
      setOptIn(next);
      return;
    }
    const before = optIn;
    setOptIn(next);
    setToggleState("saving");
    setToggleText(undefined);
    setBusy("save");
    try {
      const data = await saveWithoutCode(savedNumber, next);
      setToggleState("saved");
      setToggleText(
        data?.whatsapp_opt_in_at ? t("conta.whats.remindersOn") : t("conta.whats.remindersOff"),
      );
    } catch (err) {
      setOptIn(before);
      setToggleState("error");
      setToggleText(errorText(err as OtpPayload, err));
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode(value: string) {
    if (!/^\d{6}$/.test(value) || busy) return;
    setBusy("verify");
    setCodeError(null);
    setResult(null);
    try {
      const payload = await callVerifyPhone({
        action: "verify",
        destination: pendingNumber,
        code: value,
        opt_in: optIn,
      });
      if (!payload.ok) {
        setCodeError(errorText(payload));
        if (typeof payload.attempts_left === "number") setAttemptsLeft(payload.attempts_left);
        if (payload.error_code === "otp_invalid") setCode("");
        return;
      }
      const number = payload.whatsapp_e164 ?? pendingNumber;
      setSavedNumber(number);
      setWhatsapp(formatBr(number));
      setVerified(true);
      setOptIn(Boolean(payload.whatsapp_opt_in_at));
      setStep("edit");
      setEditing(false);
      setCode("");
      setPendingNumber("");
      setAttemptsLeft(null);
      setJustVerified(true);
      showResult(
        "saved",
        payload.whatsapp_opt_in_at ? t("fix2.whats.verifiedOptIn") : t("fix2.whats.verified"),
      );
    } catch (err) {
      setCodeError(errorText(null, err));
    } finally {
      setBusy(null);
    }
  }

  const locked = disabled || busy !== null;
  const changed = brDigits(whatsapp) !== brDigits(savedNumber);
  const showSummary = Boolean(savedNumber) && !editing && step === "edit";
  const removing = Boolean(savedNumber) && !whatsapp.trim();
  const canSubmit = demo ? changed : removing || (Boolean(whatsapp.trim()) && changed);
  const badge = !savedNumber
    ? { ...STATE.paused, label: t("conta.whats.none") }
    : verified
      ? { ...STATE.active, label: t("fix2.whats.badgeVerified") }
      : { ...STATE.attention, label: t("fix2.whats.badgeUnverified") };
  // Avisos ligados num número sem confirmar só passam a valer com o código: mostra pendente.
  const optInPending = optIn && !demo && (!savedNumber || !verified);

  /** Enviar código → Digitar código → Confirmado, a partir da etapa em que o cartão está. */
  const confirmSteps = (phase: 0 | 1 | 2) => (
    <Steps
      label={t("conta.whats.stepsLabel")}
      steps={[
        {
          key: "send",
          label: t("conta.whats.stepSend"),
          icon: Send,
          status: phase > 0 ? "done" : "current",
        },
        {
          key: "type",
          label: t("conta.whats.stepType"),
          icon: KeyRound,
          status: phase > 1 ? "done" : phase === 1 ? (codeError ? "error" : "current") : "upcoming",
        },
        {
          key: "confirmed",
          label: t("conta.whats.stepConfirmed"),
          icon: ShieldCheck,
          status: phase > 1 ? "done" : "upcoming",
        },
      ]}
    />
  );

  const optInRow = (
    <SettingRow
      icon={Bell}
      title={t("profile.whatsappOptIn")}
      description={t("profile.whatsappOptInHint")}
      controlId={optInId}
      control={
        <Switch
          id={optInId}
          checked={optIn}
          disabled={locked}
          onCheckedChange={(next) => void changeOptIn(next)}
        />
      }
      status={toggleState ?? (optInPending ? "pending" : null)}
      statusText={toggleState ? toggleText : t("conta.whats.optInPending")}
      onRetry={() => void changeOptIn(!optIn)}
      className="rounded-2xl border border-border bg-background/60 px-3"
    />
  );

  return (
    <section
      id={id}
      className={bare ? "space-y-4" : "app-action-card scroll-mt-24 space-y-4 p-4 sm:p-5"}
      aria-labelledby={bare ? undefined : titleId}
    >
      {!bare && (
        <SectionHeader
          icon={MessageCircle}
          id={titleId}
          title="WhatsApp"
          aside={step === "edit" ? <StatusBadge {...badge} size="sm" /> : null}
        />
      )}

      {step === "edit" && (
        // Para que serve o número, em duas dicas com ícone (no lugar do parágrafo).
        <IconList
          size="sm"
          label={t("conta.whats.usesLabel")}
          className="flex flex-wrap gap-x-4 gap-y-1 space-y-0"
          items={[
            { icon: Bell, text: t("conta.whats.useReminders"), key: "reminders" },
            { icon: KeyRound, text: t("conta.whats.useCodes"), key: "codes" },
          ]}
        />
      )}

      {step === "code" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode(code);
          }}
          className="space-y-4"
        >
          {confirmSteps(1)}
          <p className="text-sm">
            {t("conta.whats.sentTo")}{" "}
            <strong className="whitespace-nowrap tabular-nums">{formatBr(pendingNumber)}</strong>
          </p>
          <div className="space-y-2">
            <label htmlFor={codeId} className="block text-sm font-semibold">
              {t("fix2.whats.codeLabel")}
            </label>
            <CodeInput
              id={codeId}
              value={code}
              autoFocus
              disabled={locked}
              invalid={Boolean(codeError)}
              describedBy={codeMsgId}
              onChange={(next) => {
                setCode(next);
                setCodeError(null);
              }}
              onComplete={(next) => void verifyCode(next)}
            />
            <FieldMessage id={codeMsgId} tone={codeError ? "error" : "hint"}>
              {codeError ?? t("fix2.whats.codeHint")}
            </FieldMessage>
            {codeError && attemptsLeft !== null && attemptsLeft > 0 && (
              <span className="flex items-center gap-1.5" aria-hidden>
                {Array.from({ length: Math.min(attemptsLeft, 5) }, (_, index) => (
                  <span key={index} className="size-2.5 rounded-full bg-gold" />
                ))}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={locked || code.length !== 6}
            aria-busy={busy === "verify" || undefined}
            className="action-button action-confirm w-full"
          >
            {busy === "verify" && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
            {busy === "verify" ? t("fix2.whats.verifying") : t("fix2.whats.confirm")}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <ResendButton
              secondsLeft={cooldown}
              totalSeconds={RESEND_SECONDS}
              busy={busy === "send"}
              onClick={() => void sendCode(pendingNumber)}
              label={t("fix2.whats.resend")}
              waitLabel={t("fix2.whats.resendIn", { seconds: cooldown })}
              busyLabel={t("fix2.whats.sending")}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setStep("edit");
                setEditing(true);
                setCode("");
                setCodeError(null);
                setResult(null);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              <Pencil className="size-4" aria-hidden />
              {t("fix2.whats.changeNumber")}
            </button>
          </div>
        </form>
      ) : showSummary ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
            <IconTile icon={MessageCircle} tone={verified ? "success" : "warning"} size="sm" />
            <p className="flex-1 whitespace-nowrap text-base font-bold tabular-nums">
              {formatBr(savedNumber)}
            </p>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setEditing(true);
                setWhatsapp(formatBr(savedNumber));
                setResult(null);
                setToggleState(null);
                setJustVerified(false);
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
            >
              <Pencil className="size-4" aria-hidden />
              {t("fix2.whats.changeNumber")}
            </button>
          </div>
          {!demo && !verified && confirmSteps(0)}
          {!demo && verified && justVerified && confirmSteps(2)}
          {!verified && !demo && (
            <Notice
              tone="warning"
              role="none"
              title={t("conta.whats.consequence")}
              action={{
                // Mesmo verbo da 1ª etapa logo acima ("Enviar código").
                label: t("fix2.whats.sendCode"),
                icon: Send,
                onClick: () => void sendCode(savedNumber),
              }}
            />
          )}
          {optInRow}
        </div>
      ) : (
        <form onSubmit={(event) => void submitNumber(event)} className="space-y-3">
          <div className="space-y-2">
            <label htmlFor={numberId} className="block text-sm font-semibold">
              {t("profile.whatsappNumber")}
            </label>
            <input
              id={numberId}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-0000"
              value={whatsapp}
              disabled={locked}
              onChange={(event) => {
                setWhatsapp(event.target.value);
                setResult(null);
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </div>
          {!savedNumber && optInRow}
          {/* Número novo: as etapas mostram que vem um código (no lugar da frase). */}
          {!demo && !removing && changed && whatsapp.trim() && confirmSteps(0)}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={locked || !canSubmit}
              aria-busy={busy === "send" || busy === "save" || undefined}
              className={`action-button flex-1 basis-48 ${removing ? "action-danger" : "action-confirm"}`}
            >
              {busy ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
              ) : removing ? (
                <Trash2 aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              {busy === "send"
                ? t("fix2.whats.sending")
                : busy
                  ? t("common.saving")
                  : removing
                    ? t("conta.whats.remove")
                    : demo
                      ? t("profile.saveWhatsapp")
                      : t("fix2.whats.sendCode")}
            </button>
            {editing && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setEditing(false);
                  setWhatsapp(formatBr(savedNumber));
                  setResult(null);
                }}
                className="inline-flex min-h-11 flex-1 basis-32 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-50"
              >
                <X className="size-4" aria-hidden />
                {t("conta.whats.keepNumber")}
              </button>
            )}
          </div>
        </form>
      )}

      <ActionResult
        state={result?.state}
        text={result?.text}
        onRetry={retry ?? undefined}
        onDismiss={() => setResult(null)}
        autoHideMs={6000}
      />
    </section>
  );
}
