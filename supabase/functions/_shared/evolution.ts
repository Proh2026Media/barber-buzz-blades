/** Shared helpers for Evolution API edge functions. */

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

export function evolutionConfig() {
  const url = (Deno.env.get("EVOLUTION_API_URL") ?? "https://evolutionapi.contheiner.digital").replace(
    /\/$/,
    "",
  );
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") ?? Deno.env.get("AUTHENTICATION_API_KEY");
  if (!apiKey) throw new Error("Missing EVOLUTION_API_KEY");
  return { url, apiKey };
}

export async function evolutionFetch(path: string, init: RequestInit = {}) {
  const { url, apiKey } = evolutionConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    let message = text.slice(0, 300) || response.statusText;
    if (typeof data === "object" && data && "message" in data) {
      const raw = (data as { message: unknown }).message;
      message = Array.isArray(raw) ? raw.map(String).join(" ") : String(raw);
    } else if (typeof data === "object" && data && "response" in data) {
      const nested = (data as { response?: { message?: unknown } }).response?.message;
      if (nested != null) {
        message = Array.isArray(nested) ? nested.map(String).join(" ") : String(nested);
      }
    }
    throw new Error(message);
  }
  return data;
}

export function instanceNameForShop(shopId: string, slug?: string | null) {
  const base = (slug ?? shopId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = shopId.replace(/-/g, "").slice(0, 8);
  return `shop-${base || "barber"}-${suffix}`.slice(0, 63);
}

export function digitsOnlyPhone(e164: string) {
  return e164.replace(/\D/g, "");
}
