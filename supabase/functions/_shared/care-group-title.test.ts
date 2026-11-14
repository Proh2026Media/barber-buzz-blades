import test from "node:test";
import assert from "node:assert/strict";
import { careGroupTitle } from "./care-group-title.ts";
const base = {
  shop_name: "Arena",
  customer_name: "Alyson",
  timezone: "America/Sao_Paulo",
  starts_at: null,
};
test("Título sem agendamento e na segunda-feira do exemplo", () => {
  assert.equal(careGroupTitle(base), "Notificações Arena • Alyson");
  assert.equal(
    careGroupTitle({ ...base, starts_at: "2027-01-11T17:00:00Z" }),
    "Seg. 11/01 às 14h00 • Notificações Arena • Alyson",
  );
});
test("Fuso da loja muda o dia; meia-noite usa 00h", () => {
  assert.equal(
    careGroupTitle({ ...base, starts_at: "2027-01-12T02:00:00Z" }).split(" • ")[0],
    "Seg. 11/01 às 23h00",
  );
  assert.equal(
    careGroupTitle({ ...base, starts_at: "2027-01-12T03:00:00Z" }).split(" • ")[0],
    "Ter. 12/01 às 00h00",
  );
});
test("Nomes longos e emoji respeitam 100 unidades sem cortar surrogate", () => {
  for (const starts_at of [null, "2027-01-11T17:00:00Z"]) {
    const name = careGroupTitle({
      ...base,
      starts_at,
      shop_name: "😀".repeat(100),
      customer_name: "José ".repeat(80),
    });
    assert.ok(name.length <= 100);
    assert.ok(
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name),
    );
    assert.ok(name.includes(" • "));
    assert.ok(name.endsWith("…"));
  }
});
test("Fallback não expõe e-mail; controle e espaços são normalizados", () => {
  assert.equal(
    careGroupTitle({ ...base, shop_name: null, customer_name: "\n" }),
    "Notificações Barbearia • Cliente",
  );
  assert.equal(
    careGroupTitle({ ...base, shop_name: " Arena\n  Testes ", customer_name: "Alyson\u202e" }),
    "Notificações Arena Testes • Alyson",
  );
  assert.throws(() => careGroupTitle({ ...base, starts_at: "inválida" }));
});
