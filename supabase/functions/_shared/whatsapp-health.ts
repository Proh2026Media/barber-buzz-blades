export type HealthNumber = {
  id: string;
  name: string;
  phone: string;
  instance_name: string;
  paused: boolean;
  unknown: number;
  failed: number;
  pending: number;
  last_accepted_at: string | null;
};
/** Formatos conhecidos da Evolution; ausência/estrutura desconhecida não significa desconexão. */
export function connectionStates(
  raw: unknown,
): Map<string, "open" | "disconnected" | "connecting"> {
  const result = new Map<string, "open" | "disconnected" | "connecting">();
  if (!Array.isArray(raw)) return result;
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const i = entry.instance && typeof entry.instance === "object" ? entry.instance : entry;
    const name = i.name ?? i.instanceName,
      state = i.connectionStatus ?? i.state ?? i.status;
    if (typeof name !== "string" || typeof state !== "string") continue;
    if (state === "open") result.set(name, "open");
    else if (state === "close" || state === "closed" || state === "disconnected")
      result.set(name, "disconnected");
    else if (state === "connecting" || state === "qr") result.set(name, "connecting");
  }
  return result;
}
export function healthSummary(
  number: HealthNumber,
  state: "open" | "disconnected" | "connecting" | "unknown",
) {
  const issues: string[] = [];
  if (state === "unknown") issues.push("unknown_connection");
  else if (state !== "open") issues.push("disconnected");
  if (number.failed > 0) issues.push("failed");
  if (number.unknown > 0) issues.push("unknown_delivery");
  if (number.pending > 0 && !number.paused) issues.push("pending");
  const severity =
    issues.includes("disconnected") || issues.includes("failed")
      ? "danger"
      : issues.length
        ? "warning"
        : "ok";
  // instance_name é operacional e não precisa chegar à tela.
  return {
    id: number.id,
    name: number.name,
    phone: number.phone,
    state,
    paused: number.paused,
    issues,
    severity,
    last_accepted_at: number.last_accepted_at,
  };
}
