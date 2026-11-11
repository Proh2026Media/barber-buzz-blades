import {
  groupSnapshot,
  individualPhone,
  processCareGroup,
  stopIntent,
  type GroupProvider,
} from "../_shared/whatsapp-groups.ts";

type Database = Parameters<typeof processCareGroup>[0];
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function secretMatches(received: string | null, expected: string) {
  if (!received || expected.length < 32) return false;
  const a = await digest(received),
    b = await digest(expected);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Webhook usa cabeçalho secreto configurável da Evolution, não assinatura inventada. */
export async function handleCareGroups(
  req: Request,
  db: Database,
  provider: GroupProvider,
  secrets: { service: string; webhook: string },
) {
  if (req.method !== "POST") return answer({ error: "Método não permitido" }, 405);
  const isWorker = await secretMatches(
    req.headers.get("authorization"),
    `Bearer ${secrets.service}`,
  );
  const isWebhook = await secretMatches(req.headers.get("x-bc-group-secret"), secrets.webhook);
  if (!isWorker && !isWebhook) return answer({ error: "Sem autorização" }, 401);
  if (Number(req.headers.get("content-length")) > 131072)
    return answer({ error: "Evento excede o limite" }, 413);
  try {
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 131072) {
            await reader.cancel();
            return answer({ error: "Evento excede o limite" }, 413);
          }
          chunks.push(value);
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
    const text = new TextDecoder().decode(bytes);
    const body = JSON.parse(text);
    if (isWorker) {
      if (body.action === "purge") {
        const result = await db.rpc("purge_care_group_audit", {});
        return answer({ ok: !result.error }, result.error ? 503 : 200);
      }
      if (body.action !== "process" || typeof body.operation_id !== "string")
        return answer({ error: "Operação inválida" }, 400);
      const state = await processCareGroup(db, provider, body.operation_id);
      return answer({ state });
    }
    const kind = String(body.event ?? "")
      .toLowerCase()
      .replaceAll("_", ".");
    if (!["group.participants.update", "groups.update", "messages.upsert"].includes(kind))
      return answer({ ignored: true });
    if (typeof body.instance !== "string" || body.instance.length > 100)
      return answer({ error: "Instância inválida" }, 400);
    const list = Array.isArray(body.data) ? body.data : [body.data];
    if (list.length > 50) return answer({ error: "Muitos eventos" }, 413);
    for (const item of list) {
      const jid = kind === "messages.upsert" ? item?.key?.remoteJid : item?.id;
      if (typeof jid !== "string" || !/^[0-9-]+@g\.us$/.test(jid)) continue;
      const fromMe = item?.key?.fromMe === true;
      const sender = individualPhone(item?.key?.participant);
      // Não usar participantAlt/phoneNumber quando a origem puder ser um LID não resolvido.
      const content = item?.message?.conversation ?? item?.message?.extendedTextMessage?.text;
      const intent = fromMe ? null : stopIntent(content);
      const eventKey = await digest(
        JSON.stringify([
          body.instance,
          kind,
          jid,
          item?.key?.id ?? null,
          body.date_time ?? null,
          kind === "messages.upsert" ? intent : item,
        ]),
      );
      const result = await db.rpc("care_group_event", {
        p_instance: body.instance,
        p_group_jid: jid,
        p_event_key: eventKey,
        p_kind: kind === "group.participants.update" ? "group-participants.update" : kind,
        p_sender: sender,
        p_stop: intent,
        p_from_me: fromMe,
      });
      if (result.error) return answer({ error: "Conferência indisponível" }, 503);
    }
    return answer({ ok: true });
  } catch {
    return answer({ error: "Não foi possível conferir a operação" }, 503);
  }
}

export { groupSnapshot };
