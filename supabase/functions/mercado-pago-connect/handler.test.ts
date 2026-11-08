import test from "node:test";
import assert from "node:assert/strict";
import {
  ConnectionError,
  connectionConfigured,
  connectionErrorFromDatabase,
  createConnectionHandler,
  MERCADO_PAGO_APP_ORIGIN,
  MERCADO_PAGO_REDIRECT_URI,
  type ConnectionAttempt,
  type ConnectionConfig,
  type ConnectionDependencies,
  type ConnectionStatus,
  type ConnectionTokens,
  type ReceiverScope,
} from "./handler.ts";

const SHOP = "10000000-0000-4000-8000-000000000001";
const ACTOR = "20000000-0000-4000-8000-000000000001";
const MEMBER = "30000000-0000-4000-8000-000000000001";
const ATTEMPT = "40000000-0000-4000-8000-000000000001";
const OTHER = "50000000-0000-4000-8000-000000000001";
const TARGET = "60000000-0000-4000-8000-000000000001";
const STAFF = "70000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-07T12:00:00Z");
const STATE = "s".repeat(43);
const VERIFIER = "v".repeat(43);
const CODE = "codigo-ficticio-descartavel";
const config: ConnectionConfig = {
  enabled: true,
  clientId: "1234567890",
  clientSecret: "segredo-ficticio-da-aplicacao",
  redirectUri: MERCADO_PAGO_REDIRECT_URI,
  encryptionKey: btoa("k".repeat(32)),
  environment: "test",
};

function request(
  body: unknown,
  options: {
    authorization?: string | null;
    origin?: string | null;
    method?: string;
    contentType?: string;
  } = {},
) {
  const headers = new Headers({ "Content-Type": options.contentType ?? "application/json" });
  if (options.authorization !== null)
    headers.set("Authorization", options.authorization ?? "Bearer sessao-ficticia");
  if (options.origin !== null) headers.set("Origin", options.origin ?? MERCADO_PAGO_APP_ORIGIN);
  return new Request("https://api.invalid/functions/v1/mercado-pago-connect", {
    method: options.method ?? "POST",
    headers,
    ...(!["GET", "OPTIONS"].includes(options.method ?? "POST")
      ? {
          body: JSON.stringify(
            body && typeof body === "object" && !Array.isArray(body)
              ? { receiver_scope: "shop", ...body }
              : body,
          ),
        }
      : {}),
  });
}

function fixture(scope: ReceiverScope = "shop") {
  const calls: string[] = [];
  const writes: {
    begin?: Record<string, unknown>;
    finish?: Record<string, unknown>;
    disconnect?: Record<string, unknown>;
  } = {};
  let status: ConnectionStatus = {
    supported: true,
    can_manage: true,
    connected: false,
    status: "disconnected",
    connection_revision: "0",
    live_mode: null,
    connected_at: null,
    financial_enabled: false,
    management_blocked_reason: null,
    shop_name: "Loja fictícia",
    actor_id: MEMBER,
    receiver_scope: scope,
    staff_id: scope === "professional" ? STAFF : null,
    connection_id: TARGET,
    receiver_name: scope === "professional" ? "Parceiro fictício" : "Loja fictícia",
  };
  let attempt: ConnectionAttempt | null = null;
  let consumed = false;
  const tokens: ConnectionTokens = {
    accessToken: "token-acesso-ficticio",
    refreshToken: "token-renovacao-ficticio",
    expiresIn: 3600,
    userId: "12345",
    scope: "read write offline_access",
    liveMode: false,
  };
  const deps: ConnectionDependencies = {
    config: { ...config },
    async authenticate(authorization) {
      calls.push("authenticate");
      if (authorization !== "Bearer sessao-ficticia") return null;
      return {
        id: ACTOR,
        async getStatus(shopId, receiverScope, staffId) {
          calls.push("status");
          if (
            shopId !== SHOP ||
            receiverScope !== status.receiver_scope ||
            (staffId !== null && staffId !== status.staff_id)
          )
            throw new ConnectionError("mp_connection_not_allowed");
          return { ...status };
        },
      };
    },
    store: {
      async begin(input) {
        calls.push("begin");
        if (input.expectedRevision !== status.connection_revision)
          throw new ConnectionError("mp_connection_conflict");
        writes.begin = input;
        status = {
          ...status,
          connection_revision: String(BigInt(status.connection_revision) + 1n),
          connection_id: input.connectionId,
        };
        attempt = {
          attempt_id: ATTEMPT,
          shop_id: SHOP,
          actor_id: ACTOR,
          verifier_ciphertext: input.verifierCiphertext,
          connection_revision: status.connection_revision,
          environment: input.environment,
          expires_at: new Date(NOW + 600000).toISOString(),
          receiver_scope: input.receiverScope,
          staff_id: input.staffId,
          connection_id: input.connectionId,
        };
        return {
          attempt_id: ATTEMPT,
          connection_revision: status.connection_revision,
          expires_at: attempt.expires_at,
        };
      },
      async consume(input) {
        calls.push("consume");
        if (
          !attempt ||
          consumed ||
          input.stateHash !== "hash-do-state" ||
          input.actorId !== attempt.actor_id
        )
          throw new ConnectionError("mp_connection_state_invalid");
        if (!status.can_manage) throw new ConnectionError("mp_connection_not_allowed");
        consumed = true;
        return { ...attempt };
      },
      async finish(input) {
        calls.push("finish");
        if (!status.can_manage) throw new ConnectionError("mp_connection_not_allowed");
        if (!attempt || attempt.connection_revision !== status.connection_revision)
          throw new ConnectionError("mp_connection_conflict");
        writes.finish = input;
        status = {
          ...status,
          connected: true,
          status: "connected",
          connection_revision: String(BigInt(status.connection_revision) + 1n),
          live_mode: input.liveMode,
          connected_at: new Date(NOW).toISOString(),
        };
        return { ...status };
      },
      async disconnect(input) {
        calls.push("disconnect");
        writes.disconnect = input;
        status = {
          ...status,
          connected: false,
          status: "disconnected",
          connection_revision: String(BigInt(status.connection_revision) + 1n),
          connected_at: null,
          live_mode: null,
        };
        return { ...status };
      },
    },
    crypto: {
      randomUuid: () => TARGET,
      randomState: () => STATE,
      async createPkce() {
        return { verifier: VERIFIER, challenge: "c".repeat(43) };
      },
      async hashState(value) {
        calls.push("hash");
        return value === STATE ? "hash-do-state" : "outro-hash";
      },
      async encrypt(value, binding) {
        calls.push(`encrypt:${binding.purpose}`);
        assert.equal(binding.shopId, SHOP);
        assert.equal(binding.environment, "test");
        assert.equal(binding.receiverScope, status.receiver_scope);
        assert.equal(binding.staffId, status.staff_id);
        assert.equal(binding.targetId, TARGET);
        if (binding.purpose === "oauth-verifier") {
          assert.equal(value, VERIFIER);
          assert.equal(binding.accountId, "pending");
        } else assert.equal(binding.accountId, "12345");
        return `cifra-ficticia-${binding.purpose}`;
      },
      async decrypt(value, binding) {
        calls.push("decrypt");
        assert.equal(value, "cifra-ficticia-oauth-verifier");
        assert.equal(binding.accountId, "pending");
        assert.equal(binding.purpose, "oauth-verifier");
        assert.equal(binding.receiverScope, status.receiver_scope);
        assert.equal(binding.staffId, status.staff_id);
        assert.equal(binding.targetId, TARGET);
        return VERIFIER;
      },
    },
    provider: {
      authorizationUrl: ({ state, challenge }) =>
        `https://auth.mercadopago.com/authorization?state=${state}&code_challenge=${challenge}`,
      async exchangeCode(code, verifier) {
        calls.push("exchange");
        assert.equal(code, CODE);
        assert.equal(verifier, VERIFIER);
        return tokens;
      },
      async getUser(accessToken) {
        calls.push("getUser");
        assert.equal(accessToken, tokens.accessToken);
        return { id: "12345", siteId: "MLB", isTest: true };
      },
    },
    now: () => NOW,
  };
  const handler = createConnectionHandler(deps);
  return {
    deps,
    calls,
    writes,
    tokens,
    handler,
    setStatus(update: Partial<ConnectionStatus>) {
      status = { ...status, ...update };
    },
    setAttempt(update: Partial<ConnectionAttempt>) {
      assert.ok(attempt);
      attempt = { ...attempt, ...update };
    },
    start: () =>
      handler(
        request({
          action: "start",
          receiver_scope: status.receiver_scope,
          shop_id: SHOP,
          connection_revision: status.connection_revision,
        }),
      ),
    complete: () => handler(request({ action: "complete", code: CODE, state: STATE })),
    status: () => status,
  };
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}
async function assertError(response: Response, code: string, status: number) {
  assert.equal(response.status, status);
  assert.equal((await body(response)).error_code, code);
}

test("preflight e método inválido não autenticam nem tocam banco/provedor", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(request({}, { method: "OPTIONS", authorization: null }))).status,
    204,
  );
  await assertError(await f.handler(request({}, { method: "GET" })), "method_not_allowed", 405);
  assert.deepEqual(f.calls, []);
});

test("todas as ações, inclusive complete, exigem sessão verificada", async () => {
  for (const action of ["status", "start", "complete", "disconnect"]) {
    const f = fixture();
    for (const authorization of [null, "Bearer falsa", "Basic falsa"]) {
      await assertError(
        await f.handler(
          request({ action, shop_id: SHOP, code: CODE, state: STATE }, { authorization }),
        ),
        "unauthorized",
        401,
      );
    }
    assert.equal(
      f.calls.some((call) => call !== "authenticate"),
      false,
    );
  }
});

test("status divulga apenas metadados e mantém financeiro desativado", async () => {
  const f = fixture();
  const response = await f.handler(
    request({ action: "status", shop_id: SHOP }, { origin: "https://loja.example" }),
  );
  const result = await body(response);
  assert.equal(result.configured, true);
  assert.equal(result.financial_enabled, false);
  assert.equal(result.actor_id, MEMBER);
  assert.equal(result.environment, "test");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  for (const value of [
    config.clientSecret,
    config.encryptionKey,
    f.tokens.accessToken,
    f.tokens.refreshToken,
  ])
    assert.equal(JSON.stringify(result).includes(value), false);
  assert.deepEqual(f.calls, ["authenticate", "status"]);
});

test("configuração ausente ou malformada fecha OAuth sem chamada externa", async () => {
  const invalid: Partial<ConnectionConfig>[] = [
    { enabled: false },
    { clientId: "" },
    { clientId: "abc" },
    { clientSecret: "" },
    { redirectUri: "https://invasor.example/auth/mercado-pago" },
    { redirectUri: `${MERCADO_PAGO_REDIRECT_URI}?x=1` },
    { encryptionKey: "" },
    { encryptionKey: btoa("k".repeat(31)) },
    { environment: null },
  ];
  for (const update of invalid) {
    const f = fixture();
    Object.assign(f.deps.config, update);
    assert.equal(connectionConfigured(f.deps.config), false);
    assert.equal(
      (await body(await f.handler(request({ action: "status", shop_id: SHOP })))).configured,
      false,
    );
    await assertError(await f.start(), "mp_connection_not_configured", 503);
    await assertError(await f.complete(), "mp_connection_not_configured", 503);
    assert.equal(
      f.calls.includes("begin") || f.calls.includes("consume") || f.calls.includes("exchange"),
      false,
    );
  }
});

test("chave aceita base64 e base64url canônicos de 32 bytes", () => {
  assert.equal(connectionConfigured(config), true);
  assert.equal(
    connectionConfigured({
      ...config,
      encryptionKey: config.encryptionKey.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"),
    }),
    true,
  );
  assert.equal(connectionConfigured({ ...config, encryptionKey: "_".repeat(43) }), false);
});

test("start e complete somente na origem principal, sem retorno arbitrário", async () => {
  for (const action of ["start", "complete"]) {
    for (const origin of [
      null,
      "null",
      "https://loja.example",
      `${MERCADO_PAGO_APP_ORIGIN}.invasor.example`,
    ]) {
      const f = fixture();
      await assertError(
        await f.handler(
          request(
            { action, shop_id: SHOP, connection_revision: "0", code: CODE, state: STATE },
            { origin },
          ),
        ),
        "mp_connection_origin_invalid",
        403,
      );
      assert.equal(
        f.calls.includes("begin") || f.calls.includes("consume") || f.calls.includes("exchange"),
        false,
      );
    }
  }
});

test("start envia ao banco somente hash/PKCE cifrado e revisão explícita", async () => {
  const f = fixture();
  const result = await body(await f.start());
  assert.equal(typeof result.url, "string");
  assert.deepEqual(f.writes.begin, {
    shopId: SHOP,
    actorId: ACTOR,
    stateHash: "hash-do-state",
    verifierCiphertext: "cifra-ficticia-oauth-verifier",
    expectedRevision: "0",
    environment: "test",
    receiverScope: "shop",
    staffId: null,
    connectionId: TARGET,
  });
  assert.equal(JSON.stringify(result).includes(VERIFIER), false);
  assert.equal(JSON.stringify(f.writes.begin).includes(STATE), false);
  assert.equal(f.calls.includes("exchange"), false);
});

test("status de outra loja é negado antes de criar tentativa", async () => {
  const f = fixture();
  await assertError(
    await f.handler(request({ action: "start", shop_id: OTHER, connection_revision: "0" })),
    "mp_connection_not_allowed",
    403,
  );
  assert.equal(f.calls.includes("begin"), false);
});

test("papel sem gestão não inicia nem remove conexão", async () => {
  for (const reason of ["shared_governance", "account_manager", "owner_required"] as const) {
    const f = fixture();
    f.setStatus({ can_manage: false, management_blocked_reason: reason });
    await assertError(await f.start(), "mp_connection_not_allowed", 403);
    await assertError(
      await f.handler(request({ action: "disconnect", shop_id: SHOP, connection_revision: "0" })),
      "mp_connection_not_allowed",
      403,
    );
    assert.equal(f.calls.includes("begin") || f.calls.includes("disconnect"), false);
  }
});

test("revisão ausente, numérica, fora de faixa ou desatualizada não altera conexão", async () => {
  const f = fixture();
  for (const value of [undefined, 0, "-1", "01", "1.2", "9223372036854775808"]) {
    await assertError(
      await f.handler(request({ action: "start", shop_id: SHOP, connection_revision: value })),
      "mp_connection_invalid",
      400,
    );
  }
  await assertError(
    await f.handler(request({ action: "start", shop_id: SHOP, connection_revision: "1" })),
    "mp_connection_conflict",
    409,
  );
  assert.equal(f.calls.includes("begin"), false);
});

test("conexão existente não é sobrescrita por nova autorização", async () => {
  const f = fixture();
  f.setStatus({
    connected: true,
    status: "connected",
    connected_at: new Date(NOW).toISOString(),
    live_mode: false,
  });
  await assertError(await f.start(), "mp_connection_already_connected", 409);
  assert.equal(f.calls.includes("begin"), false);
});

test("conflito no begin não libera URL utilizável", async () => {
  const f = fixture();
  Object.assign(f.deps.store, {
    begin: async () => {
      throw new ConnectionError("mp_connection_conflict");
    },
  });
  const response = await f.start();
  assert.equal(response.status, 409);
  assert.equal((await body(response)).url, undefined);
});

test("complete consome primeiro, valida conta e cifra tokens com contexto", async () => {
  const f = fixture();
  await f.start();
  f.calls.length = 0;
  const result = await body(await f.complete());
  assert.equal(result.connected, true);
  assert.equal(result.shop_id, SHOP);
  assert.equal(result.actor_id, MEMBER);
  assert.equal(result.financial_enabled, false);
  assert.deepEqual(f.calls, [
    "authenticate",
    "hash",
    "consume",
    "decrypt",
    "exchange",
    "getUser",
    "encrypt:access-token",
    "encrypt:refresh-token",
    "finish",
    "status",
  ]);
  assert.deepEqual(f.writes.finish, {
    attemptId: ATTEMPT,
    actorId: ACTOR,
    collectorId: "12345",
    accessTokenCiphertext: "cifra-ficticia-access-token",
    refreshTokenCiphertext: "cifra-ficticia-refresh-token",
    tokenExpiresAt: new Date(NOW + 3600000).toISOString(),
    liveMode: false,
  });
  for (const secret of [CODE, VERIFIER, f.tokens.accessToken, f.tokens.refreshToken]) {
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(f.writes.finish).includes(secret), false);
  }
});

test("repetição e duas conclusões simultâneas trocam o código uma vez", async () => {
  const f = fixture();
  await f.start();
  const results = await Promise.all([f.complete(), f.complete()]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 400]);
  assert.equal(f.calls.filter((call) => call === "exchange").length, 1);
  await assertError(await f.complete(), "mp_connection_state_invalid", 400);
  assert.equal(f.calls.filter((call) => call === "exchange").length, 1);
});

test("complete ignora loja, recebedor e valor enviados pelo navegador", async () => {
  const f = fixture();
  await f.start();
  const result = await body(
    await f.handler(
      request({
        action: "complete",
        code: CODE,
        state: STATE,
        shop_id: OTHER,
        collector_id: "99999",
        amount: 9999,
      }),
    ),
  );
  assert.equal(result.shop_id, SHOP);
  assert.equal(f.writes.finish?.collectorId, "12345");
});

test("state adulterado, desconhecido ou expirado não chama provedor", async () => {
  const f = fixture();
  await f.start();
  for (const state of ["curto", "x".repeat(43), `${STATE} `]) {
    await assertError(
      await f.handler(request({ action: "complete", code: CODE, state })),
      "mp_connection_state_invalid",
      400,
    );
  }
  f.setAttempt({ expires_at: new Date(NOW).toISOString() });
  await assertError(await f.complete(), "mp_connection_state_invalid", 400);
  assert.equal(f.calls.includes("exchange"), false);
});

test("ator divergente e ambiente alterado não podem concluir tentativa", async () => {
  const actor = fixture();
  await actor.start();
  actor.setAttempt({ actor_id: OTHER });
  await assertError(await actor.complete(), "mp_connection_state_invalid", 400);
  assert.equal(actor.calls.includes("exchange"), false);
  const environment = fixture();
  await environment.start();
  environment.setAttempt({ environment: "production" });
  await assertError(await environment.complete(), "mp_connection_environment_mismatch", 409);
  assert.equal(environment.calls.includes("exchange"), false);
});

test("perda de permissão antes do consumo impede troca externa", async () => {
  const f = fixture();
  await f.start();
  f.setStatus({ can_manage: false });
  await assertError(await f.complete(), "mp_connection_not_allowed", 403);
  assert.equal(f.calls.includes("exchange"), false);
});

test("perda de permissão durante OAuth impede persistir e afirmar conexão", async () => {
  const f = fixture();
  await f.start();
  f.deps.provider.exchangeCode = async () => {
    f.setStatus({ can_manage: false });
    return f.tokens;
  };
  await assertError(await f.complete(), "mp_connection_not_allowed", 403);
  assert.equal(f.writes.finish, undefined);
  assert.equal(f.status().connected, false);
});

test("revisão alterada durante OAuth não sobrescreve conexão", async () => {
  const f = fixture();
  await f.start();
  f.deps.provider.exchangeCode = async () => {
    f.setStatus({ connection_revision: "9" });
    return f.tokens;
  };
  await assertError(await f.complete(), "mp_connection_conflict", 409);
  assert.equal(f.writes.finish, undefined);
});

test("timeout após consumo exige nova tentativa e não repete token endpoint", async () => {
  const f = fixture();
  await f.start();
  let requests = 0;
  f.deps.provider.exchangeCode = async () => {
    requests++;
    throw new ConnectionError("mp_connection_provider_unavailable");
  };
  await assertError(await f.complete(), "mp_connection_provider_unavailable", 502);
  await assertError(await f.complete(), "mp_connection_state_invalid", 400);
  assert.equal(requests, 1);
  assert.equal(f.writes.finish, undefined);
});

test("identidade, país e ambiente do recebedor devem coincidir", async () => {
  for (const user of [
    { id: "99999", siteId: "MLB", isTest: true },
    { id: "12345", siteId: "MLA", isTest: true },
    { id: "12345", siteId: "MLB", isTest: false },
  ]) {
    const f = fixture();
    await f.start();
    f.deps.provider.getUser = async () => user as { id: string; siteId: "MLB"; isTest: boolean };
    await assertError(
      await f.complete(),
      user.isTest ? "mp_connection_account_mismatch" : "mp_connection_environment_mismatch",
      409,
    );
    assert.equal(f.writes.finish, undefined);
  }
  const f = fixture();
  await f.start();
  f.deps.provider.exchangeCode = async () => ({ ...f.tokens, liveMode: true });
  await assertError(await f.complete(), "mp_connection_environment_mismatch", 409);
  assert.equal(f.calls.includes("getUser"), false);
});

test("token malformado ou sem renovação não é salvo", async () => {
  for (const update of [
    { refreshToken: "" },
    { accessToken: "" },
    { userId: "abc" },
    { expiresIn: 0 },
    { expiresIn: Infinity },
  ]) {
    const f = fixture();
    await f.start();
    f.deps.provider.exchangeCode = async () => ({ ...f.tokens, ...update });
    await assertError(await f.complete(), "mp_connection_provider_invalid", 502);
    assert.equal(f.writes.finish, undefined);
  }
});

test("erro inesperado e mensagem SQL sensível são sanitizados", async () => {
  const f = fixture();
  await f.start();
  f.deps.provider.exchangeCode = async () => {
    throw new Error(`token=${f.tokens.accessToken};code=${CODE}`);
  };
  const result = await body(await f.complete());
  assert.equal(result.error_code, "internal_error");
  assert.equal(JSON.stringify(result).includes(CODE), false);
  assert.equal(JSON.stringify(result).includes(f.tokens.accessToken), false);
  assert.equal(
    connectionErrorFromDatabase({ code: "22023", message: `segredo=${f.tokens.accessToken}` }).code,
    "internal_error",
  );
  assert.equal(
    connectionErrorFromDatabase({ code: "42501", message: "detalhe" }).code,
    "mp_connection_not_allowed",
  );
  assert.equal(
    connectionErrorFromDatabase({ code: "40001", message: "detalhe" }).code,
    "mp_connection_conflict",
  );
  assert.equal(
    connectionErrorFromDatabase({ message: "mp_connection_state_invalid" }).code,
    "mp_connection_state_invalid",
  );
});

test("disconnect local funciona sem chave MP e não alega revogação global", async () => {
  const f = fixture();
  f.setStatus({
    connected: true,
    status: "connected",
    live_mode: false,
    connected_at: new Date(NOW).toISOString(),
  });
  Object.assign(f.deps.config, { encryptionKey: "", enabled: false });
  const result = await body(
    await f.handler(
      request(
        { action: "disconnect", shop_id: SHOP, connection_revision: "0" },
        { origin: "https://loja.example" },
      ),
    ),
  );
  assert.equal(result.connected, false);
  assert.equal(result.configured, false);
  assert.equal(result.provider_authorization_revoked, false);
  assert.equal(result.financial_enabled, false);
  assert.deepEqual(f.writes.disconnect, {
    shopId: SHOP,
    actorId: ACTOR,
    expectedRevision: "0",
    receiverScope: "shop",
    staffId: null,
  });
  assert.equal(f.calls.includes("exchange") || f.calls.includes("getUser"), false);
});

test("corpos inválidos, grandes e ações financeiras são recusados", async () => {
  const f = fixture();
  for (const value of [
    null,
    [],
    "texto",
    {},
    { action: "pay" },
    { action: "refund" },
    { action: "start", shop_id: "inválido" },
  ]) {
    const response = await f.handler(request(value));
    assert.equal(response.status, 400);
  }
  await assertError(
    await f.handler(request({ action: "status", shop_id: SHOP }, { contentType: "text/plain" })),
    "invalid_request",
    400,
  );
  await assertError(
    await f.handler(request({ action: "complete", code: "x".repeat(17000), state: STATE })),
    "invalid_request",
    400,
  );
  assert.equal(f.calls.includes("begin") || f.calls.includes("consume"), false);
});

test("status inválido do banco não vira conexão falsa ou libera gestão", async () => {
  const f = fixture();
  f.setStatus({ connected: true, status: "disconnected" });
  await assertError(await f.start(), "internal_error", 500);
  assert.equal(f.calls.includes("begin"), false);
});

test("primeira conexão reserva UUID antes de cifrar e de criar a tentativa", async () => {
  const f = fixture();
  f.setStatus({ connection_id: null });
  assert.equal((await f.start()).status, 200);
  assert.equal(f.writes.begin?.connectionId, TARGET);
  assert.equal((await f.complete()).status, 200);
});

test("parceiro independente conecta a própria conta sem informar staff no navegador", async () => {
  const f = fixture("professional");
  assert.equal((await f.start()).status, 200);
  assert.equal(f.writes.begin?.receiverScope, "professional");
  assert.equal(f.writes.begin?.staffId, STAFF);
  const result = await body(await f.complete());
  assert.equal(result.connected, true);
  assert.equal(result.receiver_scope, "professional");
  assert.equal(result.staff_id, STAFF);
  assert.equal(result.connection_id, TARGET);
  assert.equal(result.financial_enabled, false);
});

test("parceiro não conecta nem remove conta da loja ou de outro profissional", async () => {
  const f = fixture("professional");
  for (const action of ["status", "start", "disconnect"]) {
    await assertError(
      await f.handler(
        request({ action, shop_id: SHOP, receiver_scope: "shop", connection_revision: "0" }),
      ),
      "mp_connection_not_allowed",
      403,
    );
    await assertError(
      await f.handler(
        request({
          action,
          shop_id: SHOP,
          receiver_scope: "professional",
          staff_id: OTHER,
          connection_revision: "0",
        }),
      ),
      "mp_connection_not_allowed",
      403,
    );
  }
  assert.equal(f.calls.includes("begin") || f.calls.includes("disconnect"), false);
});

test("chefe não usa escopo profissional para autorizar como o parceiro", async () => {
  const f = fixture();
  await assertError(
    await f.handler(
      request({
        action: "start",
        shop_id: SHOP,
        receiver_scope: "professional",
        staff_id: STAFF,
        connection_revision: "0",
      }),
    ),
    "mp_connection_not_allowed",
    403,
  );
  assert.equal(f.calls.includes("begin"), false);
});

test("complete usa escopo do nonce, apesar de alvo falso no corpo", async () => {
  const f = fixture("professional");
  await f.start();
  const result = await body(
    await f.handler(
      request({
        action: "complete",
        code: CODE,
        state: STATE,
        receiver_scope: "shop",
        staff_id: OTHER,
        connection_id: OTHER,
      }),
    ),
  );
  assert.equal(result.receiver_scope, "professional");
  assert.equal(result.staff_id, STAFF);
  assert.equal(result.connection_id, TARGET);
});

test("disconnect do parceiro conserva alvo derivado e não remove conexão da loja", async () => {
  const f = fixture("professional");
  await f.start();
  await f.complete();
  const result = await body(
    await f.handler(
      request({
        action: "disconnect",
        shop_id: SHOP,
        receiver_scope: "professional",
        connection_revision: f.status().connection_revision,
      }),
    ),
  );
  assert.equal(result.connected, false);
  assert.equal(result.receiver_scope, "professional");
  assert.equal(f.writes.disconnect?.staffId, STAFF);
  assert.equal(f.writes.disconnect?.receiverScope, "professional");
});

test("escopo obrigatório e combinações impossíveis são rejeitados", async () => {
  const f = fixture();
  for (const fields of [
    { receiver_scope: undefined },
    { receiver_scope: "employee" },
    { receiver_scope: "shop", staff_id: STAFF },
  ]) {
    await assertError(
      await f.handler(
        request({ action: "start", shop_id: SHOP, connection_revision: "0", ...fields }),
      ),
      "mp_connection_invalid",
      400,
    );
  }
  assert.equal(f.calls.includes("begin"), false);
});

test("contexto cifrado não pode mudar alvo ou escopo entre início e conclusão", async () => {
  for (const fields of [
    { connection_id: OTHER },
    { receiver_scope: "shop" as const, staff_id: null },
  ]) {
    const f = fixture("professional");
    await f.start();
    f.setAttempt(fields);
    await assertError(await f.complete(), "internal_error", 500);
    assert.equal(f.calls.includes("exchange"), false);
  }
});
