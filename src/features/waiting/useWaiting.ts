import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/translate";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useDemo } from "../demo/context";
import { waitingDemoAction } from "./demo";
import { blocksSlot, type WaitAction, type WaitingSnapshot } from "./model";

/** Mensagens fixas de `waiting_action` (em pt-BR no servidor) → chaves do dicionário. */
const SERVER_ERRORS: Array<[RegExp, MessageKey]> = [
  [/espera já foi encerrada/i, "wait.err.closed"],
  [/outro cliente já entrou/i, "wait.err.joinUnavailable"],
  [/já é o titular desta reserva/i, "fix.landing-espera-pwa.waitAlreadyHolder"],
  [/serviço indisponível para este intervalo/i, "wait.err.serviceInterval"],
  [/reserva original não pode mais ser restaurada/i, "wait.err.notRestorable"],
  [/vaga ainda não foi liberada/i, "wait.err.notReleased"],
  [/serviço ou profissional indisponível/i, "wait.err.serviceOrStaff"],
  [/invalid action/i, "wait.err.update"],
];

/** Traduz o erro do servidor para o idioma escolhido, sem texto cru em outra língua. */
function waitingErrorMessage(error: unknown) {
  const text =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message ?? "")
      : typeof error === "string"
        ? error
        : "";
  for (const [test, key] of SERVER_ERRORS) {
    if (test.test(text)) return t(key);
  }
  return friendlyAuthError(error, t("wait.err.update"));
}

const EMPTY_SNAPSHOT = (): WaitingSnapshot => ({
  server_now: new Date().toISOString(),
  waits: [],
  events: [],
});

export function useWaiting(shopId: string | null | undefined, admin = false) {
  const demo = useDemo();
  const [snapshot, setSnapshot] = useState<WaitingSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const offset = useRef(0);
  const requestId = useRef(0);
  const invalidate = useCallback(() => {
    requestId.current++;
  }, []);
  const refresh = useCallback(async () => {
    if (!shopId || demo) return;
    const id = ++requestId.current;
    const { data, error } = await supabase.rpc("get_waiting_state", { p_shop_id: shopId });
    if (id !== requestId.current) return;
    if (error) {
      setError(waitingErrorMessage(error));
      return;
    }
    const result = data as unknown as WaitingSnapshot;
    offset.current = Date.parse(result.server_now) - Date.now();
    setNow(new Date(Date.now() + offset.current));
    setSnapshot(result);
    setError(null);
  }, [shopId, demo]);
  // Ao trocar (ou perder) a loja, não deixa à mostra as esperas da loja anterior.
  useEffect(() => {
    setSnapshot(EMPTY_SNAPSHOT());
    setError(null);
  }, [shopId]);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), 10000);
    const tick = setInterval(() => setNow(new Date(Date.now() + offset.current)), 1000);
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("waiting-changed", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("focus", focus);
      window.removeEventListener("waiting-changed", focus);
      document.removeEventListener("visibilitychange", focus);
      invalidate();
    };
  }, [refresh, invalidate]);
  const act = async (id: string, action: WaitAction, serviceId?: string) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      if (demo) {
        waitingDemoAction(demo, id, action, serviceId);
        demo.dispatch({ type: "waiting.action", id, action, serviceId });
      } else {
        const { error } = await supabase.rpc("waiting_action", {
          p_id: id,
          p_action: action,
          p_service_id: serviceId ?? null,
        });
        if (error) throw error;
        await refresh();
      }
      window.dispatchEvent(new Event("waiting-changed"));
      return true;
    } catch (error) {
      // Na demonstração os erros já saem traduzidos do modelo local.
      setError(
        demo && error instanceof Error && error.message
          ? error.message
          : waitingErrorMessage(error),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const currentTime = demo?.now ?? now;
  const waits = demo
    ? demo.waits
        .filter(
          (w) =>
            blocksSlot(w, currentTime) &&
            (admin ||
              w.customer_id === demo.customerId ||
              (!w.customer_id && w.original_customer_id !== demo.customerId)),
        )
        .map((w) => ({ ...w, mine: w.customer_id === demo.customerId }))
    : snapshot.waits.filter((w) => blocksSlot(w, currentTime));
  const events = demo
    ? demo.waitingEvents
        .filter((e) => e.user_id === demo.customerId)
        .slice()
        .reverse()
    : snapshot.events;
  return { waits, events, now: currentTime, error, busy, act, refresh };
}
export type WaitingController = ReturnType<typeof useWaiting>;
