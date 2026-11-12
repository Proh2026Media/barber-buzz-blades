import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedPushOrigin,
  validPushEndpoint,
  validSubscription,
  deliverWebPush,
  pushMessage,
} from "./web-push.ts";
const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/ficticio",
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
};
test("Push aceita somente endpoints dos serviços previstos", () => {
  assert.ok(validSubscription(sub));
  assert.ok(validPushEndpoint("https://wns2-test.notify.windows.com/?token=ficticio"));
  assert.equal(
    validPushEndpoint("https://wns2-test.notify.windows.com.evil.invalid/?token=x"),
    false,
  );
  for (const url of [
    "http://fcm.googleapis.com/fcm/send/a",
    "https://127.0.0.1/a",
    "https://fcm.googleapis.com.evil.invalid/a",
    "https://user@fcm.googleapis.com/a",
    "https://web.push.apple.com:8080/a",
    "https://web.push.apple.com/a#b",
  ])
    assert.equal(validPushEndpoint(url), false);
  assert.equal(validSubscription({ ...sub, keys: { ...sub.keys, auth: "x" } }), false);
});
test("Origem exige correspondência exata ou subdomínio autorizado", () => {
  const rules = ["https://beauty.example.invalid", "https://*.beauty.example.invalid"];
  assert.ok(allowedPushOrigin("https://loja.beauty.example.invalid", rules));
  for (const url of [
    "https://evilbeauty.example.invalid",
    "https://loja.beauty.example.invalid.evil.invalid",
    "https://loja.beauty.example.invalid/path",
    "http://loja.beauty.example.invalid",
  ])
    assert.equal(allowedPushOrigin(url, rules), false);
});
for (const [status, result] of [
  [200, "accepted"],
  [201, "accepted"],
  [202, "accepted"],
  [404, "gone"],
  [410, "gone"],
  [400, "failed"],
  [429, "failed"],
  [503, "unknown"],
] as const)
  test(`Provedor ${status}: ${result}`, async () => {
    let calls = 0;
    const actual = await deliverWebPush(
      sub,
      () => ({ endpoint: sub.endpoint, headers: { TTL: 300 }, body: new Uint8Array() }),
      async (_url, init) => {
        calls++;
        assert.equal(init?.redirect, "error");
        return new Response(null, { status });
      },
    );
    assert.equal(actual, result);
    assert.equal(calls, 1);
  });
test("Timeout mantém incerteza, sem repetição", async () => {
  let calls = 0;
  assert.equal(
    await deliverWebPush(
      sub,
      () => ({ endpoint: sub.endpoint, headers: {}, body: new Uint8Array() }),
      async () => {
        calls++;
        throw new Error("timeout");
      },
    ),
    "unknown",
  );
  assert.equal(calls, 1);
});
test("Preparação inválida não faz chamada de rede", async () => {
  let calls = 0;
  const network = async () => {
    calls++;
    return new Response(null, { status: 201 });
  };
  assert.equal(
    await deliverWebPush(
      sub,
      () => {
        throw new Error("chave");
      },
      network,
    ),
    "failed",
  );
  assert.equal(
    await deliverWebPush(
      sub,
      () => ({ endpoint: "https://evil.invalid", headers: {}, body: new Uint8Array() }),
      network,
    ),
    "failed",
  );
  assert.equal(calls, 0);
});
test("Payload preserva privacidade e caminhos internos", () => {
  for (const lang of ["pt-BR", "pt-PT", "en-US", "en-GB", "es"])
    for (const kind of ["created", "changed", "cancelled", "test"]) {
      const msg = pushMessage(lang, kind, "https://evil.invalid", "teste");
      assert.ok(!JSON.stringify(msg).includes("B&C"));
      assert.ok(!JSON.stringify(msg).includes("Barba & Cabelo"));
      assert.equal(msg.url, "/app");
      assert.ok(msg.body.length < 200);
      assert.deepEqual(Object.keys(msg).sort(), ["body", "tag", "title", "url"]);
    }
});

test("Push usa a barbearia do contexto e nunca uma marca padrão da plataforma", () => {
  assert.equal(
    pushMessage("pt-BR", "created", "/app", "a", "Arena — Testes").title,
    "Arena — Testes",
  );
  assert.equal(
    pushMessage("pt-BR", "created", "/app", "b", "Outra Barbearia").title,
    "Outra Barbearia",
  );
  assert.equal(pushMessage("pt-BR", "test", "/app", "c", " ").title, "Agendamentos");
  assert.equal(
    pushMessage("pt-BR", "created", "/app", "d", " Arena\n Testes ").title,
    "Arena Testes",
  );
});
