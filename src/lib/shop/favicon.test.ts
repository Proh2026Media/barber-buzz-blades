import assert from "node:assert/strict";
import test from "node:test";
import { applyShopFavicon } from "./favicon.ts";

test("applyShopFavicon is a no-op without document (SSR-safe)", () => {
  assert.equal(typeof applyShopFavicon, "function");
  assert.doesNotThrow(() => applyShopFavicon("https://example.com/logo.png"));
  assert.doesNotThrow(() => applyShopFavicon(null));
});

// Exercita a rota real com dados de identidade fictícios. O Vite resolve os mesmos módulos WASM do servidor.
test("ícones da loja preservam pontas da arte, proporção e área segura no manifesto e no iPhone", async (t) => {
  const { createServer } = await import("vite");
  const { decode } = await import("fast-png");
  const servidor = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
    logLevel: "silent",
  });
  t.after(() => servidor.close());
  const { shopIdentity } = await servidor.ssrLoadModule("/src/lib/shop/installation.ts");
  const api = "https://supabase-barbearia.proh.media";
  const antiga = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = api;
  t.after(() => {
    if (antiga === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = antiga;
  });
  const endereco = (rota: string) => new URL(rota, "https://marca-ficticia.aurset.app");
  const loja = {
    shop_id: "loja-de-teste",
    shop_name: "Marca fictícia",
    logo_url: api + "/storage/v1/object/public/barbershop-logos/loja-de-teste/logo",
    logo_background_color: "#000000",
  };
  let arte: BodyInit =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 40"><rect width="20" height="40" fill="white"/></svg>';
  let tipo = "image/svg+xml";
  t.mock.method(globalThis, "fetch", async (url: URL) =>
    url.pathname.includes("/rpc/")
      ? Response.json(loja)
      : new Response(arte, { headers: { "Content-Type": tipo } }),
  );
  const manifesto = await (await shopIdentity(endereco("/identidade/manifesto"))).json();
  assert.deepEqual(
    manifesto.icons.map((i: { sizes: string; purpose: string }) => [i.sizes, i.purpose]),
    [
      ["192x192", "any"],
      ["192x192", "maskable"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ],
  );

  async function conferir(src: string, lado: number, mascara: boolean, proporcao: number) {
    const resposta = await shopIdentity(endereco(src));
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get("Content-Type"), "image/png");
    const { data, width, height, channels } = decode(new Uint8Array(await resposta.arrayBuffer()));
    assert.equal(width, lado);
    assert.equal(height, lado);
    let xmin = lado,
      ymin = lado,
      xmax = -1,
      ymax = -1;
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        if (data[(y * lado + x) * channels] < 128) continue;
        assert.ok(
          Math.hypot(x + 0.5 - lado / 2, y + 0.5 - lado / 2) <= lado * (mascara ? 0.4 : 0.5),
        );
        xmin = Math.min(x, xmin);
        xmax = Math.max(x, xmax);
        ymin = Math.min(y, ymin);
        ymax = Math.max(y, ymax);
      }
    }
    assert.ok(xmax > xmin && ymax > ymin);
    assert.ok(Math.abs((xmax - xmin + 1) / (ymax - ymin + 1) - proporcao) < 0.06);
    assert.ok(Math.abs(xmax + xmin - (lado - 1)) <= 2 && Math.abs(ymax + ymin - (lado - 1)) <= 2);
  }

  for (const icone of manifesto.icons) {
    await conferir(icone.src, Number(icone.sizes.split("x")[0]), icone.purpose === "maskable", 0.5);
  }
  await conferir("/apple-touch-icon.png", 180, false, 0.5);
  await conferir("/identidade/icone?tamanho=32", 32, false, 0.5);
  // WEBP quadrado branco em fundo preto: os quatro vértices precisam estar dentro da máscara.
  tipo = "image/webp";
  arte = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvC8ACAAfQ//73v/+BiOh/AAA=", "base64");
  await conferir("/identidade/icone?tamanho=192&mascara=1", 192, true, 1);
});
