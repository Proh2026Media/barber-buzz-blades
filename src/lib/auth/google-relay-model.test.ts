import assert from "node:assert/strict";
import test from "node:test";
import {
  RELAY_TTL_MS,
  isMissingFunctionError,
  isRelayCode,
  isRelayId,
  parsePendingRelay,
  readRelayReturn,
  relayReturnUrl,
} from "./google-relay-model.ts";

const ID = "3f6c2b1a-9d4e-4a7b-8c5d-1e2f3a4b5c6d";

test("relay id must be a real random UUID", () => {
  assert.equal(isRelayId(ID), true);
  assert.equal(isRelayId("not-a-uuid"), false);
  assert.equal(isRelayId(`${ID}x`), false);
  assert.equal(isRelayId(null), false);
});

test("relay code accepts the Auth code shape and nothing with spaces or symbols", () => {
  assert.equal(isRelayCode("b9f4a7f2-6c2e-4a53-9d0a-5c7f1a2b3c4d"), true);
  assert.equal(isRelayCode("short"), false);
  assert.equal(isRelayCode("tem espaço no meio"), false);
  assert.equal(isRelayCode("a".repeat(256)), false);
  assert.equal(isRelayCode(undefined), false);
});

test("return address always points to the platform auth return page", () => {
  assert.equal(
    relayReturnUrl("https://beauty.contheiner.digital/", ID),
    `https://beauty.contheiner.digital/auth/retorno?relay=${ID}`,
  );
});

test("pending relay survives within ten minutes and expires after", () => {
  const now = 1_800_000_000_000;
  const raw = JSON.stringify({ id: ID, startedAt: now - 60_000, next: "/app", shop: "arena" });
  assert.deepEqual(parsePendingRelay(raw, now), {
    id: ID,
    startedAt: now - 60_000,
    next: "/app",
    shop: "arena",
  });
  const old = JSON.stringify({ id: ID, startedAt: now - RELAY_TTL_MS - 1 });
  assert.equal(parsePendingRelay(old, now), null);
});

test("broken or suspicious pending relay counts as none", () => {
  const now = 1_800_000_000_000;
  assert.equal(parsePendingRelay(null, now), null);
  assert.equal(parsePendingRelay("{", now), null);
  assert.equal(parsePendingRelay(JSON.stringify({ id: "x", startedAt: now }), now), null);
  // Relógio voltou no tempo: começou "no futuro".
  assert.equal(parsePendingRelay(JSON.stringify({ id: ID, startedAt: now + 120_000 }), now), null);
  // Campos vazios não viram destino.
  assert.deepEqual(parsePendingRelay(JSON.stringify({ id: ID, startedAt: now, next: "" }), now), {
    id: ID,
    startedAt: now,
  });
});

test("return page reads relay and code, and notices a Google error", () => {
  assert.deepEqual(readRelayReturn(`?relay=${ID}&code=b9f4a7f2-6c2e-4a53-9d0a-5c7f1a2b3c4d`), {
    relay: ID,
    code: "b9f4a7f2-6c2e-4a53-9d0a-5c7f1a2b3c4d",
    failed: false,
  });
  assert.deepEqual(readRelayReturn(`?relay=${ID}&error=access_denied`), {
    relay: ID,
    code: null,
    failed: true,
  });
  assert.deepEqual(readRelayReturn("?relay=bad&code=x y"), {
    relay: null,
    code: null,
    failed: false,
  });
});

test("missing database function is recognized (site published before the migration)", () => {
  assert.equal(isMissingFunctionError({ code: "PGRST202", message: "" }), true);
  assert.equal(
    isMissingFunctionError({ message: "Could not find the function public.oauth_relay_take" }),
    true,
  );
  assert.equal(isMissingFunctionError({ code: "42501", message: "Not allowed" }), false);
  assert.equal(isMissingFunctionError(null), false);
});
