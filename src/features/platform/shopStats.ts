import { STATE, type StatusMeta } from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";

export type MembershipRow = Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">;

export type ShopCounts = { customers: number; admins: number };

/** Clientes e administradores de cada barbearia (vínculos daquela barbearia). */
export function countByShop(memberships: MembershipRow[]) {
  const counts = new Map<string, ShopCounts>();
  for (const row of memberships) {
    if (!row.barbershop_id) continue;
    const current = counts.get(row.barbershop_id) ?? { customers: 0, admins: 0 };
    if (row.role === "customer") current.customers += 1;
    else if (row.role === "shop_admin") current.admins += 1;
    counts.set(row.barbershop_id, current);
  }
  return counts;
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

/**
 * Situação da barbearia com a mesma cor e o mesmo ícone em todo o painel: selo, filtro,
 * cartão de número e barra dividida. Suspensa = o "pausado" de todo o sistema (cinza com
 * pausa): é uma decisão do administrador, não algo a resolver (o âmbar fica para o que pede ação).
 */
export const SHOP_STATUS = {
  active: STATE.active,
  suspended: STATE.paused,
} as const satisfies Record<Tables<"barbershops">["status"], StatusMeta>;

/** Barbearias criadas por mês, dos últimos `months` meses (o mais antigo primeiro). */
export function shopsCreatedByMonth(shops: Tables<"barbershops">[], months = 6, now = new Date()) {
  const buckets = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    return { year: date.getFullYear(), month: date.getMonth(), date, count: 0 };
  });
  for (const shop of shops) {
    const created = new Date(shop.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const bucket = buckets.find(
      (item) => item.year === created.getFullYear() && item.month === created.getMonth(),
    );
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** Meses desde a primeira barbearia (0 = criada neste mês). */
export function historyMonths(shops: Tables<"barbershops">[], now = new Date()) {
  const first = shops.reduce<Date | null>((oldest, shop) => {
    const created = new Date(shop.created_at);
    if (Number.isNaN(created.getTime())) return oldest;
    return !oldest || created < oldest ? created : oldest;
  }, null);
  if (!first) return 0;
  return (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
}

/** Fuso de Brasília não precisa aparecer: é o padrão de quase todas as barbearias. */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** "America/Manaus" → "Horário do Amazonas"; mantém o código se o navegador não souber o nome. */
export function friendlyTimeZone(timeZone: string, locale: string) {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longGeneric" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
