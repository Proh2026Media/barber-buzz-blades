import { useCallback, useEffect, useState } from "react";
import { Link2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type PlatformWaStatus = "disconnected" | "qr" | "connecting" | "open";

type PlatformWaPayload = {
  error?: string;
  instance_name?: string;
  status?: PlatformWaStatus;
  display_phone?: string | null;
  qrcode?: string | null;
  last_error?: string | null;
};

const statusLabel: Record<PlatformWaStatus, string> = {
  disconnected: "Desconectado",
  qr: "Aguardando QR",
  connecting: "Conectando…",
  open: "Conectado",
};

async function callPlatformWhatsApp(action: "status" | "connect" | "logout") {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/platform-whatsapp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json()) as PlatformWaPayload;
  if (!response.ok) throw new Error(payload.error || "Falha no WhatsApp da plataforma");
  return payload;
}

/**
 * Admin: conecta o WhatsApp usado no OTP de /cadastrar (instância PLATFORM_EVOLUTION_INSTANCE).
 */
export function PlatformWhatsAppCard() {
  const [status, setStatus] = useState<PlatformWaStatus>("disconnected");
  const [instanceName, setInstanceName] = useState("");
  const [displayPhone, setDisplayPhone] = useState<string | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const apply = useCallback((payload: PlatformWaPayload) => {
    if (payload.instance_name) setInstanceName(payload.instance_name);
    if (payload.status) setStatus(payload.status);
    setDisplayPhone(payload.display_phone ?? null);
    setQrcode(payload.qrcode ?? null);
    setLastError(payload.last_error ?? null);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = await callPlatformWhatsApp("status");
      apply(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o WhatsApp.");
    } finally {
      setBusy(false);
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!qrOpen || status === "open") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const payload = await callPlatformWhatsApp("status");
          apply(payload);
          if (payload.status === "open") {
            setQrOpen(false);
            setMessage("WhatsApp da plataforma conectado.");
          }
        } catch {
          /* ignore polling errors */
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [qrOpen, status, apply]);

  async function connect() {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callPlatformWhatsApp("connect");
      apply(payload);
      if (payload.qrcode) setQrOpen(true);
      setMessage(
        payload.status === "open"
          ? "WhatsApp da plataforma conectado."
          : "Escaneie o QR com o WhatsApp que enviará os códigos de cadastro.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const payload = await callPlatformWhatsApp("logout");
      apply(payload);
      setQrcode(null);
      setMessage("WhatsApp da plataforma desconectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-2 text-primary">
          <MessageCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">WhatsApp da plataforma</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Número que envia o código no cadastro (
            <code className="font-mono">/cadastrar</code>
            ). Instância Evolution no Coolify
            {instanceName ? (
              <>
                : <code className="font-mono">{instanceName}</code>
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 font-semibold">
          {statusLabel[status]}
        </span>
        {displayPhone && <span className="text-muted-foreground">{displayPhone}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void connect()}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <QrCode className="size-4" />
          {status === "open" ? "Reconectar" : "Conectar WhatsApp"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          Atualizar
        </button>
        {status === "open" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive disabled:opacity-50"
          >
            <Unplug className="size-4" />
            Desconectar
          </button>
        )}
        {qrcode && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
          >
            <Link2 className="size-4" />
            Ver QR
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {lastError && (
        <p className="text-xs text-muted-foreground">Último erro: {lastError}</p>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">Escaneie o QR Code</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho. Use o número da
            Contheiner (plataforma), não o da loja.
          </DialogDescription>
          {qrcode ? (
            <img
              src={qrcode}
              alt="QR Code do WhatsApp da plataforma"
              className="mx-auto mt-2 size-56 rounded-2xl"
            />
          ) : (
            <p className="text-sm text-muted-foreground">QR indisponível. Toque em Conectar novamente.</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="mt-2 min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
          >
            Já escaneei — atualizar status
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
