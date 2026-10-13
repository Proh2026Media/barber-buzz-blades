import type { Tables } from "@/integrations/supabase/types";

export type MembershipRow = Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">;

/** Dono ou sócio ativo da equipe de uma barbearia (`list_platform_shop_owners`). */
export type ShopOwnerRow = { barbershop_id: string; user_id: string };

export type ShopCounts = { customers: number; admins: number };

/**
 * Clientes e administradores de cada barbearia. Administrador = dono ou sócio ativo da equipe
 * (decisão 12), a mesma conta da ficha da loja. `owners` nulo = banco sem a lista: vale o papel
 * antigo `shop_admin` dos vínculos.
 */
export function countByShop(memberships: MembershipRow[], owners: ShopOwnerRow[] | null = null) {
  const counts = new Map<string, ShopCounts>();
  const entry = (shopId: string) => {
    const current = counts.get(shopId) ?? { customers: 0, admins: 0 };
    counts.set(shopId, current);
    return current;
  };
  for (const row of memberships) {
    if (!row.barbershop_id) continue;
    if (row.role === "customer") entry(row.barbershop_id).customers += 1;
    else if (row.role === "shop_admin" && !owners) entry(row.barbershop_id).admins += 1;
  }
  for (const row of owners ?? []) entry(row.barbershop_id).admins += 1;
  return counts;
}

/** Pessoas distintas que administram ao menos uma barbearia (mesma regra de `countByShop`). */
export function uniqueAdmins(memberships: MembershipRow[], owners: ShopOwnerRow[] | null = null) {
  if (owners) return new Set(owners.map((row) => row.user_id)).size;
  return uniquePeople(memberships, "shop_admin");
}

export function countsFor(counts: Map<string, ShopCounts>, shopId: string): ShopCounts {
  return counts.get(shopId) ?? { customers: 0, admins: 0 };
}

/** Pessoas distintas com o papel (a mesma pessoa em duas barbearias conta uma vez). */
export function uniquePeople(memberships: MembershipRow[], role: MembershipRow["role"]) {
  return new Set(memberships.filter((row) => row.role === role).map((row) => row.user_id)).size;
}

/** Barbearias ativas que ninguém da equipe administra. */
export function activeShopsWithoutAdmin(
  shops: Tables<"barbershops">[],
  counts: Map<string, ShopCounts>,
) {
  return shops.filter(
    (shop) => shop.status === "active" && countsFor(counts, shop.id).admins === 0,
  );
}
