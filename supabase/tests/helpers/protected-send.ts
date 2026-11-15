import { cycleHash } from "../../functions/_shared/care-cycles.ts";
export function protectedSendContext(instance = "autorizada") {
  return {
    group_id: "11111111-1111-4111-8111-111111111111",
    cycle_id: "22222222-2222-4222-8222-222222222222",
    version: 1,
    cycle_revision: 1,
    cycle_expires_at: new Date(Date.now() + 86400000).toISOString(),
    first_message_id: "welcome",
    creator_phone: "+5511888888888",
    group_jid: "55555-77777@g.us",
    instance_name: instance,
    customer_phone: "+5511999999999",
    platform_phones: ["+5511888888888", "+5511666666666"],
    sender_phone: "+5511888888888",
    template_key: "customer.notice",
  };
}
export function protectedSendRead(path: string, c = protectedSendContext()) {
  if (path.includes("/bcCapabilities/"))
    return {
      contract: "bc-groups-v3",
      protectedCycle: true,
      twoPlatformAdmins: true,
      serializedCommands: true,
      protectedCodes: true,
      protectedNotices: true,
    };
  if (path.includes("/bcInspect/"))
    return {
      id: c.group_jid,
      restrict: true,
      memberAddMode: false,
      joinApprovalMode: true,
      participants: [
        ...c.platform_phones.map((p) => ({ id: p.slice(1) + "@s.whatsapp.net", admin: "admin" })),
        { id: c.customer_phone.slice(1) + "@s.whatsapp.net", admin: null },
      ],
    };
  if (path.includes("/bcCycle/"))
    return {
      ready: true,
      cycle: {
        cycleId: c.cycle_id,
        groupJid: c.group_jid,
        customerJid: c.customer_phone.slice(1) + "@s.whatsapp.net",
        creatorJid: c.creator_phone.slice(1) + "@s.whatsapp.net",
        firstMessageId: c.first_message_id,
        firstSenderJid: "5511666666666@s.whatsapp.net",
        firstReceived: true,
        firstViolation: false,
        closing: false,
        closed: false,
        expiresAt: c.cycle_expires_at,
        platformJids: c.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net"),
      },
    };
  throw Error("Consulta não prevista");
}
export async function protectedSendAcceptance(
  body: Record<string, unknown>,
  c = protectedSendContext(),
) {
  return {
    state: "message_accepted",
    messageId: "aceite",
    operationKey: body.operationId,
    groupJid: c.group_jid,
    instanceId: "group:" + c.group_jid,
    requestHash: await cycleHash([
      "notice",
      c.sender_phone.slice(1) + "@s.whatsapp.net",
      c.customer_phone.slice(1) + "@s.whatsapp.net",
      c.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net").sort(),
      body.templateKey,
      await cycleHash(body.text),
    ]),
  };
}
