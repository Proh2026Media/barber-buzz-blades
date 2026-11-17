/** UI local com sessão/API fictícias e rede externa bloqueada. Não libera piloto real. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
const base = process.argv[2] ?? "http://127.0.0.1:8091";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):8091$/);
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  browser,
  lerOpcoes(["/previsao-whatsapp", "--base", base, "--largura", "390", "--altura", "900"]),
);
const fontsDir = new URL("../node_modules/@fontsource-variable/inter/files/", import.meta.url);
const fonts = new Set(readdirSync(fontsDir));
await context.route(base + "/qa-inter.css", (route) =>
  route.fulfill({ contentType: "text/css", body: readFileSync(new URL("../index.css", fontsDir)) }),
);
await context.route("**/*inter-*-wght-normal.woff2", (route) => {
  const name = new URL(route.request().url()).pathname.split("/").at(-1);
  assert.ok(fonts.has(name));
  return route.fulfill({ contentType: "font/woff2", body: readFileSync(new URL(name, fontsDir)) });
});
await context.route("**/qa-shop-release", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>',
  }),
);
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const first = "11111111-1111-4111-8111-111111111111",
  second = "22222222-2222-4222-8222-222222222222",
  person = "33333333-3333-4333-8333-333333333333";
const data = {
  contract: "bc-shop-release-v1",
  managed: true,
  running: true,
  policy_version: 1,
  pause_version: 1,
  shops: [
    {
      id: first,
      name: "Loja Fictícia A",
      enabled: true,
      version: 1,
      customers: [{ id: person, name: "Cliente Fictício", allowed: true, ready: true }],
    },
    {
      id: second,
      name: "Loja Fictícia B",
      enabled: false,
      version: 0,
      customers: [{ id: person, name: "Cliente Fictício", allowed: false, ready: true }],
    },
  ],
};
let changes = 0,
  fail = false;
await context.route("**/rest/v1/rpc/care_shop_release_admin", (route) => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  const args = route.request().postDataJSON();
  if (args.p_action !== "read") {
    assert.equal(args.p_values.confirmed, true);
    assert.equal(args.p_values.shop_id, second);
    assert.equal(args.p_values.policy_version, data.policy_version);
    assert.equal(args.p_values.pause_version, data.pause_version);
    if (fail)
      return route.fulfill({
        status: 400,
        headers,
        contentType: "application/json",
        body: '{"message":"GROUP_STALE"}',
      });
    changes++;
    data.shops[1].enabled = args.p_action === "allow";
    data.shops[1].customers[0].allowed = args.p_action === "allow";
    data.shops[1].version++;
  }
  return route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(data) });
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/qa-shop-release", { waitUntil: "networkidle" });
  await page.addStyleTag({ url: base + "/qa-inter.css" });
  await page.evaluate(async () => {
    const { injectIntoGlobalHook } = await import("/@react-refresh");
    injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    await import("/src/styles.css");
    const react = await import("/node_modules/.vite/deps/react.js"),
      React = react.default ?? react;
    const dom = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { CareShopRelease } = await import("/src/features/platform/CareShopRelease.tsx");
    const el = document.createElement("main");
    el.id = "qa-shop";
    el.className = "brand-page brand-corners-soft min-h-dvh bg-background p-4 text-foreground";
    document.body.append(el);
    (dom.createRoot ?? dom.default.createRoot)(el).render(
      React.createElement(CareShopRelease, { onChanged: () => {} }),
    );
  });
  await page.getByRole("heading", { name: "Liberação por barbearia" }).waitFor();
  const shop = () =>
    page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Loja Fictícia B" }) });
  await shop().getByRole("button", { name: "Liberar este cliente" }).waitFor();
  assert.equal(changes, 0);
  const out = "/private/tmp/bc-shop-release-ui";
  mkdirSync(out, { recursive: true });
  for (const corner of ["square", "soft", "round"]) {
    await page.locator("#qa-shop").evaluate((el, corner) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + corner);
    }, corner);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.locator("#qa-shop").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        corner + ":" + width,
      );
      if (corner === "soft" && [390, 1440].includes(width))
        await page.screenshot({ path: out + "/liberacao-" + width + ".png", fullPage: true });
    }
  }
  await shop().getByRole("button", { name: "Liberar este cliente" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Voltar", exact: true }).click();
  assert.equal(changes, 0);
  await shop().getByRole("button", { name: "Liberar este cliente" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar alteração" }).click();
  await shop().getByRole("button", { name: "Pausar nesta barbearia" }).waitFor();
  assert.equal(changes, 1);
  assert.equal(data.shops[0].enabled, true);
  fail = true;
  await shop().getByRole("button", { name: "Pausar nesta barbearia" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar alteração" }).click();
  await page
    .getByRole("alertdialog")
    .getByText("A situação mudou. Confira a liberação novamente.", { exact: true })
    .waitFor();
  assert.equal(changes, 1);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    JSON.stringify({
      layouts: 15,
      actions: ["read_no_activation", "cancel", "allow_one_shop", "stale_rejected"],
      realNetwork: false,
    }),
  );
} finally {
  await browser.close();
}
