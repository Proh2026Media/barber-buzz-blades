/** Política determinística. Identificadores LID nunca são tratados como telefone. */
export type GroupSnapshot = {
  id: string;
  locked: boolean;
  adminsAddOnly: boolean;
  approvalRequired: boolean;
  participants: { jid: string; admin: boolean; providerJid?: string }[];
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
      const p = value as {
        id?: unknown;
        phoneNumber?: unknown;
        lid?: unknown;
        admin?: unknown;
      } | null;
      const source = typeof p?.id === "string" ? p.id.replace(/:\d+@/, "@") : "";
      const direct = individualPhone(source);
      const linked = individualPhone(p?.phoneNumber);
      const isLid = /^[0-9]+@lid$/.test(source);
      const conflict =
        (p?.phoneNumber != null && (!linked || (direct && linked !== direct))) ||
        (isLid && p?.lid != null && source !== p.lid);
      const knownRole = p?.admin == null || p.admin === "admin" || p.admin === "superadmin";
      const resolved = !conflict && knownRole && (direct || (isLid && linked));
      return {
        jid: resolved ? `${resolved.slice(1)}@s.whatsapp.net` : "",
        providerJid: source,
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
  if (!platformAdmin || !snapshot.locked || !snapshot.adminsAddOnly || !snapshot.approvalRequired)
    return "unverifiable" as const;
  if (!seen.has(policy.customerPhone)) return "customer_left" as const;
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

export type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
export type CareGroupJob = {
  id: string;
  token: string;
  instance: string;
  group_jid: string | null;
  subject: string;
  platform_phones: string[];
  customer_phone: string;
  approved_phones: string[];
  removable_phones: string[];
  kind: "create" | "reconcile" | "remove" | "close";
  use_group: boolean;
  entry_pending: boolean;
};
type Before = () => Promise<void>;
export type GroupProvider = {
  canProvision: boolean;
  capabilities: (instance: string) => Promise<void>;
  create: (operation: {
    operationId: string;
    instance: string;
    subject: string;
    platformPhones: string[];
    before: Before;
  }) => Promise<{ id: string }>;
  recover: (operation: {
    operationId: string;
    instance: string;
    subject: string;
  }) => Promise<{ id: string }>;
  configure: (instance: string, groupId: string, before: Before) => Promise<void>;
  inspect: (instance: string, groupId: string) => Promise<unknown>;
  requests: (instance: string, groupId: string) => Promise<string[]>;
  decide: (
    instance: string,
    groupId: string,
    jid: string,
    action: "approve" | "reject",
    before: Before,
  ) => Promise<void>;
  member: (
    instance: string,
    groupId: string,
    jid: string,
    action: "add" | "remove",
    before: Before,
  ) => Promise<void>;
  invite: (instance: string, groupId: string, before: Before) => Promise<string>;
  revoke: (instance: string, groupId: string, before: Before) => Promise<void>;
};

/** Só o banco escolhe a instância, participantes e grupo. Nenhum ID vem do navegador. */
export async function processCareGroup(db: Database, provider: GroupProvider, operationId: string) {
  const claim = await db.rpc("claim_care_group_operation", {
    p_operation: operationId,
    p_capable: provider.canProvision,
  });
  if (claim.error) throw new Error("GROUP_AUTHORIZATION_UNAVAILABLE");
  let job = claim.data as CareGroupJob | null;
  if (!job) return "blocked";
  const id = job.id,
    token = job.token;
  let groupId = job.group_jid;
  const authorize = async (action: string) => {
    const result = await db.rpc("authorize_care_group_step", {
      p_operation: id,
      p_token: token,
      p_action: action,
    });
    if (result.error || !result.data) throw new Error("GROUP_STALE");
    const current = result.data as CareGroupJob;
    if (
      current.id !== id ||
      current.token !== token ||
      current.instance !== job!.instance ||
      (groupId && current.group_jid !== groupId)
    )
      throw new Error("GROUP_STALE");
    job = current;
  };
  const policy = (): GroupPolicy => ({
    groupJid: groupId!,
    customerPhone: job!.customer_phone,
    platformPhones: job!.platform_phones,
    approvedPhones: job!.approved_phones,
  });
  const snapshot = async () => {
    const value = groupSnapshot(await provider.inspect(job!.instance, groupId!));
    if (!value || value.id !== groupId) throw new Error("GROUP_UNVERIFIABLE");
    return value;
  };
  // Não corrigir automaticamente um administrador indevido nem adivinhar identidade LID.
  const structural = (value: GroupSnapshot) => {
    let admin = false;
    const phones = new Set<string>();
    for (const p of value.participants) {
      const phone = individualPhone(p.jid);
      if (!phone || phones.has(phone)) throw new Error("GROUP_DIVERGENCE");
      phones.add(phone);
      if (p.admin) {
        if (
          !job!.platform_phones.includes(phone) ||
          phone === job!.customer_phone ||
          job!.approved_phones.includes(phone) ||
          job!.removable_phones.includes(phone)
        )
          throw new Error("GROUP_DIVERGENCE");
        admin = true;
      }
    }
    if (!admin) throw new Error("GROUP_UNVERIFIABLE");
  };
  const observe = async (value: GroupSnapshot, invite: string | null = null) => {
    await authorize(job!.kind === "close" ? "close" : "observe");
    const result = await db.rpc("complete_care_group_operation", {
      p_operation: id,
      p_token: token,
      p_snapshot: value,
      p_invite: invite,
    });
    if (result.error) throw new Error("GROUP_STALE");
  };
  try {
    await authorize(job.kind === "close" ? "close" : "observe");
    await provider.capabilities(job!.instance);
    if (!groupId) {
      if (job!.kind === "close") throw new Error("GROUP_STALE");
      const created = await provider.create({
        operationId: id,
        instance: job!.instance,
        subject: job!.subject,
        platformPhones: job!.platform_phones,
        before: () => authorize("create"),
      });
      if (!/^[0-9-]+@g\.us$/.test(created.id)) throw new Error("GROUP_RESULT_UNKNOWN");
      groupId = created.id;
      const persisted = await db.rpc("finish_care_group_creation", {
        p_operation: id,
        p_token: token,
        p_group_jid: groupId,
      });
      if (persisted.error) return "unknown";
    }
    let value = await snapshot();
    structural(value);
    if (job!.kind === "close") {
      await provider.revoke(job!.instance, groupId, () => authorize("close"));
      for (const member of value.participants) {
        if (job!.platform_phones.includes(individualPhone(member.jid)!)) continue;
        // Encerramento retira somente as identidades que já tinham autorização registrada.
        if (
          ![job!.customer_phone, ...job!.removable_phones, ...job!.approved_phones].includes(
            individualPhone(member.jid)!,
          )
        )
          throw new Error("GROUP_DIVERGENCE");
        await provider.member(
          job!.instance,
          groupId,
          member.providerJid ?? member.jid,
          "remove",
          () => authorize("close"),
        );
      }
      value = await snapshot();
      structural(value);
      if (value.participants.some((p) => !job!.platform_phones.includes(individualPhone(p.jid)!)))
        throw new Error("GROUP_REMOVAL_UNCONFIRMED");
      await observe(value);
      return "closed";
    }
    // Participante revogado conhecido pode ser removido. Intruso desconhecido exige revisão.
    for (const member of value.participants) {
      const phone = individualPhone(member.jid)!;
      if (
        job!.removable_phones.includes(phone) &&
        !job!.approved_phones.includes(phone) &&
        phone !== job!.customer_phone
      ) {
        await provider.member(
          job!.instance,
          groupId,
          member.providerJid ?? member.jid,
          "remove",
          () => authorize("participants"),
        );
      } else if (
        ![job!.customer_phone, ...job!.platform_phones, ...job!.approved_phones].includes(phone)
      ) {
        throw new Error("GROUP_DIVERGENCE");
      }
    }
    value = await snapshot();
    structural(value);
    if (
      value.participants.some(
        (p) =>
          ![job!.customer_phone, ...job!.platform_phones, ...job!.approved_phones].includes(
            individualPhone(p.jid)!,
          ),
      )
    )
      throw new Error("GROUP_REMOVAL_UNCONFIRMED");
    // Cliente que já usou e saiu não é readmitido nem recebe um novo convite automaticamente.
    if (
      job!.use_group &&
      !job!.entry_pending &&
      !value.participants.some((p) => individualPhone(p.jid) === job!.customer_phone)
    ) {
      await observe(value);
      return "customer_left";
    }
    await provider.configure(job!.instance, groupId, () => authorize("configure"));
    const pending = await provider.requests(job!.instance, groupId);
    for (const jid of pending.sort(
      (a, b) =>
        Number(individualPhone(b) === job!.customer_phone) -
        Number(individualPhone(a) === job!.customer_phone),
    )) {
      await authorize("participants");
      value = await snapshot();
      structural(value);
      const phone = individualPhone(jid);
      const customerPresent = value.participants.some(
        (p) => individualPhone(p.jid) === job!.customer_phone,
      );
      const approved =
        phone === job!.customer_phone ||
        (customerPresent && phone !== null && job!.approved_phones.includes(phone));
      // Pedido LID sem correspondência autoritativa não é convertido em telefone.
      await provider.decide(job!.instance, groupId, jid, approved ? "approve" : "reject", () =>
        authorize("participants"),
      );
    }
    value = await snapshot();
    structural(value);
    if (value.participants.some((p) => individualPhone(p.jid) === job!.customer_phone)) {
      for (const phone of job!.approved_phones) {
        if (value.participants.some((p) => individualPhone(p.jid) === phone)) continue;
        await provider.member(
          job!.instance,
          groupId,
          `${phone.slice(1)}@s.whatsapp.net`,
          "add",
          () => authorize("participants"),
        );
        value = await snapshot();
        structural(value);
        if (!value.participants.some((p) => individualPhone(p.jid) === phone))
          throw new Error("GROUP_ADMISSION_UNCONFIRMED");
      }
    }
    value = await snapshot();
    const state = inspectGroup(policy(), value);
    if (state !== "verified" && !(state === "customer_left" && job!.entry_pending))
      throw new Error("GROUP_UNVERIFIABLE");
    // Só Cliente autenticado obtém esse convite pela RPC existente; nunca aparece ao worker HTTP.
    const invite =
      state === "customer_left"
        ? await provider.invite(job!.instance, groupId, () => authorize("invite"))
        : null;
    await observe(value, invite);
    return "observed";
  } catch (error) {
    const divergence =
      error instanceof Error &&
      ["GROUP_DIVERGENCE", "GROUP_REMOVAL_UNCONFIRMED", "GROUP_ADMISSION_UNCONFIRMED"].includes(
        error.message,
      );
    await db.rpc("fail_care_group_operation", {
      p_operation: id,
      p_token: token,
      p_known_group: groupId,
      p_reason: divergence ? "participants_changed" : "operation_unknown",
    });
    return groupId ? "paused" : "unknown";
  }
}

/** Recuperação somente por diário durável: GET, mesma chave e hash; jamais outra criação. */
export async function recoverCareGroup(db: Database, provider: GroupProvider, operationId: string) {
  if (!provider.canProvision) return "blocked";
  const result = await db.rpc("care_group_recovery_context", { p_operation: operationId });
  if (result.error || !result.data) return "blocked";
  const job = result.data as { id: string; instance: string; subject: string };
  try {
    const known = await provider.recover({
      operationId: job.id,
      instance: job.instance,
      subject: job.subject,
    });
    const saved = await db.rpc("recover_care_group_creation", {
      p_operation: job.id,
      p_group_jid: known.id,
    });
    return saved.error ? "unknown" : "recovered";
  } catch {
    return "unknown";
  }
}
