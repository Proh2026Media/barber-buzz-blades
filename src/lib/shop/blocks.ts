import type { Database, Tables } from "@/integrations/supabase/types";

/** Bloqueio como o painel usa: a linha da tabela mais o nome do profissional (ou nulo). */
export type ShopBlock = Tables<"availability_blocks"> & {
  staff: Pick<Tables<"staff">, "display_name"> | null;
};

export type ListedShopBlock =
  Database["public"]["Functions"]["list_shop_blocks"]["Returns"][number];

/**
 * Linha de `list_shop_blocks` no formato da leitura direta da tabela. Bloqueio de colega para
 * quem não tem a visão geral chega sem motivo e sem nome; o painel mostra "Colega indisponível".
 */
export function shopBlockFromListed(row: ListedShopBlock): ShopBlock {
  return {
    id: row.id,
    barbershop_id: row.barbershop_id,
    staff_id: row.staff_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    reason: row.reason,
    created_at: row.created_at,
    rule_id: row.rule_id ?? null,
    staff: row.staff_display_name ? { display_name: row.staff_display_name } : null,
  };
}
