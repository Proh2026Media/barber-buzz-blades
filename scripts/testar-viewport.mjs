import { abrirContexto, acharPlaywright, acharNavegador, lerOpcoes } from "./foto.mjs";
import assert from "node:assert/strict";
const { mod: pw } = await acharPlaywright();
const browser = await pw.chromium.launch({ executablePath: acharNavegador(), headless: true });
const results = [];
// Servidor local obrigatório; Supabase e WebSocket são simulados por foto.mjs.
// As áreas seguras e o teclado são sintéticos: não substituem um ensaio no iPhone.

try {
  for (const route of ["/auth", "/", "/demo?view=customer", "/demo?view=owner", "/platform"]) {
    const { context } = await abrirContexto(
      browser,
      lerOpcoes([
        route,
        "--base",
        "http://localhost:8090",
        "--largura",
        "440",
        "--altura",
        "956",
        ...(route === "/auth" || route === "/" ? ["--sem-login"] : []),
      ]),
    );
    await context.addInitScript(() => {
      const v = new EventTarget();
      let height = null,
        top = 0,
        scale = 1;
      Object.defineProperties(v, {
        height: { get: () => height ?? innerHeight },
        offsetTop: { get: () => top },
        scale: { get: () => scale },
        width: { get: () => innerWidth },
      });
      Object.defineProperty(window, "visualViewport", { value: v });
      window.testViewport = (h, t = 0, s = 1) => {
        height = h;
        top = t;
        scale = s;
        v.dispatchEvent(new Event("resize"));
      };
    });
    await context.route("**/functions/v1/whatsapp-health", (r) =>
      r.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          checked_at: new Date().toISOString(),
          provider_available: true,
          global_paused: false,
          numbers: [],
        }),
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:8090" + route, { waitUntil: "networkidle", timeout: 60000 });
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [440, 956],
      [956, 440],
      [768, 1024],
      [1024, 768],
      [1440, 1000],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        ({ width }) => {
          const s = document.documentElement.style;
          s.setProperty("--app-safe-top", width < 768 ? "59px" : "0px");
          s.setProperty("--app-safe-bottom", width < 1280 ? "34px" : "0px");
          s.setProperty("--app-safe-left", width === 956 ? "59px" : "0px");
          s.setProperty("--app-safe-right", "0px");
        },
        { width },
      );
      await page.waitForTimeout(450);
      const metric = await page.evaluate(() => {
        const frame = document.querySelector(".arena-workspace"),
          main = frame?.querySelector(":scope > main"),
          nav = frame?.querySelector(":scope > .app-mobile-nav");
        const box = nav?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          nav: box
            ? {
                top: box.top,
                bottom: box.bottom,
                height: box.height,
                display: getComputedStyle(nav).display,
                position: getComputedStyle(nav).position,
              }
            : null,
          padding: main ? parseFloat(getComputedStyle(main).paddingBottom) : null,
          height: frame?.getBoundingClientRect().height,
        };
      });
      assert.equal(metric.overflow, false, `${route} ${width}: rolagem horizontal`);
      if (metric.nav?.display !== "none" && metric.nav?.position === "fixed" && width < 768) {
        assert.ok(metric.nav.bottom <= height, `${route} menu cortado`);
        assert.ok(
          metric.padding >= metric.nav.height + height - metric.nav.bottom,
          `${route} fim do conteúdo encoberto ${JSON.stringify(metric)}`,
        );
      }
      results.push({ route, width, height, ...metric });
    }
    if (route === "/platform") {
      await page.setViewportSize({ width: 440, height: 956 });
      await page
        .getByRole("button", {
          name: /Saúde do WhatsApp|Não foi possível atualizar|Conferindo os números/,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      for (const [w, h, top, left] of [
        [440, 956, 59, 0],
        [956, 440, 0, 59],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(
          ({ top, left }) => {
            document.documentElement.style.setProperty("--app-safe-bottom", "34px");
            document.documentElement.style.setProperty("--app-safe-top", top + "px");
            document.documentElement.style.setProperty("--app-safe-left", left + "px");
          },
          { top, left },
        );
        await page.waitForTimeout(450);
        const b = await page.getByRole("dialog").boundingBox();
        assert.ok(
          b.y >= top - 1 && b.y + b.height <= h - 34 + 1,
          `janela cortada ${JSON.stringify(b)}`,
        );
        assert.ok(
          b.x >= left - 1 && b.x + b.width <= w,
          `janela recorte lateral ${JSON.stringify(b)}`,
        );
      }
      await page.keyboard.press("Escape");
    }
    if (route === "/demo?view=customer" || route === "/auth") {
      await page.setViewportSize({ width: 440, height: 956 });
      await page.evaluate(() => {
        const s = document.documentElement.style;
        s.setProperty("--app-safe-bottom", "34px");
        s.setProperty("--app-safe-top", "59px");
        s.setProperty("--app-safe-left", "0px");
      });
      await page.screenshot({
        path: route === "/auth" ? "/tmp/bc-iphone-auth.png" : "/tmp/bc-iphone-cliente.png",
      });
    }
    if (route === "/demo?view=customer") {
      for (const corner of ["square", "soft", "round"]) {
        await page.evaluate((corner) => {
          const f = document.querySelector(".arena-workspace");
          f.classList.remove("brand-corners-square", "brand-corners-soft", "brand-corners-round");
          f.classList.add("brand-corners-" + corner);
        }, corner);
        const logo = await page.locator(".brand-header-logo-wrap").boundingBox();
        const name = await page.locator(".brand-header-title").boundingBox();
        assert.ok(logo.x + logo.width <= name.x + 1, `Logo cobre nome no modo ${corner}`);
      }
      await page.evaluate(() => {
        const m = document.querySelector(".arena-workspace > main");
        const e = document.createElement("div");
        e.id = "scroll-probe";
        e.textContent = "Fim do conteúdo";
        m.append(e);
        m.scrollTop = m.scrollHeight;
      });
      const end = await page.locator("#scroll-probe").boundingBox();
      const nav = await page.locator(".app-mobile-nav").boundingBox();
      assert.ok(end.y + end.height <= nav.y, "Último conteúdo precisa ficar acima do menu");
      await page.evaluate(() => document.querySelector("#scroll-probe").remove());
      // Campo sentinela dentro do contêiner real: exercita a contração, rolagem e recuperação do shell.
      await page.evaluate(() => {
        const main = document.querySelector(".arena-workspace > main");
        const input = document.createElement("input");
        input.id = "keyboard-probe";
        input.type = "text";
        main.append(input);
        input.focus();
        window.testViewport(430);
      });
      await page.waitForTimeout(200);
      assert.equal(await page.locator("html").getAttribute("data-keyboard-open"), "true");
      assert.equal(await page.locator(".app-mobile-nav").isVisible(), false);
      assert.ok((await page.locator(".arena-workspace").boundingBox()).height <= 431);
      await page.evaluate(() => window.testViewport(430, 0, 2));
      await page.waitForTimeout(100);
      assert.equal(
        await page.locator("html").getAttribute("data-keyboard-open"),
        null,
        "zoom não deve ser confundido com teclado",
      );
      await page.evaluate(() => {
        document.querySelector("#keyboard-probe").remove();
        window.testViewport(null);
      });
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".app-mobile-nav").isVisible(), true);
    }
    assert.deepEqual(errors, [], `${route}: erros JS`);
    await context.close();
  }
  console.log(JSON.stringify({ ok: true, cenarios: results.length, results }, null, 2));
} finally {
  await browser.close();
}
