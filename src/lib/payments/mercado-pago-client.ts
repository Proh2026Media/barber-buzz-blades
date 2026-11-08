import { supabase } from "@/integrations/supabase/client";
import type { MessageKey } from "@/lib/i18n";
import { guardedFetch } from "@/lib/demo-guard";

export type MercadoPagoConnection = {
  supported: boolean;
  configured: boolean;
  can_manage: boolean;
  connected: boolean;
  status: "connected" | "disconnected";
  connection_revision: string;
  connected_at: string | null;
  live_mode: boolean | null;
  shop_name?: string;
  actor_id?: string | null;
  receiver_scope: "shop" | "professional";
  receiver_name?: string;
  staff_id?: string | null;
  financial_enabled?: false;
  management_blocked_reason?: "shared_governance" | "account_manager" | "owner_required" | null;
};

/** A mensagem do provedor pode conter dados privados; a tela recebe somente códigos locais. */
export class MercadoPagoClientError extends Error {
  constructor(public readonly code: "session" | "unavailable" | "denied" | "failed" | "uncertain") {
    super(code);
  }
}

export async function callMercadoPago<T>(
  body: Record<string, unknown>,
  expectedUserId: string,
): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId)
    throw new MercadoPagoClientError("session");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await guardedFetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercado-pago-connect`,
      {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        referrerPolicy: "no-referrer",
      },
    );
    if (!response.ok) {
      if (response.status === 401) throw new MercadoPagoClientError("session");
      if (response.status === 403) throw new MercadoPagoClientError("denied");
      if ([404, 501, 503].includes(response.status))
        throw new MercadoPagoClientError("unavailable");
      throw new MercadoPagoClientError("failed");
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") throw new MercadoPagoClientError("failed");
    return result as T;
  } catch (error) {
    if (error instanceof MercadoPagoClientError) throw error;
    throw new MercadoPagoClientError(body.action === "status" ? "failed" : "uncertain");
  } finally {
    clearTimeout(timeout);
  }
}

export function isMercadoPagoAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.origin === "https://auth.mercadopago.com" &&
      url.pathname === "/authorization" &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function mercadoPagoErrorKey(error: unknown): MessageKey {
  if (error instanceof MercadoPagoClientError) {
    if (error.code === "session") return "mp.session";
    if (error.code === "unavailable") return "mp.unavailable";
    if (error.code === "denied") return "mp.denied";
    if (error.code === "uncertain") return "mp.uncertain";
  }
  return "mp.failed";
}
