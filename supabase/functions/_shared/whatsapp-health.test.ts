import test from "node:test";
import assert from "node:assert/strict";
import { connectionStates, healthSummary } from "./whatsapp-health.ts";
const number = {
  id: "a",
  name: "Principal",
  phone: "+5511999990000",
  instance_name: "bc-a",
  paused: false,
  unknown: 0,
  failed: 0,
  pending: 0,
  last_accepted_at: null,
};
test("Número sem uso recente não vira falha", () => {
  assert.equal(healthSummary(number, "open").severity, "ok");
});
test("Falha da API significa desconhecido, não desconectado", () => {
  assert.deepEqual(healthSummary(number, "unknown").issues, ["unknown_connection"]);
  assert.equal(connectionStates({ error: "indisponível" }).size, 0);
});
test("Desconexão e falha de envio chamam atenção", () => {
  assert.equal(healthSummary(number, "disconnected").severity, "danger");
  assert.equal(healthSummary({ ...number, failed: 1 }, "open").severity, "danger");
});
test("Pausa não vira falha de fila; resultado incerto não é tratado como entregue", () => {
  assert.equal(healthSummary({ ...number, paused: true, pending: 10 }, "open").severity, "ok");
  assert.deepEqual(healthSummary({ ...number, unknown: 1 }, "open").issues, ["unknown_delivery"]);
});
test("Formatos conhecidos e desconhecidos da Evolution", () => {
  const states = connectionStates([
    { name: "a", connectionStatus: "open" },
    { instance: { instanceName: "b", state: "close" } },
    { name: "c", connectionStatus: "inventado" },
  ]);
  assert.equal(states.get("a"), "open");
  assert.equal(states.get("b"), "disconnected");
  assert.equal(states.has("c"), false);
});
test("Tela não recebe identificador técnico de instância", () => {
  assert.equal("instance_name" in healthSummary(number, "open"), false);
});
