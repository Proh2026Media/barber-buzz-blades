import { t, type MessageKey } from "../../lib/i18n/index.ts";
import { shopDateKey } from "../../lib/shop/appointments.ts";

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
 * Vagas da lista de espera que o cliente pode pegar em Agendar. É a única conta: a grade
 * ("pode vagar") e os cartões usam o resultado. `staffId` = profissional escolhido; `null` =
 * "Qualquer profissional" (as vagas de todos). A vaga só entra se o profissional dela faz o
 * serviço e a duração dele cabe no intervalo (`durationFor` devolve `null` quando não faz) — a
 * mesma conta de `waiting_action('join')` no banco. Dia no fuso da loja. Ordem: horário e, no
 * mesmo horário, o profissional (estável entre as consultas a cada 10 s).
 */
export function waitOpportunities(
  waits: SlotWait[],
  opts: {
    staffId: string | null;
    durationFor: (staffId: string) => number | null;
    day: string;
    timeZone: string;
    now: Date;
  },
): SlotWait[] {
  return waits
    .filter((w) => {
      if (w.has_interest || Date.parse(w.hold_until) <= +opts.now) return false;
      if (opts.staffId !== null && w.staff_id !== opts.staffId) return false;
      if (shopDateKey(new Date(w.starts_at), opts.timeZone) !== opts.day) return false;
      const duration = opts.durationFor(w.staff_id);
      return (
        duration !== null && duration * 60000 <= Date.parse(w.ends_at) - Date.parse(w.starts_at)
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.staff_id.localeCompare(b.staff_id),
    );
}
/**
 * Selos "pode vagar" da grade: um por horário. Vagas de dois profissionais no mesmo início
 * ("Qualquer profissional") viram um selo só, que leva ao primeiro cartão daquele horário.
 */
export function mayOpenStarts(opportunities: SlotWait[]) {
  const first = new Map<string, string>();
  for (const w of opportunities) {
    const iso = new Date(w.starts_at).toISOString();
    if (!first.has(iso)) first.set(iso, w.id);
  }
  return [...first].map(([iso, waitId]) => ({ iso, waitId }));
}
const eventKinds = ["exclusive", "expired", "restored", "disabled", "claimed", "left"];
/** Texto do aviso no idioma atual; tipo desconhecido vira um aviso genérico (nunca o código cru). */
export function eventLabel(kind: string) {
  return eventKinds.includes(kind)
    ? t(`wait.event.${kind}` as MessageKey)
    : t("wait.event.unknown");
}
