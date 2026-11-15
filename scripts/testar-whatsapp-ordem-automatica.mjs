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
  const arena = p.locator('[data-target-key="arena:general"]');
  const center = p.locator('[data-target-key="centro:general"]');
  const slot = (target, role) => target.locator(`[data-role="${role}"]`);
  await slot(arena, "primary").locator(".wa-distribution-reorder").dragTo(slot(arena, "backup"));
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-b");
  assert.equal(await slot(arena, "backup").getAttribute("data-number-id"), "numero-a");
  assert.equal(await slot(center, "primary").getAttribute("data-number-id"), "numero-b");
  await arena.getByRole("button", { name: "Salvar distribuição", exact: true }).click();
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-b");
  // Um gesto de ordenação nunca move o vínculo para outra barbearia.
  await slot(arena, "primary").locator(".wa-distribution-reorder").dragTo(slot(center, "backup"));
  assert.equal(await slot(center, "backup").getAttribute("data-number-id"), "numero-a");
  await slot(arena, "backup").locator(".wa-distribution-reorder").click();
  await slot(arena, "backup")
    .getByRole("button", { name: "Mover para Principal", exact: true })
    .click();
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-a");
  await arena.getByRole("button", { name: "Cancelar alterações", exact: true }).click();
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-b");
  await p.getByRole("switch", { name: "Atribuição automática", exact: true }).click();
  const nova = p.locator('[data-target-key="nova:general"]');
  await p.waitForFunction(
    () =>
      document.querySelector('[data-target-key="nova:general"] [data-role="primary"]').dataset
        .numberId !== "",
  );
  assert.ok(await slot(nova, "primary").getAttribute("data-number-id"));
  assert.ok(await slot(nova, "backup").getAttribute("data-number-id"));
  assert.equal(
    await nova.getByRole("switch", { name: "Avisos", exact: true }).getAttribute("aria-checked"),
    "false",
  );
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-b");
  assert.equal(await slot(center, "primary").getAttribute("data-number-id"), "numero-b");
  assert.equal(await slot(arena, "backup2").locator(".wa-distribution-reorder").count(), 1);
  await p.locator('button[data-number-id="numero-c"]').click();
  await slot(arena, "backup2").locator(".wa-distribution-slot-choice").click();
  assert.equal(await slot(arena, "backup2").getAttribute("draggable"), "true");
  assert.equal(
    await slot(arena, "backup2").locator(".wa-distribution-reorder").getAttribute("draggable"),
    "true",
  );
  await slot(arena, "backup2").locator(".wa-distribution-reorder").dragTo(slot(arena, "primary"));
  assert.equal(await slot(arena, "primary").getAttribute("data-number-id"), "numero-c");
  assert.equal(await slot(arena, "backup").getAttribute("data-number-id"), "numero-b");
  assert.equal(await slot(arena, "backup2").getAttribute("data-number-id"), "numero-a");
  await p.evaluate(() => scrollTo(0, 0));
  const boxes = await p
    .locator(".wa-operation-row > *")
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  assert.ok(
    boxes.every((top) => Math.abs(top - boxes[0]) < 2),
    "três blocos na mesma fileira no computador",
  );
  await p.screenshot({ path: "/tmp/bc-wa-order-auto.png", fullPage: false });
  await p.reload({ waitUntil: "networkidle" });
  assert.equal(await slot(nova, "primary").getAttribute("data-number-id"), "");
  assert.equal(
    await p
      .getByRole("switch", { name: "Atribuição automática", exact: true })
      .getAttribute("aria-checked"),
    "false",
  );
  console.log(
    "PASS: reordenar por arraste e botões; salvar e cancelar; isolamento de destino; atribuição automática local com duas contas e avisos pausados; recarga descarta simulação",
  );
} finally {
  await b.close();
}
