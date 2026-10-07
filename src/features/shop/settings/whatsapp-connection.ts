import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import type { MessageKey } from "@/lib/i18n";
import { CONNECTION_STATE } from "./connection-state";

type Channel = Tables<"whatsapp_channels">;

/**
 * Estado do WhatsApp da barbearia, igual no cartão de Avisos e no menu de Ajustes. Tom e ícone
 * vêm do mapa comum de conexões (o mesmo do Google): caiu ou "ação necessária" = atenção.
 */
export type Connection =
  | "checking"
  | "none"
  | "open"
  | "paused"
  | "waitingQr"
  | "disconnected"
  | "attention";

export const CONNECTION_META: Record<
  Connection,
  { tone: Tone; icon: LucideIcon; label: MessageKey; result: MessageKey }
> = {
  checking: {
    ...CONNECTION_STATE.checking,
    label: "integr.wa.state.checking",
    result: "integr.wa.result.checking",
  },
  none: {
    ...CONNECTION_STATE.off,
    label: "integr.wa.state.none",
    result: "integr.wa.result.none",
  },
  open: {
    ...CONNECTION_STATE.ok,
    label: "integr.wa.status.open",
    result: "integr.wa.result.open",
  },
  paused: {
    ...CONNECTION_STATE.paused,
    label: "integr.wa.state.paused",
    result: "integr.wa.result.paused",
  },
  waitingQr: {
    ...CONNECTION_STATE.waiting,
    label: "integr.wa.state.waitingQr",
    result: "integr.wa.result.waitingQr",
  },
  disconnected: {
    ...CONNECTION_STATE.action,
    label: "integr.wa.status.disconnected",
    result: "integr.wa.result.stopped",
  },
  attention: {
    ...CONNECTION_STATE.action,
    label: "integr.wa.state.attention",
    result: "integr.wa.result.stopped",
  },
};

export function connectionOf(
  channel: Pick<Channel, "status" | "enabled" | "last_error"> | null | undefined,
  checked: boolean,
): Connection {
  if (!checked) return "checking";
  if (!channel) return "none";
  if (channel.status === "open") return channel.enabled ? "open" : "paused";
  if (channel.status === "qr" || channel.status === "connecting") return "waitingQr";
  return channel.last_error ? "attention" : "disconnected";
}
