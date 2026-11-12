import { groupSnapshot, individualPhone, type GroupProvider } from "./whatsapp-groups.ts";

export type GroupTransport = (path: string, init?: RequestInit) => Promise<unknown>;
const fail = (): never => {
  throw new Error("GROUP_PROVIDER_UNVERIFIABLE");
};
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : fail();
export async function creationHash(subject: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([subject, []])),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Transporte injetado: o mesmo contrato é ensaiado sem conexão com a Evolution real. */
export function evolutionGroupProvider(request: GroupTransport, enabled = false): GroupProvider {
  const path = (route: string, instance: string) => {
    if (!enabled || !/^[A-Za-z0-9_-]{1,100}$/.test(instance)) return fail();
    return `/group/${route}/${encodeURIComponent(instance)}`;
  };
  const get = (route: string, instance: string, args: Record<string, string> = {}) =>
    request(path(route, instance) + "?" + new URLSearchParams(args), {
      signal: AbortSignal.timeout(5000),
    });
  const post = async (
    route: string,
    instance: string,
    body: unknown,
    before: () => Promise<void>,
  ) => {
    await before();
    return request(path(route, instance), {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  };
  const inspect = async (instance: string, groupId: string) => {
    const raw = await get("bcInspect", instance, { groupJid: groupId });
    const snapshot = groupSnapshot(raw);
    if (!snapshot || snapshot.id !== groupId) return fail();
    return raw;
  };
  const created = async (result: unknown, operationId: string, subject: string) => {
    const r = record(result);
    if (
      r.operationKey !== operationId ||
      r.requestHash !== (await creationHash(subject)) ||
      r.state !== "created" ||
      typeof r.groupJid !== "string" ||
      !/^[0-9-]+@g\.us$/.test(r.groupJid)
    )
      return fail();
    return { id: r.groupJid };
  };
  return {
    canProvision: enabled,
    capabilities: async (instance) => {
      const c = record(await get("bcCapabilities", instance));
      if (
        c.contract !== "bc-groups-v2" ||
        c.memberAddControl !== true ||
        c.admissionControl !== true ||
        c.persistentOperations !== true
      )
        fail();
    },
    create: async (job) =>
      created(
        await post(
          "bcCreate",
          job.instance,
          {
            operationId: job.operationId,
            subject: job.subject,
            participants: [],
          },
          job.before,
        ),
        job.operationId,
        job.subject,
      ),
    recover: async (job) =>
      created(
        await get("bcCreateStatus", job.instance, { operationId: job.operationId }),
        job.operationId,
        job.subject,
      ),
    inspect,
    configure: async (instance, groupJid, before) => {
      // Somente proteger; nunca desbloquear, desligar aprovação ou promover participantes.
      const prior = groupSnapshot(await inspect(instance, groupJid));
      if (!prior?.locked) await post("bcSetting", instance, { groupJid }, before);
      if (!prior?.adminsAddOnly)
        await post("updateMemberAddMode", instance, { groupJid, mode: "admin_add" }, before);
      if (!prior?.approvalRequired)
        await post("updateJoinApprovalMode", instance, { groupJid, mode: "on" }, before);
      const snapshot = groupSnapshot(await inspect(instance, groupJid));
      if (!snapshot?.locked || !snapshot.adminsAddOnly || !snapshot.approvalRequired) fail();
    },
    requests: async (instance, groupJid) => {
      const result = await get("joinRequests", instance, { groupJid });
      if (!Array.isArray(result) || result.length > 50) return fail();
      return result.map((item) => {
        const r = record(item);
        if (typeof r.jid !== "string" || !/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(r.jid))
          return fail();
        return r.jid;
      });
    },
    decide: async (instance, groupJid, jid, action, before) => {
      await post("joinRequests", instance, { groupJid, participants: [jid], action }, before);
    },
    member: async (instance, groupJid, jid, action, before) => {
      if (!individualPhone(jid) && !/^[0-9]+@lid$/.test(jid)) fail();
      await post("bcMember", instance, { groupJid, jid, action }, before);
    },
    invite: async (instance, groupJid, before) => {
      await before();
      const value = record(await get("bcInvite", instance, { groupJid })).inviteUrl;
      if (
        typeof value !== "string" ||
        !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,100}$/.test(value)
      )
        return fail();
      return value;
    },
    revoke: async (instance, groupJid, before) => {
      const result = record(await post("bcRevoke", instance, { groupJid }, before));
      if (result.revoked !== true) fail();
    },
  };
}
