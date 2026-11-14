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
const numbers = ["a", "b", "c"].map((id, i) => ({
  id,
  label: id,
  display_phone: `+5511800000${i + 1}11`,
  instance_name: `bc-${id}`,
  status: "open",
  routing_version: 1,
  barbershop_id: null,
  enabled: false,
  delivery_mode: "primary",
}));
const state = { policy: { enabled: false, version: 1 }, eligible: 3, waiting: [], reviews: [] };
const directory = {
  server_distribution: true,
  distribution: state,
  destination_routing: true,
  second_reserve: true,
  number_sharing: true,
  channels: numbers,
  shops: [{ id: "arena", name: "Arena teste" }],
  staff: [],
  links: [],
  history: [],
  number_activity: {},
};
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const calls = [];
let applyFails = true;
let planId;
await context.route("**/rest/v1/rpc/*", async (r) => {
  const name = new URL(r.request().url()).pathname.split("/").at(-1);
  const args = r.request().method() === "POST" ? r.request().postDataJSON() : {};
  calls.push({ name, args });
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  let data = null;
  if (name === "platform_whatsapp_directory") data = directory;
  if (name === "whatsapp_send_dashboard")
    data = { controls: [], accepted_24h: 0, unknown_24h: 0, in_flight: 0, pending: 0 };
  if (name === "platform_plan_whatsapp_distribution") {
    planId = args.p_request_id;
    data = {
      id: planId,
      assignments: [{ shop: "arena", primary: "a", backup: "b", backup2: "c" }],
      blocked: [],
      expires_at: new Date(Date.now() + 600000).toISOString(),
      applied_at: null,
    };
  }
  if (name === "platform_apply_whatsapp_distribution") {
    assert.equal(args.p_plan, planId);
    if (applyFails) {
      applyFails = false;
      return r.fulfill({
        status: 503,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ message: "Falha simulada depois do pedido" }),
      });
    }
    directory.links = [
      {
        id: "rota",
        barbershop_id: "arena",
        staff_id: null,
        channel_id: "a",
        backup_channel_id: "b",
        backup2_channel_id: "c",
        delivery_mode: "primary",
        enabled: false,
        version: 1,
        return_notice_enabled: false,
      },
    ];
    data = { applied: [{ shop: "arena", link_id: "rota", version: 1 }] };
  }
  if (name === "platform_set_whatsapp_automatic") {
    assert.equal(args.p_enabled, true);
    state.policy = { enabled: true, version: 2 };
    data = state.policy;
  }
  if (name === "platform_confirm_whatsapp_control") {
    assert.equal(args.p_isolated, true);
    numbers[0].platform_control_identity = {
      phone: numbers[0].display_phone.replace(/\D/g, ""),
      instance: numbers[0].instance_name,
    };
  }
  return r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:8090/platform?aba=whatsapp", { waitUntil: "networkidle" });
  const ops = page.locator(".wa-operation-header");
  await ops.waitFor();
  assert.equal(
    calls.some((c) => c.name === "platform_plan_whatsapp_distribution"),
    false,
    "abrir página não gera nem aplica plano",
  );
  await ops.getByRole("radio", { name: /Arena teste/ }).click();
  await ops.getByRole("button", { name: "Gerar distribuição", exact: true }).click();
  await ops.getByRole("button", { name: "Aplicar distribuição", exact: true }).click();
  await ops.getByText("Não foi possível confirmar.", { exact: false }).waitFor();
  await ops.getByRole("button", { name: "Aplicar distribuição", exact: true }).click();
  await ops.getByText("Distribuição salva.", { exact: false }).first().waitFor();
  assert.equal(calls.filter((c) => c.name === "platform_apply_whatsapp_distribution").length, 2);
  assert.equal(
    new Set(
      calls
        .filter((c) => c.name === "platform_apply_whatsapp_distribution")
        .map((c) => c.args.p_plan),
    ).size,
    1,
    "perda de resposta conserva chave de aplicação",
  );
  assert.equal(directory.links[0].enabled, false);
  await ops.getByRole("switch", { name: "Atribuição automática" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Ativar atribuição", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.wa-operation-header [role="switch"]')
        .getAttribute("aria-checked") === "true",
  );
  const reads = calls.filter((c) => c.name === "platform_whatsapp_directory").length;
  for (const corner of ["square", "soft", "round"]) {
    await page.locator(".brand-page").evaluateAll(
      (elements, c) =>
        elements.forEach((el) => {
          el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
          el.classList.add("brand-corners-" + c);
        }),
      corner,
    );
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(60);
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${corner}/${width}`,
      );
    }
  }
  assert.equal(
    calls.filter((c) => c.name === "platform_whatsapp_directory").length,
    reads,
    "redimensionar não recarrega seleção/lista",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: faixa operacional, confirmação, plano persistente, recuperação e 21 composições",
  );
} finally {
  await context.close();
  await browser.close();
}
