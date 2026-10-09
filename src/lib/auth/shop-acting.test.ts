import assert from "node:assert/strict";
import test from "node:test";
import { capabilitiesFor } from "./capabilities.ts";
import {
  ACTIVE_SHOP_KEY,
  activeShopKey,
  demoCapabilities,
  hasShopToOpen,
  initialShopEntry,
  pickInitialActorId,
  readSavedShopActor,
  resolveShopActing,
  saveShopActor,
  shopEntryForHost,
  shopPowers,
  sortShopActors,
  type ShopMemberRole,
} from "./shop-acting.ts";

type Shop = { id: string; name: string };
const shopA: Shop = { id: "shop-a", name: "Barbearia A" };
const shopB: Shop = { id: "shop-b", name: "Barbearia B" };
const shopC: Shop = { id: "shop-c", name: "Barbearia C" };

function actor(id: string, role: ShopMemberRole, shop: Shop, createdAt = "2026-01-01") {
  return { id, role, barbershop: shop, barbershop_id: shop.id, created_at: createdAt };
}

test("vínculo de equipe: age como o papel daquela loja", () => {
  const acting = resolveShopActing({
    actors: [actor("a1", "employee", shopA), actor("a2", "owner", shopB)],
    memberships: [],
    selectedActorId: "a2",
  });
  assert.equal(acting.kind, "member");
  assert.equal(acting.actor?.role, "owner");
  assert.equal(acting.shop, shopB);
});

test("escolha que não é desta conta cai na primeira loja da ordem", () => {
  const acting = resolveShopActing({
    actors: [actor("a1", "owner", shopA)],
    memberships: [],
    selectedActorId: "de-outra-conta",
  });
  assert.equal(acting.actor?.id, "a1");
});

test("shop_admin antigo continua abrindo a própria loja com poderes de dono", () => {
  const acting = resolveShopActing({
    actors: [],
    memberships: [
      { role: "customer", barbershop: shopC },
      { role: "shop_admin", barbershop: shopA },
    ],
  });
  assert.equal(acting.kind, "legacy-admin");
  assert.equal(acting.shop, shopA);
  const powers = shopPowers(acting, null);
  assert.equal(powers.ready, true);
  assert.equal(powers.writeMode, "direct");
  assert.equal(powers.manageTeam, true);
  assert.equal(powers.createServices, true);
  assert.equal(powers.ownerLike, true);
});

test("equipe na A + shop_admin antigo na B: o painel abre o vínculo de equipe (A)", () => {
  // Por isso "Minhas áreas" não lista a loja B nesse caso (areas.ts).
  const acting = resolveShopActing({
    actors: [actor("a1", "employee", shopA)],
    memberships: [{ role: "shop_admin", barbershop: shopB }],
  });
  assert.equal(acting.kind, "member");
  assert.equal(acting.shop, shopA);
  assert.deepEqual(
    initialShopEntry({ actors: [actor("a1", "employee", shopA)], requested: null }),
    { step: "ready", selected: "a1" },
  );
});

test("vínculo de cliente nunca abre o painel de uma loja", () => {
  const acting = resolveShopActing({
    actors: [],
    memberships: [
      { role: "platform_admin", barbershop: null },
      { role: "customer", barbershop: shopC },
    ],
  });
  assert.equal(acting.kind, "none");
  assert.equal(acting.shop, null);
  assert.equal(acting.kind === "none" && acting.reason, "platform-admin");
  assert.equal(
    hasShopToOpen({ actors: [], memberships: [{ role: "customer", barbershop: shopC }] }),
    false,
  );
});

test("sem papel definido não há poder nenhum", () => {
  const none = shopPowers({ kind: "none", actor: null }, null);
  for (const [key, value] of Object.entries(none)) {
    if (key === "ready") assert.equal(value, true);
    else if (key === "writeMode") assert.equal(value, "none");
    else assert.equal(value, false, key);
  }
});

test("com papel e sem permissões carregadas, nada fica liberado (troca de loja)", () => {
  const powers = shopPowers({ kind: "member", actor: { role: "owner" } }, null);
  assert.equal(powers.ready, false);
  assert.equal(powers.manageTeam, false);
  assert.equal(powers.editServices, false);
  assert.equal(powers.writeMode, "none");
});

test("dono gere tudo pela governança", () => {
  const caps = capabilitiesFor({ role: "owner" }, "single", true);
  const powers = shopPowers({ kind: "member", actor: { role: "owner" } }, caps);
  assert.equal(powers.writeMode, "governed");
  assert.equal(powers.createServices, true);
  assert.equal(powers.editBusinessHours, true);
  assert.equal(powers.manageBranding, true);
  assert.equal(powers.ownBlocksOnly, false);
});

test("Parceiro: só o próprio catálogo e os próprios bloqueios", () => {
  const caps = capabilitiesFor({ role: "associate" }, "single", false);
  const powers = shopPowers({ kind: "member", actor: { role: "associate" } }, caps);
  assert.equal(powers.writeMode, "none");
  assert.equal(powers.editServices, true);
  assert.equal(powers.changeGlobalCatalog, false);
  assert.equal(powers.createServices, false);
  assert.equal(powers.editBusinessHours, false);
  assert.equal(powers.ownBlocksOnly, true);
  assert.equal(powers.manageBranding, false);
  assert.equal(powers.manageShopChannels, false);
});

test("demonstração: Parceiro e Contratado têm as mesmas restrições do real", () => {
  for (const role of ["associate", "employee"] as const) {
    const demo = demoCapabilities({ role });
    const real = capabilitiesFor({ role }, "single", false);
    assert.deepEqual(demo, real, role);
    assert.equal(demo?.canApplyOperations, false, role);
    assert.equal(demo?.manageSociety, false, role);
    const powers = shopPowers({ kind: "member", actor: { role } }, demo);
    assert.equal(powers.manageBranding, false, role);
    assert.equal(powers.createServices, false, role);
    assert.equal(powers.editBusinessHours, false, role);
  }
  // O sócio da demonstração (sociedade igualitária) não aplica sozinho; o dono único aplica.
  assert.equal(demoCapabilities({ role: "partner" })?.canApplyOperations, false);
  assert.equal(demoCapabilities({ role: "owner" })?.canApplyOperations, true);
  // Visões de sociedade: em partes iguais e com a menor parte, a mudança vira pedido.
  assert.equal(
    demoCapabilities({ role: "owner", ownership_percent: 50 }, "equal")?.canApplyOperations,
    false,
  );
  assert.equal(
    demoCapabilities({ role: "owner", ownership_percent: 30 }, "majority")?.canApplyOperations,
    false,
  );
  assert.equal(
    demoCapabilities({ role: "owner", ownership_percent: 70 }, "majority")?.canApplyOperations,
    true,
  );
  assert.equal(
    demoCapabilities({ role: "owner", ownership_percent: 30 }, "majority")?.society,
    true,
  );
});

test("demonstração usa a loja fictícia mesmo com vínculo", () => {
  const demoShop: Shop = { id: "demo-shop", name: "Demo" };
  const acting = resolveShopActing({
    actors: [actor("demo-actor", "associate", shopA)],
    memberships: [],
    demoShop,
  });
  assert.equal(acting.shop, demoShop);
});

test("lojas em ordem fixa: papel mais alto, depois vínculo mais antigo", () => {
  const sorted = sortShopActors([
    actor("e", "employee", shopA, "2025-01-01"),
    actor("p2", "partner", shopC, "2026-03-01"),
    actor("as", "associate", shopB, "2024-01-01"),
    actor("o1", "owner", shopB, "2026-02-01"),
  ]);
  assert.deepEqual(
    sorted.map((row) => row.id),
    ["o1", "p2", "as", "e"],
  );
});

test("escolha guardada por conta, à prova de armazenamento bloqueado", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  saveShopActor("user-1", "a2", storage);
  assert.equal(store.get(activeShopKey("user-1")), "a2");
  assert.equal(readSavedShopActor("user-1", storage), "a2");
  assert.equal(readSavedShopActor("user-2", storage), null);
  // Chave antiga (sem conta) só serve de reserva e é conferida contra as lojas da conta.
  store.set(ACTIVE_SHOP_KEY, "a9");
  assert.equal(readSavedShopActor("user-2", storage), "a9");
  assert.equal(pickInitialActorId([{ id: "a1" }], "a9"), "a1");
  assert.equal(pickInitialActorId([{ id: "a1" }, { id: "a9" }], "a9"), "a9");
  assert.equal(pickInitialActorId([], null), null);

  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(readSavedShopActor("user-1", broken), null);
  assert.doesNotThrow(() => saveShopActor("user-1", "a1", broken));
  assert.equal(readSavedShopActor("user-1", null), null);
});

/* ---------- Loja de entrada do painel (onda 2, item 5) ---------- */

test("entrada: loja pedida em Minhas áreas vence domínio e escolha salva", () => {
  const actors = [actor("a1", "owner", shopA), actor("a2", "employee", shopB)];
  assert.deepEqual(initialShopEntry({ actors, requested: "a2", saved: "a1", onShopHost: true }), {
    step: "ready",
    selected: "a2",
  });
  // Pedido de loja que não é da pessoa não vale.
  assert.deepEqual(initialShopEntry({ actors, requested: "outra", saved: "a1" }), {
    step: "ready",
    selected: "a1",
  });
});

test("entrada: 2 ou mais lojas sem escolha salva perguntam; 1 loja abre direto", () => {
  const two = [actor("a1", "owner", shopA), actor("a2", "employee", shopB)];
  assert.deepEqual(initialShopEntry({ actors: two }), { step: "choose", selected: null });
  assert.deepEqual(initialShopEntry({ actors: two, saved: "a2" }), {
    step: "ready",
    selected: "a2",
  });
  assert.deepEqual(initialShopEntry({ actors: [actor("a1", "owner", shopA)] }), {
    step: "ready",
    selected: "a1",
  });
  // Demonstração nunca pergunta nem lê o aparelho.
  assert.deepEqual(initialShopEntry({ actors: two, demo: true, onShopHost: true }), {
    step: "ready",
    selected: "a1",
  });
  // Sem loja (shop_admin antigo ou admin): nada a escolher.
  assert.deepEqual(initialShopEntry({ actors: [], onShopHost: true }), {
    step: "ready",
    selected: null,
  });
});

test("entrada no domínio de uma loja: abre a loja do endereço quando a pessoa trabalha nela", () => {
  const actors = [actor("a1", "owner", shopA), actor("a2", "employee", shopB)];
  assert.deepEqual(initialShopEntry({ actors, saved: "a1", onShopHost: true }), {
    step: "host",
    selected: null,
  });
  assert.deepEqual(shopEntryForHost({ actors, hostShopId: shopB.id, saved: "a1" }), {
    step: "ready",
    selected: "a2",
  });
  // Domínio de uma loja em que não trabalha: segue a escolha salva ou pergunta.
  assert.deepEqual(shopEntryForHost({ actors, hostShopId: shopC.id, saved: "a1" }), {
    step: "ready",
    selected: "a1",
  });
  assert.deepEqual(shopEntryForHost({ actors, hostShopId: shopC.id }), {
    step: "choose",
    selected: null,
  });
  assert.deepEqual(shopEntryForHost({ actors: [actors[0]], hostShopId: null }), {
    step: "ready",
    selected: "a1",
  });
});
