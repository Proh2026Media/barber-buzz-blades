// Bancada HTTP local: nenhum provedor externo, VAPID ou destinatário real.
// node scripts/test-web-push-orcamento.ts
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { createPushBudget } from "../supabase/functions/_shared/web-push-budget.ts";
import {
  dispatchPushBatch,
  type PushContext,
} from "../supabase/functions/_shared/web-push-dispatch.ts";
import { deliverWebPush } from "../supabase/functions/_shared/web-push.ts";
const timers = new Set<ReturnType<typeof setTimeout>>();
let transmissions = 0,
  active = 0,
  peak = 0;
const server = createServer((req, res) => {
  if (req.url === "/provider") {
    transmissions++;
    active++;
    peak = Math.max(peak, active);
    req.resume();
    res.on("close", () => {
      active--;
    });
    // Recebe a requisição, mas nunca confirma: resultado precisa ser unknown.
    return;
  }
  const timer = setTimeout(() => {
    timers.delete(timer);
    res.end("{}");
  }, 4800);
  timers.add(timer);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("BANCADA_PORTA");
  const local = `http://127.0.0.1:${address.port}`;
  const budget = createPushBudget(undefined, (input, init) =>
    fetch(local + (String(input).includes("fcm.googleapis.com") ? "/provider" : "/db"), init),
  );
  const db = async () => {
    await (await budget.databaseFetch(local + "/db")).json();
  };
  const start = performance.now();
  await db(); // configurações
  await db(); // reserva
  const finished: string[] = [];
  const result = await dispatchPushBatch(
    Array.from({ length: 4 }, (_, i) => ({ id: String(i), lease: `lease-${i}` })),
    async (job) => {
      await db();
      return {
        id: job.id,
        locale: "pt-BR",
        kind: "test",
        target: "/app",
        endpoint: "https://fcm.googleapis.com/fcm/send/ficticio",
        keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
      } satisfies PushContext;
    },
    (context) =>
      deliverWebPush(
        context,
        () => ({
          endpoint: context.endpoint,
          headers: {},
          body: new Uint8Array([0]),
        }),
        budget.providerFetch,
      ),
    async (_job, outcome) => {
      await db();
      finished.push(outcome);
    },
  );
  const elapsed = performance.now() - start;
  assert.deepEqual(result, { processed: 4, cancelled: 0, uncertain: 0 });
  assert.equal(transmissions, 4);
  assert.equal(peak, 4);
  assert.deepEqual(finished, ["unknown", "unknown", "unknown", "unknown"]);
  assert.ok(elapsed < 40_000, `Prazo ultrapassado: ${elapsed}`);
  console.log(
    JSON.stringify({
      teste: "HTTP local lento",
      duracao_ms: Math.round(elapsed),
      transmissoes: transmissions,
      concorrencia: peak,
      resultados: finished,
      repeticoes: 0,
    }),
  );
} finally {
  for (const timer of timers) clearTimeout(timer);
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
