/** DNS-over-HTTPS helpers for Edge Runtime (avoid Deno.resolveDns — hangs in self-hosted). */

export type DnsRecordType = "TXT" | "CNAME" | "A";

type DnsAnswer = { data?: string; type?: number };

const DNS_TIMEOUT_MS = 4_000;

function normalizeTxtPieces(raw: string): string {
  // Cloudflare may return `"foo" "bar"` for long TXT; Google often a single quoted string.
  return raw
    .replace(/\\"/g, '"')
    .replace(/(^| )"([^"]*)"/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAnswer(data: string, type: DnsRecordType): string {
  let value = (data ?? "").trim();
  if (type === "TXT") value = normalizeTxtPieces(value);
  else value = value.replace(/^"|"$/g, "").replace(/\.$/, "");
  return value.toLowerCase();
}

async function fetchDnsJson(url: string): Promise<DnsAnswer[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(DNS_TIMEOUT_MS),
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { Answer?: DnsAnswer[] };
  return payload.Answer ?? [];
}

/**
 * Resolve DNS via public DoH (Cloudflare, then Google). Never use Deno.resolveDns here.
 */
export async function dnsQuery(name: string, type: DnsRecordType): Promise<string[]> {
  const host = name.replace(/\.$/, "").toLowerCase();
  if (!host) return [];

  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`,
  ];

  for (const url of endpoints) {
    try {
      const answers = await fetchDnsJson(url);
      const values = answers
        .map((a) => normalizeAnswer(a.data ?? "", type))
        .filter(Boolean);
      if (values.length > 0) return values;
    } catch {
      // try next resolver
    }
  }
  return [];
}
