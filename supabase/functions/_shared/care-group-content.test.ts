import test from "node:test";
import assert from "node:assert/strict";
import {
  annualGroupExpiry,
  careGroupCode,
  careGroupContent,
  groupPreferencesUrl,
} from "./care-group-content.ts";
import { loadCareGroupLogo } from "./care-group-logo.ts";
const shop = "11111111-1111-4111-8111-111111111111";
const input = {
  shop_name: "Arena",
  customer_name: "Alyson Teste",
  slug: "arena",
  expires_at: "2027-11-14T15:00:00Z",
  timezone: "America/Sao_Paulo",
};
test("Cliente vê somente a barbearia e preferências no aplicativo", () => {
  const text = careGroupContent(input);
  assert.match(text.welcome, /Arena/);
  assert.match(text.welcome, /até 3|máximo de 3/);
  assert.ok(!/Barba & Cabelo|B&C|responda PARAR/.test(text.welcome + text.description));
  assert.ok(text.description.length <= 512);
  assert.match(
    text.preferences_url,
    /^https:\/\/arena\.beauty\.contheiner\.digital\/app\?tab=conta&focus=grupo$/,
  );
});
test("Aniversário civil preserva hora e trata ano bissexto sem renovar ciclo", () => {
  assert.equal(
    annualGroupExpiry(Date.parse("2024-02-29T15:16:17Z") / 1000),
    "2025-02-28T15:16:17.000Z",
  );
  assert.equal(
    annualGroupExpiry(Date.parse("2026-12-31T23:59:59Z") / 1000),
    "2027-12-31T23:59:59.000Z",
  );
  assert.throws(() => annualGroupExpiry(0));
});
test("Código não leva nome da plataforma nem aceita texto livre no lugar dos dígitos", () => {
  assert.match(careGroupCode("Arena", "login", "123456"), /^Arena\nSeu código de acesso: 123456/);
  assert.ok(!careGroupCode("Arena", "verify_phone", "123456").includes("Barba & Cabelo"));
  assert.throws(() => careGroupCode("Arena", "login", "123456texto"));
});
test("Link não aceita domínio, caminho, porta ou credencial no slug/origem", () => {
  for (const value of ["arena/../admin", "a.example.org", "a?token=segredo", "-arena"])
    assert.throws(() => groupPreferencesUrl(value));
  for (const origin of [
    "http://localhost",
    "https://x:444",
    "https://user:senha@x",
    "https://x/caminho",
  ])
    assert.throws(() => groupPreferencesUrl("arena", origin));
});
test("Logo só é lida no armazenamento configurado e na pasta da própria loja", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  let called = "";
  const result = await loadCareGroupLogo(
    shop,
    `https://dominio-arbitrario.invalid/storage/v1/object/public/barbershop-logos/${shop}/logo-123?assinatura=nao-usar`,
    "http://storage-local:8000",
    async (url, init) => {
      called = url;
      assert.equal(init.redirect, "error");
      assert.equal(init.headers, undefined);
      return new Response(png, { headers: { "content-type": "image/png" } });
    },
  );
  assert.equal(
    called,
    `http://storage-local:8000/storage/v1/object/public/barbershop-logos/${shop}/logo-123`,
  );
  assert.equal(result.sha256.length, 64);
  assert.equal(result.base64, "iVBORw0KGgo=");
});
test("Logo de outra loja, tamanho excedido e corpo raster falso são recusados", async () => {
  const chosen = `https://storage.invalid/storage/v1/object/public/barbershop-logos/${shop}/logo-123`;
  await assert.rejects(
    () =>
      loadCareGroupLogo(
        shop,
        chosen.replace(shop, "22222222-2222-4222-8222-222222222222"),
        "http://storage-local",
        async () => {
          throw new Error("não chamar");
        },
      ),
    /INVALID/,
  );
  for (const response of [
    new Response("falso", { headers: { "content-type": "image/png" } }),
    new Response("x", { headers: { "content-type": "image/png", "content-length": "3000000" } }),
  ])
    await assert.rejects(() =>
      loadCareGroupLogo(shop, chosen, "http://storage-local", async () => response),
    );
});

test("Textos extremos preservam caracteres e não expõem e-mail como nome", () => {
  const text = careGroupContent({
    ...input,
    shop_name: "😀".repeat(100),
    customer_name: "teste@example.invalid",
    slug: "a".repeat(63),
  });
  assert.ok(text.description.length <= 512);
  assert.ok(!text.welcome.includes("@example"));
  assert.ok(
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      text.description,
    ),
  );
});

test("SVG da logo selecionada segue ao decodificador protegido, sem buscar outro host", async () => {
  const body =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30"/></svg>';
  const chosen = `https://outra-origem.invalid/storage/v1/object/public/barbershop-logos/${shop}/logo-123`;
  const result = await loadCareGroupLogo(shop, chosen, "http://storage-local", async (url) => {
    assert.ok(url.startsWith("http://storage-local/"));
    return new Response(body, { headers: { "content-type": "image/svg+xml" } });
  });
  assert.equal(atob(result.base64), body);
});
