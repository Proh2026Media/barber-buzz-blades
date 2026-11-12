import { groupPhone } from "../auth-otp/group-phone.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { randomOtp, otpVerifier } from "./whatsapp-otp.ts";

const key = "chave-de-teste-ficticia-com-mais-de-32-bytes";
const phone = "+5511999999999";
function fixture(
  endpoint: "auth-otp" | "register-shop",
  options: { insertError?: string; secret?: string; unauthorized?: boolean } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  const calls: { name: string; value?: unknown }[] = [];
  const db = {
    auth: {
      getUser: async () => ({
        data: options.unauthorized ? null : { user: { id: "conta" } },
        error: options.unauthorized ? {} : null,
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "normalize_br_whatsapp") return { data: phone };
      if (name === "request_whatsapp_group_phone") {
        calls.push({ name: "challenge", value: { request_id: args.p_request_id } });
        return options.insertError
          ? { error: { message: options.insertError } }
          : { data: { challenge_id: "desafio" } };
      }
      return { data: null };
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        insert: (value: unknown) => {
          calls.push({ name: "challenge", value });
          return query;
        },
        single: async () =>
          options.insertError
            ? { error: { message: options.insertError } }
            : { data: { id: "desafio" } },
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: table === "profiles" ? [] : null }),
      };
      return query;
    },
  };
  const source = readFileSync(new URL(`../${endpoint}/index.ts`, import.meta.url), "utf8").replace(
    /^import[\s\S]*?;\n/gm,
    "",
  );
  new Function(
    "groupPhone",
    "sendAuthorizedGroupLogin",
    "createClient",
    "sendAuthorizedWhatsapp",
    "randomOtp",
    "otpVerifier",
    "json",
    "corsHeaders",
    "Deno",
    stripTypeScriptTypes(source),
  )(
    groupPhone,
    async (_db: unknown, value: unknown) => {
      calls.push({ name: "send", value });
      return "unknown";
    },
    () => db,
    async (_db: unknown, value: unknown) => {
      calls.push({ name: "send", value });
      return { state: "unknown", recorded: true };
    },
    randomOtp,
    otpVerifier,
    (b: unknown, s = 200) => Response.json(b, { status: s }),
    {},
    {
      env: {
        get: (name: string) =>
          name === "WHATSAPP_OTP_HMAC_KEY" ? (options.secret ?? key) : "configuracao-ficticia",
      },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  );
  return {
    calls,
    run: () =>
      handler(
        new Request("https://example.invalid", {
          method: "POST",
          headers: { Authorization: "Bearer sessao-ficticia", "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            purpose: "verify_phone",
            destination: phone,
            request_id: "11111111-1111-4111-8111-111111111111",
          }),
        }),
      ),
  };
}
for (const endpoint of ["auth-otp"] as const) {
  test(`${endpoint}: pedido usa HMAC e saída comum; resultado incerto permite digitar sem fingir entrega`, async () => {
    const f = fixture(endpoint);
    const response = await f.run();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.delivery_state, "unknown");
    const sent = f.calls.find((c) => c.name === "send")?.value as {
      challengeId: string;
      text?: string;
      code?: string;
      codeHash: string;
    };
    assert.equal(sent.challengeId, "desafio");
    const code = sent.code ?? sent.text?.match(/\b\d{6}\b/)?.[0];
    assert.ok(code);
    assert.equal(
      sent.codeHash,
      await otpVerifier(
        `${endpoint === "auth-otp" ? "verify_phone:conta" : "platform"}:${phone}:${code}`,
        key,
      ),
    );
    assert.ok(!JSON.stringify(payload).includes(code));
    assert.equal(
      (f.calls.find((c) => c.name === "challenge")?.value as { request_id: string }).request_id,
      "11111111-1111-4111-8111-111111111111",
    );
  });
  test(`${endpoint}: erro do limite atômico bloqueia envio`, async () => {
    const f = fixture(endpoint, { insertError: "WA_RATE_LIMIT" });
    assert.equal((await f.run()).status, 429);
    assert.ok(!f.calls.some((c) => c.name === "send"));
  });
  test(`${endpoint}: pausa no banco bloqueia envio`, async () => {
    const f = fixture(endpoint, { insertError: "WA_SENDING_PAUSED" });
    assert.equal((await f.run()).status, 503);
    assert.ok(!f.calls.some((c) => c.name === "send"));
  });
  test(`${endpoint}: ausência de segredo falha antes de criar desafio`, async () => {
    const f = fixture(endpoint, { secret: "" });
    assert.equal((await f.run()).status, 503);
    assert.equal(f.calls.length, 0);
  });
}
test("confirmação pessoal exige sessão válida antes de gerar código", async () => {
  const f = fixture("auth-otp", { unauthorized: true });
  assert.equal((await f.run()).status, 401);
  assert.equal(f.calls.length, 0);
});

test("Cadastro legado recusa pedido sem criar desafio, conta ou envio privado", async () => {
  const f = fixture("register-shop");
  const response = await f.run();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).error_code, "shop_authenticated_signup_required");
  assert.equal(f.calls.length, 0);
});
