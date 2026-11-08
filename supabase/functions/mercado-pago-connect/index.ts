import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildAuthorizationUrl,
  createPkce,
  decryptSecret,
  encryptSecret,
  MercadoPagoClient,
  MercadoPagoError,
  randomUrlSafe,
  sha256Hex,
} from "../_shared/mercado-pago.ts";
import {
  ConnectionError,
  connectionErrorFromDatabase,
  createConnectionHandler,
  type ConnectionAttempt,
  type ConnectionConfig,
  type ConnectionStatus,
} from "./handler.ts";

const config: ConnectionConfig = {
  enabled: Deno.env.get("MERCADO_PAGO_CONNECTION_ENABLED") === "true",
  clientId: Deno.env.get("MERCADO_PAGO_CLIENT_ID") ?? "",
  clientSecret: Deno.env.get("MERCADO_PAGO_CLIENT_SECRET") ?? "",
  redirectUri: Deno.env.get("MERCADO_PAGO_REDIRECT_URI") ?? "",
  encryptionKey: Deno.env.get("MERCADO_PAGO_ENCRYPTION_KEY") ?? "",
  environment:
    Deno.env.get("MERCADO_PAGO_ENVIRONMENT") === "test"
      ? "test"
      : Deno.env.get("MERCADO_PAGO_ENVIRONMENT") === "production"
        ? "production"
        : null,
};
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

function administrativeClient() {
  if (!supabaseUrl || !serviceKey || !anonKey) throw new ConnectionError("internal_error");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await administrativeClient().rpc(name, args);
  if (error) throw connectionErrorFromDatabase(error);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ConnectionError("internal_error");
  return data;
}

async function providerOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      if (error.code === "account_mismatch")
        throw new ConnectionError("mp_connection_account_mismatch");
      if (error.code === "request_timeout" || error.code === "request_failed")
        throw new ConnectionError("mp_connection_provider_unavailable");
      if (error.code === "provider_rejected")
        throw new ConnectionError("mp_connection_provider_rejected");
      if (error.code === "invalid_response" || error.code === "invalid_token_response")
        throw new ConnectionError("mp_connection_provider_invalid");
    }
    // Não repassar texto/corpo de erros do SDK, tokens, segredo, código OAuth ou URLs.
    throw new ConnectionError("internal_error");
  }
}

function provider() {
  return new MercadoPagoClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    testMode: config.environment === "test",
  });
}

Deno.serve(
  createConnectionHandler({
    config,
    async authenticate(authorization) {
      if (!supabaseUrl || !serviceKey || !anonKey) throw new ConnectionError("internal_error");
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      if (error || !user) return null;
      return {
        id: user.id,
        async getStatus(shopId, receiverScope, staffId) {
          const { data, error: statusError } = await client.rpc("get_mercado_pago_connection", {
            p_shop_id: shopId,
            p_receiver_scope: receiverScope,
            p_staff_id: staffId,
          });
          if (statusError) throw connectionErrorFromDatabase(statusError);
          if (!data || typeof data !== "object" || Array.isArray(data))
            throw new ConnectionError("internal_error");
          return data as ConnectionStatus;
        },
      };
    },
    store: {
      begin(input) {
        return rpc("begin_mercado_pago_connection", {
          p_shop_id: input.shopId,
          p_actor_id: input.actorId,
          p_state_hash: input.stateHash,
          p_verifier_ciphertext: input.verifierCiphertext,
          p_expected_revision: input.expectedRevision,
          p_environment: input.environment,
          p_receiver_scope: input.receiverScope,
          p_staff_id: input.staffId,
          p_connection_id: input.connectionId,
        });
      },
      async consume(input) {
        return (await rpc("consume_mercado_pago_connection", {
          p_state_hash: input.stateHash,
          p_actor_id: input.actorId,
        })) as ConnectionAttempt;
      },
      finish(input) {
        return rpc("finish_mercado_pago_connection", {
          p_attempt_id: input.attemptId,
          p_actor_id: input.actorId,
          p_collector_id: input.collectorId,
          p_access_token_ciphertext: input.accessTokenCiphertext,
          p_refresh_token_ciphertext: input.refreshTokenCiphertext,
          p_token_expires_at: input.tokenExpiresAt,
          p_live_mode: input.liveMode,
        });
      },
      disconnect(input) {
        return rpc("disconnect_mercado_pago_connection", {
          p_shop_id: input.shopId,
          p_actor_id: input.actorId,
          p_expected_revision: input.expectedRevision,
          p_receiver_scope: input.receiverScope,
          p_staff_id: input.staffId,
        });
      },
    },
    crypto: {
      randomUuid: () => crypto.randomUUID(),
      randomState: () => randomUrlSafe(),
      createPkce,
      hashState: sha256Hex,
      encrypt: (value, binding) => encryptSecret(value, config.encryptionKey, binding),
      decrypt: (value, binding) => decryptSecret(value, config.encryptionKey, binding),
    },
    provider: {
      authorizationUrl: ({ state, challenge }) =>
        buildAuthorizationUrl({
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          state,
          codeChallenge: challenge,
        }),
      exchangeCode: (code, verifier) =>
        providerOperation(() => provider().exchangeCode(code, verifier)),
      getUser: (accessToken) => providerOperation(() => provider().getUser(accessToken)),
    },
    now: Date.now,
  }),
);
