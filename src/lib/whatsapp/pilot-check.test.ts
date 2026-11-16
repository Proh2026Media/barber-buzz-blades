import test from "node:test";
import assert from "node:assert/strict";
import { checkPilotConnections, type PilotState, type PilotTarget } from "./pilot-check.ts";
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
function fixture() {
  const controller = new AbortController(),
    calls: string[] = [];
  const state: PilotState = {
    contract: "bc-pilot-release-v1",
    scoped: true,
    isolated: true,
    shop_id: id(1),
    customer_id: id(2),
    shop_name: "Loja Teste fictícia",
    customer_name: "Cliente fictício",
    policy_version: 12,
    pause_version: 17,
    paused: true,
    cycles: false,
    assistance: false,
    preparation_ready: false,
  };
  const first = {
    contract: "bc-pilot-connection-check-v1",
    state,
    targets: [
      { id: id(3), phone: "+5511800000001", version: 7 },
      { id: id(4), phone: "+5511800000002", version: 8 },
    ],
    fingerprint: "a".repeat(32),
  };
  const last = structuredClone(first);
  last.state.preparation_ready = true;
  let reads = 0,
    active = true;
  const deps = {
    read: async () => {
      calls.push("read");
      return structuredClone(++reads === 1 ? first : last);
    },
    current: async () => active,
    verify: async (target: PilotTarget) => {
      calls.push(target.id);
      return { managed_channel_id: target.id, status: "open", display_phone: target.phone };
    },
  };
  return {
    controller,
    calls,
    state,
    first,
    last,
    deps,
    deactivate: () => {
      active = false;
    },
  };
}
test("um clique confere somente os números do escopo e relê prontidão sem ativar", async () => {
  const f = fixture();
  const result = await checkPilotConnections(f.deps, f.controller.signal, {
    shop_id: id(1),
    customer_id: id(2),
  });
  assert.equal(result.preparation_ready, true);
  assert.equal(result.paused, true);
  assert.equal(result.cycles, false);
  assert.equal(result.assistance, false);
  assert.deepEqual(f.calls, ["read", id(3), id(4), "read"]);
});
for (const name of ["shop_id", "customer_id"] as const)
  test(`escopo exibido divergente (${name}) não consulta outro atendimento`, async () => {
    const f = fixture();
    await assert.rejects(
      checkPilotConnections(f.deps, f.controller.signal, {
        shop_id: id(1),
        customer_id: id(2),
        [name]: id(9),
      }),
      /GROUP_STALE/,
    );
    assert.deepEqual(f.calls, ["read"]);
  });
for (const mutate of [
  (f: ReturnType<typeof fixture>) => {
    f.first.state.scoped = false;
  },
  (f: ReturnType<typeof fixture>) => {
    f.first.state.isolated = false;
  },
])
  test("escopo ausente ou sem isolamento não consulta Evolution", async () => {
    const f = fixture();
    mutate(f);
    await assert.rejects(
      checkPilotConnections(f.deps, f.controller.signal),
      /PILOT_SCOPE_REQUIRED/,
    );
    assert.deepEqual(f.calls, ["read"]);
  });
for (const kind of [
  "one",
  "overflow",
  "duplicate-id",
  "duplicate-phone",
  "invalid-version",
  "invalid-contract",
] as const)
  test(`plano inválido (${kind}) falha fechado antes da rede`, async () => {
    const f = fixture();
    if (kind === "one") f.first.targets.pop();
    if (kind === "overflow")
      f.first.targets = Array.from({ length: 21 }, (_, i) => ({
        id: id(100 + i),
        phone: `+551180000${String(i).padStart(4, "0")}`,
        version: 1,
      }));
    if (kind === "duplicate-id") f.first.targets[1].id = f.first.targets[0].id;
    if (kind === "duplicate-phone") f.first.targets[1].phone = f.first.targets[0].phone;
    if (kind === "invalid-version") f.first.targets[0].version = NaN;
    if (kind === "invalid-contract") f.first.contract = "outro";
    await assert.rejects(
      checkPilotConnections(f.deps, f.controller.signal),
      /PILOT_CONNECTION_CHECK_FAILED|CONTRACT_REQUIRED/,
    );
    assert.deepEqual(f.calls, ["read"]);
  });
for (const result of [
  { status: "disconnected" },
  { status: "connecting" },
  { managed_channel_id: id(99) },
  { display_phone: "+5511888888888" },
  { error: "CHANNEL_STATE_UNSAVED" },
])
  test(`consulta inconclusiva não autoriza (${JSON.stringify(result)})`, async () => {
    const f = fixture(),
      verify = f.deps.verify;
    f.deps.verify = async (t) => ({ ...(await verify(t)), ...result });
    await assert.rejects(
      checkPilotConnections(f.deps, f.controller.signal),
      /PILOT_CONNECTION_CHECK_FAILED/,
    );
    assert.equal(f.calls.filter((x) => x === "read").length, 1);
  });
for (const kind of ["fingerprint", "shop", "customer", "version", "identity"] as const)
  test(`mudança durante as consultas (${kind}) não libera`, async () => {
    const f = fixture();
    if (kind === "fingerprint") f.last.fingerprint = "b".repeat(32);
    if (kind === "shop") f.last.state.shop_id = id(9);
    if (kind === "customer") f.last.state.customer_id = id(9);
    if (kind === "version") f.last.targets[0].version++;
    if (kind === "identity") f.last.targets[0].phone = "+5511888888888";
    await assert.rejects(checkPilotConnections(f.deps, f.controller.signal), /GROUP_STALE/);
  });
test("falha de rede não repete as consultas nem faz a releitura virar sucesso", async () => {
  const f = fixture();
  f.deps.verify = async () => {
    throw Error("falha de rede");
  };
  await assert.rejects(checkPilotConnections(f.deps, f.controller.signal), /falha de rede/);
  assert.deepEqual(f.calls, ["read"]);
});
test("cancelamento interrompe a conferência sem consultas extras", async () => {
  const f = fixture();
  f.controller.abort();
  await assert.rejects(checkPilotConnections(f.deps, f.controller.signal));
  assert.deepEqual(f.calls, []);
});
test("troca ou encerramento de sessão após a consulta não atualiza prontidão", async () => {
  const f = fixture(),
    verify = f.deps.verify;
  f.deps.verify = async (t) => {
    const result = await verify(t);
    f.deactivate();
    return result;
  };
  await assert.rejects(checkPilotConnections(f.deps, f.controller.signal), /SESSION_REQUIRED/);
  assert.equal(f.calls.filter((x) => x === "read").length, 1);
});
test("checagem bem-sucedida não ignora os demais requisitos de segurança", async () => {
  const f = fixture();
  f.last.state.preparation_ready = false;
  const result = await checkPilotConnections(f.deps, f.controller.signal);
  assert.equal(result.preparation_ready, false);
  assert.equal(result.paused, true);
});
test("composição completa é conferida com no máximo quatro consultas paralelas", async () => {
  const f = fixture();
  f.first.targets = Array.from({ length: 9 }, (_, i) => ({
    id: id(100 + i),
    phone: `+551180000${String(i).padStart(4, "0")}`,
    version: 1,
  }));
  f.last.targets = structuredClone(f.first.targets);
  let current = 0,
    max = 0;
  const verify = f.deps.verify;
  f.deps.verify = async (t) => {
    max = Math.max(max, ++current);
    await new Promise((resolve) => setTimeout(resolve, 1));
    current--;
    return verify(t);
  };
  await checkPilotConnections(f.deps, f.controller.signal);
  assert.equal(max, 4);
  assert.equal(f.calls.length, 11);
});
