import assert from "node:assert/strict";
import test from "node:test";
import { capabilitiesFor, type ProfessionalActor } from "./capabilities.ts";

function actor(
  role: ProfessionalActor["role"],
  _ownershipPercent: number | null,
): ProfessionalActor {
  return { role };
}

test("equal partners can propose but cannot apply protected changes alone", () => {
  const result = capabilitiesFor(actor("partner", 50), "equal", false);
  assert.equal(result?.canProposeOperations, true);
  assert.equal(result?.canApplyOperations, false);
  assert.equal(result?.requiresApproval, true);
});

test("majority owner can apply protected changes", () => {
  const result = capabilitiesFor(actor("owner", 60), "majority", true);
  assert.equal(result?.canApplyOperations, true);
  assert.equal(result?.manageSociety, true);
  assert.equal(result?.requiresApproval, false);
});

test("associate sees own money and catalog while employee sees no money", () => {
  const associate = capabilitiesFor(actor("associate", null), "single", false);
  const employee = capabilitiesFor(actor("employee", null), "single", false);
  assert.equal(associate?.editOwnCatalog, true);
  assert.equal(associate?.viewMoney, true);
  assert.equal(employee?.editOwnCatalog, false);
  assert.equal(employee?.viewMoney, false);
  assert.equal(employee?.viewTeamSchedule, true);
});

test("role defaults reproduce the behaviour that existed before the matrix", () => {
  const owner = capabilitiesFor(actor("owner", 100), "single", true);
  const partner = capabilitiesFor(actor("partner", 50), "single", true);
  const associate = capabilitiesFor(actor("associate", null), "single", false);
  const employee = capabilitiesFor(actor("employee", null), "single", false);

  // Dono e sócio operam a unidade inteira.
  for (const full of [owner, partner]) {
    assert.equal(full?.viewFullShop, true);
    assert.equal(full?.viewShopFinancials, true);
    assert.equal(full?.manageCatalog, true);
    assert.equal(full?.manageTeam, true);
    assert.equal(full?.manageOperations, true);
    assert.equal(full?.viewReportsAnonymized, false);
  }
  // Parceiro tem ambiente próprio e indicadores anonimizados.
  assert.equal(associate?.viewFullShop, false);
  assert.equal(associate?.viewShopFinancials, false);
  assert.equal(associate?.viewReportsAnonymized, true);
  assert.equal(associate?.manageCatalog, false);
  assert.equal(associate?.manageTeam, false);
  // Contratado vê o próprio score, sem valores nem catálogo.
  assert.equal(employee?.viewMoney, false);
  assert.equal(employee?.editOwnCatalog, false);
});

test("an explicit permission matrix overrides the role defaults", () => {
  // A loja concedeu agenda completa e equipe ao parceiro, e retirou o caixa do sócio.
  const associate = capabilitiesFor(actor("associate", null), "single", false, {
    view_agenda_all: true,
    manage_team: true,
  });
  const partner = capabilitiesFor(actor("partner", 50), "single", true, {
    view_financial_all: false,
    view_money: false,
  });

  assert.equal(associate?.viewFullShop, true);
  assert.equal(associate?.manageTeam, true);
  assert.equal(partner?.viewShopFinancials, false);
  assert.equal(partner?.viewMoney, false);
  // O que a matriz não menciona continua no padrão do papel.
  assert.equal(partner?.manageTeam, true);
  assert.equal(partner?.viewFullShop, true);
});

test("governance stays tied to the society, not to the permission matrix", () => {
  // Mesmo com todas as permissões, sócio igualitário não aplica sozinho.
  const equalPartner = capabilitiesFor(actor("partner", 50), "equal", false, {
    manage_operations: true,
    manage_team: true,
    view_financial_all: true,
  });
  assert.equal(equalPartner?.canApplyOperations, false);
  assert.equal(equalPartner?.requiresApproval, true);
  assert.equal(equalPartner?.manageSociety, false);
});

/* ---------- Destino depois de entrar: papel × destino (docs/plano-ambientes.md, onda 2) ---------- */

import {
  decidePostAuthPath,
  entryArea,
  hasClientIntent,
  lastAreaKey,
  parseAccessNotice,
  readLastArea,
  sanitizeNext,
  saveLastArea,
  type AreaAccess,
  type AreaKind,
} from "./destination.ts";
import { areaAccessFor, areaHref, isCurrentArea, listAreas, showsAreas } from "./areas.ts";

type Account = Parameters<typeof areaAccessFor>[0];
const loja = { id: "shop-a", name: "Barbearia A" };
const loja2 = { id: "shop-b", name: "Barbearia B" };
const equipe = (role: "owner" | "partner" | "associate" | "employee", id = "m1") => ({ id, role });

// Contas reais (vínculos como vêm do banco). O acesso sai de areaAccessFor, a mesma função
// usada depois de entrar, e não de um objeto pronto.
const ACCOUNTS: Record<string, Account> = {
  adminOwner: { memberships: [{ role: "platform_admin" }], shopActors: [equipe("owner")] },
  admin: { memberships: [{ role: "platform_admin" }], shopActors: [] },
  dono: { memberships: [], shopActors: [equipe("owner")] },
  parceiro: { memberships: [], shopActors: [equipe("associate")] },
  contratado: { memberships: [], shopActors: [equipe("employee")] },
  shopAdminAntigo: { memberships: [{ role: "shop_admin", barbershop: loja }], shopActors: [] },
  // shop_admin sem loja: o painel não tem o que abrir, então não conta como painel.
  shopAdminSemLoja: { memberships: [{ role: "shop_admin", barbershop: null }], shopActors: [] },
  // Gerente de conta não tem tela própria: entra pelo app comum.
  gerenteDeConta: { memberships: [{ role: "account_manager" }], shopActors: [] },
  // Vínculo de cliente nunca abre painel.
  cliente: { memberships: [{ role: "customer", barbershop: loja }], shopActors: [] },
  duasLojas: {
    memberships: [{ role: "customer", barbershop: loja2 }],
    shopActors: [equipe("owner", "m1"), equipe("employee", "m2")],
  },
};

const ACCESS: Record<string, AreaAccess> = Object.fromEntries(
  Object.entries(ACCOUNTS).map(([who, account]) => [who, areaAccessFor(account)]),
);

test("vínculos → acesso: cada papel abre só as áreas que tem", () => {
  const expected: Record<string, AreaAccess> = {
    adminOwner: { platform: true, shop: true },
    admin: { platform: true, shop: false },
    dono: { platform: false, shop: true },
    parceiro: { platform: false, shop: true },
    contratado: { platform: false, shop: true },
    shopAdminAntigo: { platform: false, shop: true },
    shopAdminSemLoja: { platform: false, shop: false },
    gerenteDeConta: { platform: false, shop: false },
    cliente: { platform: false, shop: false },
    duasLojas: { platform: false, shop: true },
  };
  for (const [who, access] of Object.entries(expected)) {
    assert.deepEqual(ACCESS[who], access, who);
  }
});

const BOOKING = "/app?shop=barbearia-x&day=2026-10-09&time=10:00";

test("vínculos → acesso → destino: agendar vence a hierarquia; o resto segue o acesso", () => {
  const expected: Record<string, Record<string, string>> = {
    adminOwner: {
      [BOOKING]: BOOKING,
      "/app": "/platform",
      "/app?tab=reservas": "/platform",
      "/shop": "/shop",
      "/platform": "/platform",
      "": "/platform",
    },
    admin: {
      [BOOKING]: BOOKING,
      "/app": "/platform",
      "/shop": "/platform",
      "/platform": "/platform",
      "": "/platform",
    },
    dono: {
      [BOOKING]: BOOKING,
      "/app": "/shop",
      "/app?tab=reservas": "/shop",
      "/shop": "/shop",
      "/platform": "/shop",
      "": "/shop",
    },
    parceiro: { [BOOKING]: BOOKING, "/app": "/shop", "/shop": "/shop", "": "/shop" },
    contratado: { [BOOKING]: BOOKING, "/platform": "/shop", "": "/shop" },
    shopAdminAntigo: { [BOOKING]: BOOKING, "/app": "/shop", "/platform": "/shop", "": "/shop" },
    shopAdminSemLoja: { [BOOKING]: BOOKING, "/app": "/app", "/shop": "/app", "": "/app" },
    gerenteDeConta: {
      [BOOKING]: BOOKING,
      "/app": "/app",
      "/shop": "/app",
      "/platform": "/app",
      "": "/app",
    },
    duasLojas: { [BOOKING]: BOOKING, "/app": "/shop", "/shop": "/shop", "": "/shop" },
    cliente: {
      [BOOKING]: BOOKING,
      "/app": "/app",
      "/app?tab=reservas": "/app?tab=reservas",
      "/shop": "/app",
      "/platform": "/app",
      "": "/app",
    },
  };
  for (const [who, cases] of Object.entries(expected)) {
    for (const [next, path] of Object.entries(cases)) {
      assert.equal(
        decidePostAuthPath({ next, access: ACCESS[who] }),
        path,
        `${who} com next="${next}"`,
      );
    }
  }
});

test("link de profissional, de reserva e do perfil também levam ao app do cliente", () => {
  for (const next of [
    "/app?barber=carla&shop=barbearia-x",
    "/app?tab=reservas&reserva=0123456789abcdef0123456789abcdef",
    "/app?tab=conta&focus=whatsapp",
  ]) {
    assert.equal(decidePostAuthPath({ next, access: ACCESS.dono }), next);
    assert.equal(decidePostAuthPath({ next, access: ACCESS.admin }), next);
  }
  assert.equal(hasClientIntent("/app"), false);
  assert.equal(hasClientIntent("/app?tab=reservas"), false);
  assert.equal(hasClientIntent("/shop?shop=x"), false);
});

test("sem destino abre a última área usada (se a conta ainda tem acesso)", () => {
  assert.equal(decidePostAuthPath({ access: ACCESS.adminOwner, lastArea: "app" }), "/app");
  assert.equal(decidePostAuthPath({ access: ACCESS.adminOwner, lastArea: "shop" }), "/shop");
  // O /app genérico conta como "sem destino": vale a última área.
  assert.equal(decidePostAuthPath({ next: "/app", access: ACCESS.dono, lastArea: "app" }), "/app");
  // Área que a conta perdeu não vale mais.
  assert.equal(decidePostAuthPath({ access: ACCESS.cliente, lastArea: "shop" }), "/app");
  assert.equal(decidePostAuthPath({ access: ACCESS.dono, lastArea: "platform" }), "/shop");
  assert.equal(entryArea(ACCESS.admin, null), "platform");
  assert.equal(entryArea(ACCESS.cliente, null), "app");
});

test("destino só aceita caminho interno conhecido e parâmetros conhecidos", () => {
  // Redirecionamento aberto: nunca sai do sistema.
  for (const evil of [
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example",
    "/\\/evil.example/app",
    "javascript:alert(1)",
    "/app\nhttps://evil.example",
    "/%2F%2Fevil.example",
    " //evil.example",
    "/admin",
    "/auth?next=/platform",
    "/",
    "",
  ]) {
    assert.equal(sanitizeNext(evil), null, evil);
    assert.equal(decidePostAuthPath({ next: evil, access: ACCESS.cliente }), "/app", evil);
  }
  // Parâmetros desconhecidos ou inválidos caem; os conhecidos ficam.
  assert.equal(
    sanitizeNext("/app?shop=barbearia-x&day=2026-13-40&time=10:00&evil=1#x"),
    "/app?shop=barbearia-x&time=10:00",
  );
  assert.equal(sanitizeNext("/app?shop=https://evil.example"), "/app");
  assert.equal(
    sanitizeNext("/shop/?secao=equipe&unidade=abc-123"),
    "/shop?secao=equipe&unidade=abc-123",
  );
  assert.equal(sanitizeNext("/shop/pontos"), "/shop/pontos");
  assert.equal(sanitizeNext("/platform?aba=barbearias"), "/platform?aba=barbearias");
  assert.equal(
    sanitizeNext("/politica?shop=barbearia-x&lang=pt-BR"),
    "/politica?shop=barbearia-x&lang=pt-BR",
  );
  assert.equal(sanitizeNext(42), null);
});

test("motivo da recusa no endereço: só os conhecidos", () => {
  assert.equal(parseAccessNotice("removido"), "removido");
  assert.equal(parseAccessNotice("sem-plataforma"), "sem-plataforma");
  assert.equal(parseAccessNotice("<script>"), undefined);
  assert.equal(parseAccessNotice(undefined), undefined);
});

test("última área fica no aparelho por conta e sobrevive a armazenamento bloqueado", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  saveLastArea("user-a", "app", storage);
  assert.equal(readLastArea("user-a", storage), "app");
  assert.equal(readLastArea("user-b", storage), null);
  assert.equal(data.get(lastAreaKey("user-a")), "app");
  data.set(lastAreaKey("user-b"), "qualquer");
  assert.equal(readLastArea("user-b", storage), null);
  const blocked = {
    getItem: (): string | null => {
      throw new Error("bloqueado");
    },
    setItem: () => {
      throw new Error("bloqueado");
    },
  };
  assert.doesNotThrow(() => saveLastArea("user-a", "shop" as AreaKind, blocked));
  assert.equal(readLastArea("user-a", blocked), null);
  assert.equal(readLastArea("user-a", null), null);
});

/* ---------- "Minhas áreas" ---------- */

const shopA = { id: "shop-a", name: "Barbearia A" };
const shopB = { id: "shop-b", name: "Barbearia B" };

test("Minhas áreas: plataforma, cada loja com o papel e cliente; só com 2 ou mais", () => {
  const onlyCustomer = listAreas({
    memberships: [{ role: "customer", barbershop_id: "shop-a", barbershop: shopA }],
    shopActors: [],
    shopFallback: "Loja",
  });
  assert.deepEqual(
    onlyCustomer.map((area) => area.kind),
    ["customer"],
  );
  assert.equal(showsAreas(onlyCustomer), false);

  const adminOwner = listAreas({
    memberships: [
      { role: "platform_admin", barbershop_id: null },
      { role: "customer", barbershop_id: "shop-b", barbershop: shopB },
    ],
    shopActors: [
      { id: "m1", role: "owner", barbershop_id: "shop-a", barbershop: shopA },
      { id: "m2", role: "employee", barbershop_id: "shop-b", barbershop: shopB },
    ],
    shopFallback: "Loja",
  });
  assert.deepEqual(
    adminOwner.map((area) => (area.kind === "shop" ? `${area.name}:${area.role}` : area.kind)),
    ["platform", "Barbearia A:owner", "Barbearia B:employee", "customer"],
  );
  assert.equal(showsAreas(adminOwner), true);
  // Loja escolhida vai no endereço; cliente e plataforma abrem a área.
  assert.equal(areaHref(adminOwner[1]), "/shop?unidade=m1");
  assert.equal(areaHref(adminOwner[0]), "/platform");
  assert.equal(areaHref(adminOwner[3]), "/app");
  assert.equal(isCurrentArea(adminOwner[2], { kind: "shop", shopId: "shop-b" }), true);
  assert.equal(isCurrentArea(adminOwner[1], { kind: "shop", shopId: "shop-b" }), false);
  assert.equal(isCurrentArea(adminOwner[3], { kind: "customer" }), true);

  // Admin sem vínculo de equipe: nenhuma loja aparece (nem de cliente).
  const adminOnly = listAreas({
    memberships: [
      { role: "platform_admin", barbershop_id: null },
      { role: "customer", barbershop_id: "shop-a", barbershop: shopA },
    ],
    shopActors: [],
    shopFallback: "Loja",
  });
  assert.deepEqual(
    adminOnly.map((area) => area.kind),
    ["platform", "customer"],
  );

  // shop_admin antigo sem vínculo de equipe: a loja dele aparece como Dono.
  const legacy = listAreas({
    memberships: [{ role: "shop_admin", barbershop_id: "shop-a", barbershop: shopA }],
    shopActors: [],
    shopFallback: "Loja",
  });
  assert.equal(legacy[0].kind === "shop" && legacy[0].role, "owner");
  assert.equal(areaHref(legacy[0]), "/shop");
});

test("Minhas áreas: equipe na A + shop_admin antigo na B mostra só a loja que o painel abre", () => {
  // O painel sempre abre um vínculo de equipe antes do shop_admin antigo (resolveShopActing):
  // a loja B não teria como abrir, então não aparece.
  const mixed = listAreas({
    memberships: [{ role: "shop_admin", barbershop_id: "shop-b", barbershop: shopB }],
    shopActors: [{ id: "m1", role: "employee", barbershop_id: "shop-a", barbershop: shopA }],
    shopFallback: "Loja",
  });
  assert.deepEqual(
    mixed.map((area) => (area.kind === "shop" ? `${area.shopId}:${area.actorId}` : area.kind)),
    ["shop-a:m1", "customer"],
  );

  // Dois shop_admin antigos: só a loja que o painel abre (a primeira).
  const twoLegacy = listAreas({
    memberships: [
      { role: "shop_admin", barbershop_id: "shop-a", barbershop: shopA },
      { role: "shop_admin", barbershop_id: "shop-b", barbershop: shopB },
    ],
    shopActors: [],
    shopFallback: "Loja",
  });
  assert.deepEqual(
    twoLegacy.map((area) => (area.kind === "shop" ? area.shopId : area.kind)),
    ["shop-a", "customer"],
  );

  // shop_admin sem loja carregada: nada para abrir.
  const noShop = listAreas({
    memberships: [{ role: "shop_admin", barbershop_id: null, barbershop: null }],
    shopActors: [],
    shopFallback: "Loja",
  });
  assert.equal(showsAreas(noShop), false);
});
