import type { WaitingController } from "@/features/waiting/useWaiting";

/**
 * Vagas liberadas para o cliente: a espera do dono original acabou e o prazo para confirmar
 * ainda corre (fase "exclusiva" da lista de espera).
 */
export function offersFor(waiting: WaitingController) {
  const nowMs = +waiting.now;
  return waiting.waits.filter(
    (wait) =>
      wait.mine && Date.parse(wait.hold_until) <= nowMs && Date.parse(wait.claim_until) > nowMs,
  );
}
