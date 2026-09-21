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
