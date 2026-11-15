/** Navegador local, API/sessão fictícias e rede externa bloqueada. Nenhum WhatsApp real. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
const base = process.argv[2] ?? "http://127.0.0.1:8091";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):8091$/);
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const { context } = await abrirContexto(
  browser,
  lerOpcoes(["/previsao-whatsapp", "--base", base, "--largura", "1440", "--altura", "1000"]),
);
const fontDir = new URL("../node_modules/@fontsource-variable/inter/files/", import.meta.url);
const fonts = new Set(readdirSync(fontDir));
await context.route(base + "/qa-inter.css", (route) =>
  route.fulfill({ contentType: "text/css", body: readFileSync(new URL("../index.css", fontDir)) }),
);
await context.route("**/*inter-*-wght-normal.woff2", async (route) => {
  const name = new URL(route.request().url()).pathname.split("/").at(-1);
  assert.ok(fonts.has(name));
  return route.fulfill({ contentType: "font/woff2", body: readFileSync(new URL(name, fontDir)) });
});
await context.route("**/qa-p122-feedback", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>',
  }),
);

const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
const calls = [];
const shop = "11111111-1111-4111-8111-111111111111";
const customer = {
  enabled: true,
  phone: "+5511999999999",
  phone_confirmed: false,
  phone_ready: false,
  enrollment_expired: false,
  participants: [],
  preferences: { monthly_marketing: 0, proactive_paused: false },
  platform_participants: [
    { id: "22222222-2222-4222-8222-222222222222", phone: "+5511800000111" },
    { id: "33333333-3333-4333-8333-333333333333", phone: "+5511800000222" },
  ],
  group: null,
  access: {
    contract: "bc-assisted-v1",
    enabled: true,
    active: false,
    expires_at: null,
    next_check_at: null,
  },
};
let stage = "waiting_customer",
  sent = 0;
const fulfill = (r, data, status = 200) =>
  r.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
await context.route("**/rest/v1/rpc/*", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const name = new URL(r.request().url()).pathname.split("/").at(-1);
  calls.push({ name, args: r.request().postDataJSON() });
  if (name === "care_group_begin")
    throw Error("Não usar caminho legado quando contrato assistido estiver liberado");
  return fulfill(
    r,
    name === "care_group_invite" ? "https://chat.whatsapp.com/FICTICIO123456789" : customer,
  );
});
await context.route("**/functions/v1/whatsapp-group-access", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const body = r.request().postDataJSON();
  calls.push({ name: "access", args: body });
  assert.equal(body.shop, shop);
  assert.equal(body.cycle_id, undefined);
  assert.equal(body.instance, undefined);
  if (body.action === "start") {
    assert.equal(body.accept, true);
    assert.equal(body.phone, customer.phone);
    customer.group = {
      id: "grupo-ficticio",
      state: "waiting_customer",
      version: 1,
      notifications: false,
      review_invites: false,
      return_on: null,
      cycle_id: "ciclo-ficticio",
      cycle_state: "waiting_customer",
      numbers_changed: false,
    };
    customer.access.active = true;
    customer.access.expires_at = new Date(Date.now() + 20 * 60000).toISOString();
  }
  if (body.action === "advance") {
    customer.group.state = stage === "active" ? "active" : "waiting_customer";
    customer.group.reason = stage === "waiting_first_receipt" ? stage : "customer_absent";
    customer.group.cycle_state = stage;
    customer.phone_ready = stage === "active";
  }
  customer.access.next_check_at = new Date(Date.now() + 10000).toISOString();
  return fulfill(r, { state: stage, data: customer });
});
await context.route("**/functions/v1/auth-otp", async (r) => {
  const body = r.request().postDataJSON();
  calls.push({ name: "auth-otp", args: body });
  if (body.action === "request") sent++;
  if (body.action === "verify") {
    customer.phone_confirmed = true;
    customer.access.active = false;
  }
  return fulfill(r, { ok: true, delivery_state: "accepted" });
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "/tmp/bc-p122-primeiro-acesso";
mkdirSync(out, { recursive: true });
async function layouts(label) {
  const root = page.locator("#qa-feedback");
  for (const corner of ["square", "soft", "round"]) {
    await root.evaluate((el, mode) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + mode);
    }, corner);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(40);
      assert.ok(
        await root.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        label + corner + width,
      );
      if (corner === "soft" && [390, 1440].includes(width))
        await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
    }
  }
}
try {
  await page.goto(base + "/qa-p122-feedback", { waitUntil: "networkidle" });
  await page.addStyleTag({ url: base + "/qa-inter.css" });
  await page.evaluate(async () => {
    const { injectIntoGlobalHook } = await import("/@react-refresh");
    injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    await import("/src/styles.css");
    const reactModule = await import("/node_modules/.vite/deps/react.js");
    const React = reactModule.default ?? reactModule;
    const dom = await import("/node_modules/.vite/deps/react-dom_client.js");
    const createRoot = dom.createRoot ?? dom.default.createRoot;
    document.querySelectorAll(".brand-page").forEach((el) => (el.style.display = "none"));
    const el = document.createElement("main");
    el.id = "qa-feedback";
    el.className = "brand-page brand-corners-soft min-h-dvh bg-background p-4 text-foreground";
    document.body.append(el);
    const { CareGroupPanel } = await import("/src/features/whatsapp/CareGroupPanel.tsx");
    createRoot(el).render(
      React.createElement(CareGroupPanel, { shopId: "11111111-1111-4111-8111-111111111111" }),
    );
  });

  const root = page.locator("#qa-feedback");
  await root.getByRole("button", { name: "Criar meu grupo de atendimento", exact: true }).waitFor();
  assert.equal(calls.filter((c) => c.name === "access").length, 0);
  await layouts("01-telefone-consentimento");
  const create = root.getByRole("button", { name: "Criar meu grupo de atendimento", exact: true });
  assert.equal(await create.isDisabled(), true);
  await root.locator('input[type="checkbox"]').first().check();
  await create.click();
  await root.getByText(/Conferência automática ao voltar do WhatsApp/).waitFor();
  await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).waitFor();
  assert.equal(calls.filter((c) => c.name === "auth-otp").length, 0);
  assert.equal(
    await root.getByRole("button", { name: "Já entrei · conferir", exact: true }).count(),
    0,
  );
  await layouts("02-entrar-no-grupo");
  stage = "waiting_first_receipt";
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(11000);
  assert.equal(calls.filter((c) => c.name === "auth-otp").length, 0);
  assert.equal(
    await root.getByRole("button", { name: "Receber código no grupo", exact: true }).count(),
    0,
  );
  stage = "active";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const receive = root.getByRole("button", { name: "Receber código no grupo", exact: true });
  await receive.waitFor({ timeout: 18000 });
  await layouts("03-confirmar-telefone");
  assert.equal(sent, 0);
  await receive.click();
  assert.equal(sent, 1);
  await root.locator('input[autocomplete="one-time-code"]').fill("654321");
  await root.getByRole("button", { name: "Confirmar código", exact: true }).click();
  await root
    .getByText("Telefone confirmado. O login por WhatsApp também depende de um grupo disponível.", {
      exact: true,
    })
    .waitFor();
  const before = calls.filter((c) => c.name === "access").length;
  await page.waitForTimeout(11000);
  assert.equal(calls.filter((c) => c.name === "access").length, before);
  assert.equal(calls.filter((c) => c.name === "access" && c.args.action === "start").length, 1);
  assert.equal(calls.filter((c) => c.name === "auth-otp" && c.args.action === "request").length, 1);
  assert.equal(calls.filter((c) => c.name === "care_group_begin").length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: primeiro acesso em 3 etapas, aceite explícito, convite automático, retorno/foco acompanha entrada e espera prova antes do código",
  );
  console.log(
    "PASS: um pedido de código explícito, sem OTP automático, sem nova criação e acompanhamento encerrado após confirmação",
  );
  console.log(
    "PASS: 45 composições, 3 cantos × 5 larguras × 3 etapas; sem corte ou erro de execução, API/sessão fictícias",
  );
} finally {
  await browser.close();
}
