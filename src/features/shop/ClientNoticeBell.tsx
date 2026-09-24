import { useState } from "react";
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
      const channels = (data as { channels?: string[] } | null)?.channels ?? [];
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
        title="Enviar aviso"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:border-gold hover:text-gold"
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
            Escolha um aviso para {customerName ?? "o cliente"}. Envia no WhatsApp (número + opt-in
            no perfil e canal da loja conectado) e/ou no e-mail da conta. No máximo 1 aviso a cada
            30 minutos por cliente.
          </DialogDescription>
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
