import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  ScanLine,
  Unplug,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/visual";

/**
 * Estados de uma conexão externa (WhatsApp, Google), com o mesmo tom e o mesmo ícone em todo
 * lugar: cartão de Avisos, menu de Ajustes e "Precisa da sua atenção".
 */
export type ConnectionState = "checking" | "off" | "waiting" | "ok" | "paused" | "action" | "error";

export const CONNECTION_STATE: Record<ConnectionState, { tone: Tone; icon: LucideIcon }> = {
  /** Verificando agora. */
  checking: { tone: "progress", icon: Loader2 },
  /** Nunca conectado. */
  off: { tone: "neutral", icon: Unplug },
  /** Esperando a pessoa terminar (ler o QR). */
  waiting: { tone: "pending", icon: ScanLine },
  /** Conectado e funcionando. */
  ok: { tone: "success", icon: CheckCircle2 },
  /** Conectado, mas desligado pela própria loja. */
  paused: { tone: "neutral", icon: PauseCircle },
  /** Caiu ou pede uma ação da loja (reconectar). */
  action: { tone: "warning", icon: AlertTriangle },
  /** Erro que a loja não resolve sozinha. */
  error: { tone: "danger", icon: XCircle },
};
