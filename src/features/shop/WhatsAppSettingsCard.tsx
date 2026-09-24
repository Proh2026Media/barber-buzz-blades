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
type TemplateKey =
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder";

type WhatsAppSettingsCardProps = {
  shopId: string;
};

const TEMPLATE_META: Array<{ key: TemplateKey; title: string; hint: string }> = [
  {
    key: "booking.confirmed",
    title: "Confirmação",
    hint: "Enviada ao criar ou confirmar o horário.",
  },
  {
    key: "booking.rescheduled",
    title: "Remarcação",
    hint: "Enviada quando muda data, profissional ou serviço.",
  },
  {
    key: "booking.cancelled",
    title: "Cancelamento",
    hint: "Enviada quando o horário é cancelado.",
  },
  {
    key: "booking.reminder",
    title: "Lembrete",
    hint: "Enviada antes do atendimento (conforme horas do lembrete).",
  },
];

const DEFAULT_BODIES: Record<TemplateKey, string> = {
  "booking.confirmed":
    "{{loja}}\nSeu horário está confirmado.\n{{servico}} com {{profissional}}\n{{quando}}\n\nGerenciar: {{link_reserva}}",
  "booking.cancelled":
    "{{loja}}\nSeu horário foi cancelado.\n{{servico}} — {{quando}}\n\n{{link_reserva}}",
  "booking.rescheduled":
    "{{loja}}\nSeu horário foi remarcado.\n{{servico}} com {{profissional}}\nNovo horário: {{quando}}\n\n{{link_reserva}}",
  "booking.reminder":
    "{{loja}}\nLembrete do seu horário.\n{{servico}} com {{profissional}}\n{{quando}}\n\n{{link_reserva}}",
};

const PLACEHOLDER_HELP =
  "Use {{loja}}, {{servico}}, {{profissional}}, {{quando}}, {{cliente}} e {{link_reserva}}. Máximo 1000 caracteres.";

function previewBody(body: string) {
  const sample: Record<string, string> = {
    loja: "Barbearia Exemplo",
    shop: "Barbearia Exemplo",
    servico: "Corte",
    service: "Corte",
    profissional: "João",
    staff: "João",
    quando: "24/09/2026 às 15:00",
    when: "24/09/2026 às 15:00",
    cliente: "Carlos",
    customer: "Carlos",
    link_reserva: "https://exemplo.beauty.contheiner.digital/app?tab=reservas&reserva=abc",
    link: "https://exemplo.beauty.contheiner.digital/app?tab=reservas&reserva=abc",
  };
  let result = body;
  for (const [key, value] of Object.entries(sample)) {
    result = result.split(`{{${key}}}`).join(value);
  }
  return result.replace(/\{\{[a-z_]+\}\}/gi, "").trim();
}

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
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({ ...DEFAULT_BODIES });
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>("booking.confirmed");
  const [templatesDirty, setTemplatesDirty] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (demo) {
      setTemplates({ ...DEFAULT_BODIES });
      setTemplatesDirty(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("whatsapp_message_templates")
      .select("template_key, body")
      .eq("barbershop_id", shopId);
    if (loadError) {
      // Migration ainda não aplicada: segue com os textos padrão.
      setTemplates({ ...DEFAULT_BODIES });
      setTemplatesDirty(false);
      return;
    }
    const next = { ...DEFAULT_BODIES };
    for (const row of data ?? []) {
      if (row.template_key in next) {
        next[row.template_key as TemplateKey] = row.body;
      }
    }
    setTemplates(next);
    setTemplatesDirty(false);
  }, [demo, shopId]);

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
      await loadTemplates();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callChannel({ action: "status", barbershop_id: shopId });
      setChannel(payload.channel ?? null);
      setQrcode(payload.qrcode ?? null);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o WhatsApp.");
    } finally {
      setBusy(false);
    }
  }, [demo, loadTemplates, shopId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!qrOpen || channel?.status === "open") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const payload = await callChannel({ action: "status", barbershop_id: shopId });
          setChannel(payload.channel ?? null);
          setQrcode(payload.qrcode ?? null);
          if (payload.channel?.status === "open") {
            setQrOpen(false);
            setMessage("WhatsApp conectado.");
          }
        } catch {
          /* ignore polling errors */
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [qrOpen, channel?.status, shopId]);

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

  async function saveTemplates() {
    if (demo) {
      setTemplatesDirty(false);
      setMessage("Na demonstração as mensagens ficam só nesta sessão.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = TEMPLATE_META.map(({ key }) => ({
        barbershop_id: shopId,
        template_key: key,
        body: templates[key].trim().slice(0, 1000),
      }));
      for (const row of rows) {
        if (!row.body) throw new Error("Nenhuma mensagem pode ficar vazia.");
      }
      const { error: upsertError } = await supabase
        .from("whatsapp_message_templates")
        .upsert(rows, { onConflict: "barbershop_id,template_key" });
      if (upsertError) throw upsertError;
      setTemplatesDirty(false);
      setMessage("Textos do WhatsApp salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as mensagens.");
    } finally {
      setBusy(false);
    }
  }

  function resetActiveTemplate() {
    setTemplates((current) => ({
      ...current,
      [activeTemplate]: DEFAULT_BODIES[activeTemplate],
    }));
    setTemplatesDirty(true);
  }

  const activeBody = templates[activeTemplate];

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

      <div className="space-y-3 border-t border-border/60 pt-3">
        <div>
          <p className="text-sm font-semibold">Textos das mensagens</p>
          <p className="mt-1 text-xs text-muted-foreground">{PLACEHOLDER_HELP}</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tipo de mensagem">
          {TEMPLATE_META.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTemplate === item.key}
              onClick={() => setActiveTemplate(item.key)}
              className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition-colors ${
                activeTemplate === item.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {TEMPLATE_META.find((item) => item.key === activeTemplate)?.hint}
        </p>
        <label className="block space-y-2">
          <span className="sr-only">Texto da mensagem</span>
          <textarea
            value={activeBody}
            onChange={(event) => {
              const value = event.target.value.slice(0, 1000);
              setTemplates((current) => ({ ...current, [activeTemplate]: value }));
              setTemplatesDirty(true);
            }}
            rows={5}
            maxLength={1000}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <span className="block text-[11px] text-muted-foreground">{activeBody.length}/1000</span>
        </label>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prévia
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{previewBody(activeBody) || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !templatesDirty}
            onClick={() => void saveTemplates()}
            className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Salvar textos
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={resetActiveTemplate}
            className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
          >
            Restaurar padrão
          </button>
        </div>
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
