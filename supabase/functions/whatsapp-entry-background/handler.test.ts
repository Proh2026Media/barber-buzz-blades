import test from "node:test";
import assert from "node:assert/strict";
import { handleEntryBackground, entryWorkerAuthorized } from "./handler.ts";
import { advanceCareEntryBackground } from "../_shared/care-entry-background.ts";
const user = "11111111-1111-4111-8111-111111111111",
  shop = "22222222-2222-4222-8222-222222222222",
  group = "33333333-3333-4333-8333-333333333333",
  token = "44444444-4444-4444-8444-444444444444";

test("Uma chamada do servidor concilia pedido, vínculo e acesso sem navegador nem OTP", async () => {
  const calls: string[] = [];
  let phase = "waiting",
    remote = "pending",
    access = false;
  const targets = [
    { id: user, instance: "ficticio_a", phone: "+5511800000111", version: 2 },
    { id: shop, instance: "ficticio_b", phone: "+5511800000222", version: 3 },
  ];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "care_entry_background_queue")
        return {
          data: [{ user, shop, group, intent: token, kind: access ? "access" : "revision" }],
        };
      if (name === "claim_care_phone_revision")
        return {
          data: {
            id: token,
            token,
            cycle_id: group,
            shop,
            phase,
            abort: false,
            group_jid: "12345-67890@g.us",
            creator_instance: "ficticio_a",
            targets,
            payload: { action: "prepare", revisionId: token },
          },
        };
      if (name === "authorize_care_phone_binding") phase = "binding";
      if (name === "record_care_phone_revision") {
        const proof = args.p_proof as { phase: string };
        if (proof.phase !== "pending") phase = proof.phase;
        return { data: { commit_token: token } };
      }
      if (name === "continue_care_phone_revision_background") {
        assert.equal(args.p_user, user);
        access = true;
      }
      if (name === "claim_care_access") return { data: { id: group, token, targets } };
      if (name === "resume_care_access_background") return { data: group };
      return { data: null };
    },
  };
  const transport = async (path: string, init?: RequestInit) => {
    if (path.includes("bcCapabilities"))
      return { contract: "bc-groups-v4", protectedPhoneRevision: true, postAdmissionWelcome: true };
    const body = JSON.parse(String(init?.body));
    calls.push("provider:" + body.action);
    if (body.action === "bind") remote = "bound";
    if (body.action === "finalize") remote = "committed";
    return { revision: { phase: remote }, requestPresent: true };
  };
  const observe = async () =>
    targets.map((t) => ({
      name: t.instance,
      connectionStatus: "open",
      ownerJid: t.phone.slice(1) + "@s.whatsapp.net",
    }));
  const result = await handleEntryBackground(
    new Request("https://teste.invalid", { method: "POST", body: "{}" }),
    true,
    [
      db,
      observe,
      transport,
      async () => {
        calls.push("process");
        return "active";
      },
    ],
  );
  assert.deepEqual(await result.json(), {
    states: ["phone_binding", "phone_binding", "phone_revised", "active"],
  });
  assert.equal(calls.filter((c) => c === "provider:bind").length, 1);
  assert.equal(calls.filter((c) => c === "provider:finalize").length, 1);
  assert.equal(calls.filter((c) => c === "process").length, 1);
  assert.equal(
    calls.some((c) => /otp|request_whatsapp|set_config/.test(c)),
    false,
  );
});
function setup() {
  const calls: string[] = [];
  let queue: unknown = [{ user, shop, group, intent: token, kind: "access" }];
  let fail = "";
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === fail) return { error: { message: "falha" } };
      if (name === "care_entry_background_queue") return { data: queue };
      if (name === "claim_care_access") {
        assert.equal(args.p_user, user);
        assert.equal(args.p_shop, shop);
        return {
          data: {
            id: group,
            token,
            targets: [
              { id: user, instance: "ficticio_a", phone: "+5511800000111", version: 2 },
              { id: shop, instance: "ficticio_b", phone: "+5511800000222", version: 3 },
            ],
          },
        };
      }
      if (name === "record_care_access_connections") {
        assert.equal(args.p_user, user);
        assert.equal((args.p_observations as { status: string }[])[0].status, "open");
      }
      if (name === "resume_care_access_background") return { data: token };
      return { data: null };
    },
  };
  const observe = async () => [
    { name: "ficticio_a", connectionStatus: "open", ownerJid: "5511800000111@s.whatsapp.net" },
    { name: "ficticio_b", connectionStatus: "open", ownerJid: "5511800000222@s.whatsapp.net" },
  ];
  const process = async (id: string) => {
    calls.push("process");
    assert.equal(id, token);
    return "waiting_customer";
  };
  const deps: Parameters<typeof advanceCareEntryBackground> = [
    db,
    observe,
    async () => null,
    process,
  ];
  return {
    calls,
    deps,
    queue: (v: unknown) => {
      queue = v;
    },
    fail: (v: string) => {
      fail = v;
    },
  };
}
test("Servidor usa a intenção do banco sem sessão de cliente e não solicita OTP", async () => {
  const s = setup();
  const r = await advanceCareEntryBackground(...s.deps);
  assert.deepEqual(r, { processed: 1, states: ["waiting_customer"] });
  assert.deepEqual(s.calls, [
    "care_entry_background_queue",
    "claim_care_access",
    "record_care_access_connections",
    "resume_care_access_background",
    "process",
    "finish_care_access",
    "care_entry_background_progress",
  ]);
  assert.equal(
    s.calls.some((n) => /auth|otp|sendCode|set_config/.test(n)),
    false,
  );
});
test("Fila vazia não consulta Evolution nem executa grupos", async () => {
  const s = setup();
  s.queue([]);
  assert.deepEqual(await advanceCareEntryBackground(...s.deps), { processed: 0, states: [] });
  assert.deepEqual(s.calls, ["care_entry_background_queue"]);
});
test("Fila inválida ou excessiva falha fechada", async () => {
  for (const q of [
    null,
    {},
    [{ user: "inválido", shop, group, intent: token, kind: "access" }],
    Array(5).fill({ user, shop, group, intent: token, kind: "access" }),
  ]) {
    const s = setup();
    s.queue(q);
    await assert.rejects(() => advanceCareEntryBackground(...s.deps));
    assert.deepEqual(s.calls, ["care_entry_background_queue"]);
  }
});
test("Falha após posse não processa ciclo e finaliza como falha", async () => {
  const s = setup();
  s.fail("record_care_access_connections");
  assert.deepEqual((await advanceCareEntryBackground(...s.deps)).states, ["review"]);
  assert.equal(s.calls.includes("process"), false);
  assert.equal(s.calls.at(-1), "finish_care_access");
});
test("Falha de reconciliação comprometida pode ser retomada sem novo grupo", async () => {
  const s = setup();
  s.queue([{ user, shop, group, intent: token, kind: "handoff" }]);
  assert.deepEqual((await advanceCareEntryBackground(...s.deps)).states, ["phone_revised"]);
  assert.deepEqual(s.calls, [
    "care_entry_background_queue",
    "continue_care_phone_revision_background",
    "care_entry_background_progress",
  ]);
});
test("Revisão bloqueada não força admissão ou cria acesso", async () => {
  const s = setup();
  s.queue([{ user, shop, group, intent: token, kind: "revision" }]);
  const old = s.deps[0].rpc;
  s.deps[0].rpc = async (n, a) =>
    n === "claim_care_phone_revision" ? { data: { blocked: true } } : old(n, a);
  assert.deepEqual((await advanceCareEntryBackground(...s.deps)).states, ["phone_review"]);
  assert.equal(s.calls.includes("process"), false);
});
test("Endpoint privado rejeita autenticação, método e escopo vindos do chamador", async () => {
  for (const [req, auth, status] of [
    [new Request("https://teste.invalid", { method: "POST" }), false, 401],
    [new Request("https://teste.invalid"), true, 405],
    [
      new Request("https://teste.invalid", {
        method: "POST",
        body: JSON.stringify({ user, shop }),
      }),
      true,
      400,
    ],
  ] as const) {
    const s = setup();
    assert.equal((await handleEntryBackground(req, auth, s.deps)).status, status);
    assert.deepEqual(s.calls, []);
  }
});
test("Endpoint não mantém laço quando espera entrada", async () => {
  const s = setup();
  const r = await handleEntryBackground(
    new Request("https://teste.invalid", { method: "POST", body: "{}" }),
    true,
    s.deps,
  );
  assert.equal(r.status, 200);
  assert.equal(s.calls.filter((n) => n === "care_entry_background_queue").length, 1);
});
test("Autenticação exige chave longa exata; cliente, ausência e prefixo errado não valem", async () => {
  const key = "x".repeat(48);
  assert.equal(await entryWorkerAuthorized(`Bearer ${key}`, key), true);
  for (const v of [null, key, `Bearer ${key}x`, `Bearer ${"y".repeat(48)}`])
    assert.equal(await entryWorkerAuthorized(v, key), false);
  assert.equal(await entryWorkerAuthorized("Bearer curta", "curta"), false);
});
