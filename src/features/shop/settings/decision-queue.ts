import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

export type ChangeRequest = Tables<"shop_change_requests"> & {
  expires_at?: string | null;
  source?: string | null;
  checklist?: Json;
};

/**
 * Pedidos pendentes da barbearia e os que quem está vendo já aprovou (decisão em conjunto
 * com 3 ou mais donos: o pedido segue pendente até o último aprovar).
 */
export async function fetchDecisionQueue(shopId: string, me: string) {
  const listResult = await supabase.rpc("list_pending_shop_changes", { p_shop_id: shopId });
  let requests: ChangeRequest[];
  if (listResult.error) {
    // Alternativa se a função do servidor ainda não existir.
    const fallback = await supabase
      .from("shop_change_requests")
      .select("*")
      .eq("barbershop_id", shopId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30);
    if (fallback.error) return { error: fallback.error } as const;
    requests = (fallback.data as ChangeRequest[]) ?? [];
  } else {
    requests = Array.isArray(listResult.data) ? (listResult.data as ChangeRequest[]) : [];
  }
  // Quem já deu o OK em cada pedido (só leitura; a política "Partners read governance approvals"
  // deixa donos e sócios verem).
  const ids = requests.map((r) => r.id);
  const approvals = new Map<string, Set<string>>();
  if (ids.length) {
    const { data } = await supabase
      .from("shop_change_approvals")
      .select("request_id,user_id")
      .eq("approved", true)
      .in("request_id", ids);
    (data ?? []).forEach((row) => {
      const set = approvals.get(row.request_id) ?? new Set<string>();
      set.add(row.user_id);
      approvals.set(row.request_id, set);
    });
  }
  const approvedByMe = new Set(
    [...approvals].filter(([, users]) => users.has(me)).map(([id]) => id),
  );
  return { requests, approvals, approvedByMe } as const;
}

/** Pedidos que esperam a decisão de quem está vendo: de outra pessoa e ainda sem o seu OK. */
export function awaitingMe(requests: ChangeRequest[], me: string, approvedByMe: Set<string>) {
  return requests.filter(
    (r) => r.status === "pending" && r.requested_by !== me && !approvedByMe.has(r.id),
  );
}

/**
 * Quantas mudanças esperam a decisão de quem está vendo (bolha em Ajustes, aviso da Agenda e
 * menu de Ajustes). Conta igual ao painel de decisões: sem os próprios pedidos nem os já aprovados.
 */
export async function countDecisionsForMe(shopId: string, me: string): Promise<number | null> {
  const result = await fetchDecisionQueue(shopId, me);
  if ("error" in result) return null;
  return awaitingMe(result.requests, me, result.approvedByMe).length;
}
