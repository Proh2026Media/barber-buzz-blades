import test from "node:test";
import assert from "node:assert/strict";
import { suggestDistribution, suggestMissingDistributions } from "./distribution-suggestion.ts";
const nums = ["a", "b", "c"].map((id, i) => ({
  id,
  display_phone: `551190000000${i}`,
  status: "open",
}));
test("exclui desconectados e repetições físicas; aceita menos de três sem inventar reserva", () => {
  const result = suggestDistribution(
    "s",
    [nums[0], { ...nums[0], id: "dup" }, { ...nums[1], status: "disconnected" }],
    [],
  );
  assert.equal(result.available, 1);
  assert.equal(result.backup, null);
  assert.equal(result.backup2, null);
});
test("prioriza menor número de vínculos principais e não altera entradas", () => {
  const routes = [
    { barbershop_id: "outro", staff_id: null, channel_id: "a", backup_channel_id: "b" },
  ];
  const before = JSON.stringify(routes);
  const r = suggestDistribution("s", nums, routes);
  assert.equal(r.primary?.id, "c");
  assert.equal(new Set([r.primary?.id, r.backup?.id, r.backup2?.id]).size, 3);
  assert.equal(JSON.stringify(routes), before);
});
test("desconsidera o geral substituído, preserva profissionais no cálculo e é determinístico", () => {
  const routes = [
    { barbershop_id: "s", staff_id: null, channel_id: "a", backup_channel_id: null },
    { barbershop_id: "s", staff_id: "p", channel_id: "b", backup_channel_id: null },
  ];
  assert.equal(suggestDistribution("s", nums, routes).primary?.id, "a");
  assert.deepEqual(suggestDistribution("s", nums, routes), suggestDistribution("s", nums, routes));
});

test("agrega carga de instâncias diferentes do mesmo telefone físico", () => {
  const duplicate = { ...nums[0], id: "alias-a" };
  const routes = [
    { barbershop_id: "outro", staff_id: null, channel_id: "alias-a", backup_channel_id: null },
  ];
  assert.equal(suggestDistribution("s", [...nums, duplicate], routes).primary?.id, "b");
});

test("arquivados e restritos permanecem nos dados, mas não são sugeridos", () => {
  const rows = [
    ...nums,
    { ...nums[0], id: "antigo", status: "archived" },
    { ...nums[1], id: "restrito", status: "restricted" },
  ];
  const before = JSON.stringify(rows);
  const result = suggestDistribution("s", rows, []);
  assert.equal(result.available, 2);
  assert.equal(JSON.stringify(rows), before);
  assert.ok(![result.primary?.id, result.backup?.id, result.backup2?.id].includes("antigo"));
  assert.ok(![result.primary?.id, result.backup?.id, result.backup2?.id].includes("restrito"));
});

test("lote preenche somente lojas sem configuração e considera carga cumulativa", () => {
  const routes = [
    { barbershop_id: "manual", staff_id: null, channel_id: "a", backup_channel_id: "b" },
  ];
  const result = suggestMissingDistributions(
    [{ id: "manual" }, { id: "x" }, { id: "y" }],
    nums,
    routes,
  );
  assert.equal(result.assignments.length, 2);
  assert.equal(result.blocked.length, 0);
  assert.ok(result.assignments.every((r) => r.shop !== "manual" && r.primary !== r.backup));
  assert.notEqual(result.assignments[0].primary, result.assignments[1].primary);
  assert.equal(routes.length, 1);
});
test("nenhum grupo automático é composto com um único telefone ou restrito", () => {
  const result = suggestMissingDistributions(
    [{ id: "x" }],
    [nums[0], { ...nums[1], status: "restricted" }],
    [],
  );
  assert.equal(result.assignments.length, 0);
  assert.deepEqual(result.blocked, ["x"]);
});
test("principal usa menor volume em empate de vínculos; reserva considera consistência", () => {
  const measured = (accepted: number, days: number) => ({
    scope: "groups" as const,
    accepted,
    uncertain: 0,
    activeDays: days,
    observedDays: days,
    sampledAt: new Date().toISOString(),
    source: "simulation" as const,
  });
  const result = suggestDistribution(
    "x",
    [
      { ...nums[0], activity: measured(150, 15) },
      { ...nums[1], activity: measured(20, 7) },
      { ...nums[2], activity: measured(80, 10) },
    ],
    [],
  );
  assert.equal(result.primary?.id, "b");
  assert.equal(result.backup?.id, "a");
});

test("restrição histórica bloqueia nova instância do mesmo telefone na sugestão", () => {
  const result = suggestDistribution(
    "x",
    [nums[0], { ...nums[0], id: "historico", status: "restricted" }, nums[1]],
    [],
  );
  assert.equal(result.primary?.id, "b");
  assert.equal(result.available, 1);
});
