import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { Link2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";

type PlatformWaStatus = "disconnected" | "qr" | "connecting" | "open";

type PlatformWaPayload = {
  error?: string;
  instance_name?: string;
  status?: PlatformWaStatus;
  display_phone?: string | null;
  qrcode?: string | null;
  last_error?: string | null;
};

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

const statusKey = {
  disconnected: "integr.wa.status.disconnected",
  qr: "integr.wa.status.qr",
  connecting: "integr.wa.status.connecting",
  open: "integr.wa.status.open",
} as const satisfies Record<PlatformWaStatus, MessageKey>;

async function callPlatformWhatsApp(action: "status" | "connect" | "logout") {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("integr.err.session"));

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
  if (!response.ok) throw new Error(payload.error || tNow("integr.platformWa.errGeneric"));
  return payload;
}

/**
 * Admin: conecta o WhatsApp usado no OTP de /cadastrar (instância PLATFORM_EVOLUTION_INSTANCE).
 */
export function PlatformWhatsAppCard() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : tNow("integr.wa.errStatus"));
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
            setMessage(tNow("integr.platformWa.connected"));
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
          ? t("integr.platformWa.connected")
          : t("integr.platformWa.scanQr"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("integr.wa.errConnect"));
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
      setMessage(t("integr.platformWa.disconnected"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("integr.wa.errDisconnect"));
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
          <h3 className="text-sm font-bold">{t("integr.platformWa.title")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {richText(
              instanceName ? t("integr.platformWa.introInstance") : t("integr.platformWa.intro"),
              {
                path: <code className="font-mono">/cadastrar</code>,
                instance: <code className="font-mono">{instanceName}</code>,
              },
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 font-semibold">
          {t(statusKey[status])}
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
          {status === "open" ? t("integr.wa.reconnect") : t("integr.wa.connect")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t("integr.refresh")}
        </button>
        {status === "open" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive disabled:opacity-50"
          >
            <Unplug className="size-4" />
            {t("integr.disconnect")}
          </button>
        )}
        {qrcode && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
          >
            <Link2 className="size-4" />
            {t("integr.wa.showQr")}
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
        <p className="text-xs text-muted-foreground">
          {t("integr.platformWa.lastError", { error: lastError })}
        </p>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">{t("integr.wa.qrTitle")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("integr.platformWa.qrSteps")}
          </DialogDescription>
          {qrcode ? (
            <img
              src={qrcode}
              alt={t("integr.platformWa.qrAlt")}
              className="mx-auto mt-2 size-56 rounded-2xl"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("integr.wa.qrUnavailable")}</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="mt-2 min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
          >
            {t("integr.wa.scanned")}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
