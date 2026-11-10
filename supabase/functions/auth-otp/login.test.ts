import test from "node:test";
import assert from "node:assert/strict";
import { whatsappLogin } from "./login.ts";

function fixture(
  options: {
    known?: boolean;
    valid?: boolean;
    held?: boolean;
    sendFails?: boolean;
    rpcError?: string;
    banned?: boolean;
    linkFails?: boolean;
    differentAccount?: boolean;
  } = {},
) {
  const calls: Array<{ name: string; args?: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      if (options.rpcError) return { error: { message: options.rpcError } };
      return {
        data:
          name === "request_whatsapp_login"
            ? { challenge_id: "desafio", user_id: options.known === false ? null : "conta" }
            : options.valid === false
              ? []
              : [{ challenge_id: "desafio", user_id: "conta" }],
      };
    },
    from(name: string) {
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        update: (data: unknown) => {
          calls.push({ name: "invalidate", args: data });
          return q;
        },
        maybeSingle: async () => ({ data: options.held === false ? null : { id: "conta" } }),
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
      };
      calls.push({ name });
      return q;
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              email: "teste@example.invalid",
              banned_until: options.banned ? "2999-01-01" : null,
            },
          },
        }),
        generateLink: async (args: unknown) => {
          calls.push({ name: "generateLink", args });
          return options.linkFails
            ? { error: {} }
            : {
                data: {
                  user: { id: options.differentAccount ? "outra" : "conta" },
                  properties: { hashed_token: "hash-ficticio" },
                },
              };
        },
      },
    },
  };
  return {
    calls,
    run: (body: Parameters<typeof whatsappLogin>[1], instance = "plataforma") =>
      whatsappLogin(client as never, body, {
        instance,
        send: async (instance, phone, text) => {
          calls.push({ name: "send", args: { instance, phone, text } });
          if (options.sendFails) throw new Error("timeout");
        },
      }),
  };
}
const phone = "+5511999999999";
test("login global envia seis dígitos apenas pela plataforma", async () => {
  const f = fixture();
  const r = await f.run({ action: "request", destination: phone });
  assert.equal(r.status, 200);
  const sent = f.calls.find((c) => c.name === "send")?.args as { instance: string; text: string };
  assert.equal(sent.instance, "plataforma");
  assert.match(sent.text, /\b\d{6}\b/);
  assert.ok(!JSON.stringify(r.body).includes("desafio"));
});
test("número desconhecido recebe mesma resposta sem envio", async () => {
  const a = fixture(),
    b = fixture({ known: false });
  assert.deepEqual(await a.run({ destination: phone }), await b.run({ destination: phone }));
  assert.ok(!b.calls.some((c) => c.name === "send"));
});
test("timeout não distingue conta e invalida código sem reenviar", async () => {
  const a = fixture({ sendFails: true }),
    b = fixture({ known: false });
  assert.deepEqual(await a.run({ destination: phone }), await b.run({ destination: phone }));
  assert.equal(a.calls.filter((c) => c.name === "send").length, 1);
  assert.ok(a.calls.some((c) => c.name === "invalidate"));
});
test("remetente ausente não cria desafio", async () => {
  const f = fixture();
  assert.equal((await f.run({ destination: phone }, "")).status, 503);
  assert.equal(f.calls.length, 0);
});
test("telefone e ação inválidos não chegam ao banco", async () => {
  const f = fixture();
  assert.equal((await f.run({ destination: "11999999999" })).status, 400);
  assert.equal((await f.run({ action: "delete", destination: phone })).status, 400);
  assert.equal(f.calls.length, 0);
});
test("limite do banco resulta em 429 sem enviar", async () => {
  const f = fixture({ rpcError: "WA_RATE_LIMIT" });
  assert.equal((await f.run({ destination: phone })).status, 429);
  assert.ok(!f.calls.some((c) => c.name === "send"));
});
test("migration ausente falha fechada", async () => {
  const f = fixture({ rpcError: "função ausente" });
  assert.equal((await f.run({ destination: phone })).status, 503);
});
test("código incorreto não gera link", async () => {
  const f = fixture({ valid: false });
  assert.equal((await f.run({ action: "verify", destination: phone, code: "123456" })).status, 400);
  assert.ok(!f.calls.some((c) => c.name === "generateLink"));
});
test("número desvinculado depois do pedido não autentica", async () => {
  const f = fixture({ held: false });
  assert.equal((await f.run({ action: "verify", destination: phone, code: "123456" })).status, 400);
  assert.ok(!f.calls.some((c) => c.name === "generateLink"));
});
test("conta bloqueada não recebe sessão", async () => {
  const f = fixture({ banned: true });
  assert.equal((await f.run({ action: "verify", destination: phone, code: "123456" })).status, 400);
  assert.ok(!f.calls.some((c) => c.name === "generateLink"));
});
test("acerto entrega só hash para autenticação nativa", async () => {
  const f = fixture();
  const r = await f.run({ action: "verify", destination: phone, code: "123456" });
  assert.deepEqual(r, { status: 200, body: { ok: true, hashed_token: "hash-ficticio" } });
  assert.equal(
    (f.calls.find((c) => c.name === "generateLink")?.args as { type: string }).type,
    "magiclink",
  );
});
test("falha de sessão não expõe e-mail nem detalhes internos", async () => {
  const f = fixture({ linkFails: true });
  const r = await f.run({ action: "verify", destination: phone, code: "123456" });
  assert.equal(r.status, 503);
  assert.ok(!JSON.stringify(r).includes("example.invalid"));
});

test("sessão deve pertencer à mesma conta cujo telefone foi confirmado", async () => {
  const f = fixture({ differentAccount: true });
  const r = await f.run({ action: "verify", destination: phone, code: "123456" });
  assert.equal(r.status, 503);
  assert.ok(!("hashed_token" in r.body));
});
