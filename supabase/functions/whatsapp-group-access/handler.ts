import { advancePhoneRevision } from "../_shared/care-phone-revision.ts";
import { connectionStates } from "../_shared/whatsapp-health.ts";
import { instancePhone } from "../_shared/whatsapp-instance-phone.ts";

type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Target = { id: string; instance: string; phone: string; version: number };
type Dependencies = {
  enabled: boolean;
  authenticate: (req: Request) => Promise<{ id: string; db: Database } | null>;
  service: Database;
  observe: (path: string, init: RequestInit) => Promise<unknown>;
  process: (cycleId: string) => Promise<string>;
  revisionTransport?: (path: string, init?: RequestInit) => Promise<unknown>;
};
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const allowedErrors = new Set([
  "GROUP_UNAVAILABLE",
  "GROUP_STALE",
  "GROUP_PHONE_UNAVAILABLE",
  "GROUP_PARTICIPANTS_CHANGED",
  "GROUP_REVIEW_REQUIRED",
  "WA_RATE_LIMIT",
  "42501",
  "GROUP_BUSY",
  "GROUP_PHONE_PROOF_INVALID",
]);
/** O JWT do titular escolhe a intenção; o serviço nunca aceita ciclo, instância ou destinatário do navegador. */
export async function handleCareAccess(req: Request, deps: Dependencies) {
  const reply = (data: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return reply(null, 204);
  if (req.method !== "POST") return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
  let active: { id: string; token: string; user: string } | null = null;
  let failed = true;
  try {
    const user = await deps.authenticate(req);
    if (!user) return reply({ code: "42501" }, 401);
    if (!deps.enabled) return reply({ code: "GROUP_UNAVAILABLE" }, 503);
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 16384) {
            await reader.cancel();
            return reply({ code: "INVALID_REQUEST" }, 413);
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: Record<string, unknown>;
    try {
      body = object(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return reply({ code: "INVALID_REQUEST" }, 400);
    }
    if (!uuid(body.shop) || !["start", "advance", "revise", "abort"].includes(String(body.action)))
      return reply({ code: "INVALID_REQUEST" }, 400);
    const rpc = async (db: Database, name: string, args: Record<string, unknown>) => {
      const result = await db.rpc(name, args);
      if (result.error) {
        const e = object(result.error);
        throw Error(
          allowedErrors.has(String(e.message))
            ? String(e.message)
            : allowedErrors.has(String(e.code))
              ? String(e.code)
              : "ACCESS_UNAVAILABLE",
        );
      }
      return result.data;
    };
    if (body.action === "start" || body.action === "revise") {
      if (
        body.accept !== true ||
        typeof body.phone !== "string" ||
        body.phone.length > 40 ||
        !Array.isArray(body.accounts) ||
        body.accounts.length < 2 ||
        body.accounts.length > 20 ||
        !body.accounts.every(uuid) ||
        (body.group != null && !uuid(body.group)) ||
        (body.version != null && (!Number.isSafeInteger(body.version) || Number(body.version) < 0))
      )
        return reply({ code: "INVALID_REQUEST" }, 400);
      if (
        body.action === "revise" &&
        (!deps.revisionTransport || !uuid(body.group) || !Number.isSafeInteger(body.version))
      )
        return reply({ code: "INVALID_REQUEST" }, 400);
      await rpc(
        user.db,
        body.action === "revise" ? "care_phone_revision_start" : "care_access_start",
        {
          p_shop: body.shop,
          p_phone: body.phone,
          p_accounts: body.accounts,
          p_accept: true,
          p_group: body.group ?? null,
          p_version: body.version ?? null,
        },
      );
    }
    if (body.action === "abort") {
      if (!deps.revisionTransport || !uuid(body.revision))
        return reply({ code: "INVALID_REQUEST" }, 400);
      await rpc(user.db, "care_phone_revision_abort", { p_shop: body.shop, p_id: body.revision });
    }
    if (deps.revisionTransport) {
      const revision = await advancePhoneRevision(
        user.id,
        body.shop,
        user.db,
        deps.service,
        deps.observe,
        deps.revisionTransport,
      );
      if (revision)
        return reply({
          ...revision,
          data: await rpc(user.db, "care_group_read", { p_shop: body.shop }),
        });
    }
    const claim = object(
      await rpc(deps.service, "claim_care_access", { p_user: user.id, p_shop: body.shop }),
    );
    let state = "inactive";
    if (claim.waiting === true) state = "waiting";
    else if (uuid(claim.id) && uuid(claim.token)) {
      active = { id: claim.id, token: claim.token, user: user.id };
      const targets = claim.targets;
      if (
        !Array.isArray(targets) ||
        targets.length < 2 ||
        targets.length > 20 ||
        !targets.every(
          (t: Target) =>
            uuid(t.id) &&
            typeof t.instance === "string" &&
            /^[A-Za-z0-9_-]{1,100}$/.test(t.instance) &&
            /^\+[1-9][0-9]{7,14}$/.test(t.phone) &&
            Number.isSafeInteger(t.version),
        )
      )
        throw Error("ACCESS_UNAVAILABLE");
      const raw = await deps.observe("/instance/fetchInstances", {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      if (!Array.isArray(raw)) throw Error("ACCESS_CONNECTIONS_UNAVAILABLE");
      const states = connectionStates(raw);
      const observations = (targets as Target[]).map((target) => {
        const status = states.get(target.instance),
          phone = instancePhone(raw, target.instance);
        return {
          ...target,
          observed_phone: phone,
          status:
            status === "disconnected" || (status === "open" && phone === target.phone)
              ? status
              : "unknown",
        };
      });
      await rpc(deps.service, "record_care_access_connections", {
        p_id: active.id,
        p_user: user.id,
        p_token: active.token,
        p_observations: observations,
      });
      const cycle = await rpc(user.db, "resume_care_access", {
        p_id: active.id,
        p_token: active.token,
      });
      if (!uuid(cycle)) throw Error("ACCESS_UNAVAILABLE");
      // Conserva diário/leases, presença, ordem pós-entrada e provas de recebimento do motor já instalado.
      state = await deps.process(cycle);
      failed = false;
      await rpc(deps.service, "finish_care_access", {
        p_id: active.id,
        p_user: user.id,
        p_token: active.token,
        p_failed: false,
      });
      active = null;
    }
    const data = await rpc(user.db, "care_group_read", { p_shop: body.shop });
    return reply({ state, data });
  } catch (error) {
    const code =
      error instanceof Error && allowedErrors.has(error.message)
        ? error.message
        : "ACCESS_UNAVAILABLE";
    return reply({ code }, code === "42501" ? 403 : 503);
  } finally {
    if (active) {
      // Finalização incerta nunca libera outro envio: o motor ainda conserva sua própria posse e diário.
      try {
        await deps.service.rpc("finish_care_access", {
          p_id: active.id,
          p_user: active.user,
          p_token: active.token,
          p_failed: failed,
        });
      } catch {
        /* Posse vence sozinha; sem dados sensíveis em log. */
      }
    }
  }
}
