import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilitiesFor,
  permissionLockedForRole,
  type ProfessionalActor,
  type ShopCapabilities,
} from "./capabilities.ts";
import { shopPowers } from "./shop-acting.ts";
import { maskColleagueBlock, type PlacedBlock } from "../../features/shop/hours/model.ts";

/*
 * Capacidades com nome por papel (docs/plano-ambientes.md, onda 3, item 3). As telas perguntam
 * por elas, nunca pelo nome do papel; estes testes fixam o que cada papel vê hoje e o que as
 * decisões 7 e 8 mudaram para o Contratado.
 */

type Role = ProfessionalActor["role"];
const ROLES: Role[] = ["owner", "partner", "associate", "employee"];

function caps(role: Role, permissions?: Record<string, boolean>): ShopCapabilities {
  const owner = role === "owner" || role === "partner";
  const result = capabilitiesFor({ role }, "single", owner, permissions);
  assert.ok(result);
  return result;
}

function powersOf(role: Role, permissions?: Record<string, boolean>) {
  return shopPowers({ kind: "member", actor: { role } }, caps(role, permissions));
}

/** Abas do painel que cada papel vê (mesma regra do ShopShell). */
function tabsOf(role: Role, permissions?: Record<string, boolean>) {
  const p = powersOf(role, permissions);
  return [
    "agenda",
    ...(p.editServices ? ["servicos"] : []),
    ...(p.manageTeam ? ["equipe"] : []),
    ...(p.manageOperations ? ["horarios"] : []),
    "configuracoes",
  ];
}

test("capacidades com nome: padrão de cada papel", () => {
  const expected: Record<Role, Partial<ShopCapabilities>> = {
    owner: {
      society: true,
      ownCatalog: false,
      suggestToPeers: false,
      ownBlocks: false,
      ownProfile: true,
      ownPhoto: true,
      ownWallet: false,
      leaveShop: true,
      takeClientsOnLeave: true,
      googleOwnAgenda: true,
      googleWholeShop: true,
    },
    partner: {
      society: true,
      ownCatalog: false,
      ownBlocks: false,
      ownWallet: false,
      takeClientsOnLeave: true,
      googleWholeShop: true,
    },
    associate: {
      society: false,
      ownCatalog: true,
      suggestToPeers: true,
      ownBlocks: true,
      ownProfile: true,
      ownPhoto: true,
      ownWallet: true,
      leaveShop: true,
      takeClientsOnLeave: true,
      googleOwnAgenda: true,
      googleWholeShop: false,
    },
    employee: {
      society: false,
      ownCatalog: false,
      suggestToPeers: false,
      // O banco só libera o próprio bloqueio com "serviços próprios" (padrão desligado).
      ownBlocks: false,
      ownProfile: true,
      // O banco ainda não aceita a foto do Contratado sem serviços próprios.
      ownPhoto: false,
      ownWallet: false,
      // Decisão 7: sai da loja, sem levar clientes; Google só da própria agenda.
      leaveShop: true,
      takeClientsOnLeave: false,
      googleOwnAgenda: true,
      googleWholeShop: false,
    },
  };
  for (const role of ROLES) {
    const result = caps(role);
    for (const [key, value] of Object.entries(expected[role])) {
      assert.equal(result[key as keyof ShopCapabilities], value, `${role}.${key}`);
    }
  }
});

test("as abas de cada papel continuam as de antes", () => {
  assert.deepEqual(tabsOf("owner"), ["agenda", "servicos", "equipe", "horarios", "configuracoes"]);
  assert.deepEqual(tabsOf("partner"), [
    "agenda",
    "servicos",
    "equipe",
    "horarios",
    "configuracoes",
  ]);
  assert.deepEqual(tabsOf("associate"), ["agenda", "servicos", "horarios", "configuracoes"]);
  assert.deepEqual(tabsOf("employee"), ["agenda", "configuracoes"]);
});

test("Parceiro: catálogo próprio e só os próprios bloqueios, sem mudar a loja", () => {
  const p = powersOf("associate");
  assert.equal(p.ownCatalog, true);
  assert.equal(p.ownBlocksOnly, true);
  assert.equal(p.writeMode, "none");
  assert.equal(p.suggestions, true);
  assert.equal(p.ownWallet, true);
  assert.equal(p.society, false);
});

test("Contratado com serviços próprios: catálogo próprio e bloqueios, como o banco permite", () => {
  const p = powersOf("employee", { manage_own_services: true });
  assert.equal(p.ownCatalog, true);
  assert.equal(p.ownBlocks, true);
  assert.equal(p.ownBlocksOnly, true);
  assert.equal(p.ownPhoto, true);
  // Sugestão aos parceiros: o banco só aceita do Parceiro.
  assert.equal(p.suggestions, false);
  assert.deepEqual(tabsOf("employee", { manage_own_services: true }), [
    "agenda",
    "servicos",
    "horarios",
    "configuracoes",
  ]);
});

test("decisão 8: gestão da loja não vale para o Contratado, nem pela matriz", () => {
  for (const permission of [
    "manage_services",
    "manage_operations",
    "manage_team",
    "manage_permissions",
  ]) {
    assert.equal(permissionLockedForRole("employee", permission), true, permission);
    assert.equal(permissionLockedForRole("associate", permission), false, permission);
    assert.equal(permissionLockedForRole("owner", permission), false, permission);
  }
  // Ver a agenda da equipe e os valores continuam liberáveis.
  assert.equal(permissionLockedForRole("employee", "view_agenda_all"), false);
  assert.equal(permissionLockedForRole("employee", "manage_own_services"), false);

  const employee = caps("employee", {
    manage_services: true,
    manage_operations: true,
    manage_team: true,
    view_agenda_all: true,
  });
  assert.equal(employee.manageCatalog, false);
  assert.equal(employee.manageOperations, false);
  assert.equal(employee.manageTeam, false);
  assert.equal(employee.viewFullShop, true);
  assert.deepEqual(
    tabsOf("employee", { manage_services: true, manage_operations: true, manage_team: true }),
    ["agenda", "configuracoes"],
  );
});

test("valores próprios seguem a matriz: Contratado com valores ganha a carteira", () => {
  assert.equal(caps("employee").ownWallet, false);
  assert.equal(caps("employee", { view_money: true }).ownWallet, true);
  assert.equal(caps("associate", { view_money: false }).ownWallet, false);
});

test("uma permissão só de bloqueios (futura) passa a decidir os bloqueios próprios", () => {
  const employee = caps("employee", { manage_own_blocks: true });
  assert.equal(employee.ownBlocks, true);
  assert.equal(employee.ownCatalog, false);
  // Dono nunca usa o caminho "só os próprios": bloqueia pela governança.
  assert.equal(caps("owner", { manage_own_blocks: true }).ownBlocks, false);
});

test("shop_admin antigo: Google da loja, sem cartão de profissional nem sociedade", () => {
  const legacy = shopPowers({ kind: "legacy-admin", actor: null }, null);
  assert.equal(legacy.googleOwn, true);
  assert.equal(legacy.googleWholeShop, true);
  assert.equal(legacy.ownProfile, false);
  assert.equal(legacy.society, false);
  assert.equal(legacy.leaveShop, false);
});

test("bloqueio de colega: 'Colega indisponível', sem nome nem motivo", () => {
  const base: PlacedBlock = {
    id: "b1",
    staffId: "colega",
    staffName: "Ana",
    reason: "Médico",
    startKey: "2026-10-10",
    endKey: "2026-10-10",
    startMinute: 600,
    endMinute: 660,
  };
  const masked = maskColleagueBlock(base, "eu");
  assert.equal(masked.colleague, true);
  assert.equal(masked.staffName, null);
  assert.equal(masked.reason, null);
  // Continua sendo de um profissional (não vira "loja inteira").
  assert.equal(masked.staffId, "colega");
  // Os próprios, os da loja inteira e a visão de quem gere a loja ficam como estão.
  const own = { ...base, staffId: "eu" };
  assert.equal(maskColleagueBlock(own, "eu"), own);
  assert.equal(maskColleagueBlock({ ...base, staffId: null }, "eu").colleague, undefined);
  assert.equal(maskColleagueBlock(base, null), base);
});
