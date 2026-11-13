import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createPushBudget } from "./web-push-budget.ts";
import { dispatchPushBatch, type PushJob, type PushContext } from "./web-push-dispatch.ts";
import { deliverWebPush } from "./web-push.ts";
// Somente nos testes: timers e relógio monotônico avançam juntos, sem depender da CPU.
function controlledClock(t: TestContext) {
  let now = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(performance, "now", () => now);
  return (ms: number) => {
    now += ms;
    t.mock.timers.tick(ms);
  };
}

const jobs: PushJob[] = Array.from({ length: 4 }, (_, i) => ({
  id: String(i),
  lease: `lease-${i}`,
}));
const context = (job: PushJob): PushContext => ({
  id: job.id,
  locale: "pt-BR",
  kind: "test",
  target: "/app",
  endpoint: "https://fcm.googleapis.com/fcm/send/ficticio",
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
});

test("Quatro envios avançam juntos sem transmitir antes da revalidação", async () => {
  const permits = new Set();
  let release!: () => void;
  const allSending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let active = 0,
    peak = 0;
  const sent: string[] = [],
    finished: string[] = [];
  const result = await dispatchPushBatch(
    jobs,
    async (j) => {
      permits.add(j.id);
      return context(j);
    },
    async (c) => {
      assert.ok(permits.has(c.id));
      active++;
      peak = Math.max(peak, active);
      sent.push(c.id);
      if (active === 4) release();
      await allSending;
      active--;
      return "accepted";
    },
    async (j, outcome) => {
      assert.equal(outcome, "accepted");
      finished.push(j.id);
    },
  );
  assert.equal(peak, 4);
  assert.equal(new Set(sent).size, 4);
  assert.equal(finished.length, 4);
  assert.deepEqual(result, { processed: 4, cancelled: 0, uncertain: 0 });
});

test("Permissão revogada cancela; falha de autorização isola sem transmitir", async () => {
  const sent: string[] = [];
  const result = await dispatchPushBatch(
    jobs,
    async (j) => {
      if (j.id === "0") return null;
      if (j.id === "1") throw new Error("banco sem resposta");
      return context(j);
    },
    async (c) => {
      sent.push(c.id);
      return "accepted";
    },
    async () => {},
  );
  assert.deepEqual(sent.sort(), ["2", "3"]);
  assert.deepEqual(result, { processed: 2, cancelled: 1, uncertain: 1 });
});

test("Falha do provedor registra unknown; finish incerto não repete o envio", async () => {
  let calls = 0;
  const finished: string[] = [];
  const result = await dispatchPushBatch(
    jobs,
    async (j) => context(j),
    async () => {
      calls++;
      throw new Error("conexão interrompida");
    },
    async (j, outcome) => {
      assert.equal(outcome, "unknown");
      finished.push(j.id);
      if (j.id === "0") throw new Error("resultado do banco desconhecido");
    },
  );
  assert.equal(calls, 4);
  assert.equal(finished.length, 4);
  assert.deepEqual(result, { processed: 3, cancelled: 0, uncertain: 1 });
});

test("Lote do SQL antigo é recusado antes de autorizar ou transmitir", async () => {
  let calls = 0;
  await assert.rejects(
    dispatchPushBatch(
      [...jobs, { id: "5", lease: "5" }],
      async (j) => {
        calls++;
        return context(j);
      },
      async () => {
        calls++;
        return "accepted";
      },
      async () => {
        calls++;
      },
    ),
    /PUSH_BATCH_VERSION/,
  );
  assert.equal(calls, 0);
});

test("Prazo total encerra transporte travado mesmo sem cooperação com abort", async (t) => {
  const advance = controlledClock(t);
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const budget = createPushBudget(60, async (_input, init) => {
    calls++;
    signal = init?.signal;
    return new Promise<Response>(() => {});
  });
  const pending = assert.rejects(
    budget.databaseFetch("https://db.example.invalid"),
    /PUSH_DEADLINE/,
  );
  advance(59);
  assert.equal(signal?.aborted, false);
  advance(1);
  await pending;
  assert.ok(signal?.aborted);
  await assert.rejects(budget.providerFetch("https://fcm.googleapis.com/a"), /PUSH_DEADLINE/);
  assert.equal(calls, 1);
});

test("Cabeçalhos recebidos não removem o timeout do corpo; stream é cancelado", async (t) => {
  const advance = controlledClock(t);
  let reading!: () => void;
  const bodyPending = new Promise<void>((resolve) => {
    reading = resolve;
  });
  let cancelled = false;
  const budget = createPushBudget(
    50,
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"incompleto":'));
          },
          pull() {
            reading();
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  const pending = assert.rejects(
    budget.databaseFetch("https://db.example.invalid"),
    /PUSH_DEADLINE/,
  );
  await bodyPending;
  advance(50);
  await pending;
  assert.ok(cancelled);
});

test("Consultas sucessivas compartilham o mesmo prazo, não ganham novo orçamento", async (t) => {
  const advance = controlledClock(t);
  let calls = 0;
  let resolveFirst!: (response: Response) => void;
  const budget = createPushBudget(100, async () => {
    calls++;
    return new Promise<Response>((resolve) => {
      if (calls === 1) resolveFirst = resolve;
    });
  });
  const first = budget.databaseFetch("https://db.example.invalid");
  advance(65);
  resolveFirst(new Response("{}"));
  assert.deepEqual(await (await first).json(), {});
  assert.equal(budget.remaining(), 35);
  const second = assert.rejects(
    budget.databaseFetch("https://db.example.invalid"),
    /PUSH_DEADLINE/,
  );
  advance(35);
  await second;
  assert.equal(budget.remaining(), 0);
  await assert.rejects(budget.databaseFetch("https://db.example.invalid"), /PUSH_DEADLINE/);
  assert.equal(calls, 2);
});

test("Limita corpo externo, corpo de entrada e preserva respostas vazias", async (t) => {
  controlledClock(t);
  const large = createPushBudget(1000, async () => new Response("x".repeat(512001)));
  await assert.rejects(large.databaseFetch("https://db.example.invalid"), /PUSH_BODY_LIMIT/);
  const budget = createPushBudget(1000, async () => new Response(null, { status: 204 }));
  assert.equal((await budget.databaseFetch("https://db.example.invalid")).status, 204);
  await assert.rejects(
    budget.readRequest(
      new Request("https://app.example.invalid", {
        method: "POST",
        body: "x".repeat(8001),
      }),
    ),
    /PUSH_BODY_LIMIT/,
  );
});

test("Cancelamento original impede começar uma chamada de rede", async (t) => {
  controlledClock(t);
  let calls = 0;
  const budget = createPushBudget(1000, async () => {
    calls++;
    return new Response(null);
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    budget.databaseFetch("https://db.example.invalid", { signal: controller.signal }),
  );
  assert.equal(calls, 0);
});

test("Prazo vencido no envio conserva unknown e não reenvia", async (t) => {
  const advance = controlledClock(t);
  let calls = 0;
  const budget = createPushBudget(40, async () => {
    calls++;
    return new Promise<Response>(() => {});
  });
  const c = context(jobs[0]);
  const pending = deliverWebPush(
    c,
    () => ({ endpoint: c.endpoint, headers: {}, body: new Uint8Array() }),
    budget.providerFetch,
  );
  advance(40);
  assert.equal(await pending, "unknown");
  assert.equal(calls, 1);
});
