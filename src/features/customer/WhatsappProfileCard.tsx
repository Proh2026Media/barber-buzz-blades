import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, Loader2, MessageCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

type Props = {
  demo: boolean;
  disabled: boolean;
  initialNumber: string;
  initialOptIn: boolean;
  initialVerified: boolean;
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
}: Props) {
  const { t } = useI18n();
  const [whatsapp, setWhatsapp] = useState(initialNumber ? formatBr(initialNumber) : "");
  const [savedNumber, setSavedNumber] = useState(initialNumber);
  const [verified, setVerified] = useState(initialVerified);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [step, setStep] = useState<"edit" | "code">("edit");
  const [pendingNumber, setPendingNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"save" | "send" | "verify" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

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
  async function saveWithoutCode(raw: string) {
    const { data, error: rpcError } = await supabase.rpc("save_my_whatsapp", {
      p_raw: raw,
      p_opt_in: optIn,
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
    setMessage(
      data?.whatsapp_opt_in_at ? t("profile.whatsappSavedOptIn") : t("profile.whatsappSaved"),
    );
  }

  async function sendCode(number: string) {
    setBusy("send");
    setError(null);
    setMessage("");
    try {
      const payload = await callVerifyPhone({ action: "request", destination: number });
      if (!payload.ok) {
        setError(errorText(payload));
        return;
      }
      if (payload.already_verified) {
        // Mesmo número já confirmado: só grava a preferência de avisos.
        await saveWithoutCode(number);
        setVerified(true);
        setStep("edit");
        return;
      }
      setPendingNumber(number);
      setCode("");
      setStep("code");
      setCooldown(payload.resend_after_seconds ?? RESEND_SECONDS);
      setMessage(t("fix2.whats.codeSent", { number: formatBr(number) }));
    } catch (err) {
      setError(errorText(err as OtpPayload, err));
    } finally {
      setBusy(null);
    }
  }

  async function submitNumber(event: React.FormEvent) {
    event.preventDefault();
    if (demo) {
      setMessage(t("profile.whatsappDemo"));
      return;
    }
    const raw = whatsapp.trim();
    const sameAsSaved = Boolean(savedNumber) && brDigits(raw) === brDigits(savedNumber);

    // Sem código: apagar o número, ajustar avisos de um número já confirmado
    // ou desligar avisos de um número ainda não confirmado.
    if (!raw || (sameAsSaved && (verified || !optIn))) {
      setBusy("save");
      setError(null);
      setMessage("");
      try {
        await saveWithoutCode(raw);
      } catch (err) {
        setError(errorText(err as OtpPayload, err));
      } finally {
        setBusy(null);
      }
      return;
    }

    if (brDigits(raw).length < 12) {
      setError(t("fix2.whats.errInvalidNumber"));
      return;
    }
    await sendCode(raw);
  }

  async function verifyCode(value: string) {
    if (!/^\d{6}$/.test(value) || busy) return;
    setBusy("verify");
    setError(null);
    setMessage("");
    try {
      const payload = await callVerifyPhone({
        action: "verify",
        destination: pendingNumber,
        code: value,
        opt_in: optIn,
      });
      if (!payload.ok) {
        setError(errorText(payload));
        if (payload.error_code === "otp_invalid") setCode("");
        return;
      }
      const number = payload.whatsapp_e164 ?? pendingNumber;
      setSavedNumber(number);
      setWhatsapp(formatBr(number));
      setVerified(true);
      setOptIn(Boolean(payload.whatsapp_opt_in_at));
      setStep("edit");
      setCode("");
      setPendingNumber("");
      setMessage(
        payload.whatsapp_opt_in_at ? t("fix2.whats.verifiedOptIn") : t("fix2.whats.verified"),
      );
    } catch (err) {
      setError(errorText(null, err));
    } finally {
      setBusy(null);
    }
  }

  const locked = disabled || busy !== null;
  const changed = brDigits(whatsapp) !== brDigits(savedNumber);
  const needsCode = Boolean(whatsapp.trim()) && (changed || (!verified && optIn));

  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
      aria-labelledby="whatsapp-card-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle className="size-4 text-gold" aria-hidden="true" />
        <h3 id="whatsapp-card-title" className="text-sm font-semibold">
          WhatsApp
        </h3>
        {!demo && savedNumber && !changed && step === "edit" && (
          <span
            className={
              verified
                ? "ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                : "ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
            }
          >
            {verified ? (
              <BadgeCheck className="size-3.5" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-3.5" aria-hidden="true" />
            )}
            {verified ? t("fix2.whats.badgeVerified") : t("fix2.whats.badgeUnverified")}
          </span>
        )}
      </div>

      {step === "edit" ? (
        <form onSubmit={(event) => void submitNumber(event)} className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("profile.whatsappHint")}
          </p>
          <label className="block space-y-2 text-sm font-semibold">
            <span>{t("profile.whatsappNumber")}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-0000"
              value={whatsapp}
              disabled={locked}
              onChange={(event) => {
                setWhatsapp(event.target.value);
                setMessage("");
                setError(null);
              }}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("profile.whatsappOptIn")}</p>
              <p className="text-xs text-muted-foreground">{t("profile.whatsappOptInHint")}</p>
            </div>
            <Switch
              checked={optIn}
              disabled={locked}
              onCheckedChange={setOptIn}
              aria-label={t("profile.whatsappOptIn")}
            />
          </div>
          {!demo && needsCode && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("fix2.whats.needsCodeHint")}
            </p>
          )}
          <button
            type="submit"
            disabled={locked}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy === "send"
              ? t("fix2.whats.sending")
              : busy
                ? t("common.saving")
                : !demo && needsCode
                  ? t("fix2.whats.sendCode")
                  : t("profile.saveWhatsapp")}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode(code);
          }}
          className="space-y-4"
        >
          <p className="text-sm leading-relaxed">
            {t("fix2.whats.codeIntro", { number: formatBr(pendingNumber) })}
          </p>
          <label className="block space-y-2 text-sm font-semibold">
            <span>{t("fix2.whats.codeLabel")}</span>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              disabled={locked}
              aria-describedby="whatsapp-code-hint"
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                setError(null);
                if (next.length === 6) void verifyCode(next);
              }}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 py-2 text-center font-mono text-2xl tracking-[0.5em]"
            />
            <span
              id="whatsapp-code-hint"
              className="block text-xs font-normal text-muted-foreground"
            >
              {t("fix2.whats.codeHint")}
            </span>
          </label>
          <button
            type="submit"
            disabled={locked || code.length !== 6}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy === "verify" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy === "verify" ? t("fix2.whats.verifying") : t("fix2.whats.confirm")}
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={locked || cooldown > 0}
              onClick={() => void sendCode(pendingNumber)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border p-3 text-sm font-semibold disabled:opacity-50"
            >
              {busy === "send" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {cooldown > 0
                ? t("fix2.whats.resendIn", { seconds: cooldown })
                : t("fix2.whats.resend")}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setStep("edit");
                setCode("");
                setError(null);
                setMessage("");
              }}
              className="min-h-11 rounded-xl border border-border p-3 text-sm font-semibold disabled:opacity-50"
            >
              {t("fix2.whats.changeNumber")}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
