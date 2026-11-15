// O runtime de produção encerra o worker aos 60 s. Reservamos 20 s para partida/saída.
export const PUSH_BUDGET_MS = 40_000;
export const PUSH_DATABASE_MS = 5_000;
export const PUSH_PROVIDER_MS = 8_000;

export function createPushBudget(totalMs = PUSH_BUDGET_MS, transport: typeof fetch = fetch) {
  const deadline = performance.now() + totalMs;
  const remaining = () => Math.max(0, deadline - performance.now());

  async function run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    limitMs: number,
    parent?: AbortSignal | null,
  ): Promise<T> {
    const ms = Math.min(limitMs, remaining());
    if (ms <= 0 || parent?.aborted) throw new Error("PUSH_DEADLINE");
    const controller = new AbortController();
    const abort = () => controller.abort(new Error("PUSH_DEADLINE"));
    parent?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, ms);
    const stopped = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("PUSH_DEADLINE")), {
        once: true,
      });
    });
    try {
      // A corrida encerra a espera mesmo se um transporte não respeitar o sinal.
      return await Promise.race([work(controller.signal), stopped]);
    } finally {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    }
  }

  async function readBytes(
    body: ReadableStream<Uint8Array> | null,
    signal: AbortSignal,
    max: number,
  ) {
    if (!body) return new Uint8Array();
    const reader = body.getReader();
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        if (signal.aborted) throw new Error("PUSH_DEADLINE");
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) throw new Error("PUSH_BODY_LIMIT");
        chunks.push(value);
      }
      if (signal.aborted) throw new Error("PUSH_DEADLINE");
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    } finally {
      signal.removeEventListener("abort", cancel);
      cancel();
    }
  }

  const fetchWithLimit =
    (limitMs: number): typeof fetch =>
    async (input, init) => {
      const parent = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      return run(
        async (signal) => {
          const response = await transport(input, { ...init, signal });
          // O prazo inclui o corpo: receber os cabeçalhos não significa concluir a consulta.
          const bytes = await readBytes(response.body, signal, 512_000);
          return new Response(response.body === null ? null : (bytes as BodyInit), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        },
        limitMs,
        parent,
      );
    };
  return {
    remaining,
    databaseFetch: fetchWithLimit(PUSH_DATABASE_MS),
    providerFetch: fetchWithLimit(PUSH_PROVIDER_MS),
    readRequest: (req: Request) =>
      run(
        async (signal) => new TextDecoder().decode(await readBytes(req.body, signal, 8_000)),
        3_000,
        req.signal,
      ),
  };
}
