/** Google OAuth helpers for Calendar + Contacts (separate from GoTrue login). */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts",
] as const;

export function googleOAuthConfig() {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? Deno.env.get("GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID");
  const clientSecret =
    Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? Deno.env.get("GOTRUE_EXTERNAL_GOOGLE_SECRET");
  const appUrl = (Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "https://beauty.contheiner.digital").replace(
    /\/$/,
    "",
  );
  const redirectUri =
    Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") ?? `${appUrl}/auth/google-apps`;
  const stateSecret =
    Deno.env.get("GOOGLE_OAUTH_STATE_SECRET") ??
    clientSecret ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "dev-insecure-state";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET");
  }

  return { clientId, clientSecret, redirectUri, appUrl, stateSecret };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export async function buildOAuthState(
  userId: string,
  returnPath: string,
  secret: string,
  returnOrigin?: string | null,
): Promise<string> {
  const body = JSON.stringify({
    u: userId,
    r: returnPath || "/shop",
    o: returnOrigin || null,
    e: Date.now() + 10 * 60 * 1000,
    n: crypto.randomUUID(),
  });
  const bodyB64 = toBase64Url(new TextEncoder().encode(body));
  const sig = await hmacSign(secret, bodyB64);
  return `${bodyB64}.${sig}`;
}

export async function parseOAuthState(
  state: string,
  secret: string,
): Promise<{ userId: string; returnPath: string; returnOrigin: string | null } | null> {
  const [bodyB64, sig] = state.split(".");
  if (!bodyB64 || !sig) return null;
  const expected = await hmacSign(secret, bodyB64);
  if (expected !== sig) return null;
  try {
    const jsonText = new TextDecoder().decode(fromBase64Url(bodyB64));
    const parsed = JSON.parse(jsonText) as {
      u?: string;
      r?: string;
      o?: string | null;
      e?: number;
    };
    if (!parsed.u || !parsed.e || parsed.e < Date.now()) return null;
    return {
      userId: parsed.u,
      returnPath: parsed.r || "/shop",
      returnOrigin: typeof parsed.o === "string" && parsed.o ? parsed.o : null,
    };
  } catch {
    return null;
  }
}

/** Origem segura para voltar após OAuth (evita open redirect). */
export function isSafeAppsReturnOrigin(origin: string, appUrl: string): boolean {
  try {
    const normalized = origin.replace(/\/$/, "");
    const url = new URL(normalized);
    if (url.origin !== normalized) return false;
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") {
      return false;
    }
    if (host === "localhost" || host === "127.0.0.1") return true;
    let appHost = "beauty.contheiner.digital";
    try {
      appHost = new URL(appUrl).hostname.toLowerCase();
    } catch {
      /* keep default */
    }
    if (host === appHost || host.endsWith(`.${appHost}`)) return true;
    // Domínio próprio da loja
    return host.includes(".") && !host.includes("..");
  } catch {
    return false;
  }
}

export function authUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // select_account: permite Gmail da Agenda distinto do login do app;
    // consent: garante refresh_token mesmo se já houve autorização parcial.
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Falha ao trocar código Google");
  }
  return data;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Falha ao renovar token Google");
  }
  return data;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

type ConnectionRow = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  google_email: string | null;
};

type AdminClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: ConnectionRow | null; error: { message: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export async function ensureFreshAccessToken(
  admin: AdminClient,
  connection: ConnectionRow,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }
  if (!connection.refresh_token) {
    throw new Error("Conexão Google expirada. Conecte novamente.");
  }
  const refreshed = await refreshAccessToken(connection.refresh_token, clientId, clientSecret);
  const tokenExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;
  const { error } = await admin
    .from("google_connections")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", connection.id);
  if (error) throw new Error(error.message);
  return refreshed.access_token;
}
