import { sendGroupNotice } from "./whatsapp-group-notice.ts";
type Database = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
type Input =
  | { outboxId: string; leaseToken: string }
  | { challengeId: string; instance: string; codeHash: string; text: string };
export type SendResult = {
  state: "accepted" | "unknown" | "blocked";
  recorded: boolean;
  reason?: string;
};
/** Avisos só usam o contrato de grupos. Códigos passam exclusivamente por sendGroupLogin. */
export async function sendWhatsapp(
  db: Database,
  input: Input,
  transport: Transport,
  groupsEnabled = false,
): Promise<SendResult> {
  if ("outboxId" in input) return sendGroupNotice(db, input, transport, groupsEnabled);
  return { state: "blocked", recorded: true, reason: "protected_group_contract_required" };
}
