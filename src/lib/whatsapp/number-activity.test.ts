import test from "node:test";
import assert from "node:assert/strict";
import { numberActivityLevel, type NumberActivity } from "./number-activity.ts";
import { suggestDistribution } from "./distribution-suggestion.ts";
const now = Date.now();
const m: NumberActivity = {
  scope: "groups",
  accepted: 100,
  uncertain: 0,
  activeDays: 14,
  observedDays: 20,
  sampledAt: new Date(now).toISOString(),
  source: "simulation",
};
test("ausente, vazio e contagem incoerente não viram perfil positivo", () => {
  assert.equal(numberActivityLevel(), "unknown");
  assert.equal(numberActivityLevel({ ...m, accepted: 0, activeDays: 0 }), "unknown");
  assert.equal(numberActivityLevel({ ...m, activeDays: 31 }), "unknown");
  assert.equal(numberActivityLevel({ ...m, accepted: 1, activeDays: 14 }), "unknown");
});
test("limiares internos exigem volume E tempo; pausa e incerteza prevalecem", () => {
  assert.equal(numberActivityLevel(m), "established");
  assert.equal(numberActivityLevel({ ...m, accepted: 20, activeDays: 7 }), "regular");
  assert.equal(numberActivityLevel({ ...m, accepted: 9999, activeDays: 1 }), "initial");
  assert.equal(numberActivityLevel({ ...m, uncertain: 1 }), "review");
  assert.equal(numberActivityLevel({ ...m, paused: true }), "review");
});
test("medição expirada ou no futuro não é considerada atual", () => {
  assert.equal(
    numberActivityLevel({ ...m, sampledAt: new Date(now - 86400001).toISOString() }, now),
    "unknown",
  );
  assert.equal(
    numberActivityLevel({ ...m, sampledAt: new Date(now + 300001).toISOString() }, now),
    "unknown",
  );
});
test("atividade desempata carga e não permite recomendar pausados ou incertos", () => {
  const a = { id: "a", display_phone: "5511900000001", status: "open" };
  const b = { id: "b", display_phone: "5511900000002", status: "open", activity: m };
  assert.equal(suggestDistribution("s", [a, b], []).primary?.id, "b");
  assert.equal(
    suggestDistribution("s", [a, { ...b, activity: { ...m, uncertain: 1 } }], []).primary?.id,
    "a",
  );
  assert.equal(
    suggestDistribution("s", [{ ...b, activity: { ...m, paused: true } }], []).available,
    0,
  );
});

test("um pico de envios não substitui os dias ativos necessários", () => {
  assert.equal(numberActivityLevel({ ...m, accepted: 1000, activeDays: 6 }), "initial");
  assert.equal(numberActivityLevel({ ...m, accepted: 99 }), "regular");
});

test("eventos sem escopo de grupo não classificam o número", () => {
  assert.equal(numberActivityLevel({ ...m, scope: undefined }), "unknown");
});
