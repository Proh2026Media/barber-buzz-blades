/** Ponte de autenticação entre o apex da plataforma e subdomínios / domínios próprios. */

import { PLATFORM_BASE_HOST } from "@/lib/shop/host";
import { supabase } from "@/integrations/supabase/client";

const BRIDGE_STORAGE_KEY = "mb_auth_bridge_v1";

export type AuthBridgePayload = {
  returnOrigin: string;
  shop?: string;
  next?: string;
};

export function platformAuthOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_ORIGIN as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.origin;
    }
  }
  return `https://${PLATFORM_BASE_HOST}`;
}

export function currentOrigin(): string {
  if (typeof window === "undefined") return platformAuthOrigin();
  return window.location.origin;
}

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Apex (e localhost) — único lugar seguro para redirect OAuth sem depender de wildcard no GoTrue. */
export function isPlatformAuthOrigin(origin: string): boolean {
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return origin.replace(/\/$/, "") === platformAuthOrigin().replace(/\/$/, "");
}

/**
 * Qualquer host que não seja o apex precisa de ponte:
 * subdomínio `*.beauty…` e domínio próprio.
 */
export function needsAuthOriginBridge(origin = currentOrigin()): boolean {
  return !isPlatformAuthOrigin(origin);
}

export function isSafeReturnOriginShape(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.origin !== value) return false;
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPlatformShopSubdomain(host: string): boolean {
  return host === PLATFORM_BASE_HOST || host.endsWith(`.${PLATFORM_BASE_HOST}`);
}

/** Confirma que o host de retorno é o apex, um `*.beauty…` ou domínio próprio ativo. */
export async function isAllowedReturnOrigin(origin: string): Promise<boolean> {
  if (!isSafeReturnOriginShape(origin)) return false;
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (isPlatformShopSubdomain(host)) return true;
  try {
    const { data, error } = await supabase.rpc("resolve_shop_by_host", { p_host: host });
    if (error || !data) return false;
    const row = data as { shop_id?: string };
    return Boolean(row.shop_id);
  } catch {
    return false;
  }
}

/** Persiste destino da loja no apex — sobrevive ao round-trip do Google mesmo se a URL perder query. */
export function stashAuthBridge(payload: AuthBridgePayload): void {
  if (typeof window === "undefined") return;
  if (!isSafeReturnOriginShape(payload.returnOrigin)) return;
  try {
    sessionStorage.setItem(
      BRIDGE_STORAGE_KEY,
      JSON.stringify({
        returnOrigin: payload.returnOrigin,
        shop: payload.shop || undefined,
        next: payload.next || "/app",
      } satisfies AuthBridgePayload),
    );
  } catch {
    /* private mode / quota */
  }
}

export function peekAuthBridge(): AuthBridgePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthBridgePayload;
    if (!parsed?.returnOrigin || !isSafeReturnOriginShape(parsed.returnOrigin)) return null;
    return {
      returnOrigin: parsed.returnOrigin,
      shop: parsed.shop || undefined,
      next: parsed.next || "/app",
    };
  } catch {
    return null;
  }
}

export function clearAuthBridge(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BRIDGE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveAuthBridge(fromUrl?: {
  returnOrigin?: string | null;
  shop?: string | null;
  next?: string | null;
}): AuthBridgePayload | null {
  const stored = peekAuthBridge();
  const returnOrigin = fromUrl?.returnOrigin || stored?.returnOrigin;
  if (!returnOrigin || !isSafeReturnOriginShape(returnOrigin)) return null;
  return {
    returnOrigin,
    shop: fromUrl?.shop || stored?.shop || undefined,
    next: fromUrl?.next || stored?.next || "/app",
  };
}

export function buildPlatformAuthUrl(opts: {
  shop?: string | null;
  next?: string | null;
  returnOrigin?: string | null;
  oauth?: "google" | null;
  recovery?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.next) params.set("next", opts.next);
  if (opts.shop) params.set("shop", opts.shop);
  if (opts.returnOrigin) params.set("return_origin", opts.returnOrigin);
  if (opts.oauth) params.set("oauth", opts.oauth);
  if (opts.recovery) params.set("recovery", "1");
  const qs = params.toString();
  return `${platformAuthOrigin()}/auth${qs ? `?${qs}` : ""}`;
}

/** Redirect limpo para o GoTrue (sem query) — a ponte fica no sessionStorage. */
export function platformOAuthCallbackUrl(): string {
  return `${platformAuthOrigin()}/auth`;
}

/** Monta hash implícito para o cliente no domínio destino detectar a sessão. */
export function sessionTransferHash(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
}): string {
  const params = new URLSearchParams();
  params.set("access_token", session.access_token);
  params.set("refresh_token", session.refresh_token);
  params.set("token_type", "bearer");
  params.set("type", "recovery");
  if (session.expires_in != null) params.set("expires_in", String(session.expires_in));
  if (session.expires_at != null) params.set("expires_at", String(session.expires_at));
  return params.toString();
}

export async function redirectWithSessionToReturnOrigin(opts: {
  returnOrigin: string;
  shop?: string | null;
  next?: string | null;
}): Promise<boolean> {
  const allowed = await isAllowedReturnOrigin(opts.returnOrigin);
  if (!allowed) return false;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.refresh_token) return false;

  const params = new URLSearchParams();
  if (opts.next) params.set("next", opts.next);
  if (opts.shop) params.set("shop", opts.shop);
  params.set("bridged", "1");
  const qs = params.toString();
  const hash = sessionTransferHash({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  });
  clearAuthBridge();
  window.location.href = `${opts.returnOrigin}/auth${qs ? `?${qs}` : ""}#${hash}`;
  return true;
}

/** Troca o ?code= do PKCE e, se houver ponte, devolve à loja. */
export async function finishOAuthAndBridge(fromUrl?: {
  returnOrigin?: string | null;
  shop?: string | null;
  next?: string | null;
}): Promise<"bridged" | "local" | "pending" | "error"> {
  if (typeof window === "undefined") return "pending";

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (error) {
      console.warn("[auth-bridge] exchangeCodeForSession:", error.message);
    }
  }

  // PKCE / detectSessionInUrl pode concluir alguns ms depois.
  let session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    const deadline = Date.now() + 4000;
    while (!session && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      session = (await supabase.auth.getSession()).data.session;
    }
  }
  if (!session) return code ? "error" : "pending";

  const bridge = resolveAuthBridge(fromUrl);
  if (bridge?.returnOrigin && bridge.returnOrigin !== currentOrigin()) {
    const ok = await redirectWithSessionToReturnOrigin({
      returnOrigin: bridge.returnOrigin,
      shop: bridge.shop,
      next: bridge.next,
    });
    return ok ? "bridged" : "local";
  }
  return "local";
}
