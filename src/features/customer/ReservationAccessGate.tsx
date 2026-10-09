import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, Loader2, LogIn, MessageCircle, Scissors, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { friendlyAuthError, serverError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_SHOP_TIMEZONE, validTimeZone } from "@/lib/shop/appointments";
import { brandCornerClass } from "@/lib/shop/branding";
import {
  Countdown,
  EmptyState,
  LoadingState,
  Notice,
  Steps,
  type AppointmentStatus,
} from "@/components/visual";
import { AppointmentTicket, ReservationStatusBadge } from "./booking/ticket";

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

type ShopLook = {
  name: string | null;
  logo: string | null;
  logoBackground: string | null;
  corner: string | null;
};

const STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "reschedule_requested",
  "cancelled",
];
/** Espera antes de permitir pedir outro código (só na tela; o servidor tem o próprio limite). */
const RESEND_SECONDS = 30;

/** "(11) •••••-0000": o destino do código sem expor o número inteiro. */
function maskedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return value;
  const local = digits.length > 11 ? digits.slice(-11) : digits;
  const ddd = local.length >= 10 ? local.slice(0, 2) : null;
  return `${ddd ? `(${ddd}) ` : ""}•••••-${local.slice(-4)}`;
}

/**
 * Portão da aba Reservas pelo link ?reserva=token: mostra a reserva (ticket com a situação) e
 * pede o WhatsApp e o código em duas etapas, com a marca da loja no topo.
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
  const { t } = useI18n();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [shop, setShop] = useState<ShopLook | null>(null);
  const [shopTimeZone, setShopTimeZone] = useState(DEFAULT_SHOP_TIMEZONE);
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: err } = await supabase.rpc("lookup_appointment_by_token", {
        p_token: token,
      });
      if (cancelled) return;
      const found = !err && data ? (data as Lookup) : null;
      if (found) {
        // Marca e fuso da loja (a mesma consulta pública da página da barbearia).
        const landing = await supabase.rpc("get_public_shop_landing", {
          p_shop_ref: found.barbershop_id,
        });
        if (cancelled) return;
        const info = (
          landing.data as {
            shop?: {
              timezone?: string | null;
              name?: string | null;
              display_name?: string | null;
              logo_url?: string | null;
              logo_background_color?: string | null;
              corner_style?: string | null;
            };
          } | null
        )?.shop;
        setShopTimeZone(validTimeZone(found.timezone ?? info?.timezone ?? null));
        setShop({
          name: info?.display_name?.trim() || info?.name || found.shop_name,
          logo: info?.logo_url ?? null,
          logoBackground: info?.logo_background_color ?? null,
          corner: info?.corner_style ?? null,
        });
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
      const response = await guardedFetch(`${base}/functions/v1/auth-otp`, {
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
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        error_code?: string;
      };
      if (!response.ok) throw serverError(payload, t("gate.sendFailed"));
      setStep("code");
      setSentAt(Date.now());
      setCanResend(false);
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
      const response = await guardedFetch(`${base}/functions/v1/auth-otp`, {
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
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        error_code?: string;
        hashed_token?: string;
        verification_type?: string;
      };
      if (!response.ok) throw serverError(payload, t("gate.invalidCode"));

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

  const page = (children: React.ReactNode) => (
    <div
      className={`brand-page ${brandCornerClass(shop?.corner)} mx-auto max-w-md space-y-5 p-4 sm:p-6`}
    >
      {children}
    </div>
  );

  if (!loaded) {
    return page(<LoadingState variant="cards" count={1} label={t("gate.opening")} />);
  }

  if (!lookup) {
    return page(
      <EmptyState
        status="neutral"
        tone="search"
        title={t("gate.notFoundTitle")}
        description={t("gate.notFoundBody")}
        action={
          <Link
            to="/auth"
            search={{ next: "/app?tab=reservas" }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="size-4" aria-hidden />
            {t("gate.signIn")}
          </Link>
        }
      />,
    );
  }

  const status = STATUSES.includes(lookup.status as AppointmentStatus)
    ? (lookup.status as AppointmentStatus)
    : null;
  const now = new Date();
  const shopName = shop?.name || lookup.shop_name || "";

  return page(
    <>
      <header className="flex items-center gap-3">
        <span
          className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[var(--control-radius)] bg-foreground text-background"
          style={shop?.logoBackground ? { backgroundColor: shop.logoBackground } : undefined}
        >
          {shop?.logo ? (
            <img src={shop.logo} alt="" className="size-full object-contain" />
          ) : (
            <Scissors className="size-6" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{shopName}</p>
          <h2 className="text-sm text-muted-foreground">{t("gate.title")}</h2>
        </div>
      </header>

      <div className="rounded-[var(--panel-radius)] border border-border bg-card p-4 shadow-sm">
        <AppointmentTicket
          variant="mini"
          now={now}
          timeZone={shopTimeZone}
          showUntil={false}
          data={{
            startsAt: lookup.starts_at,
            serviceName: lookup.service_name ?? "",
            staffName: lookup.staff_name ?? "",
          }}
          status={
            status ? (
              <ReservationStatusBadge
                status={status}
                startsAt={lookup.starts_at}
                now={now}
                size="sm"
              />
            ) : undefined
          }
        />
      </div>

      <Steps
        label={t("gate.stepsAria")}
        steps={[
          {
            key: "phone",
            label: t("gate.step.phone"),
            icon: MessageCircle,
            status: step === "phone" ? "current" : "done",
          },
          {
            key: "code",
            label: t("gate.step.code"),
            icon: KeyRound,
            status: step === "code" ? "current" : "upcoming",
          },
        ]}
        onStepClick={busy ? undefined : () => setStep("phone")}
      />

      {step === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="block space-y-1.5 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <MessageCircle className="size-4 text-gold" aria-hidden />
              {t("gate.phoneLabel")}
            </span>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              aria-invalid={error ? true : undefined}
              className="min-h-12 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-base font-normal"
            />
            <span className="block text-xs font-normal text-muted-foreground">
              {t("gate.intro")}
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className="action-button action-confirm min-h-12 w-full"
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            {busy ? t("gate.sending") : t("gate.getCode")}
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
          <Notice
            tone="success"
            title={t("gate.codeSent", { phone: maskedPhone(phone) })}
            className="rounded-[var(--control-radius)]"
          />
          <label className="block space-y-1.5 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-gold" aria-hidden />
              {t("gate.codeLabel")}
            </span>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={error ? true : undefined}
              className="min-h-14 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-center font-mono text-2xl font-bold tracking-[0.5em]"
            />
          </label>
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            aria-busy={busy || undefined}
            className="action-button action-confirm min-h-12 w-full"
          >
            {busy ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <LogIn aria-hidden />
            )}
            {busy ? t("gate.entering") : t("gate.submit")}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy || !canResend}
              onClick={() => void sendCode()}
              className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--button-radius)] border border-border px-2 text-sm font-semibold disabled:opacity-60"
            >
              {t("gate.resend")}
              {!canResend && sentAt && (
                <Countdown
                  endsAt={sentAt + RESEND_SECONDS * 1000}
                  criticalBelow={0}
                  onExpire={() => setCanResend(true)}
                  className="text-[11px]"
                />
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("phone")}
              className="min-h-11 rounded-[var(--button-radius)] px-2 text-sm font-semibold text-muted-foreground"
            >
              {t("gate.changePhone")}
            </button>
          </div>
        </form>
      )}
      {/* O portão fica fora do .arena-workspace: o raio vem da variável do modo de cantos. */}
      {error && <Notice tone="danger" title={error} className="rounded-[var(--control-radius)]" />}
    </>,
  );
}
