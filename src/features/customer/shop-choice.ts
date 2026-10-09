import { filterReservations, type AppointmentRow } from "../../lib/shop/appointments.ts";

/**
 * Cliente com várias barbearias (plano de ambientes, onda 5): qual loja abre sem link, a última
 * lembrada no aparelho e as reservas que estão em outra loja. Sem banco: só os dados que o app
 * já carregou (vínculos de cliente e reservas da conta).
 */

/** Barbearia em que o cliente entrou (para "Minhas barbearias" e o seletor do topo). */
export type CustomerShop = { id: string; name: string; slug: string };

/** Chave da última barbearia aberta como cliente, separada por conta. */
export const LAST_CUSTOMER_SHOP_KEY = "arena:last-customer-shop";

export function lastCustomerShopKey(userId: string) {
  return `${LAST_CUSTOMER_SHOP_KEY}:${userId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Aba privada ou armazenamento bloqueado: a escolha só não fica lembrada.
    return null;
  }
}

export function readLastCustomerShop(
  userId: string,
  storage: StorageLike | null = browserStorage(),
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(lastCustomerShopKey(userId));
  } catch {
    return null;
  }
}

export function saveLastCustomerShop(
  userId: string,
  shopId: string,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return;
  try {
    storage.setItem(lastCustomerShopKey(userId), shopId);
  } catch {
    // Armazenamento cheio ou bloqueado: segue sem lembrar.
  }
}

/**
 * Loja que abre quando o endereço não pede nenhuma: a última aberta neste aparelho (se a pessoa
 * ainda é cliente dela) e, sem isso, a primeira da lista. `null` quando não há loja.
 */
export function pickCustomerShop(shopIds: readonly string[], saved: string | null): string | null {
  if (saved && shopIds.includes(saved)) return saved;
  return shopIds[0] ?? null;
}

type BookingLike = {
  barbershop_id: string;
  starts_at: string;
  status: AppointmentRow["status"];
  barbershop?: { name?: string | null } | null;
};

/** Reservas futuras em outra barbearia, agrupadas por loja (a mais próxima primeiro). */
export type OtherShopBookings = {
  shopId: string;
  name: string;
  /** Endereço curto da loja, quando a pessoa é cliente dela (para "Abrir"). */
  slug: string | null;
  count: number;
  /** Primeira reserva futura nessa loja. */
  next: string;
};

export function otherShopBookings(
  rows: readonly BookingLike[],
  currentShopId: string | null,
  now: number,
  shops: readonly CustomerShop[],
): OtherShopBookings[] {
  const upcoming = filterReservations(
    rows.filter((row) => row.barbershop_id !== currentShopId),
    "upcoming",
    now,
  );
  const groups = new Map<string, OtherShopBookings>();
  for (const row of upcoming) {
    const current = groups.get(row.barbershop_id);
    if (current) {
      current.count += 1;
      continue;
    }
    const shop = shops.find((item) => item.id === row.barbershop_id);
    groups.set(row.barbershop_id, {
      shopId: row.barbershop_id,
      name: shop?.name || row.barbershop?.name?.trim() || "",
      slug: shop?.slug ?? null,
      count: 1,
      next: row.starts_at,
    });
  }
  return [...groups.values()].sort((a, b) => a.next.localeCompare(b.next));
}

/** Reservas futuras de cada loja (contador do seletor de loja no topo). */
export function upcomingByShop(rows: readonly BookingLike[], now: number): Map<string, number> {
  const counts = new Map<string, number>();
  const upcoming = filterReservations([...rows], "upcoming", now);
  for (const row of upcoming)
    counts.set(row.barbershop_id, (counts.get(row.barbershop_id) ?? 0) + 1);
  return counts;
}

/** Endereço do app do cliente numa loja (mantém a aba e a reserva pedidas). */
export function customerShopHref(slug: string, extra?: { tab?: string; reserva?: string }) {
  const params = new URLSearchParams({ shop: slug });
  if (extra?.tab) params.set("tab", extra.tab);
  if (extra?.reserva) params.set("reserva", extra.reserva);
  return `/app?${params.toString()}`;
}
