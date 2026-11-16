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
await context.route("**/*", (r) =>
  new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
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
const out = "/tmp/bc-entrada-servidor-ui";
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
customer.background = {
  enabled: true,
  active: true,
  state: "waiting_customer",
  checked_at: new Date().toISOString(),
};
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
  await root
    .getByText("Continuamos preparando seu atendimento. Você pode voltar ao WhatsApp.", {
      exact: true,
    })
    .waitFor();
  await layouts("01-acompanhamento");
  customer.background.state = "phone_request_unresolved";
  await root
    .getByText("O WhatsApp ainda está identificando seu pedido de entrada.", { exact: true })
    .waitFor();
  await layouts("02-identidade-pendente");
  assert.equal(calls.filter((c) => c.name === "access" || c.name === "auth-otp").length, 0);
  customer.background.state = "active";
  customer.phone_ready = true;
  customer.group.state = "active";
  customer.group.cycle_state = "active";
  await root.getByRole("button", { name: "Receber código no grupo", exact: true }).waitFor();
  await layouts("03-pronto");
  assert.equal(
    calls.filter(
      (c) => c.name === "access" || c.name === "auth-otp" || c.name === "care_group_begin",
    ).length,
    0,
  );
  customer.phone_ready = false;
  customer.access.active = false;
  customer.background.active = false;
  customer.group.state = "waiting_customer";
  customer.group.cycle_state = "waiting_customer";
  customer.phone_revision = {
    contract: "bc-phone-revision-v1",
    enabled: true,
    id: "44444444-4444-4444-8444-444444444444",
    phase: "waiting",
    active: false,
    pending: true,
    expired: true,
    old_phone: customer.phone,
    declared_phone: customer.phone,
    next_check_at: null,
    deadline: new Date(Date.now() - 60000).toISOString(),
  };
  await root.getByRole("button", { name: "Retomar com este número", exact: true }).waitFor();
  await layouts("04-retomada-explicita");
  assert.equal(calls.filter((c) => c.name === "access" || c.name === "auth-otp").length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: leitura automática periódica; navegador não avança etapas ou solicita OTP; pendência real e prontidão distintas",
  );
  console.log("PASS: 60 composições — 4 estados × 3 cantos × 5 larguras, rede externa bloqueada");
} finally {
  await browser.close();
}
