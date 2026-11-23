import { careGroupContent, type GroupContent } from "./care-group-content.ts";
import { inspectProtectedGroup, validProtectedGroupContext } from "./protected-group.ts";
import { recoverableGroupTransport } from "./recoverable-group-transport.ts";
import { cycleHash } from "./care-cycles.ts";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
export async function recoverWelcome(
  user: string,
  shop: string,
  request: string,
  rpc: Rpc,
  transport: Transport,
) {
  const args = { p_user: user, p_shop: shop };
  const context = await rpc("care_welcome_recovery_context", args);
  if (!validProtectedGroupContext(context)) throw Error("GROUP_UNAVAILABLE");
  const brand = (context as unknown as { brand: GroupContent }).brand;
  const { welcome } = careGroupContent({ ...brand, expires_at: context.cycle_expires_at });
  if (!(await inspectProtectedGroup(transport, context))) throw Error("GROUP_UNAVAILABLE");
  const permit = await rpc("care_welcome_recovery_context", {
    ...args,
    p_request: request,
    p_expected: context,
  });
  if (!validProtectedGroupContext(permit)) {
    if ((permit as { prior?: string })?.prior === "accepted") return { state: "accepted" };
    throw Error("GROUP_REVIEW_REQUIRED");
  }
  const platform = permit.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net").sort();
  const customer = permit.customer_phone.slice(1) + "@s.whatsapp.net";
  const template = "notice.welcome_recovery";
  let accepted = false;
  try {
    const r = (await recoverableGroupTransport(transport)(
      "/group/bcSendNotice/" + encodeURIComponent(permit.instance_name),
      {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          operationId: request,
          groupJid: permit.group_jid,
          customerJid: customer,
          platformJids: platform,
          templateKey: template,
          text: welcome,
        }),
      },
    )) as Record<string, unknown>;
    accepted =
      r?.state === "message_accepted" &&
      r.operationKey === request &&
      r.groupJid === permit.group_jid &&
      r.instanceId === "group:" + permit.group_jid &&
      typeof r.messageId === "string" &&
      r.messageId.length > 0 &&
      r.requestHash ===
        (await cycleHash([
          "notice",
          permit.sender_phone.slice(1) + "@s.whatsapp.net",
          customer,
          platform,
          template,
          await cycleHash(welcome),
        ]));
  } finally {
    await rpc("care_welcome_recovery_finish", { p_id: request, p_accepted: accepted });
  }
  if (!accepted) throw Error("GROUP_REVIEW_REQUIRED");
  return { state: "accepted" };
}
