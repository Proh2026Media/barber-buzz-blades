import { connectionStates } from "./whatsapp-health.ts";
import { instancePhone } from "./whatsapp-instance-phone.ts";

type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
type Target = { id: string; instance: string; phone: string; version: number };
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);

/** Só observa os números do grupo escolhido pelo banco para este desafio já emitido. Não envia nem cria desafio. */
export async function refreshWhatsappLoginRoute(
  db: Database,
  args: { p_challenge_id: string; p_code_hash: string },
  observe: Transport,
) {
  try {
    const r = await db.rpc("whatsapp_login_preflight", args);
    const candidate = r.data as { challenge?: unknown; targets?: Target[] } | null;
    const targets = candidate?.targets;
    if (
      r.error ||
      !candidate ||
      candidate.challenge !== args.p_challenge_id ||
      !Array.isArray(targets) ||
      targets.length < 2 ||
      targets.length > 5 ||
      !targets.every(
        (t) =>
          t &&
          uuid(t.id) &&
          typeof t.instance === "string" &&
          /^[A-Za-z0-9_-]{1,100}$/.test(t.instance) &&
          typeof t.phone === "string" &&
          /^\+[1-9]\d{7,14}$/.test(t.phone) &&
          Number.isSafeInteger(t.version) &&
          t.version >= 0,
      ) ||
      new Set(targets.map((t) => t.id)).size !== targets.length ||
      new Set(targets.map((t) => t.instance)).size !== targets.length ||
      new Set(targets.map((t) => t.phone)).size !== targets.length
    )
      return false;
    const raw = await observe("/instance/fetchInstances", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!Array.isArray(raw)) return false;
    const states = connectionStates(raw);
    const observations = targets.map((t) => {
      const state = states.get(t.instance),
        phone = instancePhone(raw, t.instance);
      return {
        ...t,
        observed_phone: phone,
        status:
          state === "disconnected" || (state === "open" && phone === t.phone) ? state : "unknown",
      };
    });
    const saved = await db.rpc("complete_whatsapp_login_preflight", {
      ...args,
      p_expected: candidate,
      p_observations: observations,
    });
    return !saved.error && saved.data === true;
  } catch {
    return false;
  }
}
