import {
  processCareCycle,
  syncCareCycleRegistry,
  type CycleTransport,
  type CycleLogo,
} from "../_shared/care-cycles.ts";
import {
  groupSnapshot,
  individualPhone,
  processCareGroup,
  recoverCareGroup,
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
  cycles?: { enabled: boolean; transport: CycleTransport; logo: CycleLogo },
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
    if (isWorker && body.action === "purge") {
      const result = await db.rpc("purge_care_group_audit", {});
      return answer({ ok: !result.error }, result.error ? 503 : 200);
    }
    if (isWorker && cycles) {
      if (!cycles.enabled) return answer({ state: "blocked" });
      if (body.action === "reconcile") {
        const registry = await syncCareCycleRegistry(db, cycles.transport, true);
        const queued = await db.rpc("queue_care_cycles", {});
        if (queued.error || !Array.isArray(queued.data) || queued.data.length > 5)
          return answer({ error: "Conferência indisponível" }, 503);
        const states: string[] = [];
        for (const id of queued.data) {
          if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
            return answer({ error: "Operação inválida" }, 503);
          states.push(await processCareCycle(db, cycles.transport, id, cycles.logo, true));
        }
        return answer({ states, registry });
      }
      if (
        body.action === "process" &&
        typeof body.cycle_id === "string" &&
        /^[a-f0-9-]{36}$/i.test(body.cycle_id)
      )
        return answer({
          state: await processCareCycle(db, cycles.transport, body.cycle_id, cycles.logo, true),
        });
      return answer({ error: "Operação inválida" }, 400);
    }
    if (isWorker) {
      if (body.action === "reconcile") {
        if (!provider.canProvision) return answer({ state: "blocked" });
        const pending = await db.rpc("queue_care_group_reconciliation", {});
        if (pending.error || !Array.isArray(pending.data))
          return answer({ error: "Conferência indisponível" }, 503);
        const states: string[] = [];
        for (const id of pending.data.slice(0, 5)) {
          if (typeof id !== "string") return answer({ error: "Operação inválida" }, 503);
          states.push(await processCareGroup(db, provider, id));
        }
        return answer({ states });
      }
      if (
        !["process", "recover"].includes(body.action) ||
        typeof body.operation_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.operation_id)
      )
        return answer({ error: "Operação inválida" }, 400);
      const state =
        body.action === "recover"
          ? await recoverCareGroup(db, provider, body.operation_id)
          : await processCareGroup(db, provider, body.operation_id);
      return answer({ state });
    }
    const kind = String(body.event ?? "")
      .toLowerCase()
      .replace(/[_-]/g, ".");
    if (
      ![
        "group.participants.update",
        "group.join.request",
        "groups.update",
        "messages.upsert",
      ].includes(kind)
    )
      return answer({ ignored: true });
    if (typeof body.instance !== "string" || body.instance.length > 100)
      return answer({ error: "Instância inválida" }, 400);
    const list = Array.isArray(body.data) ? body.data : [body.data];
    if (list.length > 50) return answer({ error: "Muitos eventos" }, 413);
    for (const item of list) {
      const jid = kind === "messages.upsert" ? item?.key?.remoteJid : item?.id;
      if (typeof jid !== "string" || !/^[0-9-]+@g\.us$/.test(jid)) continue;
      const fromMe = kind === "messages.upsert" && item?.key?.fromMe === true;
      const sender = individualPhone(item?.key?.participant);
      // Não usar participantAlt/phoneNumber quando a origem puder ser um LID não resolvido.
      const intent = null; // Preferências só são alteradas no aplicativo.
      // Reentrega da mesma mensagem pode ganhar outra data de envelope.
      // A finalidade negativa e a identidade resolvida distinguem complementos legítimos.
      const messageId =
        typeof item?.key?.id === "string" && item.key.id.length > 0 && item.key.id.length <= 200
          ? item.key.id
          : null;
      const eventKey = await digest(
        JSON.stringify([
          body.instance,
          kind,
          jid,
          kind === "messages.upsert" ? messageId : null,
          kind === "messages.upsert" && messageId
            ? null
            : typeof body.event_id === "string" && /^[0-9a-f-]{36}$/i.test(body.event_id)
              ? body.event_id
              : (body.date_time ?? null),
          kind === "messages.upsert" ? [sender, intent, fromMe] : item,
        ]),
      );
      if (kind === "group.participants.update" && item?.action === "remove") {
        const removed = Array.isArray(item.participants)
          ? item.participants
              .map((p: unknown) => {
                const value = typeof p === "string" ? p : (p as { id?: unknown })?.id;
                return typeof value === "string" && /^[0-9]+@(s\.whatsapp\.net|lid)$/.test(value)
                  ? value
                  : null;
              })
              .filter((v: unknown) => v !== null)
          : [];
        if (removed.length > 50) return answer({ error: "Muitos participantes" }, 413);
        const departure = await db.rpc("care_group_removed_members", {
          p_instance: body.instance,
          p_group_jid: jid,
          p_event_key: await digest("departure:" + eventKey),
          p_jids: removed,
        });
        if (departure.error) return answer({ error: "Conferência indisponível" }, 503);
      }
      // O banco examina o delta completo. Não remover campos desconhecidos: eles
      // exigem nova conferência. Nome/autor não identificam nem autorizam o grupo.
      if (kind === "groups.update") {
        const metadata = await db.rpc("care_group_metadata_event", {
          p_instance: body.instance,
          p_group_jid: jid,
          p_event_key: eventKey,
          p_update: item,
        });
        if (metadata.error) return answer({ error: "Conferência indisponível" }, 503);
        continue;
      }
      const result = await db.rpc("care_group_event", {
        p_instance: body.instance,
        p_group_jid: jid,
        p_event_key: eventKey,
        p_kind:
          kind === "group.participants.update"
            ? "group-participants.update"
            : kind === "group.join.request"
              ? "group.join-request"
              : kind,
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
