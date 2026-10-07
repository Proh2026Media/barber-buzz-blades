import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Hourglass,
  Loader2,
  Moon,
  PauseCircle,
  Sparkles,
  Timer,
  TimerOff,
  UserX,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/lib/i18n";
import type { Tone } from "./tones";

export type StatusMeta = { tone: Tone; icon: LucideIcon };

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

/**
 * Situação do atendimento — a mesma cor e o mesmo ícone na agenda da loja, nas reservas do
 * cliente, no histórico e na plataforma. Confirmar é azul, concluir é verde e cancelar é
 * vermelho, como os botões de ação aprovados.
 */
export const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusMeta & { labelKey: MessageKey }> =
  {
    pending: { tone: "pending", icon: Hourglass, labelKey: "status.pending" },
    confirmed: { tone: "info", icon: CalendarCheck, labelKey: "status.confirmed" },
    completed: { tone: "success", icon: CheckCircle2, labelKey: "status.completed" },
    reschedule_requested: {
      tone: "warning",
      icon: CalendarClock,
      labelKey: "status.reschedule_requested",
    },
    cancelled: { tone: "danger", icon: XCircle, labelKey: "status.cancelled" },
  };

/**
 * Situações derivadas do atendimento, calculadas pela tela (o rótulo vem da própria tela).
 * `noShow`: o cliente não veio. `onHold`: horário em espera. `unresolved`: já passou e
 * ninguém deu baixa.
 */
export const APPOINTMENT_DERIVED: Record<"noShow" | "onHold" | "unresolved", StatusMeta> = {
  noShow: { tone: "danger", icon: UserX },
  onHold: { tone: "pending", icon: Timer },
  unresolved: { tone: "neutral", icon: Clock3 },
};

/**
 * Vocabulário de estados fora da agenda. Use com `<StatusBadge {...STATE.paused} label=… />`
 * para que "pausado", "aguardando" ou "conectado" tenham a mesma cara em todo o sistema.
 */
export const STATE = {
  /** Ativo, visível, ligado, conectado, aberto, aprovado, salvo. */
  active: { tone: "success", icon: CheckCircle2 },
  /** Pausado, inativo, oculto, desligado. */
  paused: { tone: "neutral", icon: PauseCircle },
  /** Fechado (loja, dia, horário). */
  closed: { tone: "neutral", icon: Moon },
  /** Vencido, expirou. */
  expired: { tone: "neutral", icon: TimerOff },
  /** Aguardando alguém: aprovação, leitura do QR, resposta do cliente. */
  waiting: { tone: "pending", icon: Hourglass },
  /** Precisa de uma ação da pessoa. */
  attention: { tone: "warning", icon: AlertTriangle },
  /** Agendado para depois (aviso agendado, mudança marcada). */
  scheduled: { tone: "info", icon: CalendarClock },
  /** Em andamento: salvando, conectando, enviando. */
  working: { tone: "progress", icon: Loader2 },
  /** Bloqueado (horário, acesso). */
  blocked: { tone: "danger", icon: Ban },
  /** Erro, falhou, recusado. */
  failed: { tone: "danger", icon: XCircle },
  /** Destaque: padrão, fundador, recomendado. */
  featured: { tone: "highlight", icon: Sparkles },
} as const satisfies Record<string, StatusMeta>;

/** Resultado de uma ação que grava algo (botões, salvamentos, aprovações). */
export type ActionState = "saving" | "saved" | "pending" | "error";

export const ACTION_STATE: Record<ActionState, StatusMeta & { textKey: MessageKey }> = {
  saving: { tone: "progress", icon: Loader2, textKey: "visual.result.saving" },
  saved: { tone: "success", icon: CheckCircle2, textKey: "visual.result.saved" },
  pending: { tone: "pending", icon: Hourglass, textKey: "visual.result.pending" },
  error: { tone: "danger", icon: XCircle, textKey: "visual.result.error" },
};
