import test from "node:test";
import assert from "node:assert/strict";
import { suggestDistribution } from "./distribution-suggestion.ts";
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
