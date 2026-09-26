import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const PRESETS = [
  {
    id: "reminder_next" as const,
    title: "Lembrete do próximo horário",
    hint: "Avisa sobre o próximo atendimento marcado.",
  },
  {
    id: "confirm_today" as const,
    title: "Confirmar se vem hoje",
    hint: "Pede confirmação para o horário de hoje.",
  },
  {
    id: "slot_open" as const,
    title: "Vaga disponível",
    hint: "Informa que abriu uma vaga.",
  },
  {
    id: "shop_hello" as const,
    title: "Aviso da loja",
    hint: "Mensagem curta e genérica da barbearia.",
  },
];

type NoticePreset = (typeof PRESETS)[number]["id"];

function formatWait(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? "1 minuto" : `${m} minutos`;
}

export function ClientNoticeBell({
  shopId,
  customerId,
  customerName,
}: {
  shopId: string;
  customerId: string;
  customerName: string | null;
}) {
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  async function refreshPending() {
    if (demo) return;
    const { data } = await supabase.rpc("get_client_notice_pending", {
      p_shop_id: shopId,
      p_customer_id: customerId,
    });
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const payload = data as {
      pending?: { preset?: string } | null;
      wait_seconds?: number;
    };
    setPendingPreset(payload.pending?.preset ?? null);
    setWaitSeconds(Number(payload.wait_seconds) || 0);
  }

  useEffect(() => {
    if (!open) return;
    void refreshPending();
  }, [open, shopId, customerId]);

  async function send(preset: NoticePreset) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (demo) {
        setMessage("Na demonstração o aviso só aparece aqui.");
        setOpen(false);
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("send_client_notice", {
        p_shop_id: shopId,
        p_customer_id: customerId,
        p_preset: preset,
      });
      if (rpcError) {
        throw new Error(rpcError.message || "Não foi possível enviar o aviso.");
      }
      const result = data as {
        channels?: string[];
        status?: string;
        wait_seconds?: number;
        preset?: string;
      } | null;
      if (result?.status === "queued") {
        const wait = Number(result.wait_seconds) || 0;
        setPendingPreset(result.preset ?? preset);
        setWaitSeconds(wait);
        setMessage(
          `Agendado — envia automaticamente em ${formatWait(wait)} (último aviso escolhido).`,
        );
        setOpen(false);
        return;
      }
      const channels = result?.channels ?? [];
      setPendingPreset(null);
      setWaitSeconds(0);
      setMessage(
        channels.length
          ? `Enviado por ${channels.join(" e ")}.`
          : "Aviso registrado.",
      );
      setOpen(false);
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : null;
      setError(detail || "Não foi possível enviar o aviso.");
    } finally {
      setBusy(false);
    }
  }

  const pendingLabel = PRESETS.find((row) => row.id === pendingPreset)?.title;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
          setError(null);
        }}
        aria-label={`Enviar aviso para ${customerName ?? "cliente"}`}
        title={pendingPreset ? "Aviso agendado" : "Enviar aviso"}
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
          pendingPreset
            ? "border-gold text-gold"
            : "border-border text-muted-foreground hover:border-gold hover:text-gold"
        }`}
      >
        <Bell className="size-4" />
      </button>

      {(message || error) && !open && (
        <span className="sr-only" role="status">
          {message ?? error}
        </span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-sm rounded-3xl border-border bg-card p-5"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogTitle className="text-base font-extrabold">Enviar aviso</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha um aviso para {customerName ?? "o cliente"}. Envia no WhatsApp e/ou e-mail. Se
            ainda estiver no intervalo de 30 minutos, o último gatilho fica agendado e sai
            automaticamente.
          </DialogDescription>
          {pendingPreset && (
            <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
              Agendado: <strong>{pendingLabel ?? pendingPreset}</strong>
              {waitSeconds > 0 ? ` — envia em ${formatWait(waitSeconds)}.` : "."}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => void send(preset.id)}
                className="flex w-full flex-col gap-0.5 rounded-xl border border-border px-3 py-3 text-left hover:border-primary disabled:opacity-50"
              >
                <span className="text-sm font-semibold">{preset.title}</span>
                <span className="text-xs text-muted-foreground">{preset.hint}</span>
              </button>
            ))}
          </div>
          {busy && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Enviando…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
