import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEBOUNCE_MS = 400;
/** Consulta leve ao último sinal enquanto o tempo real não estiver conectado. */
const POLL_MS = 15_000;
/** Depois de uma falha do tempo real, tenta conectar de novo só depois deste intervalo. */
const REALTIME_RETRY_MS = 5 * 60_000;

/**
 * Avisa quando a agenda da loja muda (atendimento, bloqueio, espera, expediente ou serviços do
 * profissional). O banco grava um sinal sem dado pessoal em `availability_signals`; aqui ele chega
 * pelo Realtime ou, se o Realtime estiver fora, por uma consulta curta a cada 15 s. A tela refaz a
 * própria consulta em `onChange`. O recarregamento periódico de cada tela continua como reserva.
 */
export function useAvailabilitySignal(shopId: string | null | undefined, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!shopId || typeof window === "undefined") return;
    let disposed = false;
    let live = false;
    let lastSeen: string | null | undefined;
    let channel: RealtimeChannel | null = null;
    let debounceTimer: number | undefined;
    let retryTimer: number | undefined;

    const notify = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!disposed) onChangeRef.current();
      }, DEBOUNCE_MS);
    };

    const poll = async () => {
      if (disposed || live || document.visibilityState !== "visible") return;
      const { data, error } = await supabase
        .from("availability_signals")
        .select("changed_at")
        .eq("barbershop_id", shopId)
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (disposed || error) return;
      const latest = data?.changed_at ?? null;
      if (lastSeen !== undefined && latest !== lastSeen) notify();
      lastSeen = latest;
    };

    const subscribe = () => {
      if (disposed) return;
      const current = supabase
        .channel(`availability:${shopId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "availability_signals",
            filter: `barbershop_id=eq.${shopId}`,
          },
          notify,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            live = true;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            const wasLive = live;
            live = false;
            if (channel === current) {
              channel = null;
              void supabase.removeChannel(current);
              window.clearTimeout(retryTimer);
              retryTimer = window.setTimeout(subscribe, REALTIME_RETRY_MS);
            }
            // Pode ter perdido mudanças enquanto caía: confere já pelo sinal.
            if (wasLive) void poll();
          }
        });
      channel = current;
    };

    void poll();
    subscribe();
    const pollTimer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(debounceTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [shopId]);
}
