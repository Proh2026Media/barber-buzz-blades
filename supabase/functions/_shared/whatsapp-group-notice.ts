import { cycleHash } from "./care-cycles.ts";
import {
  inspectProtectedGroup,
  validProtectedGroupContext,
  type ProtectedGroupContext,
} from "./protected-group.ts";
import type { SendResult } from "./whatsapp-send.ts";
type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
/** Aviso/corpo e destino exclusivamente do banco; ausência de grupo nunca vira mensagem privada. */
export async function sendGroupNotice(
  db: Database,
  input: { outboxId: string; leaseToken: string },
  transport: Transport,
  enabled = false,
): Promise<SendResult> {
  const args = { p_outbox_id: input.outboxId, p_lease_token: input.leaseToken };
  const defer = async () => {
    try {
      return !(
        await db.rpc("defer_whatsapp_send", {
          p_id: input.outboxId,
          p_lease_token: input.leaseToken,
        })
      ).error;
    } catch {
      return false;
    }
  };
  if (!enabled) return { state: "blocked", recorded: await defer() };
  const candidate = await db.rpc("whatsapp_group_notice_context", args);
  if (candidate.error) throw Error("WA_AUTHORIZATION_UNAVAILABLE");
  const context = candidate.data as ProtectedGroupContext & { template_key: string };
  if (
    !validProtectedGroupContext(context) ||
    typeof context.template_key !== "string" ||
    !(await inspectProtectedGroup(transport, context))
  )
    return { state: "blocked", recorded: await defer() };
  const authorization = await db.rpc("authorize_whatsapp_group_notice", {
    ...args,
    p_expected: context,
  });
  if (authorization.error) throw Error("WA_AUTHORIZATION_UNAVAILABLE");
  const permit = authorization.data as
    | (typeof context & { attempt_id: string; body: string })
    | null;
  if (
    !permit?.attempt_id ||
    permit.group_jid !== context.group_jid ||
    permit.instance_name !== context.instance_name ||
    permit.cycle_id !== context.cycle_id ||
    typeof permit.body !== "string"
  )
    return { state: "blocked", recorded: await defer() };
  let providerId: string | null = null;
  try {
    const result = (await transport(
      `/group/bcSendNotice/${encodeURIComponent(permit.instance_name)}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          operationId: permit.attempt_id,
          groupJid: permit.group_jid,
          customerJid: permit.customer_phone.slice(1) + "@s.whatsapp.net",
          platformJids: permit.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net"),
          templateKey: permit.template_key,
          text: permit.body,
        }),
      },
    )) as Record<string, unknown>;
    const hash = await cycleHash([
      "notice",
      permit.sender_phone.slice(1) + "@s.whatsapp.net",
      permit.customer_phone.slice(1) + "@s.whatsapp.net",
      permit.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net").sort(),
      permit.template_key,
      await cycleHash(permit.body),
    ]);
    if (
      result?.state === "message_accepted" &&
      result.instanceId === "group:" + permit.group_jid &&
      result.groupJid === permit.group_jid &&
      result.operationKey === permit.attempt_id &&
      result.requestHash === hash &&
      typeof result.messageId === "string" &&
      result.messageId.length > 0 &&
      result.messageId.length <= 200
    )
      providerId = result.messageId;
  } catch {
    /* Tentativa já iniciada: não repetir, não alternar conta, não usar o privado. */
  }
  let recorded = false;
  try {
    recorded = !(
      await db.rpc("finish_whatsapp_send", {
        p_attempt_id: permit.attempt_id,
        p_provider_id: providerId,
      })
    ).error;
  } catch {
    /* Início durável conserva a barreira. */
  }
  return { state: providerId ? "accepted" : "unknown", recorded };
}
