import { groupSnapshot, inspectGroup } from "./whatsapp-groups.ts";
export type ProtectedGroupContext = {
  group_id: string;
  group_jid: string;
  version: number;
  cycle_id: string;
  cycle_revision: number;
  cycle_expires_at: string;
  creator_phone: string;
  first_message_id: string;
  admission_id: string;
  welcome_message_id: string;
  instance_name: string;
  customer_phone: string;
  platform_phones: string[];
  sender_phone: string;
};
export function validProtectedGroupContext(value: unknown): value is ProtectedGroupContext {
  if (!value || typeof value !== "object") return false;
  const c = value as ProtectedGroupContext;
  const phone = (v: unknown) => typeof v === "string" && /^\+[1-9]\d{7,14}$/.test(v);
  const uuid = (v: unknown) =>
    typeof v === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
  return (
    uuid(c.group_id) &&
    uuid(c.cycle_id) &&
    uuid(c.admission_id) &&
    typeof c.welcome_message_id === "string" &&
    c.welcome_message_id.length > 0 &&
    c.welcome_message_id.length <= 200 &&
    Number.isSafeInteger(c.version) &&
    c.version > 0 &&
    Number.isSafeInteger(c.cycle_revision) &&
    c.cycle_revision > 0 &&
    typeof c.group_jid === "string" &&
    /^[0-9-]+@g\.us$/.test(c.group_jid) &&
    typeof c.instance_name === "string" &&
    /^[A-Za-z0-9_-]{1,100}$/.test(c.instance_name) &&
    typeof c.cycle_expires_at === "string" &&
    Date.parse(c.cycle_expires_at) > Date.now() &&
    phone(c.customer_phone) &&
    phone(c.sender_phone) &&
    phone(c.creator_phone) &&
    Array.isArray(c.platform_phones) &&
    c.platform_phones.length >= 2 &&
    c.platform_phones.length <= 20 &&
    c.platform_phones.every(phone) &&
    new Set(c.platform_phones).size === c.platform_phones.length &&
    !c.platform_phones.includes(c.customer_phone) &&
    c.platform_phones.includes(c.sender_phone) &&
    c.platform_phones.includes(c.creator_phone) &&
    typeof c.first_message_id === "string" &&
    c.first_message_id.length > 0 &&
    c.first_message_id.length <= 200
  );
}
export async function inspectProtectedGroup(
  transport: (path: string, init?: RequestInit) => Promise<unknown>,
  context: ProtectedGroupContext,
) {
  if (!validProtectedGroupContext(context)) return false;
  const instance = encodeURIComponent(context.instance_name);
  try {
    const capabilities = (await transport(`/group/bcCapabilities/${instance}`, {
      signal: AbortSignal.timeout(5000),
    })) as {
      contract?: string;
      protectedCodes?: boolean;
      protectedNotices?: boolean;
      serializedCommands?: boolean;
      protectedCycle?: boolean;
      postAdmissionWelcome?: boolean;
      twoPlatformAdmins?: boolean;
    };
    if (
      capabilities?.contract !== "bc-groups-v4" ||
      capabilities.protectedCodes !== true ||
      capabilities.protectedNotices !== true ||
      capabilities.serializedCommands !== true ||
      capabilities.protectedCycle !== true ||
      capabilities.postAdmissionWelcome !== true ||
      capabilities.twoPlatformAdmins !== true
    )
      return false;
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
      return false;
    if (
      !context.platform_phones.every((phone) =>
        snapshot?.participants.some((m) => m.jid === phone.slice(1) + "@s.whatsapp.net" && m.admin),
      )
    )
      return false;
    const observed = (await transport(
      `/group/bcCycle/${instance}?${new URLSearchParams({ groupJid: context.group_jid })}`,
      { signal: AbortSignal.timeout(5000) },
    )) as { ready?: boolean; cycle?: Record<string, unknown> };
    const c = observed?.cycle;
    if (
      observed.ready !== true ||
      !c ||
      c.cycleId !== context.cycle_id ||
      c.groupJid !== context.group_jid ||
      c.customerJid !== context.customer_phone.slice(1) + "@s.whatsapp.net" ||
      c.creatorJid !== context.creator_phone.slice(1) + "@s.whatsapp.net" ||
      c.firstMessageId !== context.first_message_id ||
      c.firstReceived !== true ||
      c.firstSenderJid === c.creatorJid ||
      !context.platform_phones.some(
        (phone) => c.firstSenderJid === phone.slice(1) + "@s.whatsapp.net",
      ) ||
      c.lastWelcomeReceived !== true ||
      c.lastWelcomeAdmissionId !== context.admission_id ||
      c.lastWelcomeMessageId !== context.welcome_message_id ||
      c.firstViolation !== false ||
      c.closing !== false ||
      c.closed !== false ||
      Date.parse(String(c.expiresAt)) !== Date.parse(context.cycle_expires_at) ||
      !Array.isArray(c.platformJids) ||
      JSON.stringify([...c.platformJids].sort()) !==
        JSON.stringify(context.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net").sort())
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
