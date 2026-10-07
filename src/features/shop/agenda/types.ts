import { Scissors } from "lucide-react";
import {
  APPOINTMENT_DERIVED,
  APPOINTMENT_STATUS,
  STATE,
  type StatusMeta,
} from "@/components/visual";
import type { CancellationReason } from "@/features/insights/cancellation";
import type { Tables } from "@/integrations/supabase/types";
import type { MessageKey } from "@/lib/i18n";
import type { AgendaGroup } from "./model";

/** Atendimento do dia como a Agenda recebe (consulta direta ou `get_team_schedule`). */
export type DayAppointment = Tables<"appointments"> & {
  service: Pick<Tables<"services">, "name" | "price_cents"> | null;
  staff: Pick<Tables<"staff">, "display_name"> | null;
  customer: Pick<Tables<"profiles">, "full_name"> | null;
  /** `busy`: horário de outro profissional, sem dados do cliente (privacidade). */
  visibility?: "full" | "busy";
};

export type AgendaBlock = Tables<"availability_blocks"> & {
  staff: Pick<Tables<"staff">, "display_name"> | null;
};

export type CancellationDetail = {
  reason: CancellationReason | null;
  source: "customer" | "shop";
};

/** Estado mostrado no selo do cartão: os grupos do dia e dois estados de momento. */
export type CardState = AgendaGroup | "inProgress" | "noShow";

/**
 * Situações do ponto de vista da barbearia. Cores e ícones são os do sistema (mesmo estado =
 * mesma cara em todo o app); só o rótulo muda para dizer quem precisa agir.
 */
export const AGENDA_STATE: Record<CardState, StatusMeta & { labelKey: MessageKey }> = {
  completed: { ...APPOINTMENT_STATUS.completed, labelKey: "agenda.state.completed" },
  // "Passou do horário" pede uma ação da barbearia (dar baixa): é o "Precisa de ação" do
  // sistema (STATE.attention, ⚠ laranja) no selo, na pílula, no cartão (contorno tracejado) e
  // em "Precisa da sua atenção". Fica distinto pela forma do "Cliente vai remarcar" (mesma
  // família laranja do sistema, ícone de calendário, a vez é do cliente) e do "Próximo"
  // (contorno dourado contínuo).
  unresolved: { ...STATE.attention, labelKey: "agenda.state.unresolved" },
  confirmed: { ...APPOINTMENT_STATUS.confirmed, labelKey: "agenda.state.confirmed" },
  pending: { ...APPOINTMENT_STATUS.pending, labelKey: "agenda.state.pending" },
  reschedule_requested: {
    ...APPOINTMENT_STATUS.reschedule_requested,
    labelKey: "agenda.state.reschedule",
  },
  cancelled: { ...APPOINTMENT_STATUS.cancelled, labelKey: "agenda.state.cancelled" },
  // "Agora" (em atendimento) segue o dourado da linha "Agora · 09:00", separado do azul de
  // "Confirmado" (agendado).
  inProgress: { tone: "highlight", icon: Scissors, labelKey: "agenda.state.inProgress" },
  noShow: { ...APPOINTMENT_DERIVED.noShow, labelKey: "agenda.state.noShow" },
};

export const ON_HOLD_STATE: StatusMeta & { labelKey: MessageKey } = {
  ...APPOINTMENT_DERIVED.onHold,
  labelKey: "agenda.state.onHold",
};

/** Ação em andamento ou que falhou em um cartão. */
export type CardAction = "confirm" | "complete";
export type CardFeedback = { action: CardAction; state: "saving" | "error" };
