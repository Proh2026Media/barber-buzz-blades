/** Conexão da loja ou do parceiro independente; não cria cobranças ou devoluções. */
export const MERCADO_PAGO_APP_ORIGIN = "https://beauty.contheiner.digital";
export const MERCADO_PAGO_REDIRECT_URI = `${MERCADO_PAGO_APP_ORIGIN}/auth/mercado-pago`;

export type Environment = "test" | "production";
export type ReceiverScope = "shop" | "professional";
export type ConnectionConfig = Readonly<{
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  environment: Environment | null;
}>;
export type ConnectionStatus = Readonly<{
  supported: boolean;
  can_manage: boolean;
  connected: boolean;
  status: "connected" | "disconnected";
  connection_revision: string;
  live_mode: boolean | null;
  connected_at: string | null;
  financial_enabled: false;
  management_blocked_reason: "shared_governance" | "account_manager" | "owner_required" | null;
  shop_name: string;
  /** Vínculo shop_members para navegar à loja; não é o UUID de autenticação. */
  actor_id: string | null;
  receiver_scope: ReceiverScope;
  staff_id: string | null;
  connection_id: string | null;
  receiver_name: string;
}>;
export type SecretBinding = Readonly<{
  shopId: string;
  accountId: string;
  purpose: "oauth-verifier" | "access-token" | "refresh-token";
  environment: Environment;
  receiverScope: ReceiverScope;
  staffId: string | null;
  targetId: string;
}>;
export type ConnectionAttempt = Readonly<{
  attempt_id: string;
  shop_id: string;
  actor_id: string;
  verifier_ciphertext: string;
  connection_revision: string;
  environment: Environment;
  expires_at: string;
  receiver_scope: ReceiverScope;
  staff_id: string | null;
  connection_id: string;
}>;
export type ConnectionTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  scope: string;
  liveMode: boolean;
}>;
export type ConnectionStore = Readonly<{
  begin(input: {
    shopId: string;
    actorId: string;
    stateHash: string;
    verifierCiphertext: string;
    expectedRevision: string;
    environment: Environment;
    receiverScope: ReceiverScope;
    staffId: string | null;
    connectionId: string;
  }): Promise<unknown>;
  consume(input: { stateHash: string; actorId: string }): Promise<ConnectionAttempt>;
  finish(input: {
    attemptId: string;
    actorId: string;
    collectorId: string;
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    tokenExpiresAt: string;
    liveMode: boolean;
  }): Promise<unknown>;
  disconnect(input: {
    shopId: string;
    actorId: string;
    expectedRevision: string;
    receiverScope: ReceiverScope;
    staffId: string | null;
  }): Promise<unknown>;
}>;
export type ConnectionDependencies = Readonly<{
  config: ConnectionConfig;
  authenticate(authorization: string): Promise<{
    id: string;
    getStatus(
      shopId: string,
      receiverScope: ReceiverScope,
      staffId: string | null,
    ): Promise<ConnectionStatus>;
  } | null>;
  store: ConnectionStore;
  crypto: {
    randomUuid(): string;
    randomState(): string;
    createPkce(): Promise<{ verifier: string; challenge: string }>;
    hashState(value: string): Promise<string>;
    encrypt(value: string, binding: SecretBinding): Promise<string>;
    decrypt(value: string, binding: SecretBinding): Promise<string>;
  };
  provider: {
    authorizationUrl(input: { state: string; challenge: string }): string;
    exchangeCode(code: string, verifier: string): Promise<ConnectionTokens>;
    getUser(accessToken: string): Promise<{ id: string; siteId: "MLB"; isTest: boolean }>;
  };
  now(): number;
}>;

const errors = {
  method_not_allowed: [405, "Use uma solicitação POST."],
  invalid_request: [400, "Não foi possível ler a solicitação."],
  unauthorized: [401, "Entre novamente para continuar."],
  mp_connection_origin_invalid: [403, "Abra a conexão pela entrada principal do aplicativo."],
  mp_connection_not_configured: [503, "A conexão com o Mercado Pago ainda não foi configurada."],
  mp_connection_not_allowed: [403, "Você não pode alterar esta conexão."],
  mp_connection_conflict: [409, "A conexão mudou. Atualize a página e tente novamente."],
  mp_connection_already_connected: [409, "Já existe uma conta conectada para este recebimento."],
  mp_connection_invalid: [400, "Confira os dados da solicitação e tente novamente."],
  mp_connection_state_invalid: [
    400,
    "Esta tentativa expirou ou já foi utilizada. Inicie uma nova conexão.",
  ],
  mp_connection_account_mismatch: [409, "A conta recebida não corresponde à conexão iniciada."],
  mp_connection_environment_mismatch: [409, "A conta não corresponde ao ambiente configurado."],
  mp_connection_provider_rejected: [
    502,
    "O Mercado Pago recusou esta conexão. Inicie uma nova tentativa.",
  ],
  mp_connection_provider_unavailable: [
    502,
    "Não foi possível confirmar a conexão com o Mercado Pago. Inicie uma nova tentativa.",
  ],
  mp_connection_provider_invalid: [502, "Não foi possível validar a conta do Mercado Pago."],
  internal_error: [500, "Não foi possível concluir a conexão. Tente novamente."],
} as const;
export type ConnectionErrorCode = keyof typeof errors;

export class ConnectionError extends Error {
  readonly code: ConnectionErrorCode;
  constructor(code: ConnectionErrorCode) {
    super(code);
    this.name = "ConnectionError";
    this.code = code;
  }
}

/** Não devolve mensagens SQL/HTTP, corpos do provedor, códigos OAuth ou tokens. */
export function connectionErrorFromDatabase(error: {
  code?: unknown;
  message?: unknown;
}): ConnectionError {
  const code = error.message;
  if (
    typeof code === "string" &&
    code.startsWith("mp_connection_") &&
    Object.hasOwn(errors, code)
  ) {
    return new ConnectionError(code as ConnectionErrorCode);
  }
  if (error.code === "42501") return new ConnectionError("mp_connection_not_allowed");
  if (error.code === "40001") return new ConnectionError("mp_connection_conflict");
  return new ConnectionError("internal_error");
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/json; charset=utf-8",
};
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers });
}
function fail(code: ConnectionErrorCode): Response {
  const [status, message] = errors[code];
  return json({ ok: false, error_code: code, message }, status);
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function shopId(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw new ConnectionError("mp_connection_invalid");
  return value.toLowerCase();
}
function revision(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d{0,18})$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw new ConnectionError("mp_connection_invalid");
  }
  return value;
}
function safeText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) <= 0x20 || character.charCodeAt(0) === 0x7f,
    )
  );
}

function validReceiver(scope: unknown, staffId: unknown): boolean {
  return scope === "shop"
    ? staffId === null
    : scope === "professional" && typeof staffId === "string" && uuidPattern.test(staffId);
}

export function connectionConfigured(config: ConnectionConfig): boolean {
  if (
    !config.enabled ||
    !/^[1-9]\d{0,19}$/.test(config.clientId) ||
    !safeText(config.clientSecret, 4096) ||
    config.redirectUri !== MERCADO_PAGO_REDIRECT_URI ||
    !["test", "production"].includes(config.environment ?? "")
  )
    return false;
  try {
    // Mesma representação aceita pelo helper AES-GCM: 32 bytes, base64 ou base64url canônica.
    const raw = config.encryptionKey;
    if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(raw)) return false;
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const bytes = atob(`${normalized}=`);
    return bytes.length === 32 && btoa(bytes).replace(/=+$/, "") === normalized;
  } catch {
    return false;
  }
}

function publicStatus(status: ConnectionStatus, config: ConnectionConfig): Record<string, unknown> {
  if (
    typeof status?.supported !== "boolean" ||
    typeof status.can_manage !== "boolean" ||
    typeof status.connected !== "boolean" ||
    !["connected", "disconnected"].includes(status.status) ||
    status.connected !== (status.status === "connected") ||
    status.financial_enabled !== false ||
    ![null, "shared_governance", "account_manager", "owner_required"].includes(
      status.management_blocked_reason,
    ) ||
    typeof status.shop_name !== "string" ||
    typeof status.receiver_name !== "string" ||
    ![null, true, false].includes(status.live_mode) ||
    !validReceiver(status.receiver_scope, status.staff_id) ||
    (status.connection_id !== null &&
      (typeof status.connection_id !== "string" || !uuidPattern.test(status.connection_id))) ||
    (status.connected &&
      (!status.connection_id || status.live_mode === null || status.connected_at === null)) ||
    (status.actor_id !== null &&
      (typeof status.actor_id !== "string" || !uuidPattern.test(status.actor_id))) ||
    (status.connected_at !== null &&
      (typeof status.connected_at !== "string" ||
        !Number.isFinite(Date.parse(status.connected_at))))
  ) {
    throw new ConnectionError("internal_error");
  }
  const connectionRevision = revision(status.connection_revision);
  return {
    ok: true,
    supported: status.supported,
    can_manage: status.can_manage,
    configured: connectionConfigured(config),
    connected: status.connected,
    status: status.status,
    connection_revision: connectionRevision,
    live_mode: status.live_mode,
    connected_at: status.connected_at,
    financial_enabled: false,
    management_blocked_reason: status.management_blocked_reason,
    shop_name: status.shop_name,
    actor_id: status.actor_id,
    receiver_scope: status.receiver_scope,
    staff_id: status.staff_id,
    connection_id: status.connection_id,
    receiver_name: status.receiver_name,
    environment: config.environment,
  };
}

async function requestBody(req: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") ?? ""))
    throw new ConnectionError("invalid_request");
  if (Number(req.headers.get("Content-Length")) > 16384 || !req.body)
    throw new ConnectionError("invalid_request");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        throw new ConnectionError("invalid_request");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("objeto necessário");
    return value as Record<string, unknown>;
  } catch {
    throw new ConnectionError("invalid_request");
  } finally {
    reader.releaseLock();
  }
}

export function createConnectionHandler(
  deps: ConnectionDependencies,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return fail("method_not_allowed");
    try {
      const authorization = req.headers.get("Authorization") ?? "";
      if (!/^Bearer [^\s]+$/i.test(authorization) || authorization.length > 16384)
        return fail("unauthorized");
      const actor = await deps.authenticate(authorization);
      if (!actor || !uuidPattern.test(actor.id)) return fail("unauthorized");
      const body = await requestBody(req);
      const action = body.action;
      if (!["status", "start", "complete", "disconnect"].includes(String(action)))
        return fail("invalid_request");

      if (action === "complete") {
        if (req.headers.get("Origin") !== MERCADO_PAGO_APP_ORIGIN)
          return fail("mp_connection_origin_invalid");
        if (!connectionConfigured(deps.config)) return fail("mp_connection_not_configured");
        if (
          !safeText(body.code, 4096) ||
          typeof body.state !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(body.state)
        )
          return fail("mp_connection_state_invalid");

        // O banco confere ator/permissão/revisão/TTL e consome o nonce ANTES de qualquer chamada externa.
        const attempt = await deps.store.consume({
          actorId: actor.id,
          stateHash: await deps.crypto.hashState(body.state),
        });
        if (
          !uuidPattern.test(attempt?.attempt_id) ||
          !uuidPattern.test(attempt.shop_id) ||
          !uuidPattern.test(attempt.connection_id) ||
          !validReceiver(attempt.receiver_scope, attempt.staff_id) ||
          attempt.actor_id !== actor.id ||
          !Number.isFinite(Date.parse(attempt.expires_at)) ||
          Date.parse(attempt.expires_at) <= deps.now()
        )
          return fail("mp_connection_state_invalid");
        if (attempt.environment !== deps.config.environment)
          return fail("mp_connection_environment_mismatch");
        const binding: SecretBinding = {
          shopId: attempt.shop_id,
          accountId: "pending",
          purpose: "oauth-verifier",
          environment: attempt.environment,
          receiverScope: attempt.receiver_scope,
          staffId: attempt.staff_id,
          targetId: attempt.connection_id,
        };
        const verifier = await deps.crypto.decrypt(attempt.verifier_ciphertext, binding);
        const tokens = await deps.provider.exchangeCode(body.code, verifier);
        if (
          !safeText(tokens.accessToken, 4096) ||
          !safeText(tokens.refreshToken, 4096) ||
          !/^[1-9]\d{0,19}$/.test(tokens.userId) ||
          !Number.isSafeInteger(tokens.expiresIn) ||
          tokens.expiresIn <= 0 ||
          tokens.expiresIn > 366 * 24 * 60 * 60
        )
          return fail("mp_connection_provider_invalid");
        if (tokens.liveMode !== (attempt.environment === "production"))
          return fail("mp_connection_environment_mismatch");
        const tokenExpiresAt = new Date(deps.now() + tokens.expiresIn * 1000).toISOString();
        const user = await deps.provider.getUser(tokens.accessToken);
        if (user.id !== tokens.userId || user.siteId !== "MLB")
          return fail("mp_connection_account_mismatch");
        if (user.isTest !== (attempt.environment === "test"))
          return fail("mp_connection_environment_mismatch");

        // Novamente no banco: só persiste se a autorização e a revisão continuam válidas.
        const tokenBinding = { ...binding, accountId: user.id };
        const accessTokenCiphertext = await deps.crypto.encrypt(tokens.accessToken, {
          ...tokenBinding,
          purpose: "access-token",
        });
        const refreshTokenCiphertext = await deps.crypto.encrypt(tokens.refreshToken, {
          ...tokenBinding,
          purpose: "refresh-token",
        });
        await deps.store.finish({
          attemptId: attempt.attempt_id,
          actorId: actor.id,
          collectorId: user.id,
          accessTokenCiphertext,
          refreshTokenCiphertext,
          tokenExpiresAt,
          liveMode: tokens.liveMode,
        });
        const status = await actor.getStatus(
          attempt.shop_id,
          attempt.receiver_scope,
          attempt.staff_id,
        );
        if (
          !status.connected ||
          status.connection_id !== attempt.connection_id ||
          status.receiver_scope !== attempt.receiver_scope ||
          status.staff_id !== attempt.staff_id
        )
          return fail("mp_connection_conflict");
        return json({ ...publicStatus(status, deps.config), shop_id: attempt.shop_id });
      }

      const id = shopId(body.shop_id);
      if (body.receiver_scope !== "shop" && body.receiver_scope !== "professional")
        return fail("mp_connection_invalid");
      const receiverScope = body.receiver_scope;
      const requestedStaffId =
        body.staff_id === null || body.staff_id === undefined ? null : shopId(body.staff_id);
      if (receiverScope === "shop" && requestedStaffId !== null)
        return fail("mp_connection_invalid");
      // Sem staff_id no navegador, a RPC resolve o parceiro da sessão; um ID explícito nunca concede acesso.
      const status = await actor.getStatus(id, receiverScope, requestedStaffId);
      if (
        status.receiver_scope !== receiverScope ||
        (requestedStaffId !== null && requestedStaffId !== status.staff_id)
      )
        return fail("internal_error");
      const safeStatus = publicStatus(status, deps.config);
      if (action === "status") return json(safeStatus);
      if (!status.can_manage) return fail("mp_connection_not_allowed");
      const expectedRevision = revision(body.connection_revision);
      if (expectedRevision !== status.connection_revision) return fail("mp_connection_conflict");

      if (action === "disconnect") {
        await deps.store.disconnect({
          shopId: id,
          actorId: actor.id,
          expectedRevision,
          receiverScope,
          staffId: status.staff_id,
        });
        const after = await actor.getStatus(id, receiverScope, status.staff_id);
        if (after.connected) return fail("mp_connection_conflict");
        // Apenas remoção local. Não afirma revogação global da autorização no Mercado Pago.
        return json({ ...publicStatus(after, deps.config), provider_authorization_revoked: false });
      }

      if (req.headers.get("Origin") !== MERCADO_PAGO_APP_ORIGIN)
        return fail("mp_connection_origin_invalid");
      if (!connectionConfigured(deps.config)) return fail("mp_connection_not_configured");
      if (!status.supported) return fail("mp_connection_not_allowed");
      if (status.connected) return fail("mp_connection_already_connected");
      const environment = deps.config.environment!;
      const connectionId = status.connection_id ?? deps.crypto.randomUuid();
      if (!uuidPattern.test(connectionId)) return fail("internal_error");
      const state = deps.crypto.randomState();
      const pkce = await deps.crypto.createPkce();
      const url = deps.provider.authorizationUrl({ state, challenge: pkce.challenge });
      const verifierCiphertext = await deps.crypto.encrypt(pkce.verifier, {
        shopId: id,
        accountId: "pending",
        purpose: "oauth-verifier",
        environment,
        receiverScope,
        staffId: status.staff_id,
        targetId: connectionId,
      });
      await deps.store.begin({
        shopId: id,
        actorId: actor.id,
        stateHash: await deps.crypto.hashState(state),
        verifierCiphertext,
        expectedRevision,
        environment,
        receiverScope,
        staffId: status.staff_id,
        connectionId,
      });
      return json({ ok: true, url });
    } catch (error) {
      return fail(error instanceof ConnectionError ? error.code : "internal_error");
    }
  };
}
