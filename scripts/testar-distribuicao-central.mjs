import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
import assert from "node:assert/strict";
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  browser,
  lerOpcoes([
    "/platform?aba=whatsapp",
    "--base",
    "http://localhost:8090",
    "--largura",
    "1440",
    "--altura",
    "1000",
  ]),
);
const channel = (id, phone) => ({
  id,
  label: id,
  display_phone: phone,
  status: "open",
  instance_name: id,
  barbershop_id: null,
  staff_id: null,
  backup_instance_name: null,
  delivery_mode: "primary",
  routing_version: 1,
  return_notice_enabled: false,
  enabled: false,
});
const link = (id, shop, primary, backup) => ({
  id,
  barbershop_id: shop,
  staff_id: null,
  channel_id: primary,
  backup_channel_id: backup,
  delivery_mode: "primary",
  enabled: false,
  version: 1,
  return_notice_enabled: false,
});
const directory = {
  destination_routing: true,
  number_sharing: true,
  channels: [
    channel("numero-a", "5511900000101"),
    channel("numero-b", "5511900000202"),
    channel("duplicado-a", "+5511900000101"),
  ],
  shops: [
    { id: "arena", name: "Arena" },
    { id: "centro", name: "Centro" },
    { id: "nova", name: "Nova" },
  ],
  staff: [],
  links: [
    link("rota-a", "arena", "numero-a", "numero-b"),
    link("rota-b", "centro", "numero-b", "numero-a"),
  ],
  history: [],
};
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
await context.route("**/rest/v1/rpc/platform_whatsapp_directory", (r) =>
  r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify(directory),
  }),
);
let attempted = null;
await context.route("**/rest/v1/rpc/platform_set_whatsapp_route", (r) => {
  attempted = r.request().postDataJSON();
  return r.fulfill({
    status: 400,
    headers,
    contentType: "application/json",
    body: JSON.stringify({ message: "WA_STALE", code: "40001", details: null, hint: null }),
  });
});
await context.route("**/rest/v1/rpc/whatsapp_send_dashboard", (r) =>
  r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify({
      controls: [],
      accepted_24h: 0,
      unknown_24h: 0,
      in_flight: 0,
      pending: 0,
    }),
  }),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:8090/platform?aba=whatsapp", { waitUntil: "networkidle" });
  await page.locator(".wa-distribution").waitFor();
  await page.locator('button[data-number-id="numero-a"]').click();
  const target = page.locator('[data-target-key="nova:general"]');
  await target.locator('[data-role="primary"] .wa-distribution-slot-choice').click();
  await target.getByRole("button", { name: "Salvar distribuição", exact: true }).click();
  await target.getByRole("alert").waitFor();
  assert.equal(attempted.p_primary_id, "numero-a");
  assert.equal(attempted.p_version, 0);
  assert.equal(attempted.p_enabled, false);
  assert.equal(
    await target.locator('[data-role="primary"]').getAttribute("data-number-id"),
    "numero-a",
    "falha conserva rascunho",
  );
  assert.equal(
    await page
      .locator('[data-target-key="centro:general"] [data-role="backup"]')
      .getAttribute("data-number-id"),
    "numero-a",
  );
  await page.locator('button[data-number-id="duplicado-a"]').click();
  await target.locator('[data-role="backup"] .wa-distribution-slot-choice').click();
  assert.ok(
    (await target.getByRole("alert").innerText()).includes("números diferentes"),
    "IDs distintos do mesmo telefone também são rejeitados",
  );
  await target.getByRole("button", { name: "Cancelar alterações", exact: true }).click();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page
    .getByRole("group", { name: "Organização do WhatsApp" })
    .getByRole("button", { name: /^Números/ })
    .click();
  await page
    .getByRole("button", { name: /5511900000101/ })
    .first()
    .click();
  assert.ok((await page.locator("body").innerText()).includes("Principal em 1"));
  assert.ok((await page.locator("body").innerText()).includes("Reserva em 1"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Central real usa contrato novo; RPC CAS correta e sem habilitar envio; erro mantém rascunho; papéis independentes na lista; 5 larguras. Supabase simulado.",
  );
} catch (e) {
  console.log((await page.locator("body").innerText()).slice(0, 700));
  throw e;
} finally {
  await browser.close();
}
