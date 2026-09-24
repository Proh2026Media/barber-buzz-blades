import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Lookup = {
  appointment_id: string;
  barbershop_id: string;
  customer_id: string;
  status: string;
  starts_at: string;
  shop_name: string | null;
  service_name: string | null;
  staff_name: string | null;
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
  const [lookup, setLookup] = useState<Lookup | null>(null);
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
      if (!err && data) setLookup(data as Lookup);
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
      if (!response.ok) throw new Error(payload.error || "Falha ao enviar código");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código.");
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
      if (!response.ok) throw new Error(payload.error || "Código inválido");

      if (!payload.hashed_token) throw new Error("Sessão indisponível. Tente de novo.");

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: payload.hashed_token,
        type: (payload.verification_type as "magiclink" | "recovery") || "magiclink",
      });
      if (verifyError) throw verifyError;

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid || !lookup || uid !== lookup.customer_id) {
        await supabase.auth.signOut();
        throw new Error(
          "Este WhatsApp não é o da reserva. Use o número cadastrado nesta barbearia.",
        );
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Abrindo reserva…
      </p>
    );
  }

  if (!lookup) {
    return (
      <div className="space-y-3 p-6">
        <h2 className="text-lg font-bold">Reserva não encontrada</h2>
        <p className="text-sm text-muted-foreground">
          O link pode ter expirado ou estar incorreto. Peça um novo aviso à barbearia.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">Sua reserva</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lookup.shop_name} · {lookup.service_name} com {lookup.staff_name}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {new Date(lookup.starts_at).toLocaleString("pt-BR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Para ver ou alterar, informe o WhatsApp cadastrado nesta barbearia. Enviaremos um código.
      </p>
      {step === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="block space-y-1 text-xs font-semibold">
            WhatsApp com DDD
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
            Receber código
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
            Código de 6 dígitos
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
            Entrar e ver reserva
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("phone")}
            className="min-h-11 w-full text-sm font-semibold text-muted-foreground"
          >
            Trocar número
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
