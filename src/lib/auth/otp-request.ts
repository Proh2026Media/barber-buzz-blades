/** Um novo clique explícito gera um pedido; repetição do mesmo corpo mantém o identificador. */
export function otpRequestBody(body: Record<string, unknown>): string {
  return JSON.stringify(
    body.action === "request"
      ? { ...body, request_id: body.request_id ?? crypto.randomUUID() }
      : body,
  );
}
