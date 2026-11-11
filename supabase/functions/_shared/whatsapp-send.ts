/** Única saída de mensagens. Não recebe destino/conteúdo de avisos do cliente. */
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

export async function sendWhatsapp(
  db: Database,
  input: Input,
  transport: Transport,
): Promise<SendResult> {
  const outbox = "outboxId" in input;
  const reference = outbox
    ? { p_outbox_id: input.outboxId, p_lease_token: input.leaseToken }
    : {
        p_challenge_id: input.challengeId,
        p_instance: input.instance,
        p_code_hash: input.codeHash,
      };
  const defer = async () => {
    if (!outbox) return true;
    const r = await db.rpc("defer_whatsapp_send", {
      p_id: input.outboxId,
      p_lease_token: input.leaseToken,
    });
    return !r.error;
  };
  const candidate = await db.rpc("whatsapp_send_candidate", reference);
  if (candidate.error) throw new Error("WA_AUTHORIZATION_UNAVAILABLE");
  const route = candidate.data as { instance_name?: string } | null;
  if (!route?.instance_name) return { state: "blocked", recorded: await defer() };
  // Consulta sem efeito. A autorização final ocorre DEPOIS desta espera de rede.
  let connected = false;
  try {
    const state = (await transport(
      `/instance/connectionState/${encodeURIComponent(route.instance_name)}`,
      { signal: AbortSignal.timeout(5_000) },
    )) as { instance?: { state?: string } };
    connected = state?.instance?.state === "open";
  } catch {
    /* Nenhuma transmissão: a fila pode ser adiada. */
  }
  if (!connected) return { state: "blocked", reason: "connection", recorded: await defer() };
  const decision = await db.rpc("authorize_whatsapp_send", {
    ...reference,
    p_expected_instance: route.instance_name,
  });
  if (decision.error) throw new Error("WA_AUTHORIZATION_UNAVAILABLE");
  const permit = decision.data as {
    attempt_id?: string;
    instance_name: string;
    to_e164: string;
    body: string;
    reason?: string;
  } | null;
  if (!permit?.attempt_id)
    return { state: "blocked", reason: permit?.reason, recorded: await defer() };
  let providerId: string | null = null;
  try {
    const result = (await transport(
      `/message/sendText/${encodeURIComponent(permit.instance_name)}`,
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          number: permit.to_e164.replace(/\D/g, ""),
          text: outbox ? permit.body : input.text,
        }),
      },
    )) as { key?: { id?: string }; message?: { key?: { id?: string } } };
    const id = result?.key?.id ?? result?.message?.key?.id;
    if (typeof id === "string" && id.length > 0 && id.length <= 200) providerId = id;
  } catch {
    /* Pode ter chegado ao provedor: nunca repetir, nem usar reserva. */
  }
  const state = providerId ? "accepted" : "unknown";
  let recorded = false;
  try {
    const done = await db.rpc("finish_whatsapp_send", {
      p_attempt_id: permit.attempt_id,
      p_provider_id: providerId,
    });
    recorded = !done.error;
  } catch {
    /* A tentativa persistida antes da chamada continua impedindo duplicação. */
  }
  // Sem corpo, telefone, código, resposta bruta ou credencial.
  console.info(
    JSON.stringify({ event: "whatsapp_send", attempt_id: permit.attempt_id, state, recorded }),
  );
  return { state, recorded };
}
