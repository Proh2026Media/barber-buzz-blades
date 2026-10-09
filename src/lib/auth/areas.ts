import type { AreaAccess } from "./destination.ts";
import { hasShopToOpen, type ShopMemberRole } from "./shop-acting.ts";

/**
 * "Minhas áreas": os ambientes que a conta pode abrir, na mesma ordem nos três menus de conta
 * (plataforma, cada barbearia com o papel ali e o app do cliente).
 *
 * O app do cliente vale para toda conta; por isso só quem tem outro ambiente (2 ou mais áreas)
 * vê a lista. Uma conta só de cliente não vê nada novo.
 */
export type AreaItem =
  | { kind: "platform"; key: "platform" }
  | {
      kind: "shop";
      key: string;
      /** Vínculo de equipe; `null` no shop_admin antigo (abre o painel dele, sem escolher). */
      actorId: string | null;
      shopId: string;
      name: string;
      role: ShopMemberRole;
      /** Parte do dono (selo "Dono · 50%"); nula para quem não é dono. */
      percent?: number | null;
    }
  | { kind: "customer"; key: "customer" };

/** Onde a pessoa está agora (para marcar a área atual). */
export type CurrentArea =
  | { kind: "platform" }
  | { kind: "shop"; shopId: string | null }
  | { kind: "customer" };

type ShopLike = { id: string; name?: string | null } | null | undefined;

export function listAreas(input: {
  memberships: readonly { role: string; barbershop_id?: string | null; barbershop?: ShopLike }[];
  shopActors: readonly {
    id: string;
    role: ShopMemberRole;
    barbershop_id: string;
    ownership_percent?: number | null;
    barbershop?: ShopLike;
  }[];
  /** Nome usado quando a loja vem sem nome. */
  shopFallback: string;
}): AreaItem[] {
  const areas: AreaItem[] = [];
  if (input.memberships.some((m) => m.role === "platform_admin")) {
    areas.push({ kind: "platform", key: "platform" });
  }
  const seen = new Set<string>();
  for (const actor of input.shopActors) {
    if (seen.has(actor.barbershop_id)) continue;
    seen.add(actor.barbershop_id);
    areas.push({
      kind: "shop",
      key: `shop:${actor.id}`,
      actorId: actor.id,
      shopId: actor.barbershop_id,
      name: actor.barbershop?.name?.trim() || input.shopFallback,
      role: actor.role,
      percent: actor.ownership_percent ?? null,
    });
  }
  // shop_admin antigo sem vínculo de equipe: aparece como Dono (o mesmo selo do cabeçalho).
  // Só entra a loja que o painel abre de fato (resolveShopActing): com vínculo de equipe, o
  // painel sempre abre um vínculo, então a loja do shop_admin antigo não teria como abrir.
  if (input.shopActors.length === 0) {
    const legacy = input.memberships.find(
      (m) => m.role === "shop_admin" && m.barbershop?.id && !seen.has(m.barbershop.id),
    );
    if (legacy?.barbershop) {
      areas.push({
        kind: "shop",
        key: `shop-admin:${legacy.barbershop.id}`,
        actorId: null,
        shopId: legacy.barbershop.id,
        name: legacy.barbershop.name?.trim() || input.shopFallback,
        role: "owner",
      });
    }
  }
  areas.push({ kind: "customer", key: "customer" });
  return areas;
}

/** A lista só aparece para quem tem mais de um ambiente. */
export function showsAreas(areas: readonly AreaItem[]) {
  return areas.length >= 2;
}

export function isCurrentArea(area: AreaItem, current: CurrentArea | null | undefined) {
  if (!current || area.kind !== current.kind) return false;
  if (area.kind === "shop" && current.kind === "shop") return area.shopId === current.shopId;
  return true;
}

/** Endereço que abre a área (a loja escolhida vai no endereço, para valer sobre o domínio). */
export function areaHref(area: AreaItem) {
  if (area.kind === "platform") return "/platform";
  if (area.kind === "customer") return "/app";
  return area.actorId ? `/shop?unidade=${encodeURIComponent(area.actorId)}` : "/shop";
}

/**
 * Áreas que a conta pode abrir, a partir dos vínculos (sem banco, para testar no Node).
 * Plataforma: só platform_admin (o gerente de conta não tem tela própria). Painel: vínculo de
 * equipe ativo ou shop_admin antigo com loja (a mesma regra que o painel usa para abrir).
 */
export function areaAccessFor(input: {
  memberships: readonly { role: string; barbershop?: unknown }[];
  shopActors: readonly { id: string; role: ShopMemberRole }[];
}): AreaAccess {
  return {
    platform: input.memberships.some((m) => m.role === "platform_admin"),
    shop: hasShopToOpen({ actors: input.shopActors, memberships: input.memberships }),
  };
}
