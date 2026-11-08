import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MercadoPagoClient,
  MercadoPagoError,
  amountToCents,
  buildAuthorizationUrl,
  createPkce,
  decryptSecret,
  encryptSecret,
  randomUrlSafe,
  sha256Hex,
  validatePayment,
  verifyWebhookSignature,
} from "./mercado-pago.ts";
import type { MercadoPagoClientConfig, PaymentExpectation, SecretBinding } from "./mercado-pago.ts";

const binding: SecretBinding = {
  shopId: "loja-1",
  targetId: "10000000-0000-4000-8000-000000000001",
  receiverScope: "shop",
  staffId: null,
  accountId: "777",
  purpose: "access-token",
  environment: "test",
};
const key = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)));
const expected: PaymentExpectation = {
  collectorId: "777",
  externalReference: "agendamento-1",
  liveMode: false,
  amountCents: 10001,
};
const payment = {
  id: 123,
  collector_id: 777,
  external_reference: "agendamento-1",
  live_mode: false,
  currency_id: "BRL",
  transaction_amount: "100.01",
  transaction_amount_refunded: 0,
  status: "approved",
  status_detail: "accredited",
};
const tokens = {
  access_token: "token-protegido",
  refresh_token: "refresh-protegido",
  user_id: 777,
  token_type: "bearer",
  expires_in: 15552000,
  scope: "read write offline_access",
  live_mode: false,
};
const config: MercadoPagoClientConfig = {
  clientId: "555",
  clientSecret: "segredo-protegido",
  redirectUri: "https://app.example.com/retorno",
  testMode: true,
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function clientWith(values: Array<unknown | Error | Response>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new MercadoPagoClient({
    ...config,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const value = values.shift();
      if (value instanceof Error) throw value;
      if (value instanceof Response) return value;
      return response(value);
    },
  });
  return { client, calls };
}

test("PKCE usa S256 e state imprevisível; redirect só HTTPS estático", async () => {
  const pkce = await createPkce();
  const second = await createPkce();
  assert.match(pkce.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(pkce.verifier, second.verifier);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pkce.verifier));
  assert.equal(pkce.challenge, Buffer.from(digest).toString("base64url"));
  const args = {
    clientId: "555",
    redirectUri: config.redirectUri,
    state: randomUrlSafe(),
    codeChallenge: pkce.challenge,
  };
  const url = new URL(buildAuthorizationUrl(args));
  assert.equal(url.origin, "https://auth.mercadopago.com");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "read write offline_access");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.throws(() => buildAuthorizationUrl({ ...args, state: "previsivel" }));
  for (const bad of [
    "http://app.example.com/retorno",
    "https://senha@app.example.com",
    "https://app.example.com/#code",
    "https://app.example.com/?outro=1",
  ]) {
    assert.throws(() => buildAuthorizationUrl({ ...args, redirectUri: bad }));
  }
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("AES-GCM autentica loja, conta, finalidade e ambiente com nonce novo", async () => {
  const cipher = await encryptSecret("token-secreto", key, binding);
  assert.match(cipher, /^mp1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{23,}$/);
  assert.equal(await decryptSecret(cipher, key, binding), "token-secreto");
  assert.notEqual(cipher, await encryptSecret("token-secreto", key, binding));
  for (const context of [
    { ...binding, shopId: "loja-2" },
    { ...binding, accountId: "778" },
    { ...binding, purpose: "refresh-token" as const },
    { ...binding, environment: "production" as const },
    { ...binding, targetId: "10000000-0000-4000-8000-000000000002" },
    {
      ...binding,
      receiverScope: "professional" as const,
      staffId: "20000000-0000-4000-8000-000000000001",
    },
  ])
    await assert.rejects(decryptSecret(cipher, key, context), { code: "secret_decryption_failed" });
  const parts = cipher.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  await assert.rejects(decryptSecret(parts.join("."), key, binding), {
    code: "secret_decryption_failed",
  });
  await assert.rejects(decryptSecret("token-cru", key, binding));
  await assert.rejects(encryptSecret("token", btoa("curta"), binding));
  await assert.rejects(encryptSecret("token com espaço", key, binding));
});

test("AES-GCM separa dois parceiros da mesma loja e conta Mercado Pago", async () => {
  const professional: SecretBinding = {
    ...binding,
    receiverScope: "professional",
    staffId: "20000000-0000-4000-8000-000000000001",
  };
  const cipher = await encryptSecret("token-parceiro", key, professional);
  assert.equal(await decryptSecret(cipher, key, professional), "token-parceiro");
  await assert.rejects(
    decryptSecret(cipher, key, {
      ...professional,
      staffId: "20000000-0000-4000-8000-000000000002",
    }),
    { code: "secret_decryption_failed" },
  );
  await assert.rejects(decryptSecret(cipher, key, binding), { code: "secret_decryption_failed" });
  for (const invalid of [
    { ...professional, staffId: null },
    { ...professional, staffId: "colega" },
    { ...binding, staffId: professional.staffId },
    { ...binding, targetId: "" },
  ])
    await assert.rejects(encryptSecret("token", key, invalid), { code: "invalid_input" });
});

async function signedWebhook(ts = "1794052800", dataId = "123", requestId = "requisicao-1") {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const secret = "chave-webhook-para-testes";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)),
  ).toString("hex");
  return {
    url: `https://app.example.com/webhook?data.id=${dataId}&type=payment`,
    xRequestId: requestId,
    xSignature: `ts=${ts},v1=${signature}`,
    secret,
    nowMs: 1794052800000,
  };
}

test("webhook aceita segundos e milissegundos assinados sem alterar manifest", async () => {
  const input = await signedWebhook();
  const checked = await verifyWebhookSignature(input);
  assert.equal(checked.dataId, "123");
  assert.equal(checked.timestampMs, input.nowMs);
  assert.equal(checked.fingerprint, (await verifyWebhookSignature(input)).fingerprint);
  assert.equal(
    (await verifyWebhookSignature(await signedWebhook("1794052800000"))).timestampMs,
    input.nowMs,
  );
});

test("webhook rejeita adulteração, campos ambíguos e replay fora da janela", async () => {
  const input = await signedWebhook();
  for (const changed of [
    { ...input, nowMs: input.nowMs + 300001 },
    { ...input, nowMs: input.nowMs - 300001 },
    { ...input, url: "https://app.example.com/?data.id=124" },
    { ...input, url: "https://app.example.com/?data.id=123&data.id=124" },
    { ...input, url: "https://app.example.com/?id=123" },
    { ...input, xRequestId: "outra-requisicao" },
    { ...input, xRequestId: null },
    { ...input, xSignature: input.xSignature + ",ts=1794052800" },
    { ...input, secret: "outra-chave" },
  ])
    await assert.rejects(verifyWebhookSignature(changed), { code: "invalid_webhook_signature" });
  const dedupe = new Set<string>();
  const first = await verifyWebhookSignature(input);
  dedupe.add(first.fingerprint);
  assert.equal(
    dedupe.has((await verifyWebhookSignature(input)).fingerprint),
    true,
    "replay recente é identificado pela chave persistida pelo chamador",
  );
});

test("centavos não arredondam números indevidos nem aceitam fração extra", () => {
  for (const [input, value] of [
    [0, 0],
    [0.04, 4],
    ["100.01", 10001],
    ["100.1", 10010],
  ] as const)
    assert.equal(amountToCents(input), value);
  for (const invalid of [
    0.001,
    "1.234",
    -1,
    NaN,
    Infinity,
    "1e2",
    " 1.00",
    "01.00",
    "90071992547409.92",
    {},
    null,
  ])
    assert.throws(() => amountToCents(invalid));
});

test("pagamento verifica recebedor, referência, moeda, ambiente, ID e total", () => {
  assert.equal(validatePayment(payment, "123", expected).amountCents, 10001);
  for (const altered of [
    { ...payment, id: 124 },
    { ...payment, collector_id: 778 },
    { ...payment, external_reference: "outra-loja" },
    { ...payment, currency_id: "USD" },
    { ...payment, live_mode: true },
    { ...payment, transaction_amount: "100.02" },
    { ...payment, transaction_amount_refunded: "100.02" },
  ])
    assert.throws(() => validatePayment(altered, "123", expected), { code: "payment_mismatch" });
});

test("OAuth usa POST seguro, PKCE, modo teste e tokens completos", async () => {
  const { client, calls } = clientWith([tokens]);
  const pkce = await createPkce();
  const result = await client.exchangeCode("codigo", pkce.verifier);
  assert.equal(result.userId, "777");
  assert.equal(result.expiresIn, 15552000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.mercadopago.com/oauth/token");
  assert.equal(calls[0].init?.redirect, "error");
  assert.equal(calls[0].init?.referrerPolicy, "no-referrer");
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.code_verifier, pkce.verifier);
  assert.equal(body.test_token, true);
  assert.equal(body.grant_type, "authorization_code");
});

test("refresh devolve ambos os tokens novos; não repete a rotação", async () => {
  const { client, calls } = clientWith([
    { ...tokens, access_token: "novo-access", refresh_token: "novo-refresh" },
  ]);
  const result = await client.refreshTokens("antigo-refresh");
  assert.equal(result.accessToken, "novo-access");
  assert.equal(result.refreshToken, "novo-refresh");
  assert.equal(JSON.parse(String(calls[0].init?.body)).grant_type, "refresh_token");
  assert.equal(calls.length, 1);
});

test("OAuth incompleto, ambiente trocado ou escopo insuficiente não conecta", async () => {
  for (const body of [
    { ...tokens, refresh_token: null },
    { ...tokens, expires_in: 0 },
    { ...tokens, live_mode: true },
    { ...tokens, scope: "read write" },
    { ...tokens, user_id: Number.MAX_SAFE_INTEGER + 1 },
  ])
    await assert.rejects(clientWith([body]).client.refreshTokens("refresh"), {
      code: "invalid_token_response",
      uncertain: true,
    });
});

test("conta recebedora deve ser brasileira e pertencer ao ambiente", async () => {
  assert.deepEqual(
    await clientWith([{ id: 777, site_id: "MLB", tags: ["test_user"] }]).client.getUser("token"),
    { id: "777", siteId: "MLB", isTest: true },
  );
  for (const body of [
    { id: 777, site_id: "MLA", tags: ["test_user"] },
    { id: 777, site_id: "MLB", tags: [] },
    { id: 777, site_id: "MLB" },
  ]) {
    await assert.rejects(clientWith([body]).client.getUser("token"), { code: "account_mismatch" });
  }
});

test("erro do provedor não expõe corpo, credenciais ou causa e não tenta novamente", async () => {
  for (const failure of [
    response({ message: "token-protegido segredo-protegido" }, 503),
    new Error("token-protegido segredo-protegido"),
  ]) {
    const { client, calls } = clientWith([failure]);
    await assert.rejects(client.refreshTokens("refresh-protegido"), (error: unknown) => {
      assert.ok(error instanceof MercadoPagoError);
      assert.equal(error.uncertain, true);
      assert.doesNotMatch(
        String(error) + JSON.stringify(error),
        /token-protegido|segredo-protegido|refresh-protegido/,
      );
      return true;
    });
    assert.equal(calls.length, 1);
  }
});

test("timeout de POST é incerto e dispara abort, sem retry", async () => {
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const client = new MercadoPagoClient({
    ...config,
    timeoutMs: 5,
    fetchImpl: async (_, init) => {
      calls++;
      signal = init?.signal;
      return await new Promise<Response>(() => undefined);
    },
  });
  await assert.rejects(client.refreshTokens("refresh"), {
    code: "request_timeout",
    uncertain: true,
  });
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
});

test("GET financeiro valida conta e não consulta ID fora do formato", async () => {
  const { client, calls } = clientWith([payment]);
  assert.equal((await client.getPayment("token", "123", expected)).status, "approved");
  assert.equal(calls[0].init?.method, "GET");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer token");
  await assert.rejects(client.getPayment("token", "123/../../users/me", expected));
  assert.equal(calls.length, 1);
});

test("reembolso envia centavos exatos e chave estável; não cobra comissão", async () => {
  const { client, calls } = clientWith([
    payment,
    { id: 321, payment_id: 123, amount: 0.04, status: "approved" },
  ]);
  const result = await client.createRefund("token", {
    paymentId: "123",
    amountCents: 4,
    idempotencyKey: "operacao-reembolso-1",
    expected,
  });
  assert.equal(result.amountCents, 4);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init?.method, "GET");
  assert.equal(calls[1].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { amount: 0.04 });
  assert.equal(
    (calls[1].init?.headers as Record<string, string>)["X-Idempotency-Key"],
    "operacao-reembolso-1",
  );
});

test("não reembolsa pagamento pendente, terceiro ou saldo insuficiente", async () => {
  for (const body of [
    { ...payment, status: "pending" },
    { ...payment, status: "authorized" },
    { ...payment, collector_id: 778 },
    { ...payment, transaction_amount_refunded: "100.00" },
  ]) {
    const { client, calls } = clientWith([body]);
    await assert.rejects(
      client.createRefund("token", {
        paymentId: "123",
        amountCents: 4,
        idempotencyKey: "operacao-reembolso-1",
        expected,
      }),
    );
    assert.equal(calls.length, 1, "não enviou POST");
  }
});

test("resposta financeira incoerente ou perdida fica incerta, sem segundo POST", async () => {
  for (const body of [
    { id: 321, payment_id: 124, amount: 0.04, status: "approved" },
    { id: 321, payment_id: 123, amount: 0.05, status: "approved" },
    new Error("conexão perdida depois de enviar"),
    response({}, 503),
    new Response("não é json"),
  ]) {
    const { client, calls } = clientWith([payment, body]);
    await assert.rejects(
      client.createRefund("token", {
        paymentId: "123",
        amountCents: 4,
        idempotencyKey: "operacao-reembolso-1",
        expected,
      }),
      (error: unknown) => error instanceof MercadoPagoError && error.uncertain,
    );
    assert.equal(calls.filter((call) => call.init?.method === "POST").length, 1);
  }
});

test("refund pendente não é convertido em confirmado", async () => {
  const { client } = clientWith([
    payment,
    { id: 321, payment_id: 123, amount: 0.04, status: "pending" },
  ]);
  assert.equal(
    (
      await client.createRefund("token", {
        paymentId: "123",
        amountCents: 4,
        idempotencyKey: "operacao-reembolso-1",
        expected,
      })
    ).status,
    "pending",
  );
});

test("conciliação GET vincula reembolso ao pagamento verificado", async () => {
  const { client, calls } = clientWith([
    payment,
    { id: 321, payment_id: 123, amount: 0.04, status: "approved" },
  ]);
  assert.equal((await client.getRefund("token", "123", "321", expected)).amountCents, 4);
  assert.equal(calls[1].url, "https://api.mercadopago.com/v1/payments/123/refunds/321");
  assert.ok(calls.every((call) => call.init?.method === "GET"));
  await assert.rejects(
    clientWith([
      payment,
      { id: 322, payment_id: 123, amount: 0.04, status: "approved" },
    ]).client.getRefund("token", "123", "321", expected),
    { code: "refund_mismatch" },
  );
});

test("lista de reembolsos não aceita duplicatas, outra transação nem total excedente", async () => {
  const refund = { id: 321, payment_id: 123, amount: 0.04, status: "approved" };
  assert.equal(
    (await clientWith([payment, [refund]]).client.listRefunds("token", "123", expected)).length,
    1,
  );
  for (const body of [
    [refund, refund],
    [{ ...refund, payment_id: 124 }],
    [{ ...refund, amount: 100.02 }],
  ]) {
    await assert.rejects(clientWith([payment, body]).client.listRefunds("token", "123", expected), {
      code: "refund_mismatch",
    });
  }
});
