/**
 * Contrato Mercado Pago (Preferences/Payments), sem configuração global ou ativação financeira.
 * OAuth: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/creation
 * Webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications
 * O chamador mantém permissões, consumo único de state, locks, ledger e conciliação persistente.
 */
const API_ORIGIN = "https://api.mercadopago.com";
const encoder = new TextEncoder();

export class MercadoPagoError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly uncertain: boolean;

  constructor(code: string, status?: number, uncertain = false) {
    super(`Mercado Pago: ${code}`);
    this.name = "MercadoPagoError";
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
  }
}

function invalid(): never {
  throw new MercadoPagoError("invalid_input");
}

function text(value: unknown, max = 4096): string {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    invalid();
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function numericId(value: unknown): string {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0)) invalid();
  const id = String(value);
  if (!/^[1-9]\d{0,19}$/.test(id)) invalid();
  return id;
}

function bytesBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) invalid();
  const binary = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4),
  );
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (bytesBase64Url(bytes) !== value) invalid();
  return bytes;
}

export function randomUrlSafe(bytes = 32): string {
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > 64) invalid();
  return bytesBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomUrlSafe();
  return {
    verifier,
    challenge: bytesBase64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))),
    ),
  };
}

function redirectUri(value: string): string {
  try {
    const url = new URL(text(value, 2048));
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search)
      invalid();
    return value;
  } catch {
    return invalid();
  }
}

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  if (
    !/^[A-Za-z0-9_-]{43,128}$/.test(input.state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)
  )
    invalid();
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.search = new URLSearchParams({
    client_id: numericId(input.clientId),
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri(input.redirectUri),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    scope: "read write offline_access",
  }).toString();
  return url.href;
}

export type SecretBinding = Readonly<{
  shopId: string;
  targetId: string;
  receiverScope: "shop" | "professional";
  staffId: string | null;
  accountId: string;
  purpose: "oauth-verifier" | "access-token" | "refresh-token";
  environment: "test" | "production";
}>;

function secretAad(binding: SecretBinding): Uint8Array<ArrayBuffer> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !["oauth-verifier", "access-token", "refresh-token"].includes(binding.purpose) ||
    !["test", "production"].includes(binding.environment) ||
    !uuid.test(binding.targetId) ||
    !(binding.receiverScope === "shop"
      ? binding.staffId === null
      : binding.receiverScope === "professional" &&
        typeof binding.staffId === "string" &&
        uuid.test(binding.staffId))
  )
    invalid();
  return encoder.encode(
    JSON.stringify([
      "barba-cabelo/mercado-pago/v1/recebedor",
      text(binding.shopId, 128),
      binding.targetId.toLowerCase(),
      binding.receiverScope,
      binding.staffId?.toLowerCase() ?? null,
      text(binding.accountId, 128),
      binding.purpose,
      binding.environment,
    ]),
  );
}

async function encryptionKey(keyBase64: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  // Chave aleatória de 32 bytes, fornecida pelo cofre; aceita base64 padrão ou URL-safe.
  const normalized = text(keyBase64, 44).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const bytes = fromBase64Url(normalized);
  if (bytes.length !== 32) invalid();
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [usage]);
}

export async function encryptSecret(
  plain: string,
  keyBase64: string,
  binding: SecretBinding,
): Promise<string> {
  if (!/^[\x21-\x7e]+$/.test(plain)) invalid();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: secretAad(binding), tagLength: 128 },
    await encryptionKey(keyBase64, "encrypt"),
    encoder.encode(text(plain)),
  );
  return `mp1.${bytesBase64Url(iv)}.${bytesBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(
  cipher: string,
  keyBase64: string,
  binding: SecretBinding,
): Promise<string> {
  try {
    const parts = text(cipher, 16384).split(".");
    if (parts.length !== 3 || parts[0] !== "mp1") invalid();
    const iv = fromBase64Url(parts[1]);
    if (iv.length !== 12) invalid();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: secretAad(binding), tagLength: 128 },
      await encryptionKey(keyBase64, "decrypt"),
      fromBase64Url(parts[2]),
    );
    return text(new TextDecoder("utf-8", { fatal: true }).decode(decrypted));
  } catch {
    throw new MercadoPagoError("secret_decryption_failed");
  }
}

export type VerifiedWebhook = Readonly<{
  dataId: string;
  requestId: string;
  timestampMs: number;
  fingerprint: string;
}>;

/** Exige os três campos assinados; fingerprint deve ter unicidade persistente no chamador. */
export async function verifyWebhookSignature(input: {
  url: string;
  xSignature: string | null;
  xRequestId: string | null;
  secret: string;
  nowMs?: number;
  toleranceMs?: number;
}): Promise<VerifiedWebhook> {
  try {
    const query = new URL(input.url).searchParams;
    if (query.getAll("data.id").length !== 1) invalid();
    // Payments usa identificadores numéricos. Não aceitar ID do corpo como substituto.
    const dataId = numericId(query.get("data.id"));
    const requestId = text(input.xRequestId, 128);
    if (!/^[A-Za-z0-9_-]+$/.test(requestId)) invalid();
    const parts = text(input.xSignature, 256)
      .split(",")
      .map((part) => part.trim().split("="));
    if (parts.length !== 2 || parts.some((part) => part.length !== 2)) invalid();
    const fields = new Map(parts.map(([key, value]) => [key, value]));
    if (fields.size !== 2 || !fields.has("ts") || !fields.has("v1")) invalid();
    const ts = fields.get("ts")!;
    const signature = fields.get("v1")!;
    if (!/^(?:\d{10}|\d{13})$/.test(ts) || !/^[a-fA-F0-9]{64}$/.test(signature)) invalid();
    const timestampMs = Number(ts) * (ts.length === 10 ? 1000 : 1);
    const nowMs = input.nowMs ?? Date.now();
    const toleranceMs = input.toleranceMs ?? 5 * 60 * 1000;
    if (
      !Number.isSafeInteger(nowMs) ||
      !Number.isSafeInteger(toleranceMs) ||
      toleranceMs < 0 ||
      toleranceMs > 15 * 60 * 1000 ||
      Math.abs(nowMs - timestampMs) > toleranceMs
    )
      invalid();
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(text(input.secret)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const bytes = Uint8Array.from(signature.match(/../g)!, (pair) => parseInt(pair, 16));
    // WebCrypto verifica a assinatura sem comparação JS de strings dependente do conteúdo.
    if (!(await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(manifest)))) invalid();
    return {
      dataId,
      requestId,
      timestampMs,
      fingerprint: await sha256Hex(manifest + signature.toLowerCase()),
    };
  } catch {
    throw new MercadoPagoError("invalid_webhook_signature");
  }
}

export type MercadoPagoTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  scope: string;
  liveMode: boolean;
}>;

export type MercadoPagoUser = Readonly<{ id: string; siteId: "MLB"; isTest: boolean }>;
export type PaymentExpectation = Readonly<{
  collectorId: string;
  externalReference: string;
  liveMode: boolean;
  amountCents: number;
}>;
export type MercadoPagoPayment = Readonly<{
  id: string;
  collectorId: string;
  externalReference: string;
  liveMode: boolean;
  currency: "BRL";
  amountCents: number;
  refundedCents: number;
  status: string;
  statusDetail: string;
}>;
export type MercadoPagoRefund = Readonly<{
  id: string;
  paymentId: string;
  amountCents: number;
  status: string;
}>;

/** Decimal do provedor para centavos sem multiplicação/arredondamento em ponto flutuante. */
export function amountToCents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") invalid();
  const match = /^(0|[1-9]\d{0,13})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) invalid();
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) invalid();
  return Number(cents);
}

function cents(value: number, positive = false): number {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) invalid();
  return value;
}

function safeStatus(value: unknown): string {
  const status = text(value, 80);
  if (!/^[a-z][a-z0-9_]*$/.test(status)) invalid();
  return status;
}

export function validatePayment(
  value: unknown,
  paymentId: string,
  expected: PaymentExpectation,
): MercadoPagoPayment {
  const data = record(value);
  const id = numericId(data.id);
  const collectorId = numericId(data.collector_id);
  const externalReference = text(data.external_reference, 256);
  const amountCents = amountToCents(data.transaction_amount);
  const refundedCents = amountToCents(data.transaction_amount_refunded);
  if (
    id !== numericId(paymentId) ||
    collectorId !== numericId(expected.collectorId) ||
    externalReference !== text(expected.externalReference, 256) ||
    data.currency_id !== "BRL" ||
    typeof expected.liveMode !== "boolean" ||
    data.live_mode !== expected.liveMode ||
    amountCents !== cents(expected.amountCents, true) ||
    refundedCents > amountCents
  ) {
    throw new MercadoPagoError("payment_mismatch");
  }
  return {
    id,
    collectorId,
    externalReference,
    liveMode: expected.liveMode,
    currency: "BRL",
    amountCents,
    refundedCents,
    status: safeStatus(data.status),
    statusDetail: safeStatus(data.status_detail),
  };
}

function validateRefund(value: unknown, paymentId: string, refundId?: string): MercadoPagoRefund {
  const data = record(value);
  const id = numericId(data.id);
  const amountCents = amountToCents(data.amount);
  if (
    numericId(data.payment_id) !== numericId(paymentId) ||
    (refundId !== undefined && id !== numericId(refundId)) ||
    amountCents <= 0
  )
    throw new MercadoPagoError("refund_mismatch");
  return { id, paymentId: numericId(paymentId), amountCents, status: safeStatus(data.status) };
}

export type MercadoPagoClientConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  testMode: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}>;

export class MercadoPagoClient {
  private readonly config: MercadoPagoClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: MercadoPagoClientConfig) {
    numericId(config.clientId);
    text(config.clientSecret);
    redirectUri(config.redirectUri);
    if (typeof config.testMode !== "boolean") invalid();
    this.timeoutMs = config.timeoutMs ?? 10000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 30000)
      invalid();
    this.config = { ...config };
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request(
    path: string,
    method: "GET" | "POST",
    accessToken?: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<unknown> {
    if (
      !/^\/(oauth\/token|users\/me|v1\/payments\/[1-9]\d{0,19}(?:\/refunds(?:\/[1-9]\d{0,19})?)?)$/.test(
        path,
      )
    )
      invalid();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (accessToken !== undefined) headers.Authorization = `Bearer ${text(accessToken)}`;
    if (idempotencyKey !== undefined) headers["X-Idempotency-Key"] = idempotencyKey;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new MercadoPagoError("request_timeout", undefined, method === "POST"));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        timeout,
        (async () => {
          const response = await this.fetchImpl(API_ORIGIN + path, {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            redirect: "error",
            referrerPolicy: "no-referrer",
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            // Não incorporar resposta, URL, causa ou token do provedor à exceção/log.
            throw new MercadoPagoError("provider_rejected", response.status, method === "POST");
          }
          if (!response.body)
            throw new MercadoPagoError("invalid_response", response.status, method === "POST");
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              size += next.value.byteLength;
              if (size > 1024 * 1024)
                throw new MercadoPagoError("invalid_response", response.status, method === "POST");
              chunks.push(next.value);
            }
          } finally {
            await reader.cancel().catch(() => undefined);
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          try {
            return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
          } catch {
            throw new MercadoPagoError("invalid_response", response.status, method === "POST");
          }
        })(),
      ]);
    } catch (error) {
      if (error instanceof MercadoPagoError) throw error;
      throw new MercadoPagoError("request_failed", undefined, method === "POST");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private parseTokens(value: unknown): MercadoPagoTokens {
    try {
      const data = record(value);
      const expiresIn = data.expires_in;
      const scope = text(data.scope, 256);
      if (
        data.token_type !== "bearer" ||
        !Number.isSafeInteger(expiresIn) ||
        (expiresIn as number) <= 0 ||
        typeof data.live_mode !== "boolean" ||
        data.live_mode === this.config.testMode ||
        !["read", "write", "offline_access"].every((item) => scope.split(" ").includes(item))
      )
        invalid();
      return {
        accessToken: text(data.access_token),
        refreshToken: text(data.refresh_token),
        expiresIn: expiresIn as number,
        userId: numericId(data.user_id),
        scope,
        liveMode: data.live_mode,
      };
    } catch {
      throw new MercadoPagoError("invalid_token_response", undefined, true);
    }
  }

  async exchangeCode(code: string, verifier: string): Promise<MercadoPagoTokens> {
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) invalid();
    return this.parseTokens(
      await this.request("/oauth/token", "POST", undefined, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "authorization_code",
        code: text(code),
        code_verifier: verifier,
        redirect_uri: redirectUri(this.config.redirectUri),
        test_token: this.config.testMode,
      }),
    );
  }

  /** O chamador precisa de lock por conexão e persistência atômica dos dois tokens novos. */
  async refreshTokens(refreshToken: string): Promise<MercadoPagoTokens> {
    return this.parseTokens(
      await this.request("/oauth/token", "POST", undefined, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: text(refreshToken),
      }),
    );
  }

  async getUser(accessToken: string): Promise<MercadoPagoUser> {
    const data = record(await this.request("/users/me", "GET", accessToken));
    const isTest = Array.isArray(data.tags) && data.tags.includes("test_user");
    if (data.site_id !== "MLB" || !Array.isArray(data.tags) || isTest !== this.config.testMode)
      throw new MercadoPagoError("account_mismatch");
    return { id: numericId(data.id), siteId: "MLB", isTest };
  }

  async getPayment(
    accessToken: string,
    paymentId: string,
    expected: PaymentExpectation,
  ): Promise<MercadoPagoPayment> {
    if (expected.liveMode === this.config.testMode) throw new MercadoPagoError("payment_mismatch");
    return validatePayment(
      await this.request(`/v1/payments/${numericId(paymentId)}`, "GET", accessToken),
      paymentId,
      expected,
    );
  }

  async getRefund(
    accessToken: string,
    paymentId: string,
    refundId: string,
    expected: PaymentExpectation,
  ): Promise<MercadoPagoRefund> {
    const payment = await this.getPayment(accessToken, paymentId, expected);
    const refund = validateRefund(
      await this.request(
        `/v1/payments/${numericId(paymentId)}/refunds/${numericId(refundId)}`,
        "GET",
        accessToken,
      ),
      paymentId,
      refundId,
    );
    if (refund.amountCents > payment.amountCents) throw new MercadoPagoError("refund_mismatch");
    return refund;
  }

  async listRefunds(
    accessToken: string,
    paymentId: string,
    expected: PaymentExpectation,
  ): Promise<readonly MercadoPagoRefund[]> {
    const payment = await this.getPayment(accessToken, paymentId, expected);
    const data = await this.request(
      `/v1/payments/${numericId(paymentId)}/refunds`,
      "GET",
      accessToken,
    );
    if (!Array.isArray(data)) throw new MercadoPagoError("invalid_response");
    const refunds = data.map((item) => validateRefund(item, paymentId));
    const ids = new Set(refunds.map((item) => item.id));
    const total = refunds
      .filter((item) => item.status === "approved")
      .reduce((sum, item) => sum + BigInt(item.amountCents), 0n);
    if (ids.size !== refunds.length || total > BigInt(payment.amountCents))
      throw new MercadoPagoError("refund_mismatch");
    return refunds;
  }

  /** Preparado, mas sem rota consumidora. Exige ledger/lock/autorização antes de integrar. */
  async createRefund(
    accessToken: string,
    input: {
      paymentId: string;
      amountCents: number;
      idempotencyKey: string;
      expected: PaymentExpectation;
    },
  ): Promise<MercadoPagoRefund> {
    cents(input.amountCents, true);
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(input.idempotencyKey)) invalid();
    const payment = await this.getPayment(accessToken, input.paymentId, input.expected);
    if (
      payment.status !== "approved" ||
      input.amountCents > payment.amountCents - payment.refundedCents
    )
      throw new MercadoPagoError("refund_not_available");
    // O contrato JSON exige decimal; o ledger permanece em centavos inteiros.
    const decimal = `${Math.floor(input.amountCents / 100)}.${String(input.amountCents % 100).padStart(2, "0")}`;
    const amount = Number(decimal);
    if (amountToCents(amount) !== input.amountCents) invalid();
    const data = await this.request(
      `/v1/payments/${payment.id}/refunds`,
      "POST",
      accessToken,
      { amount },
      input.idempotencyKey,
    );
    try {
      const result = validateRefund(data, payment.id);
      if (result.amountCents !== input.amountCents) invalid();
      return result;
    } catch {
      throw new MercadoPagoError("refund_response_mismatch", undefined, true);
    }
  }
}
