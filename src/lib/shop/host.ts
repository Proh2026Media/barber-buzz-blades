/** Resolve barbearia pelo Host (subdomínio ou domínio próprio). */

import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_BASE_HOST =
  (import.meta.env.VITE_PLATFORM_BASE_HOST as string | undefined)?.trim() ||
  "beauty.contheiner.digital";

export type ShopHostResolution = {
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  kind: "custom" | "subdomain";
  host: string;
  canonical_host: string;
};

export function currentHostname(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

export function isPlatformApexHost(host = currentHostname()): boolean {
  const h = host.split(":")[0] ?? "";
  return h === PLATFORM_BASE_HOST || h === "localhost" || h === "127.0.0.1";
}

export function platformSubdomainUrl(slug: string, path = "/app"): string {
  const clean = slug.replace(/^\/+|\/+$/g, "");
  const basePath = path.startsWith("/") ? path : `/${path}`;
  return `https://${clean}.${PLATFORM_BASE_HOST}${basePath}`;
}

export function shopPublicOrigin(opts: {
  slug: string;
  customDomain?: string | null;
  customDomainStatus?: string | null;
}): string {
  if (opts.customDomain && opts.customDomainStatus === "active") {
    return `https://${opts.customDomain}`;
  }
  return `https://${opts.slug}.${PLATFORM_BASE_HOST}`;
}

export async function resolveShopFromCurrentHost(): Promise<ShopHostResolution | null> {
  const host = currentHostname();
  if (!host || isPlatformApexHost(host)) return null;
  const { data, error } = await supabase.rpc("resolve_shop_by_host", { p_host: host });
  if (error || !data) return null;
  const row = data as ShopHostResolution;
  if (!row.shop_id || !row.shop_slug) return null;
  return row;
}

/** Redireciona subdomínio → domínio próprio quando ativo. */
export function maybeRedirectToCanonical(resolution: ShopHostResolution | null): boolean {
  if (!resolution || typeof window === "undefined") return false;
  const current = currentHostname();
  if (
    resolution.kind === "subdomain" &&
    resolution.canonical_host &&
    resolution.canonical_host !== current &&
    !resolution.canonical_host.endsWith(`.${PLATFORM_BASE_HOST}`)
  ) {
    const url = new URL(window.location.href);
    url.hostname = resolution.canonical_host;
    window.location.replace(url.toString());
    return true;
  }
  return false;
}
