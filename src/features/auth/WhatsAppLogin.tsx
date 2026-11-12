import { otpRequestBody } from "@/lib/auth/otp-request";
import { useDemo } from "@/features/demo/context";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Mail, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Hint, Notice } from "@/components/visual";
import { CodeInput } from "./entry/CodeInput";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  initialPairingCountry,
  normalizePairingPhone,
  pairingCountries,
  type CountryCode,
} from "@/features/whatsapp/pairing-phone";

export function WhatsAppLogin({
  disabled,
  onAuthenticated,
  onUseEmail,
}: {
  disabled: boolean;
  onAuthenticated: () => Promise<void>;
  onUseEmail: () => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const emailRequested = useRef(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled || Boolean(demo)}
        onClick={() => {
          if (!demo) setOpen(true);
        }}
        className="auth-brand-button flex min-h-[3.25rem] w-full items-center justify-center gap-3 border border-border/70 px-3 text-[15px] font-semibold hover:bg-muted/50 disabled:opacity-60"
      >
        <MessageCircle className="size-5" aria-hidden />
        {t("waLogin.title")}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!verifying) setOpen(value);
        }}
      >
        <DialogContent
          size="md"
          mobileSheet
          className="bg-card"
          onCloseAutoFocus={(event) => {
            if (emailRequested.current) {
              event.preventDefault();
              emailRequested.current = false;
              onUseEmail();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("waLogin.title")}</DialogTitle>
            <DialogDescription>{t("waLogin.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {open && (
              <LoginForm
                onAuthenticated={onAuthenticated}
                onVerifying={setVerifying}
                onUseEmail={() => {
                  emailRequested.current = true;
                  setOpen(false);
                }}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoginForm({
  onAuthenticated,
  onUseEmail,
  onVerifying,
}: {
  onAuthenticated: () => Promise<void>;
  onUseEmail: () => void;
  onVerifying: (value: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [country, setCountry] = useState<CountryCode>(() =>
    initialPairingCountry(undefined, locale),
  );
  const countries = useMemo(() => pairingCountries(locale), [locale]);
  const [hasGroup, setHasGroup] = useState(false);
  const [phone, setPhone] = useState("");
  const [destination, setDestination] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<MessageKey | null>(null);
  const pending = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(action: "request" | "verify") {
    if (pending.current || (action === "request" && cooldown > 0)) return;
    const normalized =
      destination ??
      (() => {
        const result = normalizePairingPhone(phone, country);
        return result ? `+${result.digits}` : null;
      })();
    if (!normalized) {
      setError("waPair.invalidPhone");
      return;
    }
    pending.current = true;
    if (action === "verify") onVerifying(true);
    setBusy(true);
    setError(null);
    try {
      const response = await guardedFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-otp`,
        {
          method: "POST",
          signal: AbortSignal.timeout(25000),
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          },
          body: otpRequestBody({
            action,
            purpose: "login",
            channel: "whatsapp",
            destination: normalized,
            ...(action === "verify" ? { code } : {}),
          }),
        },
      );
      const payload = await response.json();
      if (!live.current) return;
      if (!response.ok || payload.ok !== true) {
        if (payload.error_code === "rate_limited") {
          setCooldown(60);
          setError("waLogin.limit");
        } else if (payload.error_code === "otp_invalid") {
          setCode("");
          setError("waLogin.invalid");
        } else setError("waLogin.unavailable");
        return;
      }
      if (action === "request") {
        setDestination(normalized);
        setCode("");
        setCooldown(
          Number.isInteger(payload.resend_after_seconds) &&
            payload.resend_after_seconds >= 60 &&
            payload.resend_after_seconds <= 900
            ? payload.resend_after_seconds
            : 60,
        );
        return;
      }
      if (typeof payload.hashed_token !== "string" || !payload.hashed_token)
        throw new Error("Sessão ausente");
      const { data: current } = await supabase.auth.getSession();
      if (!live.current || current.session) return;
      const { error: failed } = await supabase.auth.verifyOtp({
        token_hash: payload.hashed_token,
        type: "email",
      });
      if (failed) throw failed;
      if (live.current) await onAuthenticated();
    } catch {
      if (live.current) {
        setError("waLogin.unavailable");
        if (action === "request") setCooldown(60);
      }
    } finally {
      if (action === "verify") onVerifying(false);
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  if (!hasGroup)
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="action-button w-full justify-between gap-3 p-4 text-left"
          onClick={() => setHasGroup(true)}
        >
          <KeyRound className="size-6 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("waLogin.haveGroup")}</span>
            <span className="block text-sm font-normal opacity-80">
              {t("waLogin.haveGroupHint")}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          className="action-button w-full justify-between gap-3 p-4 text-left"
          onClick={onUseEmail}
        >
          <Mail className="size-6 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t("waLogin.firstAccess")}</span>
            <span className="block text-sm font-normal opacity-80">
              {t("waLogin.firstAccessHint")}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </button>
      </div>
    );
  const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(destination ? "verify" : "request");
      }}
    >
      {!destination ? (
        <>
          <label className="grid gap-1 text-sm font-semibold">
            {t("waPair.country")}
            <select
              aria-label={t("waPair.country")}
              value={country}
              disabled={busy}
              className={field}
              onChange={(e) => setCountry(e.target.value as CountryCode)}
            >
              {countries.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.name} (+{c.code})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("waPair.phone")}
            <input
              type="tel"
              autoComplete="tel-national"
              autoFocus
              value={phone}
              disabled={busy}
              className={field}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <Hint>{t("waLogin.verifiedOnly")}</Hint>
        </>
      ) : (
        <>
          <Notice tone="info" title={t("waLogin.requested")}>
            <p className="mb-1">{t("waLogin.sent")}</p>
            <span className="break-all">{destination}</span>
          </Notice>
          <CodeInput
            id="whatsapp-login-code"
            value={code}
            onChange={setCode}
            label={t("auth.field.otp")}
            disabled={busy}
            autoFocus
            invalid={error === "waLogin.invalid"}
          />
          <Hint>{t("waLogin.expiry")}</Hint>
        </>
      )}
      {error && <Notice tone="danger" title={t(error)} />}
      <button
        type="button"
        className="entry-link-button w-full"
        disabled={busy && Boolean(destination)}
        onClick={onUseEmail}
      >
        {t("waLogin.useEmail")}
      </button>
      <button
        className="action-button action-confirm w-full"
        disabled={busy || (destination ? code.length !== 6 : cooldown > 0)}
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t(destination ? "waLogin.enter" : "waLogin.send")}
      </button>
      {cooldown > 0 && (
        <p className="text-center text-sm text-muted-foreground" role="status">
          {t("waLogin.wait", { seconds: cooldown })}
        </p>
      )}
      {destination && (
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            className="entry-link-button"
            disabled={busy || cooldown > 0}
            onClick={() => void submit("request")}
          >
            {t("waLogin.resend")}
          </button>
          <button
            type="button"
            className="entry-link-button"
            disabled={busy}
            onClick={() => {
              setDestination(null);
              setCode("");
              setError(null);
            }}
          >
            {t("waLogin.change")}
          </button>
        </div>
      )}
    </form>
  );
}
