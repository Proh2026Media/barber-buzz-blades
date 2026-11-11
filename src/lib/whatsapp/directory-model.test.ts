import assert from "node:assert/strict";
import test from "node:test";
import { whatsappCoverage } from "./directory-model.ts";
const numbers = [
  { id: "geral", display_phone: "+5511999990000", status: "open" },
  { id: "proprio", display_phone: "+5511999990001", status: "disconnected" },
  { id: "incompleto", display_phone: null, status: "connecting" },
];
const general = {
  id: "link-geral",
  channel_id: "geral",
  barbershop_id: "loja",
  staff_id: null,
  enabled: false,
};
const own = { ...general, id: "link-prof", channel_id: "proprio", staff_id: "prof" };
test("profissional sem vínculo próprio usa o número geral, mesmo com avisos pausados", () => {
  const result = whatsappCoverage("loja", "prof", numbers, [general]);
  assert.equal(result.kind, "shop");
  assert.equal(result.number?.id, "geral");
  assert.equal(result.link?.enabled, false);
});
test("número próprio prevalece mesmo desconectado; não afirma que o geral está sendo usado", () => {
  const result = whatsappCoverage("loja", "prof", numbers, [general, own]);
  assert.equal(result.kind, "own");
  assert.equal(result.number?.id, "proprio");
});
test("vínculo próprio incompleto bloqueia cobertura automática, como whatsapp_route_link", () => {
  const pending = { ...own, channel_id: "incompleto" };
  const result = whatsappCoverage("loja", "prof", numbers, [general, pending]);
  assert.equal(result.kind, "none");
  assert.equal(result.number, undefined);
  assert.equal(result.pending?.id, pending.id);
});
test("preparação geral não conta como número da barbearia", () => {
  const result = whatsappCoverage("loja", null, numbers, [
    { ...general, channel_id: "incompleto" },
  ]);
  assert.equal(result.kind, "none");
  assert.ok(result.pending);
});
test("profissional usa seu próprio número mesmo sem número geral", () => {
  assert.equal(whatsappCoverage("loja", "prof", numbers, [own]).kind, "own");
  assert.equal(whatsappCoverage("loja", null, numbers, [own]).kind, "none");
});
test("vínculos de outra barbearia não cobrem o destino", () => {
  assert.equal(whatsappCoverage("outra", "prof", numbers, [general, own]).kind, "none");
});
test("telefone em branco e vínculo sem cadastro de número não significam cobertura", () => {
  assert.equal(
    whatsappCoverage("loja", null, [{ ...numbers[0], display_phone: "  " }], [general]).kind,
    "none",
  );
  assert.equal(whatsappCoverage("loja", null, [], [general]).kind, "none");
});
