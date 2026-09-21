import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "../demo/context";
import { waitingDemoAction } from "./demo";
import { blocksSlot, type WaitAction, type WaitingSnapshot } from "./model";

export function useWaiting(shopId: string | null | undefined, admin = false) {
  const demo = useDemo();
  const [snapshot, setSnapshot] = useState<WaitingSnapshot>({
    server_now: new Date().toISOString(),
    waits: [],
    events: [],
  });
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
      setError(error.message);
      return;
    }
    const result = data as unknown as WaitingSnapshot;
    offset.current = Date.parse(result.server_now) - Date.now();
    setNow(new Date(Date.now() + offset.current));
    setSnapshot(result);
    setError(null);
  }, [shopId, demo]);
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
      setError(
        error instanceof Error
          ? error.message
          : ((error as { message?: string }).message ?? "Não foi possível atualizar a espera."),
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
