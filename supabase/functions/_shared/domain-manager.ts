/** Client for the Traefik domain-manager (route + TLS for custom domains). */

export type DomainManagerConfig = {
  url: string;
  apiKey: string;
};

export function domainManagerConfig(): DomainManagerConfig | null {
  const url = (Deno.env.get("DOMAIN_MANAGER_URL") ?? "").replace(/\/$/, "");
  const apiKey = Deno.env.get("DOMAIN_MANAGER_API_KEY") ?? "";
  if (!url || !apiKey) return null;
  return { url, apiKey };
}

export type DomainManagerResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
  data?: unknown;
};

async function callDomainManager(
  method: "POST" | "DELETE",
  path: "/add" | "/remove",
  body: Record<string, string>,
): Promise<DomainManagerResult> {
  const cfg = domainManagerConfig();
  if (!cfg) {
    return {
      ok: false,
      skipped: true,
      error: "DOMAIN_MANAGER_URL / DOMAIN_MANAGER_API_KEY não configurados no servidor",
    };
  }

  try {
    const response = await fetch(`${cfg.url}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : `domain-manager ${path} HTTP ${response.status}`,
        data,
      };
    }
    return { ok: true, status: response.status, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao contactar domain-manager",
    };
  }
}

/** Provision Traefik route + certificate for a custom domain. */
export function domainManagerAdd(domain: string, slug: string): Promise<DomainManagerResult> {
  return callDomainManager("POST", "/add", { domain, slug });
}

/** Remove Traefik route for a custom domain. */
export function domainManagerRemove(domain: string): Promise<DomainManagerResult> {
  return callDomainManager("DELETE", "/remove", { domain });
}
