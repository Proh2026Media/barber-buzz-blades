import { test } from "node:test";
import assert from "node:assert/strict";
import { brPhoneE164, looksLikeEmail, maskBrPhone, slugifyShopName } from "./owner-signup.ts";

test("slug igual ao slugify_pt do banco", () => {
  assert.equal(slugifyShopName("Barbearia do João"), "barbearia-do-joao");
  assert.equal(slugifyShopName("  Ação & Cia. 2!  "), "acao-cia-2");
  assert.equal(slugifyShopName("Vinícius"), "vinicius");
  assert.equal(slugifyShopName("Óculos Úteis Ñandú Ýs"), "oculos-uteis-nandu-ys");
  assert.equal(slugifyShopName("---"), "item");
  assert.equal(slugifyShopName(""), "item");
  assert.equal(slugifyShopName("a".repeat(80)).length, 60);
});

test("máscara do WhatsApp", () => {
  assert.equal(maskBrPhone("11999990000"), "(11) 99999-0000");
  assert.equal(maskBrPhone("1133334444"), "(11) 3333-4444");
  assert.equal(maskBrPhone("119"), "(11) 9");
  assert.equal(maskBrPhone("+55 11 99999 0000"), "+55 (11) 99999-0000");
  assert.equal(maskBrPhone("5511999990000"), "(11) 99999-0000");
  assert.equal(maskBrPhone("+351 912 345 678"), "+351912345678");
  assert.equal(maskBrPhone(""), "");
  // Digitando "+55 11…" caractere a caractere: o 5 do país não vira DDD.
  assert.equal(maskBrPhone("+5"), "+5");
  assert.equal(maskBrPhone("+55"), "+55");
  assert.equal(maskBrPhone("+551"), "+55 (1");
  assert.equal(maskBrPhone("+55 (11"), "+55 (11");
});

test("conferência do WhatsApp", () => {
  assert.equal(brPhoneE164("(11) 99999-0000"), "+5511999990000");
  assert.equal(brPhoneE164("+55 (11) 99999-0000"), "+5511999990000");
  assert.equal(brPhoneE164("(11) 3333-4444"), "+551133334444");
  assert.equal(brPhoneE164("(20) 99999-0000"), null);
  assert.equal(brPhoneE164("(11) 89999-0000"), null);
  assert.equal(brPhoneE164("9999-0000"), null);
  assert.equal(brPhoneE164("+351912345678"), "+351912345678");
});

test("e-mail", () => {
  assert.ok(looksLikeEmail("ana@exemplo.com"));
  assert.ok(!looksLikeEmail("ana@exemplo"));
  assert.ok(!looksLikeEmail("ana exemplo.com"));
});
