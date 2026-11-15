import { connectionStates } from "./whatsapp-health.ts";
import { instancePhone } from "./whatsapp-instance-phone.ts";
type Database = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
type Candidate = { id: string; instance: string; phone: string; version: number };
/** Somente leitura da Evolution. Nunca pareia, cria grupo, envia ou assume uma reserva. */
export async function runDistribution(db: Database, transport: Transport) {
  const list = await db.rpc("whatsapp_distribution_connections");
  if (list.error || !Array.isArray(list.data) || list.data.length > 50)
    throw new Error("WA_DISTRIBUTION_UNAVAILABLE");
  const candidates = list.data as Candidate[];
  let raw: unknown;
  try {
    raw = await transport("/instance/fetchInstances", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!Array.isArray(raw)) return { state: "unavailable" as const, checked: 0 };
  } catch {
    // Não atualiza status, não prolonga a prova de conexão e não confunde falha da API com bloqueio.
    return { state: "unavailable" as const, checked: 0 };
  }
  const states = connectionStates(raw);
  const observations = candidates.map((c) => {
    const status = states.get(c.instance);
    const phone = instancePhone(raw, c.instance);
    const proven = status === "disconnected" || (status === "open" && phone === c.phone);
    return { ...c, status: proven ? status : "unknown", observed_phone: phone };
  });
  const recorded = await db.rpc("record_whatsapp_distribution_connections", {
    p_observations: observations,
  });
  if (recorded.error) throw new Error("WA_DISTRIBUTION_UNAVAILABLE");
  const result = await db.rpc("run_whatsapp_distribution");
  if (result.error) throw new Error("WA_DISTRIBUTION_UNAVAILABLE");
  return {
    state: "checked" as const,
    checked: observations.filter((o) => o.status !== "unknown").length,
    result: result.data,
  };
}
