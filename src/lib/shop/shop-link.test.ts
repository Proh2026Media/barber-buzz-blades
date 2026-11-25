import assert from "node:assert/strict";
import test from "node:test";
import { parseShopLink, shopLinkAppHref } from "./shop-link.ts";

const BASE = "aurset.app";

test("link de loja: subdomínio, /b/, ?shop= e nome curto", () => {
  assert.deepEqual(parseShopLink("https://arena.aurset.app", BASE), {
    slug: "arena",
  });
  assert.deepEqual(parseShopLink("arena.aurset.app/", BASE), { slug: "arena" });
  assert.deepEqual(parseShopLink("https://aurset.app/b/arena-barber", BASE), {
    slug: "arena-barber",
  });
  assert.deepEqual(parseShopLink("https://aurset.app/app?shop=arena", BASE), {
    slug: "arena",
  });
  assert.deepEqual(parseShopLink("  Arena-Barber ", BASE), { slug: "arena-barber" });
});

test("link do profissional leva a loja e o profissional", () => {
  assert.deepEqual(parseShopLink("https://arena.aurset.app/carlao", BASE), {
    slug: "arena",
    barber: "carlao",
  });
  assert.deepEqual(
    parseShopLink("https://aurset.app/app?shop=arena&barber=bruno", BASE),
    { slug: "arena", barber: "bruno" },
  );
  // Páginas do sistema não viram profissional.
  assert.deepEqual(parseShopLink("https://arena.aurset.app/auth", BASE), {
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
  assert.equal(parseShopLink("https://aurset.app/", BASE), null);
  assert.equal(parseShopLink("javascript:alert(1)", BASE), null);
  assert.equal(parseShopLink("ftp://arena.aurset.app", BASE), null);
  assert.equal(parseShopLink("não é link", BASE), null);
  assert.equal(parseShopLink("https://x.y.aurset.app", BASE), null);
});

test("endereço do app fica no mesmo domínio", () => {
  assert.equal(shopLinkAppHref("arena"), "/app?shop=arena");
  assert.equal(shopLinkAppHref("arena", "carlao"), "/app?shop=arena&barber=carlao");
});
