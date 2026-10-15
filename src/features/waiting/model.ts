import { t, type MessageKey } from "../../lib/i18n/index.ts";

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
/**
 * Vagas da lista de espera que o cliente pode pegar em Agendar. Com um profissional escolhido,
 * só as dele; com "Qualquer profissional" (`staffId` nulo), as de todos. Em ambos os casos a
 * vaga precisa ser de quem faz o serviço e caber na duração dele (`durationFor` devolve `null`
 * quando o profissional não faz o serviço) — a mesma conta que o banco faz ao entrar na espera.
 */
export function waitOpportunities(
  waits: SlotWait[],
  opts: {
    staffId: string | null;
    durationFor: (staffId: string) => number | null;
    day: string;
    dayOf: (startsAt: string) => string;
    now: Date;
  },
) {
  return waits.filter((w) => {
    if (w.has_interest || Date.parse(w.hold_until) <= +opts.now) return false;
    if (opts.staffId !== null && w.staff_id !== opts.staffId) return false;
    if (opts.dayOf(w.starts_at) !== opts.day) return false;
    const duration = opts.durationFor(w.staff_id);
    return duration !== null && duration * 60000 <= Date.parse(w.ends_at) - Date.parse(w.starts_at);
  });
}
const eventKinds = ["exclusive", "expired", "restored", "disabled", "claimed", "left"];
/** Texto do aviso no idioma atual; tipo desconhecido vira um aviso genérico (nunca o código cru). */
export function eventLabel(kind: string) {
  return eventKinds.includes(kind)
    ? t(`wait.event.${kind}` as MessageKey)
    : t("wait.event.unknown");
}
