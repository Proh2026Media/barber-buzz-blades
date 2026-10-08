import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pendingHoursRequests, type PendingHours } from "./model";

/**
 * Pedidos de Horários esperando os sócios (funcionamento, bloqueios novos e remoções), lidos da
 * mesma lista de Ajustes → Equipe (`list_pending_shop_changes`). Assim o "Aguardando aprovação"
 * continua depois de recarregar a página. Só leitura; quem não pode ver a lista (o servidor
 * recusa) fica com `null` e a aba usa o que lembra desta visita.
 */
export function usePendingHours({
  shopId,
  enabled,
  revision,
}: {
  shopId: string;
  /** Desligado na demonstração (nada vai aos sócios). */
  enabled: boolean;
  /** Sobe a cada pedido enviado, para ler de novo. */
  revision: number;
}): PendingHours | null {
  const [pending, setPending] = useState<PendingHours | null>(null);

  useEffect(() => {
    if (!enabled || !shopId) return;
    let alive = true;
    // Quem está vendo (da sessão já aberta): separa "meu pedido" do pedido de outro sócio.
    void Promise.all([
      supabase.rpc("list_pending_shop_changes", { p_shop_id: shopId }),
      supabase.auth.getSession(),
    ]).then(([{ data, error }, { data: auth }]) => {
      if (alive && !error) setPending(pendingHoursRequests(data, auth.session?.user.id ?? null));
    });
    return () => {
      alive = false;
    };
  }, [shopId, enabled, revision]);

  return pending;
}
