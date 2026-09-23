/** Auth no domínio da loja: Google via pop-up no apex (a aba principal não sai do domínio). */

import { PLATFORM_BASE_HOST } from "@/lib/shop/host";
import { supabase } from "@/integrations/supabase/client";

const BRIDGE_STORAGE_KEY = "mb_auth_bridge_v1";
const HANDOFF_STORAGE_KEY = "mb_auth_handoff_v1";

export const AUTH_POPUP_MESSAGE = "mb-auth-session-v1";

export type AuthBridgePayload = {
  returnOrigin: string;
  shop?: string;
  next?: string;
  /** Pop-up no apex: postMessage de volta; a aba da loja nunca navega para beauty. */
  popup?: boolean;
};

export type AuthPopupMessage = {
  type: typeof AUTH_POPUP_MESSAGE;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
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

export function isPlatformAuthOrigin(origin: string): boolean {
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  return origin.replace(/\/$/, "") === platformAuthOrigin().replace(/\/$/, "");
}

/** Subdomínio ou domínio próprio — login/logout ficam nesse host; Google usa pop-up no apex. */
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

export async function isAllowedReturnOrigin(origin: string): Promise<boolean> {
  if (!isSafeReturnOriginShape(origin)) return false;
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (isPlatformShopSubdomain(host)) return true;
  try {
    const { data, error } = await supabase.rpc("resolve_shop_by_host", { p_host: host });
    if (error || !data) return false;
    return Boolean((data as { shop_id?: string }).shop_id);
  } catch {
    return false;
  }
}

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
        popup: payload.popup === true,
      } satisfies AuthBridgePayload),
    );
  } catch {
    /* ignore */
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
      popup: parsed.popup === true,
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
  popup?: boolean;
}): AuthBridgePayload | null {
  const stored = peekAuthBridge();
  const returnOrigin = fromUrl?.returnOrigin || stored?.returnOrigin;
  if (!returnOrigin || !isSafeReturnOriginShape(returnOrigin)) return null;
  return {
    returnOrigin,
    shop: fromUrl?.shop || stored?.shop || undefined,
    next: fromUrl?.next || stored?.next || "/app",
    popup: fromUrl?.popup === true || stored?.popup === true,
  };
}

export function buildPlatformAuthUrl(opts: {
  shop?: string | null;
  next?: string | null;
  returnOrigin?: string | null;
  oauth?: "google" | null;
  recovery?: boolean;
  popup?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.next) params.set("next", opts.next);
  if (opts.shop) params.set("shop", opts.shop);
  if (opts.returnOrigin) params.set("return_origin", opts.returnOrigin);
  if (opts.oauth) params.set("oauth", opts.oauth);
  if (opts.recovery) params.set("recovery", "1");
  if (opts.popup) params.set("popup", "1");
  const qs = params.toString();
  return `${platformAuthOrigin()}/auth${qs ? `?${qs}` : ""}`;
}

/** Callback OAuth no apex; `popup=1` mantém o modo pop-up após o Google. */
export function platformOAuthCallbackUrl(popup = false): string {
  return popup ? `${platformAuthOrigin()}/auth?popup=1` : `${platformAuthOrigin()}/auth`;
}

export function isAuthPopupMessage(data: unknown): data is AuthPopupMessage {
  if (!data || typeof data !== "object") return false;
  const row = data as Record<string, unknown>;
  return (
    row.type === AUTH_POPUP_MESSAGE &&
    typeof row.access_token === "string" &&
    typeof row.refresh_token === "string"
  );
}

function sessionMessage(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}): AuthPopupMessage {
  return {
    type: AUTH_POPUP_MESSAGE,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

/** Entrega sessão à aba da loja (mesmo domínio): BroadcastChannel + storage. */
export function handoffSessionSameOrigin(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}): void {
  if (typeof window === "undefined") return;
  const message = sessionMessage(session);
  try {
    const channel = new BroadcastChannel(AUTH_POPUP_MESSAGE);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify({ ...message, t: Date.now() }));
    localStorage.removeItem(HANDOFF_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function postSessionToOpener(
  session: { access_token: string; refresh_token: string; expires_at?: number },
  targetOrigin: string,
): boolean {
  if (typeof window === "undefined" || !window.opener || window.opener.closed) return false;
  if (!isSafeReturnOriginShape(targetOrigin)) return false;
  try {
    window.opener.postMessage(sessionMessage(session), targetOrigin);
    return true;
  } catch {
    return false;
  }
}

function buildBridgedShopUrl(
  bridge: AuthBridgePayload,
  session: { access_token: string; refresh_token: string; expires_at?: number },
): string {
  const target = new URL(`${bridge.returnOrigin}/auth`);
  target.searchParams.set("bridged", "1");
  if (bridge.shop) target.searchParams.set("shop", bridge.shop);
  if (bridge.next) target.searchParams.set("next", bridge.next);
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (session.expires_at) hash.set("expires_at", String(session.expires_at));
  return `${target.origin}${target.pathname}?${target.searchParams.toString()}#${hash.toString()}`;
}

/**
 * No pop-up do apex: troca ?code=, envia sessão ao opener (domínio da loja) e fecha.
 * Se o Google zerar `opener` (COOP), redireciona só o pop-up ao domínio da loja com tokens.
 */
export async function finishPopupOAuthAndNotifyOpener(fromUrl?: {
  returnOrigin?: string | null;
  shop?: string | null;
  next?: string | null;
  popup?: boolean;
}): Promise<"notified" | "local" | "pending" | "error"> {
  if (typeof window === "undefined") return "pending";

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (error) console.warn("[auth-popup] exchangeCodeForSession:", error.message);
  }

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
  const isPopup = Boolean(fromUrl?.popup || bridge?.popup || url.searchParams.get("popup") === "1");
  if (isPopup && bridge?.returnOrigin) {
    const ok = postSessionToOpener(session, bridge.returnOrigin);
    clearAuthBridge();
    if (ok) {
      window.setTimeout(() => window.close(), 200);
      return "notified";
    }
    // Fallback: só o pop-up vai ao domínio da loja; a aba principal permanece lá.
    window.location.href = buildBridgedShopUrl(bridge, session);
    return "notified";
  }
  return "local";
}

/** Lê tokens da hash (fallback bridged) e limpa a URL. */
export function consumeBridgedHashTokens(): AuthPopupMessage | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  const expiresRaw = params.get("expires_at");
  const expires_at = expiresRaw ? Number(expiresRaw) : undefined;
  window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  return {
    type: AUTH_POPUP_MESSAGE,
    access_token,
    refresh_token,
    ...(Number.isFinite(expires_at) ? { expires_at } : {}),
  };
}
