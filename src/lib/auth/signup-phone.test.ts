import assert from "node:assert/strict";
import test from "node:test";
import { checkSignupPhone, formatSignupPhone, nextMaskedPhone } from "./signup-phone.ts";

test("aceita celular e fixo do Brasil com DDD válido", () => {
  assert.deepEqual(checkSignupPhone("(11) 99999-0000"), {
    ok: true,
    digits: "5511999990000",
    e164: "+5511999990000",
  });
  assert.equal(checkSignupPhone("(21) 3333-4444").ok, true);
  assert.equal(checkSignupPhone("+55 (11) 99999-0000").ok, true);
  assert.equal(checkSignupPhone("5511999990000").ok, true);
});

test("recusa DDD inexistente, tamanho errado e celular sem 9", () => {
  assert.deepEqual(checkSignupPhone("(20) 99999-0000"), { ok: false, reason: "ddd" });
  assert.deepEqual(checkSignupPhone("99999-0000"), { ok: false, reason: "length" });
  assert.deepEqual(checkSignupPhone("(11) 89999-0000"), { ok: false, reason: "length" });
  assert.deepEqual(checkSignupPhone("  "), { ok: false, reason: "empty" });
});

test("aceita Portugal com +351 ou pelo idioma pt-PT", () => {
  assert.deepEqual(checkSignupPhone("+351 912 345 678"), {
    ok: true,
    digits: "351912345678",
    e164: "+351912345678",
  });
  assert.equal(checkSignupPhone("912 345 678", "pt-PT").ok, true);
  assert.equal(checkSignupPhone("+351 812 345 678").ok, false);
});

test("máscara enquanto digita", () => {
  assert.equal(formatSignupPhone("11"), "(11");
  assert.equal(formatSignupPhone("119999"), "(11) 9999");
  assert.equal(formatSignupPhone("1199999000"), "(11) 9999-9000");
  assert.equal(formatSignupPhone("11999990000"), "(11) 99999-0000");
  assert.equal(formatSignupPhone("+351912345678"), "+351 912 345 678");
  assert.equal(formatSignupPhone("912345678", "pt-PT"), "912 345 678");
});

test("apagar o símbolo da máscara apaga o último dígito", () => {
  assert.equal(nextMaskedPhone("(11) 9999-", "(11) 9999", undefined), "(11) 999");
  assert.equal(nextMaskedPhone("(11", "(1", undefined), "(1");
});

test("número com código do país sem + não é cortado pela máscara", () => {
  assert.equal(formatSignupPhone("5511999990000"), "+55 (11) 99999-0000");
  assert.equal(checkSignupPhone(formatSignupPhone("5511999990000")).ok, true);
  assert.equal(formatSignupPhone("351912345678"), "+351 912 345 678");
  assert.equal(checkSignupPhone(formatSignupPhone("351912345678")).ok, true);
  // Número nacional com DDD 55 (RS) continua nacional.
  assert.equal(formatSignupPhone("55999990000"), "(55) 99999-0000");
});
