import assert from "node:assert/strict";
import test from "node:test";
import { parseShopLink, shopLinkAppHref } from "./shop-link.ts";

const BASE = "beauty.contheiner.digital";

test("link de loja: subdomínio, /b/, ?shop= e nome curto", () => {
  assert.deepEqual(parseShopLink("https://arena.beauty.contheiner.digital", BASE), {
    slug: "arena",
  });
  assert.deepEqual(parseShopLink("arena.beauty.contheiner.digital/", BASE), { slug: "arena" });
  assert.deepEqual(parseShopLink("https://beauty.contheiner.digital/b/arena-barber", BASE), {
    slug: "arena-barber",
  });
  assert.deepEqual(parseShopLink("https://beauty.contheiner.digital/app?shop=arena", BASE), {
    slug: "arena",
  });
  assert.deepEqual(parseShopLink("  Arena-Barber ", BASE), { slug: "arena-barber" });
});

test("link do profissional leva a loja e o profissional", () => {
  assert.deepEqual(parseShopLink("https://arena.beauty.contheiner.digital/carlao", BASE), {
    slug: "arena",
    barber: "carlao",
  });
  assert.deepEqual(
    parseShopLink("https://beauty.contheiner.digital/app?shop=arena&barber=bruno", BASE),
    { slug: "arena", barber: "bruno" },
  );
  // Páginas do sistema não viram profissional.
  assert.deepEqual(parseShopLink("https://arena.beauty.contheiner.digital/auth", BASE), {
    slug: "arena",
  });
});

test("domínio próprio volta como endereço para conferir", () => {
  assert.deepEqual(parseShopLink("https://www.barbeariadoze.com.br", BASE), {
    host: "barbeariadoze.com.br",
  });
  assert.deepEqual(parseShopLink("barbeariadoze.com.br/ze", BASE), {
    host: "barbeariadoze.com.br",
    barber: "ze",
  });
});

test("links que não apontam loja são recusados", () => {
  assert.equal(parseShopLink("", BASE), null);
  assert.equal(parseShopLink("https://beauty.contheiner.digital/", BASE), null);
  assert.equal(parseShopLink("javascript:alert(1)", BASE), null);
  assert.equal(parseShopLink("ftp://arena.beauty.contheiner.digital", BASE), null);
  assert.equal(parseShopLink("não é link", BASE), null);
  assert.equal(parseShopLink("https://x.y.beauty.contheiner.digital", BASE), null);
});

test("endereço do app fica no mesmo domínio", () => {
  assert.equal(shopLinkAppHref("arena"), "/app?shop=arena");
  assert.equal(shopLinkAppHref("arena", "carlao"), "/app?shop=arena&barber=carlao");
});
