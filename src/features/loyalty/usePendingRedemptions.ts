import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

export type PendingRedemption = {
  id: string;
  reward_name: string;
  cost_points: number;
  expires_at: string;
};

/** Máximo de prêmios esperando retirada ao mesmo tempo (regra do servidor). */
export const MAX_PENDING_REDEMPTIONS = 3;

/**
 * Prêmios trocados que ainda esperam retirada na barbearia. Uma só consulta para o Início, os
 * Avisos e Meus pontos; `refreshKey` recarrega depois de trocar ou desistir.
 */
export function usePendingRedemptions(
  userId: string | null,
  shopId: string | null,
  refreshKey = 0,
): PendingRedemption[] {
  const demo = useDemo();
  const [rows, setRows] = useState<PendingRedemption[]>([]);

  useEffect(() => {
    if (demo || !userId || !shopId) return;
    let cancelled = false;
    void supabase
      .from("loyalty_redemptions")
      .select("id, reward_name, cost_points, expires_at")
      .eq("user_id", userId)
      .eq("barbershop_id", shopId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!cancelled && !error) setRows((data ?? []) as PendingRedemption[]);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, userId, shopId, refreshKey]);

  if (demo) return demo.redemptions.filter((row) => row.status === "pending");
  return rows;
}
