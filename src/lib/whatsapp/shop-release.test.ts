import { test } from "node:test";
import assert from "node:assert/strict";
import { shopReleaseState, checkShopReleaseNumbers } from "./shop-release.ts";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const state = {
  contract: "bc-shop-release-v1",
  managed: true,
  running: true,
  policy_version: 1,
  pause_version: 1,
  shops: [
    {
      id: a,
      name: "Loja fictícia",
      enabled: true,
      version: 1,
      customers: [{ id: b, name: "Cliente", allowed: true, ready: true }],
    },
  ],
};
const snapshot = () => ({
  fingerprint: "a".repeat(32),
  targets: [
    { id: a, phone: "+5511800000001", version: 1 },
    { id: b, phone: "+5511800000002", version: 1 },
  ],
});
const verify = async (t: { id: string; phone: string }) => ({
  managed_channel_id: t.id,
  status: "open",
  display_phone: t.phone,
});
test("Contrato por loja rejeita IDs duplicados e sucesso sem estado real", () => {
  assert.equal(shopReleaseState(state).shops[0].customers[0].allowed, true);
  assert.throws(() => shopReleaseState({ ...state, shops: [state.shops[0], state.shops[0]] }));
  assert.throws(() => shopReleaseState({ ...state, running: null }));
});
test("Conferência observa exatamente dois números e relê composição", async () => {
  let reads = 0;
  const calls: string[] = [];
  await checkShopReleaseNumbers(
    {
      read: async () => {
        reads++;
        return snapshot();
      },
      current: async () => true,
      verify: async (t) => {
        calls.push(t.id);
        return verify(t);
      },
    },
    new AbortController().signal,
  );
  assert.equal(reads, 2);
  assert.deepEqual(calls, [a, b]);
});
test("Conferência rejeita troca de rota ou retorno de outra identidade", async () => {
  let reads = 0;
  await assert.rejects(
    checkShopReleaseNumbers(
      {
        read: async () => ({ ...snapshot(), fingerprint: (++reads === 1 ? "a" : "b").repeat(32) }),
        current: async () => true,
        verify,
      },
      new AbortController().signal,
    ),
    /GROUP_STALE/,
  );
  await assert.rejects(
    checkShopReleaseNumbers(
      {
        read: async () => snapshot(),
        current: async () => true,
        verify: async () => ({
          managed_channel_id: b,
          status: "open",
          display_phone: "+5511800000001",
        }),
      },
      new AbortController().signal,
    ),
    /PILOT_CONNECTION_CHECK_FAILED/,
  );
});
test("Sessão expirada e cancelamento impedem consultas seguintes", async () => {
  let calls = 0;
  await assert.rejects(
    checkShopReleaseNumbers(
      {
        read: async () => snapshot(),
        current: async () => false,
        verify: async (t) => {
          calls++;
          return verify(t);
        },
      },
      new AbortController().signal,
    ),
    /SESSION_REQUIRED/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    checkShopReleaseNumbers(
      { read: async () => snapshot(), current: async () => true, verify },
      controller.signal,
    ),
  );
  assert.equal(calls, 0);
});
