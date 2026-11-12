import test from "node:test";
import assert from "node:assert/strict";
import { groupPhone } from "./group-phone.ts";
const phone = "+5511999999999";
function fixture(options: { error?: string; verified?: boolean; state?: string } = {}) {
  const calls: { name: string; args: unknown }[] = [];
  const admin = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      if (name === "normalize_br_whatsapp") return { data: phone };
      if (options.error) return { error: { message: options.error } };
      if (name === "request_whatsapp_group_phone") return { data: { challenge_id: "ficticio" } };
      return {
        data: options.verified
          ? {
              whatsapp_e164: phone,
              whatsapp_verified_at: "2026-11-11T00:00:00Z",
              whatsapp_opt_in_at: null,
            }
          : null,
      };
    },
  };
  return {
    calls,
    run: (body: Parameters<typeof groupPhone>[2], user = "titular") =>
      groupPhone(admin as never, user, body, {
        hash: async (value) => {
          calls.push({ name: "hash", args: value });
          return "a".repeat(64);
        },
        send: async (code, id, hash) => {
          calls.push({ name: "send", args: { code, id, hash } });
          return options.state ?? "accepted";
        },
      }),
  };
}
test("confirmação exige sessão e meio correto antes de qualquer chamada", async () => {
  const f = fixture();
  assert.equal((await f.run({}, "")).status, 401);
  assert.equal((await f.run({ channel: "email" })).status, 400);
  assert.equal(f.calls.length, 0);
});
test("desafio usa exclusivamente titular autenticado e finalidade de confirmação", async () => {
  const f = fixture();
  const result = await f.run({ destination: phone, request_id: "pedido" });
  assert.equal(result.status, 200);
  assert.match(
    f.calls.find((x) => x.name === "hash")!.args as string,
    /^verify_phone:titular:\+5511999999999:\d{6}$/,
  );
  assert.deepEqual(f.calls.find((x) => x.name === "request_whatsapp_group_phone")!.args, {
    p_user: "titular",
    p_destination: phone,
    p_code_hash: "a".repeat(64),
    p_request_id: "pedido",
  });
  assert.equal(f.calls.filter((x) => x.name === "send").length, 1);
  assert.ok(!JSON.stringify(result).includes("ficticio"));
});
test("limite e grupo indisponível não enviam código", async () => {
  for (const [error, status] of [
    ["WA_RATE_LIMIT", 429],
    ["GROUP_UNAVAILABLE", 503],
  ] as const) {
    const f = fixture({ error });
    assert.equal((await f.run({})).status, status);
    assert.ok(!f.calls.some((x) => x.name === "send"));
  }
});
test("resultado incerto não tenta outro envio ou privado", async () => {
  const f = fixture({ state: "unknown" });
  assert.equal((await f.run({})).status, 200);
  assert.equal(f.calls.filter((x) => x.name === "send").length, 1);
});
test("prova errada não confirma e prova correta preserva avisos desligados", async () => {
  assert.equal((await fixture().run({ action: "verify", code: "123456" })).status, 400);
  const f = fixture({ verified: true });
  const result = await f.run({ action: "verify", code: "123456" });
  assert.equal(result.status, 200);
  assert.equal((result.body as { whatsapp_opt_in_at: unknown }).whatsapp_opt_in_at, null);
  assert.ok(!f.calls.some((x) => x.name === "send"));
});
