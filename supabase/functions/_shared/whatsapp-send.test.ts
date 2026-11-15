import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { inspectProtectedGroup } from "./protected-group.ts";
import { sendWhatsapp } from "./whatsapp-send.ts";
import {
  protectedSendContext,
  protectedSendRead,
  protectedSendAcceptance,
} from "../../tests/helpers/protected-send.ts";
const job = { outboxId: "aviso", leaseToken: "posse" };
function fixture(
  options: {
    deny?: boolean;
    dbFail?: boolean;
    timeout?: boolean;
    finishFail?: boolean;
    closed?: boolean;
    noId?: boolean;
    wrongProof?: boolean;
  } = {},
) {
  const c = protectedSendContext(),
    calls: string[] = [],
    messages: Record<string, unknown>[] = [];
  let licensed = false;
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "whatsapp_group_notice_context")
        return options.dbFail ? { error: true } : { data: c };
      if (name === "authorize_whatsapp_group_notice") {
        if (licensed || options.deny) return { data: null };
        licensed = true;
        return {
          data: {
            ...c,
            attempt_id: "33333333-3333-4333-8333-333333333333",
            body: "Conteúdo do banco",
          },
        };
      }
      if (name === "finish_whatsapp_send" && options.finishFail) throw Error("falha fictícia");
      return { error: null };
    },
  };
  const transport = async (path: string, init?: RequestInit) => {
    calls.push(path);
    assert.ok(!path.startsWith("/message/"));
    if (init?.method !== "POST") {
      if (options.closed) throw Error("conta indisponível");
      return protectedSendRead(path, c);
    }
    const body = JSON.parse(String(init.body));
    messages.push(body);
    assert.ok(init.signal);
    if (options.timeout) throw Error("resultado incerto");
    const accepted = await protectedSendAcceptance(body, c);
    return options.noId
      ? {}
      : options.wrongProof
        ? { ...accepted, groupJid: "outro@g.us" }
        : accepted;
  };
  return { calls, messages, run: (enabled = true) => sendWhatsapp(db, job, transport, enabled) };
}
test("Aviso usa texto do banco e somente JID protegido, nunca destino privado", async () => {
  const f = fixture();
  assert.equal((await f.run()).state, "accepted");
  assert.equal(f.messages[0].groupJid, "55555-77777@g.us");
  assert.equal(f.messages[0].text, "Conteúdo do banco");
  assert.ok(!("number" in f.messages[0]));
  assert.ok(
    f.calls.indexOf("authorize_whatsapp_group_notice") >
      f.calls.findIndex((p) => p.includes("/bcCycle/")),
  );
});
test("Mudança de consentimento após leitura impede transmissão", async () => {
  const f = fixture({ deny: true });
  assert.equal((await f.run()).state, "blocked");
  assert.equal(f.messages.length, 0);
});
test("Autorizador indisponível falha fechado", async () => {
  const f = fixture({ dbFail: true });
  await assert.rejects(() => f.run(), /AUTHORIZATION_UNAVAILABLE/);
  assert.equal(f.messages.length, 0);
});
test("Dupla execução compartilha uma única licença de aviso", async () => {
  const f = fixture();
  await Promise.all([f.run(), f.run()]);
  assert.equal(f.messages.length, 1);
});
for (const options of [
  { timeout: true },
  { noId: true },
  { finishFail: true },
  { wrongProof: true },
])
  test(`Resultado em aberto ou prova inválida não provoca reenvio: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    const first = await f.run();
    await f.run();
    assert.equal(f.messages.length, 1);
    assert.equal(first.state, options.finishFail ? "accepted" : "unknown");
    assert.equal(first.recorded, !options.finishFail);
  });
test("Integração desabilitada ou conta indisponível só adia aviso sem transmissão", async () => {
  for (const mode of ["flag", "conexao"]) {
    const f = fixture({ closed: mode === "conexao" });
    assert.equal((await f.run(mode !== "flag")).state, "blocked");
    assert.equal(f.messages.length, 0);
    assert.ok(f.calls.includes("defer_whatsapp_send"));
  }
});
test("Emissor antigo de código privado permanece bloqueado sem consultar rede", async () => {
  let calls = 0;
  const r = await sendWhatsapp(
    {
      rpc: async () => {
        calls++;
        return {};
      },
    },
    { challengeId: "desafio", instance: "conta", codeHash: "hash", text: "Código" },
    async () => {
      calls++;
      return {};
    },
    true,
  );
  assert.equal(r.state, "blocked");
  assert.equal(calls, 0);
});
test("cliente administrativo rejeita tentativa de ignorar a saída comum", async () => {
  const source = readFileSync(new URL("./evolution.ts", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "")
    .replaceAll("export ", "");
  let network = 0;
  const management = new Function(
    "sendWhatsapp",
    "fetch",
    "Deno",
    stripTypeScriptTypes(source) + "\nreturn evolutionFetch;",
  )(
    sendWhatsapp,
    async () => {
      network++;
      return Response.json({});
    },
    { env: { get: () => "ficticio" } },
  );
  await assert.rejects(management("/message/sendText/teste"), /WA_OUTBOUND_REQUIRED/);
  await assert.rejects(management("/instance/../message/sendText/teste"), /WA_OUTBOUND_REQUIRED/);
  assert.equal(network, 0);
});

for (const change of [
  "contrato anterior",
  "admissão anterior",
  "mensagem anterior",
  "sem recebimento",
] as const) {
  test(`Acolhimento pós-entrada bloqueia envio com ${change}`, async () => {
    const c = protectedSendContext();
    const transport = async (path: string) => {
      const response = protectedSendRead(path, c) as {
        contract?: string;
        cycle?: Record<string, unknown>;
      };
      if (path.includes("/bcCapabilities/") && change === "contrato anterior")
        response.contract = "bc-groups-v3";
      if (path.includes("/bcCycle/") && response.cycle) {
        if (change === "admissão anterior")
          response.cycle.lastWelcomeAdmissionId = "44444444-4444-4444-8444-444444444444";
        if (change === "mensagem anterior")
          response.cycle.lastWelcomeMessageId = "acolhimento-antigo";
        if (change === "sem recebimento") response.cycle.lastWelcomeReceived = false;
      }
      return response;
    };
    assert.equal(await inspectProtectedGroup(transport, c), false);
  });
}
