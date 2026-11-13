import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
import assert from "node:assert/strict";
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  browser,
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
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const target = (id) => page.locator(`[data-target-key="${id}"]`);
try {
  await page.goto("http://localhost:8090/previsao-whatsapp", { waitUntil: "networkidle" });
  await page.locator(".wa-distribution").waitFor();
  assert.ok(!(await page.locator("body").innerText()).includes("waDistribution."));
  const a = page.locator('button[data-number-id="numero-a"]');
  const b = page.locator('button[data-number-id="numero-b"]');
  assert.ok(
    (await a.innerText()).includes("Principal em 1") &&
      (await a.innerText()).includes("Reserva em 1"),
  );
  assert.ok(
    (await b.innerText()).includes("Principal em 1") &&
      (await b.innerText()).includes("Reserva em 1"),
  );
  // Clique/toque: compartilhar A como principal de outro destino.
  await a.click();
  await target("nova:general")
    .locator('[data-role="primary"] > button.wa-distribution-slot-choice')
    .click();
  assert.equal(
    await target("nova:general").locator('[data-role="primary"]').getAttribute("data-number-id"),
    "numero-a",
  );
  assert.ok((await a.innerText()).includes("Principal em 1"), "rascunho não muda usos persistidos");
  await target("nova:general")
    .getByRole("button", { name: "Salvar distribuição", exact: true })
    .click();
  await page.waitForTimeout(100);
  assert.ok((await a.innerText()).includes("Principal em 2"));
  assert.equal(
    await target("centro:general").locator('[data-role="backup"]').getAttribute("data-number-id"),
    "numero-a",
  );
  // Mesmo telefone nos dois slots do mesmo destino é rejeitado.
  await target("nova:general")
    .locator('[data-role="backup"] > button.wa-distribution-slot-choice')
    .click();
  await target("nova:general").getByRole("alert").waitFor();
  // Cancelar devolve os dados salvos.
  const c = page.locator('button[data-number-id="numero-c"]');
  await c.click();
  await target("nova:general")
    .locator('[data-role="backup"] > button.wa-distribution-slot-choice')
    .click();
  await target("nova:general")
    .getByRole("button", { name: "Cancelar alterações", exact: true })
    .click();
  assert.equal(
    await target("nova:general").locator('[data-role="backup"]').getAttribute("data-number-id"),
    "",
  );
  // Arraste e salvamento explícito em destino profissional.
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.setData("application/x-bc-whatsapp-number", "numero-c");
    return d;
  });
  await target("arena:rafael")
    .locator('[data-role="primary"]')
    .dispatchEvent("drop", { dataTransfer: dt });
  await target("arena:rafael")
    .getByRole("button", { name: "Salvar distribuição", exact: true })
    .click();
  assert.equal(
    await target("arena:general").locator('[data-role="primary"]').getAttribute("data-number-id"),
    "numero-a",
  );
  assert.equal(
    await target("arena:bruno").locator('[data-role="primary"]').getAttribute("data-number-id"),
    "numero-a",
  );
  // Remover o próprio exige revisão e recupera herança do geral.
  await target("arena:rafael")
    .locator('[data-role="primary"]')
    .getByRole("button", { name: "Remover Principal", exact: true })
    .click();
  assert.equal(
    await target("arena:rafael")
      .getByRole("button", { name: "Salvar distribuição", exact: true })
      .isEnabled(),
    false,
  );
  await target("arena:rafael").locator(".wa-distribution-technical input").check();
  await target("arena:rafael")
    .getByRole("button", { name: "Salvar distribuição", exact: true })
    .click();
  assert.equal(
    await target("arena:rafael").locator('[data-role="primary"]').getAttribute("data-number-id"),
    "numero-a",
  );
  // Teclado: seleção por Enter é equivalente ao clique.
  await a.focus();
  await page.keyboard.press("Enter");
  assert.equal(await a.getAttribute("aria-pressed"), "true");
  for (const corner of ["square", "soft", "round"]) {
    await page.locator(".brand-page").evaluate((el, corner) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + corner);
    }, corner);
    for (const width of [320, 390, 440, 768, 956, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 956 ? 440 : 1000 });
      await page.waitForTimeout(80);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${corner} ${width}: sem rolagem horizontal`,
      );
      if (width === 1440 && corner === "soft")
        await page.screenshot({ path: "/tmp/bc-wa-distribution-desktop.png", fullPage: false });
      if (width === 390 && corner === "soft")
        await page.screenshot({ path: "/tmp/bc-wa-distribution-mobile.png", fullPage: false });
    }
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/bc-wa-distribution-preview.png", fullPage: false });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: papéis cruzados; compartilhar sem mover; clique, arraste e teclado; mesmo número rejeitado; cancelar; remoção confirmada e herança; 21 composições e zero erros JS.",
  );
} catch (e) {
  console.log((await page.locator("body").innerText()).slice(0, 500));
  throw e;
} finally {
  await browser.close();
}
