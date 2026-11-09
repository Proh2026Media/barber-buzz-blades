import test from "node:test";
import assert from "node:assert/strict";
import {
  connectWithPairingCode,
  evolutionQr,
  pairingCode,
  pairingPhone,
  type EvolutionCall,
} from "./whatsapp-pairing.ts";

const PHONE = "5511999990000";
const CODE = "ABCD1234";
function fixture(state: string, responses: unknown[] = []) {
  const calls: { path: string; init?: RequestInit }[] = [];
  const call: EvolutionCall = async (path, init) => {
    calls.push({ path, init });
    if (path.includes("connectionState")) {
      if (state === "missing") throw new Error("404 instance not found");
      return { instance: { state } };
    }
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next ?? {};
  };
  return {
    calls,
    run: (action: "connect" | "pairing-status" = "connect") =>
      connectWithPairingCode(call, "loja/a", PHONE, action, async () => {}),
  };
}

test("telefone exige formato internacional e rejeita entrada arbitrária", () => {
  assert.equal(pairingPhone("+55 (11) 99999-0000"), PHONE);
  for (const value of [
    null,
    123,
    "123456",
    "05511999990000",
    "5511999990000&admin=1",
    "a5511999990000",
    "1".repeat(16),
  ])
    assert.equal(pairingPhone(value), null);
});
test("pareamento aceita oito caracteres, nunca QR cru nem OTP de seis dígitos", () => {
  assert.equal(pairingCode({ pairingCode: "abcd-1234" }), CODE);
  assert.equal(pairingCode({ qrcode: { pairingCode: CODE } }), CODE);
  for (const value of [{ code: CODE }, { pairingCode: "123456" }, { base64: CODE }, null])
    assert.equal(pairingCode(value), null);
});
test("imagem de QR vem apenas do campo base64", () => {
  assert.equal(evolutionQr({ code: "texto-cru-qr" }), null);
  assert.equal(evolutionQr({ base64: "javascript:alert(1)" }), null);
  assert.equal(
    evolutionQr({ qrcode: { base64: "iVBORw0KGgo=" } }),
    "data:image/png;base64,iVBORw0KGgo=",
  );
});
test("sessão conectada não é recriada ou desconectada", async () => {
  const f = fixture("open");
  assert.deepEqual(await f.run(), { status: "open", pairing_code: null });
  assert.equal(f.calls.length, 1);
});
test("tentativa em andamento não é reiniciada nem tem código antigo reaproveitado", async () => {
  const f = fixture("connecting", [{ pairingCode: CODE }]);
  await assert.rejects(f.run(), /PAIRING_IN_PROGRESS/);
  assert.equal(f.calls.length, 1);
});
test("criação recebe o número normalizado e a integração Baileys", async () => {
  const f = fixture("missing", [{ qrcode: { pairingCode: CODE } }]);
  assert.equal((await f.run()).pairing_code, CODE);
  assert.deepEqual(JSON.parse(String(f.calls[1].init?.body)), {
    instanceName: "loja/a",
    integration: "WHATSAPP-BAILEYS",
    number: PHONE,
    qrcode: true,
  });
});
test("instância fechada usa conexão por número e caminho escapado", async () => {
  const f = fixture("close", [{ pairingCode: CODE }]);
  await f.run();
  assert.equal(f.calls[1].path, `/instance/connect/loja%2Fa?number=${PHONE}`);
});
test("código atrasado tem tentativas limitadas", async () => {
  const f = fixture("close", [{}, {}, { pairingCode: CODE }]);
  assert.equal((await f.run()).pairing_code, CODE);
  assert.equal(f.calls.length, 4);
  const empty = fixture("close");
  assert.deepEqual(await empty.run(), { status: "connecting", pairing_code: null });
  assert.equal(empty.calls.length, 4);
});
for (const state of ["missing", "close", "disconnected"])
  test(`consulta ${state} não cria nem conecta`, async () => {
    const f = fixture(state);
    assert.deepEqual(await f.run("pairing-status"), { status: "disconnected", pairing_code: null });
    assert.equal(f.calls.length, 1);
  });
test("consulta atualiza código sem recriar instância", async () => {
  const f = fixture("connecting", [{ pairingCode: CODE }]);
  assert.equal((await f.run("pairing-status")).pairing_code, CODE);
  assert.equal(f.calls.length, 2);
});
test("abertura detectada durante conexão remove código", async () => {
  const f = fixture("close", [{ instance: { state: "open" }, pairingCode: CODE }]);
  assert.deepEqual(await f.run(), { status: "open", pairing_code: null });
});
test("erros do provedor não vazam conteúdo da sessão", async () => {
  const f = fixture("close", [new Error("resposta privada fictícia")]);
  await assert.rejects(f.run(), { message: "PAIRING_UNAVAILABLE" });
});
test("telefone inválido não faz chamada remota", async () => {
  let called = false;
  await assert.rejects(
    connectWithPairingCode(
      async () => {
        called = true;
      },
      "a",
      "123",
      "connect",
    ),
    /PAIRING_PHONE_INVALID/,
  );
  assert.equal(called, false);
});
