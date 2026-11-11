import test from "node:test";
import assert from "node:assert/strict";
import { sendWhatsapp } from "./whatsapp-send.ts";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const otp = {
  challengeId: "desafio",
  instance: "plataforma",
  codeHash: "verificador",
  text: "Código fictício",
};
const job = { outboxId: "aviso", leaseToken: "posse" };
function fixture(
  options: {
    deny?: boolean;
    dbFail?: boolean;
    timeout?: boolean;
    finishFail?: boolean;
    closed?: boolean;
    noId?: boolean;
  } = {},
) {
  const calls: string[] = [];
  let licensed = false;
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "whatsapp_send_candidate") return { data: { instance_name: "autorizada" } };
      if (name === "authorize_whatsapp_send") {
        if (options.dbFail) return { error: {} };
        if (options.deny || licensed) return { data: null };
        licensed = true;
        return {
          data: {
            attempt_id: "tentativa",
            instance_name: "autorizada",
            to_e164: "+5511999999999",
            body: "Conteúdo do banco",
          },
        };
      }
      if (name === "finish_whatsapp_send" && options.finishFail) throw new Error("indisponível");
      return { error: null };
    },
  };
  const messages: unknown[] = [];
  const transport = async (path: string, init?: RequestInit) => {
    calls.push(path);
    if (path.startsWith("/instance"))
      return { instance: { state: options.closed ? "close" : "open" } };
    messages.push(JSON.parse(String(init?.body)));
    assert.ok(init?.signal, "transmissão sempre tem prazo");
    if (options.timeout) throw new Error("pode ter sido aceito");
    return options.noId ? {} : { key: { id: "aceite" } };
  };
  return {
    calls,
    messages,
    run: (input = otp as typeof otp | typeof job) => sendWhatsapp(db, input, transport),
  };
}
test("pausa/consentimento alterado durante a consulta de conexão bloqueia os dois emissores", async () => {
  for (const input of [otp, job]) {
    const f = fixture({ deny: true });
    await f.run(input);
    assert.equal(f.messages.length, 0);
    assert.ok(
      f.calls.indexOf("authorize_whatsapp_send") >
        f.calls.findIndex((c) => c.startsWith("/instance")),
    );
  }
});
test("autorizador indisponível falha fechado", async () => {
  const f = fixture({ dbFail: true });
  await assert.rejects(f.run(), /WA_AUTHORIZATION_UNAVAILABLE/);
  assert.equal(f.messages.length, 0);
});
test("destino e texto do aviso vêm do banco; o emissor não escolhe outro número", async () => {
  const f = fixture();
  assert.equal((await f.run(job)).state, "accepted");
  assert.deepEqual(f.messages, [{ number: "5511999999999", text: "Conteúdo do banco" }]);
});
test("duas execuções do mesmo desafio não duplicam transmissão", async () => {
  const f = fixture();
  await Promise.all([f.run(), f.run()]);
  assert.equal(f.messages.length, 1);
});
for (const options of [{ timeout: true }, { noId: true }, { finishFail: true }])
  test(`incerteza preservada, sem retry: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    const first = await f.run();
    await f.run();
    assert.equal(f.messages.length, 1);
    assert.equal(first.state, options.finishFail ? "accepted" : "unknown");
    assert.equal(first.recorded, !options.finishFail);
    assert.ok(!f.calls.includes("defer_whatsapp_send"));
  });
test("conexão indisponível não transmite e adia somente aviso ainda não transmitido", async () => {
  const f = fixture({ closed: true });
  await f.run(job);
  assert.equal(f.messages.length, 0);
  assert.ok(f.calls.includes("defer_whatsapp_send"));
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
