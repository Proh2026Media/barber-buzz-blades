/** DNS-over-HTTPS for Edge Runtime — never use Deno.resolveDns (hangs self-hosted). */

export type DnsRecordType = "TXT" | "CNAME" | "A";

type DnsAnswer = { data?: string; type?: number };

const DNS_TIMEOUT_MS = 2_500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DNS timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function normalizeTxtPieces(raw: string): string {
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
  const response = await withTimeout(
    fetch(url, { headers: { Accept: "application/dns-json" } }),
    DNS_TIMEOUT_MS,
  );
  if (!response.ok) return [];
  const payload = (await withTimeout(response.json(), DNS_TIMEOUT_MS)) as {
    Answer?: DnsAnswer[];
  };
  return payload.Answer ?? [];
}

async function queryEndpoint(url: string, type: DnsRecordType): Promise<string[]> {
  try {
    const answers = await fetchDnsJson(url);
    return answers.map((a) => normalizeAnswer(a.data ?? "", type)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Resolve via Cloudflare and Google DoH in parallel; first non-empty wins. */
export async function dnsQuery(name: string, type: DnsRecordType): Promise<string[]> {
  const host = name.replace(/\.$/, "").toLowerCase();
  if (!host) return [];

  const endpoints = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
    `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`,
  ];

  const results = await Promise.all(endpoints.map((url) => queryEndpoint(url, type)));
  for (const values of results) {
    if (values.length > 0) return values;
  }
  return [];
}
