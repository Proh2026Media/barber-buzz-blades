import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
import assert from "node:assert/strict";
const { mod: pw } = await acharPlaywright();
const b = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  b,
  lerOpcoes([
    "/previsao-whatsapp",
    "--base",
    "http://localhost:8090",
    "--sem-login",
    "--largura",
    "1440",
    "--altura",
    "1000",
  ]),
);
try {
  const p = await context.newPage();
  await p.goto("http://localhost:8090/previsao-whatsapp", { waitUntil: "networkidle" });
  const order = await p
    .locator('[data-target-key="arena:general"] .wa-distribution-controls')
    .evaluate((e) => [...e.children].map((c) => c.className));
  assert.equal(order[0], "wa-distribution-mode");
  assert.equal(order[1], "wa-distribution-toggle");
  const row = p.locator('[data-target-key="arena:rafael"] .wa-distribution-destination-title');
  assert.equal(
    await row.evaluate((e) => e.lastElementChild.className),
    "wa-distribution-customize",
  );
  assert.ok(
    (await row.innerText()).indexOf("Avisos ligados") <
      (await row.innerText()).indexOf("Usa números"),
  );
  const radio = p
    .getByRole("radiogroup", { name: "Selecionar barbearia" })
    .getByRole("radio", { name: /Arena/ });
  await radio.click();
  const indicator = radio.locator(".wa-shop-selection");
  assert.equal(await indicator.getAttribute("data-selected"), "true");
  assert.notEqual(
    await indicator
      .locator(".wa-shop-selection-fill")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
    "0s",
  );
  const archived = p.locator('button[data-number-id="numero-historico"]');
  assert.equal(await archived.isEnabled(), false);
  assert.equal(await archived.getAttribute("draggable"), "false");
  assert.ok((await archived.innerText()).includes("Preservado no histórico"));
  await p.getByRole("button", { name: "Gerar distribuição", exact: true }).click();
  assert.ok(!(await p.locator(".wa-auto-proposal").innerText()).includes("5511900000404"));
  await archived.scrollIntoViewIfNeeded();
  await p.screenshot({ path: "/tmp/bc-wa-history-preview.png", fullPage: false });
  console.log(
    "PASS: ordem dos controles e pílulas; Personalizar por último; transição persistente; histórico visível e não selecionável; restrito excluído da proposta",
  );
} finally {
  await b.close();
}
