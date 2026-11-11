/** Política determinística. Identificadores LID nunca são tratados como telefone. */
export type GroupSnapshot = {
  id: string;
  locked: boolean;
  adminsAddOnly: boolean;
  approvalRequired: boolean;
  participants: { jid: string; admin: boolean }[];
};
export type GroupPolicy = {
  groupJid: string;
  customerPhone: string;
  platformPhones: string[];
  approvedPhones: string[];
};
export const EVOLUTION_GROUP_CAPABILITIES = Object.freeze({
  version: "2.3.7",
  create: true,
  inspect: true,
  editLock: true,
  memberAddControl: false,
  admissionControl: false,
  reliableCreateReconciliation: false,
});

export function individualPhone(jid: unknown): string | null {
  if (typeof jid !== "string") return null;
  const match = /^([1-9]\d{7,14})@s\.whatsapp\.net$/.exec(jid);
  return match ? `+${match[1]}` : null;
}

export function groupSnapshot(raw: unknown): GroupSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !/^[0-9-]+@g\.us$/.test(r.id) || !Array.isArray(r.participants))
    return null;
  // Ausência de campo não equivale a proteção habilitada. A 2.3.7 omite os dois últimos.
  return {
    id: r.id,
    locked: r.restrict === true,
    adminsAddOnly: r.memberAddMode === false,
    approvalRequired: r.joinApprovalMode === true,
    participants: r.participants.map((value) => {
      const p = value as { id?: unknown; admin?: unknown } | null;
      return {
        jid: typeof p?.id === "string" ? p.id : "",
        admin: p?.admin === "admin" || p?.admin === "superadmin",
      };
    }),
  };
}

export function inspectGroup(policy: GroupPolicy, snapshot: GroupSnapshot | null) {
  if (!snapshot || snapshot.id !== policy.groupJid) return "unverifiable" as const;
  const expected = new Set([
    policy.customerPhone,
    ...policy.platformPhones,
    ...policy.approvedPhones,
  ]);
  const seen = new Set<string>();
  let platformAdmin = false;
  for (const member of snapshot.participants) {
    const phone = individualPhone(member.jid);
    if (!phone || !expected.has(phone) || seen.has(phone)) return "divergence" as const;
    seen.add(phone);
    if (member.admin) {
      if (
        !policy.platformPhones.includes(phone) ||
        phone === policy.customerPhone ||
        policy.approvedPhones.includes(phone)
      )
        return "divergence" as const;
      platformAdmin = true;
    }
  }
  if (!seen.has(policy.customerPhone)) return "customer_left" as const;
  if (!platformAdmin || !snapshot.locked || !snapshot.adminsAddOnly || !snapshot.approvalRequired)
    return "unverifiable" as const;
  return "verified" as const;
}

/** Somente pedidos negativos inequívocos. Autorizações e privilégios nunca vêm do texto. */
export function stopIntent(text: unknown): "marketing" | "all" | null {
  if (typeof text !== "string" || text.length > 2000) return null;
  const clean = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (
    /^(nao quero (mais )?(promocoes|ofertas)|cancelar promocoes|stop promotions|no quiero promociones)[.!\s]*$/.test(
      clean,
    )
  )
    return "marketing";
  if (
    /^(pare( de mandar mensagens)?|parar|stop|nao (me )?(mande|envie) (mais )?mensagens|deja de enviar mensajes)[.!\s]*$/.test(
      clean,
    )
  )
    return "all";
  return null;
}

type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
export type GroupProvider = {
  canProvision: boolean;
  create: (operation: {
    instance: string;
    subject: string;
    platformPhones: string[];
  }) => Promise<{ id: string }>;
  configure: (instance: string, groupId: string) => Promise<void>;
  inspect: (instance: string, groupId: string) => Promise<unknown>;
};

/** A licença é persistida ANTES de criar. Timeout nunca provoca segunda criação. */
export async function processCareGroup(db: Database, provider: GroupProvider, operationId: string) {
  const claim = await db.rpc("claim_care_group_operation", {
    p_operation: operationId,
    p_capable: provider.canProvision,
  });
  if (claim.error) throw new Error("GROUP_AUTHORIZATION_UNAVAILABLE");
  const job = claim.data as {
    id: string;
    token: string;
    instance: string;
    group_jid: string | null;
    subject: string;
    platform_phones: string[];
  } | null;
  if (!job) return "blocked";
  let groupId = job.group_jid;
  try {
    if (!groupId) {
      const created = await provider.create({
        instance: job.instance,
        subject: job.subject,
        platformPhones: job.platform_phones,
      });
      if (!/^[0-9-]+@g\.us$/.test(created.id)) throw new Error("GROUP_RESULT_UNKNOWN");
      groupId = created.id;
      const persisted = await db.rpc("finish_care_group_creation", {
        p_operation: job.id,
        p_token: job.token,
        p_group_jid: groupId,
      });
      if (persisted.error) return "unknown";
    }
    await provider.configure(job.instance, groupId);
    // Nenhum nome é usado para reencontrar o grupo. Inspeção por ID persistido.
    const snapshot = groupSnapshot(await provider.inspect(job.instance, groupId));
    const saved = await db.rpc("observe_care_group", {
      p_operation: job.id,
      p_token: job.token,
      p_snapshot: snapshot,
    });
    if (saved.error) return "unknown";
    return "observed";
  } catch {
    await db.rpc("fail_care_group_operation", {
      p_operation: job.id,
      p_token: job.token,
      p_known_group: groupId,
    });
    return groupId ? "paused" : "unknown";
  }
}
