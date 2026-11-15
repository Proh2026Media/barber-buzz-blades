import test from "node:test";
import assert from "node:assert/strict";
import { handleCareAccess } from "./handler.ts";
const shop = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  token = "44444444-4444-4444-8444-444444444444",
  cycle = "55555555-5555-4555-8555-555555555555";
const targets = [
  { id: shop, instance: "ficticia_a", phone: "+5511800000111", version: 2 },
  { id: user, instance: "ficticia_b", phone: "+5511800000222", version: 3 },
];
function setup() {
  const calls: { side: string; name: string; args?: Record<string, unknown> }[] = [];
  const data = { access: { contract: "bc-assisted-v1" }, phone: "+5511999999999" };
  const db = (side: string) => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ side, name, args });
      return {
        data:
          name === "claim_care_access"
            ? { id, token, targets }
            : name === "resume_care_access"
              ? cycle
              : name === "care_group_read"
                ? data
                : id,
      };
    },
  });
  const deps = {
    enabled: true,
    authenticate: async () => ({ id: user, db: db("user") }),
    service: db("service"),
    observe: async (path: string, init: RequestInit) => {
      calls.push({ side: "provider", name: path });
      assert.equal(init.method, "GET");
      return targets.map((t) => ({
        name: t.instance,
        connectionStatus: "open",
        ownerJid: t.phone.slice(1) + "@s.whatsapp.net",
      }));
    },
    process: async (value: string) => {
      assert.equal(value, cycle);
      calls.push({ side: "engine", name: value });
      return "waiting_customer";
    },
  };
  const request = (start = false) =>
    new Request("https://example.invalid/access", {
      method: "POST",
      body: JSON.stringify({
        action: start ? "start" : "advance",
        shop,
        ...(start
          ? { accept: true, phone: "+5511999999999", accounts: targets.map((t) => t.id) }
          : {}),
      }),
    });
  return { calls, deps, data, request };
}
test("Acompanhamento observa apenas números consentidos antes de retomar e usa motor protegido", async () => {
  const s = setup(),
    response = await handleCareAccess(s.request(true), s.deps);
  assert.equal(response.status, 200);
  assert.deepEqual(
    s.calls.map((c) => c.name),
    [
      "care_access_start",
      "claim_care_access",
      "/instance/fetchInstances",
      "record_care_access_connections",
      "resume_care_access",
      cycle,
      "finish_care_access",
      "care_group_read",
    ],
  );
  const observations = s.calls[3].args!.p_observations as Record<string, unknown>[];
  assert.equal(observations.length, 2);
  assert.equal(observations[0].status, "open");
  assert.equal(s.calls[0].side, "user");
  assert.equal(s.calls[4].side, "user");
  assert.equal(
    s.calls.some((c) => /distribution|auth-otp|sendCode|begin/.test(c.name)),
    false,
  );
  assert.deepEqual(await response.json(), { state: "waiting_customer", data: s.data });
});
test("Requisição sem sessão não lê nem processa qualquer intenção", async () => {
  const s = setup();
  s.deps.authenticate = async () => null as never;
  assert.equal((await handleCareAccess(s.request(), s.deps)).status, 401);
  assert.equal(s.calls.length, 0);
});
test("Flag de ambiente desligada bloqueia antes de tocar banco/provedor", async () => {
  const s = setup();
  s.deps.enabled = false;
  assert.equal((await handleCareAccess(s.request(), s.deps)).status, 503);
  assert.equal(s.calls.length, 0);
});
test("Sem intenção/fora do escopo não consulta instâncias nem cria intenção no polling", async () => {
  const s = setup(),
    rpc = s.deps.service.rpc;
  s.deps.service.rpc = async (name, args) =>
    name === "claim_care_access" ? { data: null as never } : rpc(name, args);
  const r = await handleCareAccess(s.request(), s.deps);
  assert.equal((await r.json()).state, "inactive");
  assert.deepEqual(
    s.calls.map((c) => c.name),
    ["care_group_read"],
  );
});
test("Lease/rate entre abas só devolve leitura sem processar de novo", async () => {
  const s = setup(),
    rpc = s.deps.service.rpc;
  s.deps.service.rpc = async (name, args) =>
    name === "claim_care_access" ? { data: { waiting: true } as never } : rpc(name, args);
  const r = await handleCareAccess(s.request(), s.deps);
  assert.equal((await r.json()).state, "waiting");
  assert.equal(
    s.calls.some((c) => c.side === "provider" || c.side === "engine"),
    false,
  );
});
test("Falha de rede não registra status/frescor e devolve erro sanitizado", async () => {
  const s = setup();
  s.deps.observe = async () => {
    throw Error("senha token +5511999999999");
  };
  const r = await handleCareAccess(s.request(), s.deps);
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { code: "ACCESS_UNAVAILABLE" });
  assert.equal(
    s.calls.some((c) => c.name === "record_care_access_connections" || c.side === "engine"),
    false,
  );
  assert.equal(s.calls.at(-1)!.args!.p_failed, true);
});
test("LID ou telefone diferente não confirma conexão aberta", async () => {
  for (const owner of ["12345@lid", "5511800000999@s.whatsapp.net"]) {
    const s = setup();
    s.deps.observe = async () =>
      targets.map((t) => ({ name: t.instance, connectionStatus: "open", ownerJid: owner }));
    await handleCareAccess(s.request(), s.deps);
    const observations = s.calls.find((c) => c.name === "record_care_access_connections")!.args!
      .p_observations as Record<string, unknown>[];
    assert.equal(
      observations.every((o) => o.status === "unknown"),
      true,
    );
  }
});
test("Identidades não consentidas vindas da lista global nunca são gravadas", async () => {
  const s = setup(),
    observe = s.deps.observe;
  s.deps.observe = async (path, init) => [
    ...(await observe(path, init)),
    { name: "nao_consentida", connectionStatus: "open", ownerJid: "5511800000999@s.whatsapp.net" },
  ];
  await handleCareAccess(s.request(), s.deps);
  const observations = s.calls.find((c) => c.name === "record_care_access_connections")!.args!
    .p_observations as Record<string, unknown>[];
  assert.deepEqual(
    observations.map((o) => o.instance),
    targets.map((t) => t.instance),
  );
});
test("Rejeição de telefone conserva código controlado e não chama motor", async () => {
  const s = setup(),
    rpc = s.deps.authenticate;
  s.deps.authenticate = async () => {
    const u = await rpc();
    const fn = u.db.rpc;
    u.db.rpc = async (name, args) =>
      name === "resume_care_access"
        ? ({ error: { message: "GROUP_PHONE_UNAVAILABLE", details: "segredo" } } as never)
        : fn(name, args);
    return u;
  };
  const r = await handleCareAccess(s.request(), s.deps);
  assert.deepEqual(await r.json(), { code: "GROUP_PHONE_UNAVAILABLE" });
  assert.equal(
    s.calls.some((c) => c.side === "engine"),
    false,
  );
});
test("Entrada inválida, sem aceite ou excedente não consulta provedor", async () => {
  for (const body of [
    { action: "start", shop, accept: false },
    { action: "advance", shop: "outra" },
    { action: "qualquer", shop },
  ]) {
    const s = setup();
    const r = await handleCareAccess(
      new Request("https://example.invalid", { method: "POST", body: JSON.stringify(body) }),
      s.deps,
    );
    assert.equal(r.status, 400);
    assert.equal(s.calls.length, 0);
  }
  const s = setup();
  const r = await handleCareAccess(
    new Request("https://example.invalid", { method: "POST", body: "x".repeat(16385) }),
    s.deps,
  );
  assert.equal(r.status, 413);
  assert.equal(s.calls.length, 0);
});
test("Preflight sem sessão funciona e não inicia operação", async () => {
  const s = setup();
  assert.equal(
    (await handleCareAccess(new Request("https://example.invalid", { method: "OPTIONS" }), s.deps))
      .status,
    204,
  );
  assert.equal(s.calls.length, 0);
});

test("Instância duplicada não serve como prova de identidade live", async () => {
  const s = setup(),
    original = s.deps.observe;
  s.deps.observe = async (path, init) => {
    const raw = await original(path, init);
    return [...raw, raw[0]];
  };
  await handleCareAccess(s.request(), s.deps);
  const observations = s.calls.find((c) => c.name === "record_care_access_connections")!.args!
    .p_observations as Record<string, unknown>[];
  assert.equal(observations[0].status, "unknown");
});

test("Revisar exige grupo e versão e nunca é tratado como simples cadastro", async () => {
  const s = setup();
  const r = await handleCareAccess(
    new Request("https://example.invalid/access", {
      method: "POST",
      body: JSON.stringify({
        action: "revise",
        shop,
        phone: "+5511999999999",
        accounts: targets.map((t) => t.id),
        accept: true,
      }),
    }),
    s.deps,
  );
  assert.equal(r.status, 400);
  assert.equal(s.calls.length, 0);
});
