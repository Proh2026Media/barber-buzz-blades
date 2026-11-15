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
let readFails = false;
let renewMessage = "GROUP_PARTICIPANTS_CHANGED";
let inviteNumber = 0;
const customer = {
  enabled: false,
  phone: "+5511999999999",
  phone_confirmed: false,
  phone_ready: false,
  enrollment_expired: true,
  participants: [],
  preferences: { monthly_marketing: 0, proactive_paused: false },
  platform_participants: [
    { id: "a", phone: "+5511800000111" },
    { id: "b", phone: "+5511800000222" },
  ],
  group: {
    id: "g1",
    state: "waiting_customer",
    version: 1,
    notifications: true,
    review_invites: false,
    return_on: null,
    cycle_id: "c1",
    cycle_state: "waiting_customer",
    expires_at: "2027-11-14T12:00:00Z",
    numbers_changed: false,
  },
};
await context.route("**/rest/v1/rpc/*", async (r) => {
  if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers });
  const name = new URL(r.request().url()).pathname.split("/").at(-1);
  const args = r.request().postDataJSON();
  calls.push({ name, args });
  if (name === "care_group_begin")
    return r.fulfill({
      status: 400,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        code: "P0001",
        message: renewMessage,
        details: "segredo-ficticio +5511999999999",
        hint: "email@example.invalid",
      }),
    });
  if (name === "care_group_read" && readFails)
    return r.fulfill({
      status: 503,
      headers,
      contentType: "application/json",
      body: JSON.stringify({ code: "PGRST000", message: "Falha fictícia de leitura" }),
    });
  const data =
    name === "care_group_invite"
      ? "https://chat.whatsapp.com/FICTICIO12345678" + ++inviteNumber
      : customer;
  return r.fulfill({
    status: 200,
    headers,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await context.route("**/functions/v1/auth-otp", async (r) => {
  calls.push({ name: "auth-otp" });
  return r.fulfill({ status: 503, headers, contentType: "application/json", body: '{"ok":false}' });
});
await context.addInitScript(() =>
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: async (text) => {
        window.__diagnostico = text;
      },
    },
    configurable: true,
  }),
);
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const out = "/tmp/bc-p122-feedback-interface";
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
      await page.waitForTimeout(35);
      assert.ok(
        await root.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        label + "/" + corner + "/" + width,
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
    createRoot(el).render(React.createElement(CareGroupPanel, { shopId: "loja-ficticia" }));
  });
  const root = page.locator("#qa-feedback");
  const resume = root.getByRole("button", { name: "Retomar confirmação", exact: true });
  const refresh = () =>
    root.getByRole("button", { name: "Atualizar situação", exact: true }).last().click();
  await resume.waitFor();
  await root.getByText("Este atendimento está indisponível no momento.", { exact: true }).waitFor();
  assert.equal(await root.getByText("Aguardando sua entrada", { exact: true }).count(), 0);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await resume.isDisabled(), true);
  await page.waitForTimeout(5500);
  assert.equal(
    calls.filter((x) => ["care_group_begin", "care_group_invite", "auth-otp"].includes(x.name))
      .length,
    0,
  );
  console.log(
    "PASS: pausa informada pela leitura impede renovação, convite e código; sem polling de convite",
  );
  await layouts("pausado");
  customer.enabled = true;
  await refresh();
  await resume.click();
  await root
    .getByText("Os números de envio precisam ser conferidos pela plataforma.", { exact: true })
    .waitFor();
  await root.getByRole("button", { name: "Copiar diagnóstico", exact: true }).click();
  const diagnostic = JSON.parse(await page.evaluate(() => window.__diagnostico));
  assert.equal(diagnostic.operacao, "resume");
  assert.equal(diagnostic.codigo, "GROUP_PARTICIPANTS_CHANGED");
  assert.equal(diagnostic.status_http, 400);
  assert.ok(!/segredo|5511|example/.test(JSON.stringify(diagnostic)));
  assert.equal(calls.find((c) => c.name === "care_group_begin").args.p_phone, customer.phone);
  console.log(
    "PASS: falha capturada da renovação é distinta; diagnóstico sem dados pessoais e telefone não alterado",
  );
  readFails = true;
  await page.waitForTimeout(10600);
  await root
    .getByText("Os números de envio precisam ser conferidos pela plataforma.", { exact: true })
    .waitFor();
  assert.equal(calls.filter((c) => c.name === "care_group_begin").length, 1);
  console.log("PASS: polling com falha não apaga o erro da ação nem repete a renovação");
  readFails = false;
  renewMessage = "GROUP_PHONE_UNAVAILABLE";
  await resume.click();
  await root
    .getByText("O telefone deste atendimento precisa ser revisado.", { exact: true })
    .waitFor();
  await layouts("telefone-em-revisao");
  renewMessage = "Falha sem causa capturada";
  await resume.click();
  await root.getByText("Não foi possível retomar a confirmação.", { exact: true }).waitFor();
  readFails = true;
  await refresh();
  await root.getByText("Não foi possível atualizar o atendimento.", { exact: true }).waitFor();
  await layouts("falha-de-leitura");
  readFails = false;
  await refresh();
  await root
    .getByText("Não foi possível atualizar o atendimento.", { exact: true })
    .waitFor({ state: "hidden" });
  console.log(
    "PASS: falhas desconhecidas respeitam a operação; leitura bem-sucedida remove só seu aviso",
  );
  customer.enrollment_expired = false;
  customer.phone_ready = true;
  customer.enabled = false;
  await refresh();
  assert.equal(
    await root.getByRole("button", { name: "Receber código no grupo", exact: true }).count(),
    0,
  );
  assert.equal(await root.getByRole("link", { name: "Abrir meu grupo", exact: true }).count(), 0);
  assert.equal(calls.filter((x) => x.name === "auth-otp").length, 0);
  customer.phone_ready = false;
  customer.enabled = true;
  await refresh();
  await root.getByRole("button", { name: "Obter convite", exact: true }).click();
  const link = root.getByRole("link", { name: "Abrir meu grupo", exact: true });
  await link.waitFor();
  const old = await link.getAttribute("href");
  customer.enabled = false;
  await root
    .getByRole("button")
    .filter({ has: page.locator("svg.lucide-refresh-cw") })
    .last()
    .click();
  await link.waitFor({ state: "hidden" });
  customer.enabled = true;
  await refresh();
  assert.equal(await link.count(), 0);
  await root.getByRole("button", { name: "Obter convite", exact: true }).click();
  await link.waitFor();
  assert.notEqual(await link.getAttribute("href"), old);
  console.log("PASS: pausa oculta ações mesmo com ready antigo e invalida o convite em memória");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 45 composições (3 cantos × 5 larguras × 3 estados), sem corte ou erro de execução; nenhuma rede externa real",
  );
} finally {
  await context.close();
  await browser.close();
}
