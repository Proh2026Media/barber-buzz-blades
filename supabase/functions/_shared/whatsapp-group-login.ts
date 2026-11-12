import { groupSnapshot, inspectGroup } from "./whatsapp-groups.ts";

type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
type Context = {
  group_id: string;
  group_jid: string;
  version: number;
  instance_name: string;
  customer_phone: string;
  platform_phones: string[];
  sender_phone: string;
  purpose: "login" | "verify_phone";
  expires_at: string;
};
function validContext(value: unknown): value is Context {
  if (!value || typeof value !== "object") return false;
  const c = value as Context;
  const phone = (v: unknown) => typeof v === "string" && /^\+[1-9]\d{7,14}$/.test(v);
  return (
    ["login", "verify_phone"].includes(c.purpose) &&
    Date.parse(c.expires_at) > Date.now() &&
    typeof c.group_id === "string" &&
    /^[0-9a-f-]{36}$/i.test(c.group_id) &&
    typeof c.group_jid === "string" &&
    /^[0-9-]+@g\.us$/.test(c.group_jid) &&
    Number.isSafeInteger(c.version) &&
    c.version > 0 &&
    typeof c.instance_name === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(c.instance_name) &&
    phone(c.customer_phone) &&
    phone(c.sender_phone) &&
    Array.isArray(c.platform_phones) &&
    c.platform_phones.length > 0 &&
    c.platform_phones.every(phone) &&
    new Set(c.platform_phones).size === c.platform_phones.length &&
    c.platform_phones.includes(c.sender_phone) &&
    !c.platform_phones.includes(c.customer_phone)
  );
}

/** Envio protegido, desligado por padrão; ativação depende do piloto configurado. */
export async function sendGroupLogin(
  db: Database,
  input: { challengeId: string; codeHash: string; code: string },
  transport: Transport,
  enabled = false,
): Promise<"blocked" | "accepted" | "unknown"> {
  if (!enabled || !/^\d{6}$/.test(input.code)) return "blocked";
  const args = { p_challenge_id: input.challengeId, p_code_hash: input.codeHash };
  const candidate = await db.rpc("whatsapp_group_login_context", args);
  if (candidate.error || !validContext(candidate.data)) return "blocked";
  const context = candidate.data;
  const instance = encodeURIComponent(context.instance_name);
  try {
    const capabilities = (await transport(`/group/bcCapabilities/${instance}`, {
      signal: AbortSignal.timeout(5000),
    })) as { contract?: string; protectedCodes?: boolean; serializedCommands?: boolean };
    if (
      capabilities?.contract !== "bc-groups-v2" ||
      capabilities.protectedCodes !== true ||
      capabilities.serializedCommands !== true
    )
      return "blocked";
    const snapshot = groupSnapshot(
      await transport(
        `/group/bcInspect/${instance}?${new URLSearchParams({ groupJid: context.group_jid })}`,
        { signal: AbortSignal.timeout(5000) },
      ),
    );
    if (
      inspectGroup(
        {
          groupJid: context.group_jid,
          customerPhone: context.customer_phone,
          platformPhones: context.platform_phones,
          approvedPhones: [],
        },
        snapshot,
      ) !== "verified"
    )
      return "blocked";
  } catch {
    return "blocked";
  }
  // A leitura da rede não concede permissão: conta, versão, pausa e posse são revalidadas no banco.
  const authorized = await db.rpc("authorize_whatsapp_group_login", {
    ...args,
    p_expected: context,
  });
  const permit = authorized.data as {
    attempt_id?: string;
    group_jid?: string;
    instance_name?: string;
  } | null;
  if (
    authorized.error ||
    !permit?.attempt_id ||
    permit.group_jid !== context.group_jid ||
    permit.instance_name !== context.instance_name
  )
    return "blocked";
  let providerId: string | null = null;
  try {
    const result = (await transport(`/group/bcSendCode/${instance}`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        operationId: permit.attempt_id,
        groupJid: context.group_jid,
        customerJid: context.customer_phone.slice(1) + "@s.whatsapp.net",
        platformJids: context.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net"),
        purpose: context.purpose,
        expiresAt: context.expires_at,
        code: input.code,
      }),
    })) as { state?: string; messageId?: unknown };
    if (
      result?.state === "code_accepted" &&
      typeof result.messageId === "string" &&
      result.messageId.length > 0 &&
      result.messageId.length <= 200
    )
      providerId = result.messageId;
  } catch {
    /* Tentativa já persistida: não repetir nem enviar ao privado. */
  }
  try {
    await db.rpc("finish_whatsapp_send", {
      p_attempt_id: permit.attempt_id,
      p_provider_id: providerId,
    });
  } catch {
    /* O registro de início mantém a tentativa protegida. */
  }
  return providerId ? "accepted" : "unknown";
}
