import type { EvolutionCall } from "./whatsapp-pairing.ts";
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Somente identidade confirmada da instância; nunca rótulo, telefone digitado ou LID. */
export function instancePhone(payload: unknown, instance: string): string | null {
  const rows = (Array.isArray(payload) ? payload : [payload]).map(record).filter((r) => r !== null);
  const names = (row: Record<string, unknown>) => {
    const nested = record(row.instance);
    return [row.name, row.instanceName, nested?.name, nested?.instanceName].filter(
      (v): v is string => typeof v === "string",
    );
  };
  const matches = rows.filter(
    (row) => names(row).length > 0 && names(row).every((n) => n === instance),
  );
  const row =
    matches.length === 1
      ? matches[0]
      : rows.length === 1 && names(rows[0]).length === 0
        ? rows[0]
        : null;
  if (!row) return null;
  const nested = record(row.instance);
  const identities = [row.ownerJid, nested?.ownerJid].filter((v) => v != null);
  if (!identities.length) return null;
  const phones = identities.map((v) => {
    const match = typeof v === "string" && /^([1-9]\d{7,14})(?::\d+)?@s\.whatsapp\.net$/.exec(v);
    return match ? `+${match[1]}` : null;
  });
  return phones.every((p) => p && p === phones[0]) ? phones[0] : null;
}

/** Falha de consulta não apaga a identidade anteriormente confirmada. */
export async function readInstancePhone(
  call: EvolutionCall,
  instance: string,
  previous: string | null = null,
) {
  try {
    const payload = await call(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instance)}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      },
    );
    return instancePhone(payload, instance) ?? previous;
  } catch {
    return previous;
  }
}
