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
await context.route("**/qa-pilot-release", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>',
  }),
);
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const data = {
  contract: "bc-pilot-release-v1",
  scoped: true,
  isolated: true,
  shop_id: "11111111-1111-4111-8111-111111111111",
  customer_id: "22222222-2222-4222-8222-222222222222",
  shop_name: "Barbearia Fictícia",
  customer_name: "Cliente Fictício",
  policy_version: 12,
  pause_version: 17,
  paused: true,
  cycles: false,
  assistance: false,
  preparation_ready: false,
};
const calls = [];
let stale = false;
let readFailure = false,
  delayed = false;
await context.route("**/rest/v1/rpc/care_pilot_admin", async (route) => {
  if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  const args = route.request().postDataJSON();
  calls.push(args);
  if (args.p_action === "read" && delayed)
    await new Promise((resolve) => setTimeout(resolve, 16000));
  if (args.p_action === "read" && readFailure)
    return route.fulfill({
      status: 500,
      headers,
      contentType: "application/json",
      body: '{"message":"falha simulada"}',
    });
  if (args.p_action !== "read") {
    assert.equal(args.p_values.confirmed, true);
    assert.equal(args.p_values.shop_id, data.shop_id);
    assert.equal(args.p_values.customer_id, data.customer_id);
    if (stale)
      return route.fulfill({
        status: 400,
        headers,
        contentType: "application/json",
        body: '{"code":"P0001","message":"GROUP_STALE"}',
      });
    assert.equal(args.p_values.policy_version, data.policy_version);
    assert.equal(args.p_values.pause_version, data.pause_version);
    data.paused = args.p_action === "pause";
    data.cycles = !data.paused;
    data.assistance = !data.paused;
    data.policy_version += 2;
    data.pause_version++;
  }
  return route.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "/tmp/bc-p122-liberacao-interface";
mkdirSync(out, { recursive: true });
async function layouts(state) {
  for (const corner of ["square", "soft", "round"]) {
    await page.locator("#qa-pilot").evaluate((el, mode) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + mode);
    }, corner);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.locator("#qa-pilot").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        state + "/" + corner + "/" + width,
      );
      if (corner === "soft" && [390, 1440].includes(width))
        await page.screenshot({ path: `${out}/${state}-${width}.png`, fullPage: true });
    }
  }
}
try {
  await page.goto(base + "/qa-pilot-release", { waitUntil: "networkidle" });
  await page.addStyleTag({ url: base + "/qa-inter.css" });
  await page.evaluate(async () => {
    const { injectIntoGlobalHook } = await import("/@react-refresh");
    injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    await import("/src/styles.css");
    const react = await import("/node_modules/.vite/deps/react.js");
    const React = react.default ?? react;
    const dom = await import("/node_modules/.vite/deps/react-dom_client.js");
    const { CarePilotRelease } = await import("/src/features/platform/CarePilotRelease.tsx");
    const el = document.createElement("main");
    el.id = "qa-pilot";
    el.className = "brand-page brand-corners-soft min-h-dvh bg-background p-4 text-foreground";
    document.body.append(el);
    (dom.createRoot ?? dom.default.createRoot)(el).render(
      React.createElement(CarePilotRelease, { onChanged: () => {} }),
    );
  });
  const release = () =>
    page.locator("#qa-pilot").getByRole("button", { name: "Liberar teste", exact: true });
  const refresh = () =>
    page.getByRole("button", { name: "Conferir liberação", exact: true }).click();
  await release().waitFor();
  assert.equal(await release().isDisabled(), true);
  assert.ok(calls.every((r) => r.p_action === "read"));
  await layouts("pausado");
  await refresh();
  await page.getByText("Conferência concluída", { exact: true }).waitFor();
  await page
    .getByText("Confira a conexão recente e a autorização dos dois números de atendimento.", {
      exact: true,
    })
    .first()
    .waitFor();
  data.paused = false;
  await refresh();
  await page.getByText("Teste parcialmente desativado", { exact: true }).waitFor();
  assert.equal(await release().count(), 0);
  await page.getByRole("button", { name: "Pausar teste", exact: true }).waitFor();
  assert.ok(calls.every((r) => r.p_action === "read"));
  data.paused = true;
  data.preparation_ready = true;
  await refresh();
  await release().click();
  const dialog = page.getByRole("alertdialog");
  await dialog.waitFor();
  assert.ok(
    calls.every((r) => r.p_action === "read"),
    "Abrir confirmação não ativa",
  );
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await layouts("pronto");
  await release().click();
  stale = true;
  await dialog.getByRole("button", { name: "Liberar teste", exact: true }).click();
  await dialog
    .getByText("A situação mudou. Confira a liberação novamente.", { exact: true })
    .waitFor();
  assert.equal(data.paused, true);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  stale = false;
  await refresh();
  await release().click();
  await dialog.getByRole("button", { name: "Liberar teste", exact: true }).click();
  await page.getByText("Teste liberado", { exact: true }).waitFor();
  await layouts("liberado");
  await page.getByRole("button", { name: "Pausar teste", exact: true }).click();
  await page.getByText("Teste pausado", { exact: true }).waitFor();
  assert.equal(data.paused, true);
  assert.equal(data.cycles, false);
  assert.equal(data.assistance, false);
  readFailure = true;
  await refresh();
  await page
    .getByText("Não foi possível conferir ou alterar a liberação. Atualize e tente novamente.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await release().count(), 0);
  readFailure = false;
  await refresh();
  await release().waitFor();
  delayed = true;
  await refresh();
  await page.getByRole("button", { name: "Conferindo…", exact: true }).waitFor();
  await page
    .getByText("Tempo esgotado. Confira sua conexão e tente novamente.", { exact: true })
    .first()
    .waitFor({ timeout: 20000 });
  assert.equal(await release().count(), 0);
  delayed = false;
  await refresh();
  await release().waitFor();
  assert.equal(data.paused, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: leitura não ativa; pré-requisitos/CAS/confirmar/cancelar/pausar; identidade e versões enviadas pelo contrato atômico",
  );
  console.log(
    "PASS: 45 composições, três cantos e cinco larguras; somente API/sessão fictícias, nenhuma liberação produtiva",
  );
} finally {
  await context.close();
  await browser.close();
}
