import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../../public/push-events.js", import.meta.url), "utf8");
function fixture() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: [string, { body: string; tag: string; data: { url: string } }][] = [],
    opened: string[] = [];
  const self = {
    addEventListener(name: string, fn: (event: unknown) => void) {
      handlers[name] = fn;
    },
    location: { origin: "https://beauty.example.invalid" },
    registration: {
      async showNotification(
        title: string,
        options: { body: string; tag: string; data: { url: string } },
      ) {
        shown.push([title, options]);
      },
    },
    clients: {
      async matchAll() {
        return [] as {
          url: string;
          navigate?: (url: string) => Promise<void>;
          focus?: () => Promise<void>;
        }[];
      },
      async openWindow(url: string) {
        opened.push(url);
      },
    },
  };
  vm.runInNewContext(source, { self, URL });
  return { handlers, shown, opened, self };
}
test("Push inválido ainda exibe aviso visível e genérico", async () => {
  const f = fixture();
  let pending: Promise<unknown>;
  f.handlers.push({
    data: {
      json() {
        throw new Error();
      },
    },
    waitUntil(p: Promise<unknown>) {
      pending = p;
    },
  });
  await pending!;
  assert.equal(f.shown.length, 1);
  assert.equal(f.shown[0][0], "Agendamentos");
  assert.equal(f.shown[0][1].data.url, "/app");
});
test("Push limita texto e ignora destino externo", async () => {
  const f = fixture();
  let pending: Promise<unknown>;
  f.handlers.push({
    data: {
      json: () => ({
        title: "Arena — Testes",
        body: "x".repeat(1000),
        url: "https://externo.invalid",
        tag: "a".repeat(200),
      }),
    },
    waitUntil(p: Promise<unknown>) {
      pending = p;
    },
  });
  await pending!;
  assert.equal(f.shown[0][0], "Arena — Testes");
  assert.equal("icon" in f.shown[0][1], false);
  assert.equal(f.shown[0][1].body.length, 200);
  assert.equal(f.shown[0][1].tag.length, 100);
  assert.equal(f.shown[0][1].data.url, "/app");
});
test("Clique abre somente página interna da mesma origem", async () => {
  const f = fixture();
  let pending: Promise<unknown>,
    closed = false;
  f.handlers.notificationclick({
    notification: {
      close() {
        closed = true;
      },
      data: { url: "https://externo.invalid" },
    },
    waitUntil(p: Promise<unknown>) {
      pending = p;
    },
  });
  await pending!;
  assert.equal(closed, true);
  assert.deepEqual(f.opened, ["https://beauty.example.invalid/app"]);
});
test("Clique reutiliza janela da mesma origem e respeita destino profissional", async () => {
  const f = fixture();
  const actions: string[] = [];
  let pending: Promise<unknown>;
  f.self.clients.matchAll = async () => [
    { url: "https://externo.invalid" },
    {
      url: "https://beauty.example.invalid/app",
      async navigate(url: string) {
        actions.push(url);
      },
      async focus() {
        actions.push("foco");
      },
    },
  ];
  f.handlers.notificationclick({
    notification: { close() {}, data: { url: "/shop" } },
    waitUntil(p: Promise<unknown>) {
      pending = p;
    },
  });
  await pending!;
  assert.deepEqual(actions, ["https://beauty.example.invalid/shop", "foco"]);
  assert.equal(f.opened.length, 0);
});
