import { advancePhoneRevision } from "./care-phone-revision.ts";
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
type Job = {
  user: string;
  shop: string;
  group: string | null;
  intent: string;
  kind: "revision" | "access" | "handoff";
};
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Usa exclusivamente intenções autenticadas persistidas. Não aceita cliente, telefone ou ciclo do chamador. */
export async function advanceCareEntryBackground(
  db: Database,
  observe: Transport,
  transport: Transport,
  process: (cycle: string) => Promise<string>,
) {
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await db.rpc(name, args);
    if (r.error) throw Error("ENTRY_BACKGROUND_UNAVAILABLE");
    return r.data;
  };
  const jobs = await rpc("care_entry_background_queue", {});
  if (
    !Array.isArray(jobs) ||
    jobs.length > 4 ||
    !jobs.every((j) => {
      const v = object(j);
      return (
        uuid(v.user) &&
        uuid(v.shop) &&
        uuid(v.intent) &&
        (v.group === null || uuid(v.group)) &&
        ["revision", "access", "handoff"].includes(String(v.kind))
      );
    })
  )
    throw Error("ENTRY_BACKGROUND_UNAVAILABLE");
  const states: string[] = [];
  for (const value of jobs) {
    const job = value as Job;
    let active: { id: string; token: string } | null = null;
    try {
      // O adaptador não fabrica sessão/JWT nem permite outras operações de titular.
      const intentDb: Database = {
        rpc: (name, args) => {
          if (name !== "continue_care_phone_revision" || args.p_shop !== job.shop)
            throw Error("ENTRY_BACKGROUND_FORBIDDEN");
          return db.rpc("continue_care_phone_revision_background", { ...args, p_user: job.user });
        },
      };
      let state: string;
      if (job.kind === "handoff") {
        await rpc("continue_care_phone_revision_background", {
          p_shop: job.shop,
          p_id: job.intent,
          p_user: job.user,
        });
        state = "phone_revised";
      } else if (job.kind === "revision") {
        const r = await advancePhoneRevision(job.user, job.shop, intentDb, db, observe, transport);
        state = r?.state ?? "waiting";
      } else {
        const claim = object(
          await rpc("claim_care_access", { p_user: job.user, p_shop: job.shop }),
        );
        if (!uuid(claim.id) || !uuid(claim.token)) {
          states.push("waiting");
          continue;
        }
        active = { id: claim.id, token: claim.token };
        const targets = claim.targets;
        if (
          !Array.isArray(targets) ||
          targets.length < 2 ||
          targets.length > 20 ||
          !targets.every((t) => {
            const n = object(t);
            return (
              uuid(n.id) &&
              typeof n.instance === "string" &&
              /^[A-Za-z0-9_-]{1,100}$/.test(n.instance) &&
              typeof n.phone === "string" &&
              /^\+[1-9][0-9]{7,14}$/.test(n.phone) &&
              Number.isSafeInteger(n.version)
            );
          })
        )
          throw Error("ENTRY_BACKGROUND_UNAVAILABLE");
        const raw = await observe("/instance/fetchInstances", {
          method: "GET",
          signal: AbortSignal.timeout(8000),
        });
        if (!Array.isArray(raw)) throw Error("ENTRY_BACKGROUND_UNAVAILABLE");
        const connections = connectionStates(raw);
        const observations = (targets as Target[]).map((t) => {
          const status = connections.get(t.instance),
            phone = instancePhone(raw, t.instance);
          return {
            ...t,
            observed_phone: phone,
            status:
              status === "disconnected" || (status === "open" && phone === t.phone)
                ? status
                : "unknown",
          };
        });
        await rpc("record_care_access_connections", {
          p_id: active.id,
          p_user: job.user,
          p_token: active.token,
          p_observations: observations,
        });
        const cycle = await rpc("resume_care_access_background", {
          p_id: active.id,
          p_user: job.user,
          p_token: active.token,
        });
        if (!uuid(cycle)) throw Error("ENTRY_BACKGROUND_UNAVAILABLE");
        state = await process(cycle);
        await rpc("finish_care_access", {
          p_id: active.id,
          p_user: job.user,
          p_token: active.token,
          p_failed: false,
        });
        active = null;
      }
      // Só antecipa a próxima etapa quando o diário comprova progresso. Espera normal mantém 10 s.
      await rpc("care_entry_background_progress", {
        p_user: job.user,
        p_shop: job.shop,
        p_state: state,
      });
      states.push(state);
    } catch {
      states.push("review");
      try {
        await rpc("care_entry_background_progress", {
          p_user: job.user,
          p_shop: job.shop,
          p_state: "review",
        });
      } catch {
        /* Sem sucesso inventado. */
      }
    } finally {
      if (active) {
        try {
          await rpc("finish_care_access", {
            p_id: active.id,
            p_user: job.user,
            p_token: active.token,
            p_failed: true,
          });
        } catch {
          /* A posse vence; o diário preserva a operação incerta. */
        }
      }
    }
  }
  return { processed: jobs.length, states };
}
