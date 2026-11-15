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
  id: string;
  token: string;
  shop: string;
  cycle_id: string;
  group_jid: string;
  creator_instance: string;
  targets: Target[];
  phase: string;
  abort: boolean;
  payload: Record<string, unknown>;
  commit_token?: string;
};
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const controlled = new Set([
  "GROUP_UNAVAILABLE",
  "GROUP_STALE",
  "GROUP_PHONE_UNAVAILABLE",
  "GROUP_PARTICIPANTS_CHANGED",
  "GROUP_REVIEW_REQUIRED",
  "GROUP_BUSY",
  "WA_RATE_LIMIT",
  "GROUP_PHONE_PROOF_INVALID",
]);
/** Somente o titular autenticado escolhe a intenção. Contexto físico/nonce vem do banco privado. */
export async function advancePhoneRevision(
  user: string,
  shop: string,
  userDb: Database,
  db: Database,
  observe: (path: string, init: RequestInit) => Promise<unknown>,
  transport: Transport,
) {
  const rpc = async (client: Database, name: string, args: Record<string, unknown>) => {
    const r = await client.rpc(name, args);
    if (r.error) {
      const e = object(r.error);
      throw Error(controlled.has(String(e.message)) ? String(e.message) : "ACCESS_UNAVAILABLE");
    }
    return r.data;
  };
  const value = await rpc(db, "claim_care_phone_revision", { p_user: user, p_shop: shop });
  if (!value) return null;
  const claim = object(value);
  if (claim.waiting === true || claim.blocked === true)
    return { state: claim.blocked ? "phone_review" : "phone_waiting" };
  if (
    !uuid(claim.id) ||
    !uuid(claim.token) ||
    !uuid(claim.cycle_id) ||
    !Array.isArray(claim.targets) ||
    claim.targets.length < 2 ||
    claim.targets.length > 20 ||
    !claim.targets.every(
      (t: Target) =>
        uuid(t.id) &&
        typeof t.instance === "string" &&
        /^[A-Za-z0-9_-]{1,100}$/.test(t.instance) &&
        /^\+[1-9][0-9]{7,14}$/.test(t.phone) &&
        Number.isSafeInteger(t.version),
    ) ||
    typeof claim.group_jid !== "string" ||
    !/^[0-9-]+@g\.us$/.test(claim.group_jid)
  )
    throw Error("ACCESS_UNAVAILABLE");
  const job = claim as unknown as Job;
  let failed = true;
  const args = { p_id: job.id, p_user: user, p_token: job.token };
  const post = async (action: string, extra: Record<string, unknown> = {}) =>
    object(
      await transport(`/group/bcPhoneRevision/${job.creator_instance}`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ action, groupJid: job.group_jid, revisionId: job.id, ...extra }),
      }),
    );
  const record = async (result: Record<string, unknown>) =>
    object(
      await rpc(db, "record_care_phone_revision", {
        ...args,
        p_proof: result.revision,
        p_invite: typeof result.inviteUrl === "string" ? result.inviteUrl : null,
      }),
    );
  try {
    const raw = await observe("/instance/fetchInstances", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!Array.isArray(raw)) throw Error("ACCESS_UNAVAILABLE");
    const states = connectionStates(raw);
    const observations = job.targets.map((t) => {
      const status = states.get(t.instance),
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
    await rpc(db, "record_care_phone_revision_connections", {
      ...args,
      p_observations: observations,
    });
    const live = observations.filter((t) => t.status === "open");
    if (live.length < 2 || !live.some((t) => t.instance === job.creator_instance))
      throw Error("GROUP_PARTICIPANTS_CHANGED");
    await Promise.all(
      live.slice(0, 2).map(async (t) => {
        const caps = object(
          await transport(`/group/bcCapabilities/${t.instance}`, {
            method: "GET",
            signal: AbortSignal.timeout(8000),
          }),
        );
        if (
          caps.contract !== "bc-groups-v4" ||
          caps.protectedPhoneRevision !== true ||
          caps.postAdmissionWelcome !== true
        )
          throw Error("GROUP_REVIEW_REQUIRED");
      }),
    );
    // Prepare é idempotente e devolve o diário real se bind/finalize perderam a resposta.
    let result = job.abort
      ? await post("abort", { ...job.payload, action: "abort" })
      : await post("prepare", job.payload);
    let revision = object(result.revision);
    if (revision.phase === "aborted") {
      await record(result);
      failed = false;
      return { state: "phone_aborted" };
    }
    if (revision.phase === "pending") {
      if (job.abort || result.expired === true) {
        result = await post("abort");
        await record(result);
        failed = false;
        return { state: "phone_aborted" };
      }
      await record(result);
      if (result.requestPresent !== true) {
        failed = false;
        return { state: "phone_waiting" };
      }
      await rpc(db, "authorize_care_phone_binding", args);
      if (job.phase !== "binding") {
        failed = false;
        return { state: "phone_binding" };
      }
      result = await post("bind");
      await record(result);
      failed = false;
      return { state: "phone_binding" };
    }
    if (revision.phase === "bound") {
      const ack = await record(result);
      if (typeof ack.commit_token !== "string" || !uuid(ack.commit_token))
        throw Error("GROUP_PHONE_PROOF_INVALID");
      result = await post("finalize", { commitToken: ack.commit_token });
      revision = object(result.revision);
    }
    if (revision.phase !== "committed") throw Error("GROUP_PHONE_PROOF_INVALID");
    await record(result);
    await rpc(userDb, "continue_care_phone_revision", { p_shop: shop, p_id: job.id });
    failed = false;
    return { state: "phone_revised" };
  } finally {
    try {
      await db.rpc("finish_care_phone_revision", { ...args, p_failed: failed });
    } catch {
      /* Posse e diário preservam resultado incerto; nada de reenvio ou PV. */
    }
  }
}
