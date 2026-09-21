export type SlotWait = {
  id: string;
  appointment_id: string | null;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  hold_until: string;
  claim_until: string;
  state: "holding" | "exclusive" | "released" | "restored" | "claimed" | "disabled";
  mine: boolean;
  has_interest: boolean;
  service_id: string | null;
  restorable: boolean;
};
export type WaitingEvent = {
  id: string;
  wait_id: string;
  user_id: string;
  kind: string;
  starts_at: string;
  created_at: string;
  deadline?: string | null;
};
export type WaitingSnapshot = { server_now: string; waits: SlotWait[]; events: WaitingEvent[] };
export type WaitAction = "join" | "leave" | "claim" | "restore";
export const HOLD_MINUTES = 10;
export const CLAIM_MINUTES = 5;
export function canHold(startsAt: string, now: Date, enabled: boolean, cutoff: number) {
  return (
    enabled &&
    Number.isInteger(cutoff) &&
    cutoff >= 0 &&
    cutoff <= 1440 &&
    new Date(startsAt).getTime() - now.getTime() >= (cutoff + HOLD_MINUTES + CLAIM_MINUTES) * 60000
  );
}
export function blocksSlot(w: SlotWait, now: Date) {
  return (
    (w.state === "holding" || w.state === "exclusive") &&
    (Date.parse(w.hold_until) > +now || (w.has_interest && Date.parse(w.claim_until) > +now))
  );
}
export function remaining(deadline: string, now: Date) {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - +now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function cutoffExample(cutoff: number) {
  const display = (minutes: number) => {
    const date = new Date(2026, 0, 2, 15, -minutes);
    return `${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${date.getDate() === 1 ? " do dia anterior" : ""}`;
  };
  return `Para um atendimento às 15h, a espera pode começar até ${display(cutoff + 15)} e termina até ${display(cutoff)}. Depois de ${display(cutoff + 15)}, retirar a confirmação libera o horário imediatamente.`;
}
export const eventLabels: Record<string, string> = {
  exclusive: "Vaga liberada para você. Confirme dentro do prazo.",
  expired: "O prazo da espera terminou. O horário voltou ao calendário.",
  restored: "A reserva original foi mantida. Esta vaga não foi liberada.",
  disabled: "A barbearia desligou a espera. O horário foi liberado no calendário.",
  claimed: "Você confirmou o horário. Sua reserva está em Agendamentos.",
  left: "Você saiu da espera por este horário.",
};
