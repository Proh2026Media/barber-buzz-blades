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
  assert.ok(
    await p.locator("main > :first-child").evaluate((e) => e.classList.contains("wa-future-stats")),
  );
  const gen = p.getByRole("button", { name: "Gerar distribuição", exact: true });
  assert.equal(await gen.isEnabled(), false);
  await p
    .getByRole("radiogroup", { name: "Selecionar barbearia" })
    .getByRole("radio", { name: /Arena/ })
    .click();
  await gen.click();
  assert.ok((await p.locator(".wa-auto-warning").innerText()).includes("2"));
  assert.equal(await p.locator(".wa-auto-proposal").getByText("5511900000303").count(), 0);
  await p.getByRole("button", { name: "Aplicar na prévia", exact: true }).click();
  const arena = p.locator('[data-target-key="arena:general"]');
  const sw = arena.getByRole("switch", { name: "Avisos", exact: true });
  assert.equal(await sw.getAttribute("aria-checked"), "false");
  await sw.click();
  assert.equal(await sw.getAttribute("aria-checked"), "true");
  await sw.evaluate((e) => {
    const box = e.getBoundingClientRect(),
      knob = e.firstElementChild.getBoundingClientRect();
    if (Math.abs(knob.top + knob.height / 2 - (box.top + box.height / 2)) > 1)
      throw Error("Círculo desalinhado");
  });
  await sw.press("Space");
  assert.equal(await sw.getAttribute("aria-checked"), "false");
  assert.equal(
    await p
      .locator('[data-target-key="centro:general"] [data-role="primary"]')
      .getAttribute("data-number-id"),
    "numero-b",
  );
  for (const width of [320, 390, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await p.reload({ waitUntil: "networkidle" });
  await p.screenshot({ path: "/tmp/bc-wa-auto-preview.png", fullPage: false });
  console.log(
    "PASS: estatísticas primeiro; escolha obrigatória; gerar/revisar/aplicar local; inelegíveis fora; outro destino preservado; switch centrado e teclado; 5 larguras",
  );
} finally {
  await b.close();
}
