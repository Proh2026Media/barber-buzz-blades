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
const shop = "11111111-1111-4111-8111-111111111111",
  group = "44444444-4444-4444-8444-444444444444",
  revisionId = "55555555-5555-4555-8555-555555555555";
const oldPhone = "+551198888777",
  declared = "+5511998888777";
const calls = [];
const customer = {
  enabled: true,
  phone: oldPhone,
  phone_confirmed: false,
  phone_ready: false,
  enrollment_expired: true,
  participants: [],
  preferences: { monthly_marketing: 0, proactive_paused: false },
  platform_participants: [
    { id: "22222222-2222-4222-8222-222222222222", phone: "+5511800000111" },
    { id: "33333333-3333-4333-8333-333333333333", phone: "+5511800000222" },
  ],
  group: {
    id: group,
    state: "waiting_customer",
    reason: "customer_absent",
    version: 1,
    notifications: false,
    review_invites: false,
    return_on: null,
    cycle_id: "66666666-6666-4666-8666-666666666666",
    cycle_state: "waiting_customer",
    numbers_changed: false,
  },
  access: {
    contract: "bc-assisted-v1",
    enabled: true,
    active: false,
    expires_at: null,
    next_check_at: null,
  },
  phone_revision: {
    contract: "bc-phone-revision-v1",
    enabled: true,
    id: null,
    phase: null,
    active: false,
    pending: false,
    expired: false,
    old_phone: oldPhone,
    declared_phone: null,
    deadline: null,
    next_check_at: null,
  },
};
let stage = "waiting",
  sent = 0;
const reply = (route, data, status = 200) =>
  route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });
await context.route("**/rest/v1/rpc/*", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const name = new URL(r.request().url()).pathname.split("/").at(-1);
  calls.push({ name, args: r.request().postDataJSON() });
  const value =
    name === "care_phone_revision_invite" || name === "care_group_invite"
      ? "https://chat.whatsapp.com/FICTICIO123456789"
      : customer;
  return reply(r, value);
});
await context.route("**/functions/v1/whatsapp-group-access", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const body = r.request().postDataJSON();
  calls.push({ name: "access", args: body });
  assert.equal(body.shop, shop);
  if (body.action === "revise") {
    assert.equal(body.phone, declared);
    assert.equal(body.accept, true);
    assert.equal(body.group, group);
    Object.assign(customer.phone_revision, {
      id: revisionId,
      phase: "waiting",
      active: true,
      pending: true,
      declared_phone: declared,
      deadline: new Date(Date.now() + 1200000).toISOString(),
      next_check_at: new Date(Date.now() - 1000).toISOString(),
    });
    customer.phone = declared;
  } else if (body.action === "abort") {
    assert.equal(body.revision, revisionId);
    Object.assign(customer.phone_revision, {
      phase: "aborted",
      active: false,
      pending: false,
      expired: false,
    });
    customer.phone = oldPhone;
  } else if (body.action === "advance") {
    if (stage === "binding") customer.phone_revision.phase = "binding";
    if (stage === "receipt" || stage === "ready") {
      Object.assign(customer.phone_revision, { phase: "committed", active: false, pending: false });
      customer.enrollment_expired = false;
      Object.assign(customer.access, {
        active: true,
        expires_at: new Date(Date.now() + 1200000).toISOString(),
        next_check_at: new Date(Date.now() - 1000).toISOString(),
      });
      customer.group.reason = stage === "receipt" ? "waiting_first_receipt" : "verified";
      customer.group.state = stage === "receipt" ? "waiting_customer" : "active";
      customer.phone_ready = stage === "ready";
    }
  }
  return reply(r, { state: "phone_" + stage, data: customer });
});
await context.route("**/functions/v1/auth-otp", async (r) => {
  const body = r.request().postDataJSON();
  calls.push({ name: "auth-otp", args: body });
  assert.equal(body.destination, declared);
  if (body.action === "request") sent++;
  if (body.action === "verify") {
    customer.phone_confirmed = true;
    customer.access.active = false;
    customer.phone_revision.enabled = false;
  }
  return reply(r, { ok: true, delivery_state: "accepted" });
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "/tmp/bc-p122-revisao-telefone";
mkdirSync(out, { recursive: true });
let compositions = 0;
async function layouts(label) {
  const root = page.locator("#qa-feedback");
  for (const corner of ["square", "soft", "round"]) {
    await root.evaluate((el, mode) => {
      el.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
      el.classList.add("brand-corners-" + mode);
    }, corner);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await root.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        label + corner + width,
      );
      compositions++;
      if (corner === "soft" && [390, 1440].includes(width))
        await page.screenshot({ path: `${out}/${label}-${width}.png`, fullPage: true });
    }
  }
}
async function mount() {
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
}
try {
  await mount();
  const root = page.locator("#qa-feedback");
  await root.getByRole("button", { name: "Corrigir meu número", exact: true }).waitFor();
  assert.equal(calls.filter((c) => c.name === "access").length, 0);
  await layouts("01-revisar-numero");
  await root.getByRole("button", { name: "Corrigir meu número", exact: true }).click();
  await root.getByRole("textbox", { name: "Seu WhatsApp correto", exact: true }).fill(declared);
  await layouts("02-confirmar-candidato");
  const proceed = root.getByRole("button", { name: "Conferir e continuar", exact: true });
  assert.equal(await proceed.isDisabled(), true);
  await root.locator('input[type="checkbox"]').first().check();
  await proceed.click();
  await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).waitFor();
  assert.equal(sent, 0);
  assert.equal(customer.phone_confirmed, false);
  assert.equal(
    await root.getByRole("button", { name: "Receber código no grupo", exact: true }).count(),
    0,
  );
  await layouts("03-mesmo-grupo");
  stage = "binding";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(11000);
  await root.getByText("Concluindo a correção do telefone.", { exact: true }).waitFor();
  assert.equal(await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).count(), 0);
  await layouts("04-conciliacao");
  stage = "receipt";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(11000);
  assert.equal(sent, 0);
  assert.equal(
    await root.getByRole("button", { name: "Receber código no grupo", exact: true }).count(),
    0,
  );
  assert.equal(await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).count(), 0);
  stage = "ready";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const receive = root.getByRole("button", { name: "Receber código no grupo", exact: true });
  await receive.waitFor({ timeout: 18000 });
  await layouts("05-codigo-no-grupo");
  await receive.click();
  assert.equal(sent, 1);
  await root.locator('input[autocomplete="one-time-code"]').fill("654321");
  await root.getByRole("button", { name: "Confirmar código", exact: true }).click();
  await root
    .getByText("Telefone confirmado. O login por WhatsApp também depende de um grupo disponível.", {
      exact: true,
    })
    .waitFor();
  assert.equal(customer.phone, declared);
  assert.equal(customer.group.id, group);
  assert.equal(calls.filter((c) => c.name === "access" && c.args.action === "revise").length, 1);
  assert.equal(calls.filter((c) => c.name === "care_group_begin").length, 0);
  // Expiração/cancelamento não consolidam o perfil nem liberam código.
  customer.phone_confirmed = false;
  customer.phone_ready = false;
  customer.enrollment_expired = true;
  customer.access.active = false;
  Object.assign(customer.phone_revision, {
    enabled: true,
    phase: "waiting",
    pending: true,
    active: false,
    expired: true,
  });
  await mount();
  await root
    .getByText("A revisão expirou. Cancele para informar o número novamente.", { exact: true })
    .waitFor();
  await layouts("06-expirado");
  await root.getByRole("button", { name: "Cancelar revisão", exact: true }).click();
  await root.getByRole("button", { name: "Corrigir meu número", exact: true }).waitFor();
  assert.equal(customer.phone, oldPhone);
  assert.equal(sent, 1);
  customer.enabled = false;
  customer.phone_ready = true;
  Object.assign(customer.phone_revision, {
    enabled: false,
    phase: "waiting",
    pending: true,
    active: false,
    expired: false,
  });
  await mount();
  await root.getByRole("button", { name: "Cancelar revisão", exact: true }).waitFor();
  assert.equal(
    await root.getByRole("button", { name: "Cancelar revisão", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await root.getByRole("button", { name: "Receber código no grupo", exact: true }).count(),
    0,
  );
  assert.equal(await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).count(), 0);
  await layouts("07-pausado");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: revisão explícita do telefone, mesmo grupo, nenhuma confirmação/código antes da prova e acompanhamento automático",
  );
  console.log(
    "PASS: código usa número declarado; expiração/cancelamento/pausa sem troca de perfil, link ou OTP indevido",
  );
  console.log(
    `PASS: ${compositions} composições (3 cantos × 5 larguras × 7 estados), API/sessão fictícias, sem corte horizontal ou erro de execução`,
  );
} finally {
  await browser.close();
}
