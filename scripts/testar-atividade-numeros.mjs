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
  const a = p.locator('button[data-number-id="numero-a"]'),
    bb = p.locator('button[data-number-id="numero-b"]'),
    c = p.locator('button[data-number-id="numero-c"]');
  assert.equal(await a.locator("[data-activity]").getAttribute("data-activity"), "established");
  assert.equal(await bb.locator("[data-activity]").getAttribute("data-activity"), "regular");
  assert.equal(await c.locator("[data-activity]").getAttribute("data-activity"), "unknown");
  assert.ok((await a.innerText()).includes("Exemplo fictício"));
  await a.click();
  assert.equal(
    await a.evaluate((e) => getComputedStyle(e).boxShadow),
    "none",
    "sem sombra colorida unilateral",
  );
  await p
    .getByRole("radiogroup", { name: "Selecionar barbearia" })
    .getByRole("radio", { name: /Nova/ })
    .click();
  await p.getByRole("button", { name: "Gerar distribuição", exact: true }).click();
  assert.ok(
    (await p.locator(".wa-auto-proposal article").first().innerText()).includes("5511900000202"),
  );
  await a.scrollIntoViewIfNeeded();
  await p.screenshot({ path: "/tmp/bc-wa-activity-cards.png", fullPage: false });
  console.log(
    "PASS: perfis distintos, ausência de medição explícita, exemplos rotulados, critério de atividade na proposta e cartão selecionado sem quina unilateral",
  );
} finally {
  await b.close();
}
