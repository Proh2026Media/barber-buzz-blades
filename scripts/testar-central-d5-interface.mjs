/** Componentes reais, API/sessão fictícias e rede externa bloqueada por foto.mjs. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  browser,
  lerOpcoes([
    "/previsao-whatsapp",
    "--base",
    "http://localhost:8090",
    "--largura",
    "1440",
    "--altura",
    "1000",
  ]),
);
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const calls = [];
let inviteReady = false,
  failReview = true;
const customer = {
  enabled: true,
  phone: "+5511999999999",
  phone_confirmed: false,
  phone_ready: true,
  enrollment_expired: false,
  participants: [],
  preferences: { monthly_marketing: 1, proactive_paused: false },
  platform_participants: [
    { id: "a", phone: "+5511800000111" },
    { id: "b", phone: "+5511800000222" },
  ],
  group: {
    id: "g1",
    state: "active",
    version: 1,
    notifications: true,
    review_invites: false,
    return_on: null,
    cycle_id: "c1",
    cycle_state: "active",
    expires_at: "2027-11-14T12:00:00Z",
    numbers_changed: false,
  },
};
const admin = {
  cycle_contract: "bc-groups-v3",
  enabled: false,
  policy_version: 1,
  capabilities_ready: true,
  registry_pending: 0,
  cleanup_orphans: 1,
  accounts: [],
  groups: [
    {
      id: "g1",
      shop_name: "Barbearia da Praça • Ensaio fictício",
      customer_name: "Cliente de demonstração",
      state: "active",
      ready: true,
      version: 1,
      cycle_id: "c1",
      cycle_state: "active",
      expires_at: "2027-11-14T12:00:00Z",
      reason: "active",
      cleanup_pending: true,
      legacy: false,
      approved_count: 3,
      observed_count: 4,
      numbers_changed: false,
    },
    {
      id: "g2",
      shop_name: "Outra loja de teste",
      customer_name: "Cliente do grupo anterior",
      state: "active",
      ready: false,
      version: 1,
      cycle_id: null,
      cycle_state: null,
      expires_at: null,
      reason: "legacy",
      cleanup_pending: null,
      legacy: true,
      approved_count: 1,
      observed_count: 2,
      numbers_changed: true,
    },
  ],
};
await context.route("**/rest/v1/rpc/*", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const name = new URL(r.request().url()).pathname.split("/").at(-1);
  const args = r.request().postDataJSON();
  calls.push({ name, args });
  let data = null;
  if (name === "care_group_read") data = customer;
  if (name === "care_group_invite")
    data = inviteReady ? "https://chat.whatsapp.com/FICTICIO123456789" : null;
  if (name === "care_group_customer_update") {
    assert.equal(args.p_group, "g1");
    if (args.p_action === "preferences") {
      customer.group = { ...customer.group, ...args.p_values, version: customer.group.version + 1 };
      customer.preferences = {
        monthly_marketing: args.p_values.monthly_marketing,
        proactive_paused: args.p_values.proactive_paused,
      };
    }
    data = customer;
  }
  if (name === "care_group_admin") {
    if (args.p_action === "enrollment") {
      assert.equal(args.p_values.version, admin.policy_version);
      assert.equal(args.p_values.confirmed, true);
      admin.enabled = args.p_values.enabled;
      admin.policy_version++;
    }
    if (args.p_action === "review" && failReview) {
      failReview = false;
      return r.fulfill({
        status: 503,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ message: "Falha fictícia" }),
      });
    }
    if (args.p_action === "close_legacy") {
      assert.equal(args.p_values.confirmed, true);
      admin.groups[1] = {
        ...admin.groups[1],
        legacy: false,
        cycle_id: "c2",
        cycle_state: "closing",
      };
    }
    data = admin;
  }
  return r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await context.route("**/functions/v1/auth-otp", async (r) => {
  const args = r.request().postDataJSON();
  calls.push({ name: "auth-otp", args });
  return r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, delivery_state: "accepted" }),
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "/tmp/bc-d5-interface";
mkdirSync(out, { recursive: true });
async function mount(component) {
  await page.goto("http://localhost:8090/previsao-whatsapp", { waitUntil: "networkidle" });
  await page.evaluate(async (which) => {
    const reactModule = await import("/node_modules/.vite/deps/react.js");
    const React = reactModule.default ?? reactModule;
    const dom = await import("/node_modules/.vite/deps/react-dom_client.js");
    const createRoot = dom.createRoot ?? dom.default.createRoot;
    document.querySelectorAll(".brand-page").forEach((el) => (el.style.display = "none"));
    const el = document.createElement("main");
    el.className = "brand-page brand-corners-soft min-h-dvh bg-background p-4 text-foreground";
    el.id = "qa-grupos";
    document.body.append(el);
    const module = await import(
      which === "admin"
        ? "/src/features/platform/CareGroupsAdmin.tsx"
        : "/src/features/whatsapp/CareGroupPanel.tsx"
    );
    const C = which === "admin" ? module.CareGroupsAdmin : module.CareGroupPanel;
    createRoot(el).render(
      React.createElement(
        C,
        which === "admin" ? { shops: [], numbers: [] } : { shopId: "loja-ficticia" },
      ),
    );
  }, component);
}
async function layouts(prefix) {
  const root = page.locator("#qa-grupos");
  for (const corner of ["square", "soft", "round"]) {
    await root.evaluate((el, c) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + c);
    }, corner);
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(40);
      assert.ok(
        await root.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${prefix}/${corner}/${width}`,
      );
      if (corner === "soft" && [390, 1440].includes(width))
        await page.screenshot({ path: `${out}/${prefix}-${width}.png`, fullPage: true });
    }
  }
}
try {
  await mount("admin");
  const root = page.locator("#qa-grupos");
  await root.getByText("Cliente de demonstração", { exact: true }).waitFor();
  const enrollment = root.getByRole("button").filter({ has: page.locator("svg.lucide-power") });
  await enrollment.click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Ativar grupos e códigos", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  assert.equal(admin.enabled, true);
  await root.getByRole("button", { name: "Solicitar conferência", exact: true }).first().click();
  await root
    .getByText("Não foi possível conferir ou salvar. Atualize e tente novamente.", { exact: true })
    .waitFor();
  await root.getByRole("button", { name: "Encerrar grupo anterior", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Encerrar grupo anterior", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await root.getByText("Encerrando o grupo", { exact: true }).waitFor();
  await layouts("administracao");
  await mount("customer");
  const c = page.locator("#qa-grupos");
  await c.getByRole("button", { name: "Receber código no grupo", exact: true }).waitFor();
  await c.getByRole("button", { name: "Receber código no grupo", exact: true }).click();
  const code = c.locator('input[inputmode="numeric"]').first();
  await code.fill("123456");
  const prefs = c.locator("summary").filter({ hasText: "Preferências" });
  await prefs.click();
  await c.locator("select").selectOption("3");
  const readCount = calls.filter((x) => x.name === "care_group_read").length;
  customer.group.version++;
  await page.waitForTimeout(10500);
  assert.ok(
    calls.filter((x) => x.name === "care_group_read").length > readCount,
    "há atualização em segundo plano",
  );
  assert.equal(await code.inputValue(), "123456", "atualização não desmonta o código digitado");
  assert.equal(
    await c.locator("select").inputValue(),
    "3",
    "atualização não apaga preferências em edição",
  );
  await c.getByRole("button", { name: "Salvar preferências", exact: true }).click();
  assert.equal(customer.preferences.monthly_marketing, 3);
  await layouts("cliente");
  customer.group.state = "waiting_customer";
  customer.phone_ready = false;
  await c.getByRole("button", { name: "Atualizar situação", exact: true }).click();
  await c.getByRole("button", { name: "Obter convite", exact: true }).click();
  await c.getByText("Preparando seu convite. Ele aparecerá aqui.", { exact: true }).waitFor();
  inviteReady = true;
  await c.getByRole("link", { name: "Abrir meu grupo", exact: true }).waitFor({ timeout: 8000 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: administração/cliente, confirmação, falha recuperável, encerramento legado, OTP e rascunho preservados, convite pendente e 42 composições",
  );
} finally {
  await context.close();
  await browser.close();
}
