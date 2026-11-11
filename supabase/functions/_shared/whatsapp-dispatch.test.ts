import { sendWhatsapp } from "./whatsapp-send.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

function fixture(
  options: {
    state?: string;
    stateError?: boolean;
    sendError?: boolean;
    providerId?: boolean;
    prepare?: boolean;
    migrationError?: boolean;
    completionError?: boolean;
  } = {},
) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  let handler!: (req: Request) => Promise<Response>;
  const source = readFileSync(
    new URL("../whatsapp-dispatch/index.ts", import.meta.url),
    "utf8",
  ).replace(/^import .*;\n/gm, "");
  const client = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "process_whatsapp_return_notices" && options.migrationError)
        return { error: { message: "ausente" } };
      if (name === "claim_whatsapp_outbox")
        return { data: [{ id: "mensagem", attempts: 1, lease_token: "posse" }] };
      if (name === "whatsapp_send_candidate") return { data: { instance_name: "principal-fixo" } };
      if (name === "authorize_whatsapp_send")
        return {
          data:
            options.prepare === false
              ? null
              : {
                  attempt_id: "tentativa",
                  instance_name: "principal-fixo",
                  to_e164: "+5511999999999",
                  body: "Aviso fictício",
                },
        };
      if (name === "finish_whatsapp_send" && options.completionError)
        return { error: { message: "banco indisponível" } };
      return { data: null, error: null };
    },
  };
  const evolutionFetch = async (name: string) => {
    calls.push({ name });
    if (name.includes("connectionState")) {
      if (options.stateError) throw new Error("rede");
      return { instance: { state: options.state ?? "open" } };
    }
    if (options.sendError) throw new Error("timeout após aceite possível");
    return options.providerId === false ? {} : { key: { id: "aceite-ficticio" } };
  };
  new Function(
    "createClient",
    "sendAuthorizedWhatsapp",
    "digitsOnlyPhone",
    "corsHeaders",
    "json",
    "fetch",
    "Deno",
    stripTypeScriptTypes(source),
  )(
    () => client,
    (db: never, input: never) => sendWhatsapp(db, input, evolutionFetch),
    (p: string) => p.replace(/\D/g, ""),
    {},
    (b: unknown, s = 200) => Response.json(b, { status: s }),
    async () => Response.json({}),
    {
      env: {
        get: (key: string) =>
          key === "SUPABASE_URL" ? "https://example.invalid" : "segredo-ficticio",
      },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  );
  return {
    calls,
    run: (authorized = true) =>
      handler(
        new Request("https://example.invalid", {
          method: "POST",
          headers: authorized ? { Authorization: "Bearer segredo-ficticio" } : {},
        }),
      ),
  };
}

test("despacho exige autenticação do worker antes de qualquer RPC", async () => {
  const f = fixture();
  assert.equal((await f.run(false)).status, 401);
  assert.equal(f.calls.length, 0);
});
test("migration ausente impede consumir a fila", async () => {
  const f = fixture({ migrationError: true });
  assert.equal((await f.run()).status, 503);
  assert.ok(!f.calls.some((c) => c.name === "claim_whatsapp_outbox"));
});
test("um único envio usa somente a rota preparada no banco", async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 200);
  assert.deepEqual(
    f.calls.filter((c) => c.name.includes("/message/")),
    [{ name: "/message/sendText/principal-fixo" }],
  );
  assert.equal(
    f.calls.find((c) => c.name === "finish_whatsapp_send")?.args?.p_provider_id,
    "aceite-ficticio",
  );
});
test("consentimento ou agendamento recusado pelo banco não chama Evolution", async () => {
  const f = fixture({ prepare: false });
  await f.run();
  assert.ok(!f.calls.some((c) => c.name.startsWith("/message/")));
});
for (const options of [
  { state: "close" },
  { state: "connecting" },
  { state: "blocked" },
  { stateError: true },
]) {
  test(`pré-conferência indisponível adia sem envio: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await f.run();
    assert.ok(f.calls.some((c) => c.name === "defer_whatsapp_send"));
    assert.ok(!f.calls.some((c) => c.name.includes("/message/")));
  });
}
for (const options of [{ sendError: true }, { providerId: false }]) {
  test(`resultado incerto não faz retry nem escolhe reserva: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await f.run();
    assert.equal(f.calls.filter((c) => c.name.includes("/message/")).length, 1);
    assert.equal(f.calls.find((c) => c.name === "finish_whatsapp_send")?.args?.p_provider_id, null);
    assert.ok(!f.calls.some((c) => c.name === "defer_whatsapp_send"));
  });
}
test("aceite externo e falha no banco não produzem outro envio", async () => {
  const f = fixture({ completionError: true });
  assert.equal((await f.run()).status, 503);
  assert.equal(f.calls.filter((c) => c.name.includes("/message/")).length, 1);
  assert.equal(f.calls.filter((c) => c.name === "finish_whatsapp_send").length, 1);
});
