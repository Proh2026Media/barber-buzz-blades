import { useCallback, useEffect, useState } from "react";
import { Link2, MessageCircle, QrCode, RefreshCw, Unplug } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useDemo } from "@/features/demo/context";

type Channel = Tables<"whatsapp_channels">;

type WhatsAppSettingsCardProps = {
  shopId: string;
};

async function callChannel(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/whatsapp-channel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: string;
    channel?: Channel;
    qrcode?: string | null;
  };
  if (!response.ok) throw new Error(payload.error || "Falha no WhatsApp");
  return payload;
}

const statusLabel: Record<Channel["status"], string> = {
  disconnected: "Desconectado",
  qr: "Aguardando QR",
  connecting: "Conectando…",
  open: "Conectado",
};

export function WhatsAppSettingsCard({ shopId }: WhatsAppSettingsCardProps) {
  const demo = useDemo();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (demo) {
      setChannel({
        barbershop_id: shopId,
        instance_name: "demo-shop",
        status: "open",
        display_phone: "+5511999999999",
        enabled: true,
        notify_booking: true,
        notify_reminder: true,
        reminder_hours_before: 24,
        last_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({ action: "status", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o WhatsApp.");
    } finally {
      setBusy(false);
    }
  }, [demo, shopId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect() {
    if (demo) {
      setMessage("Na demonstração o WhatsApp aparece conectado.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callChannel({ action: "connect", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      if (payload.qrcode) setQrOpen(true);
      setMessage(
        payload.channel?.status === "open"
          ? "WhatsApp conectado."
          : "Escaneie o QR Code no celular com o WhatsApp da barbearia.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (demo) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({ action: "logout", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(null);
      setMessage("WhatsApp desconectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(patch: Partial<Channel>) {
    if (demo) {
      setChannel((current) => (current ? { ...current, ...patch } : current));
      return;
    }
    if (!channel) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({
        action: "settings",
        barbershop_id: shopId,
        notify_booking: patch.notify_booking ?? channel.notify_booking,
        notify_reminder: patch.notify_reminder ?? channel.notify_reminder,
        reminder_hours_before: patch.reminder_hours_before ?? channel.reminder_hours_before,
        enabled: patch.enabled ?? channel.enabled,
      });
      setChannel(payload.channel ?? null);
      setMessage("Preferências salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 size-5 text-gold" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">WhatsApp da barbearia</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Conecte o número da loja para avisar clientes sobre horários e enviar códigos de acesso.
            Cada barbearia usa o próprio WhatsApp.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2.5 py-1 font-semibold">
          {channel ? statusLabel[channel.status] : "Não configurado"}
        </span>
        {channel?.display_phone && (
          <span className="text-muted-foreground">{channel.display_phone}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void connect()}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <QrCode className="size-4" />
          {channel?.status === "open" ? "Reconectar" : "Conectar WhatsApp"}
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
        {channel?.status === "open" && (
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

      {channel && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Avisos de horário</p>
              <p className="text-xs text-muted-foreground">Confirmação, remarcação e cancelamento.</p>
            </div>
            <Switch
              checked={channel.notify_booking}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ notify_booking: checked })}
              aria-label="Avisos de horário"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Lembrete</p>
              <p className="text-xs text-muted-foreground">
                Aviso antes do atendimento ({channel.reminder_hours_before}h).
              </p>
            </div>
            <Switch
              checked={channel.notify_reminder}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ notify_reminder: checked })}
              aria-label="Lembrete de horário"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Canal ativo</p>
              <p className="text-xs text-muted-foreground">Pausa todos os envios sem desconectar.</p>
            </div>
            <Switch
              checked={channel.enabled}
              disabled={busy}
              onCheckedChange={(checked) => void saveSettings({ enabled: checked })}
              aria-label="Canal ativo"
            />
          </div>
        </div>
      )}

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
      {channel?.last_error && (
        <p className="text-xs text-muted-foreground">Último erro: {channel.last_error}</p>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-border bg-card p-5">
          <DialogTitle className="text-base font-extrabold">Escaneie o QR Code</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho.
          </DialogDescription>
          {qrcode ? (
            <img src={qrcode} alt="QR Code do WhatsApp" className="mx-auto mt-2 size-56 rounded-2xl" />
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
