import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_SHOP_TIMEZONE, formatShopDate, validTimeZone } from "@/lib/shop/appointments";

type Lookup = {
  appointment_id: string;
  barbershop_id: string;
  customer_id: string;
  status: string;
  starts_at: string;
  shop_name: string | null;
  service_name: string | null;
  staff_name: string | null;
  /** Fuso da loja, quando a RPC passar a devolvê-lo. */
  timezone?: string | null;
};

/**
 * Gate da aba Reservas via link ?reserva=token.
 * Cliente cadastrado prova o WhatsApp com OTP e entra na conta.
 */
export function ReservationAccessGate({
  token,
  shopSlug,
  onAuthenticated,
}: {
  token: string;
  shopSlug?: string;
  onAuthenticated: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [shopTimeZone, setShopTimeZone] = useState(DEFAULT_SHOP_TIMEZONE);
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await supabase.rpc("lookup_appointment_by_token", {
        p_token: token,
      });
      if (cancelled) return;
      const found = !err && data ? (data as Lookup) : null;
      if (found) {
        // Horário no fuso da loja, igual ao app e às mensagens (não no fuso do aparelho).
        let timeZone = found.timezone ?? null;
        if (!timeZone) {
          const landing = await supabase.rpc("get_public_shop_landing", {
            p_shop_ref: found.barbershop_id,
          });
          if (cancelled) return;
          timeZone =
            (landing.data as { shop?: { timezone?: string | null } } | null)?.shop?.timezone ??
            null;
        }
        setShopTimeZone(validTimeZone(timeZone));
        setLookup(found);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(`${base}/functions/v1/auth-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({
          action: "request",
          purpose: "login",
          shop: shopSlug || lookup?.barbershop_id,
          channel: "whatsapp",
          destination: phone,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("gate.sendFailed"));
      setStep("code");
    } catch (err) {
      setError(friendlyAuthError(err, t("gate.sendError")));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL || "";
      const response = await fetch(`${base}/functions/v1/auth-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({
          action: "verify",
          purpose: "login",
          shop: shopSlug || lookup?.barbershop_id,
          channel: "whatsapp",
          destination: phone,
          code,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        hashed_token?: string;
        verification_type?: string;
      };
      if (!response.ok) throw new Error(payload.error || t("gate.invalidCode"));

      if (!payload.hashed_token) throw new Error(t("gate.sessionUnavailable"));

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: payload.hashed_token,
        type: (payload.verification_type as "magiclink" | "recovery") || "magiclink",
      });
      if (verifyError) throw verifyError;

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid || !lookup || uid !== lookup.customer_id) {
        await supabase.auth.signOut();
        throw new Error(t("gate.wrongPhone"));
      }
      onAuthenticated();
    } catch (err) {
      setError(friendlyAuthError(err, t("gate.signInError")));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        {t("gate.opening")}
      </p>
    );
  }

  if (!lookup) {
    return (
      <div className="space-y-3 p-6">
        <h2 className="text-lg font-bold">{t("gate.notFoundTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("gate.notFoundBody")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">{t("gate.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("gate.summary", {
            shop: lookup.shop_name ?? "",
            service: lookup.service_name ?? "",
            staff: lookup.staff_name ?? "",
          })}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {formatShopDate(
            lookup.starts_at,
            shopTimeZone,
            { dateStyle: "medium", timeStyle: "short" },
            intlLocale,
          )}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{t("gate.intro")}</p>
      {step === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="block space-y-1 text-xs font-semibold">
            {t("gate.phoneLabel")}
            <input
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("gate.getCode")}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyCode();
          }}
        >
          <label className="block space-y-1 text-xs font-semibold">
            {t("gate.codeLabel")}
            <input
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal tracking-widest"
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("gate.submit")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sendCode()}
            className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold disabled:opacity-50"
          >
            {t("gate.resend")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("phone")}
            className="min-h-11 w-full text-sm font-semibold text-muted-foreground"
          >
            {t("gate.changePhone")}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
