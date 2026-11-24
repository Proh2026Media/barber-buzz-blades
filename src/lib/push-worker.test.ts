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

test("Push da loja usa o ícone da própria origem mesmo com imagem externa no payload", async () => {
  const f = fixture();
  let pending: Promise<unknown>;
  f.handlers.push({
    data: { json: () => ({ title: "Loja Teste B", shop_icon: true, icon: "https://outro.invalid/logo" }) },
    waitUntil(p: Promise<unknown>) { pending = p; },
  });
  await pending!;
  assert.equal(f.shown[0][0], "Loja Teste B");
  assert.equal((f.shown[0][1] as {icon?: string}).icon, "/identidade/icone?dominio=beauty.example.invalid");
});

test("Só o toque registra abertura e o aviso continua abrindo o app", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const chamadas: string[] = [], janelas: string[] = [];
  let dados: any;
  const worker = {
    addEventListener: (tipo: string, fn: typeof handlers[string]) => { handlers[tipo] = fn; },
    registration: { showNotification: (_: string, options: {data: unknown}) => { dados = options.data; } },
    location: {origin: "https://loja.example.invalid"},
    clients: {matchAll: async () => [], openWindow: async (url: string) => { janelas.push(url); }},
  };
  vm.runInNewContext(source, { self: worker, URL, fetch: async (url: string) => {
    chamadas.push(url);
    throw new Error("Sem conexão");
  }});
  const token = "95db929d-831e-4634-b864-f82c194cbd2f";
  const tarefas: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => tarefas.push(p);
  handlers.push({data: {json: () => ({receipt: token})}, waitUntil});
  assert.equal(chamadas.length, 0);
  handlers.notificationclick({notification: {data: dados, close() {}}, waitUntil});
  await Promise.all(tarefas);
  assert.deepEqual(chamadas, ["https://loja.example.invalid/avisos/abertura/push?t=" + token]);
  assert.deepEqual(janelas, ["https://loja.example.invalid/app#bc-toque=" + token]);
});

test("Recupera o recibo pela etiqueta e repete somente o toque pendente", async () => {
  const token = "95db929d-831e-4634-b864-f82c194cbd2f";
  const url = "https://loja.example.invalid/avisos/abertura/push?t=" + token;
  const pendentes = new Set<string>(), chamadas: string[] = [];
  let disponivel = false;
  const cache = {
    put: async (key: string) => pendentes.add(key),
    delete: async (key: string) => pendentes.delete(key),
    keys: async () => Array.from(pendentes, key => ({url:key})),
  };
  const handlers: Record<string, (event: any) => void> = {};
  const worker = {
    location: {origin:"https://loja.example.invalid"},
    addEventListener: (name: string, fn: typeof handlers[string]) => { handlers[name] = fn; },
    clients: { matchAll: async () => [], openWindow: async () => {} },
  };
  vm.runInNewContext(source, {self:worker, URL, Response,
    caches: {open: async () => cache, has: async () => true},
    fetch: async (key: string) => { chamadas.push(key); return {ok:disponivel}; },
  });
  const tarefas: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => tarefas.push(p);
  handlers.notificationclick({notification:{tag:"bc-open-"+token,close(){}},waitUntil});
  await Promise.all(tarefas);
  assert.deepEqual([...pendentes],[url]);
  disponivel = true;
  handlers.message({data:"retomar-toques-push",waitUntil});
  await Promise.all(tarefas);
  handlers.message({data:"retomar-toques-push",waitUntil});
  await Promise.all(tarefas);
  assert.deepEqual(chamadas,[url,url]);
  assert.equal(pendentes.size,0);
});

test("Toque nativo no iPhone usa a loja do aparelho e só o recibo desse aviso", async () => {
  const f = fixture();
  const token = "95db929d-831e-4634-b864-f82c194cbd2f";
  for (const receipt of [token, "invalido"]) {
    let work: Promise<unknown>;
    f.handlers.push({data: {json: () => ({receipt, url:"/app", navigate:"https://externo.invalid/"})},
      waitUntil(p: Promise<unknown>) { work = p; }});
    await work!;
  }
  const options = f.shown.map(row => row[1] as {navigate?: string});
  assert.equal(options[0].navigate, "https://beauty.example.invalid/avisos/toque?t=" + token);
  assert.equal(options[1].navigate, undefined);
});
