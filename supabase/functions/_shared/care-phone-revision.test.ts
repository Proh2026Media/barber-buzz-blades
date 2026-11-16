import test from "node:test";
import assert from "node:assert/strict";
import { advancePhoneRevision } from "./care-phone-revision.ts";
const id = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  token = "33333333-3333-4333-8333-333333333333",
  cycle = "44444444-4444-4444-8444-444444444444";
function setup(phase = "requested", remote = "pending") {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const job = {
    id,
    token,
    cycle_id: cycle,
    shop: id,
    phase,
    abort: false,
    group_jid: "12345-67890@g.us",
    creator_instance: "ficticia_a",
    targets: [
      { id, instance: "ficticia_a", phone: "+5511800000111", version: 1 },
      { id: user, instance: "ficticia_b", phone: "+5511800000222", version: 2 },
    ],
    payload: { action: "prepare", revisionId: id },
  };
  let requestPresent = false;
  let diagnostic: unknown;
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data:
          name === "claim_care_phone_revision"
            ? job
            : name === "record_care_phone_revision"
              ? { commit_token: token }
              : null,
      };
    },
  };
  const observe = async (path: string) => {
    calls.push({ name: path });
    return job.targets.map((t) => ({
      name: t.instance,
      connectionStatus: "open",
      ownerJid: t.phone.slice(1) + "@s.whatsapp.net",
    }));
  };
  const transport = async (path: string, init?: RequestInit) => {
    if (path.includes("bcCapabilities")) {
      calls.push({ name: "capability" });
      return { contract: "bc-groups-v4", protectedPhoneRevision: true, postAdmissionWelcome: true };
    }
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init.body));
    calls.push({ name: body.action, args: body });
    return {
      revision: {
        phase:
          body.action === "finalize"
            ? "committed"
            : body.action === "bind"
              ? "bound"
              : body.action === "abort"
                ? "aborted"
                : remote,
      },
      requestPresent,
      requestStatus: diagnostic,
      inviteUrl: "https://chat.whatsapp.com/FICTICIO123456789",
    };
  };
  return {
    calls,
    job,
    db,
    observe,
    transport,
    diagnostic: (value: unknown) => {
      diagnostic = value;
    },
    present: () => {
      requestPresent = true;
    },
    run: () => advancePhoneRevision(user, id, db, db, observe, transport),
  };
}
test("Revisão observa apenas contas do banco e não envia/admite antes do pedido", async () => {
  const s = setup();
  assert.equal((await s.run())!.state, "phone_waiting");
  assert.deepEqual(
    s.calls.map((c) => c.name),
    [
      "claim_care_phone_revision",
      "/instance/fetchInstances",
      "record_care_phone_revision_connections",
      "capability",
      "capability",
      "prepare",
      "record_care_phone_revision",
      "finish_care_phone_revision",
    ],
  );
  assert.equal(
    s.calls.some((c) => /send|admit|distribut/i.test(c.name)),
    false,
  );
});
test("Pedido só lacra a fase binding; alteração remota acontece na próxima conferência", async () => {
  const s = setup();
  s.present();
  assert.equal((await s.run())!.state, "phone_binding");
  assert.equal(
    s.calls.some((c) => c.name === "authorize_care_phone_binding"),
    true,
  );
  assert.equal(
    s.calls.some((c) => c.name === "bind"),
    false,
  );
});
test("Bind autorizado é gravado no B&C e não revela nonce ao cliente", async () => {
  const s = setup("binding");
  s.present();
  const result = await s.run();
  assert.deepEqual(result, { state: "phone_binding" });
  const names = s.calls.map((c) => c.name);
  assert.ok(names.indexOf("authorize_care_phone_binding") < names.indexOf("bind"));
  assert.equal(names.at(-2), "record_care_phone_revision");
  assert.ok(!JSON.stringify(result).includes(token));
});
test("Vínculo incerto recupera diário bound e finaliza somente com ack do banco", async () => {
  const s = setup("binding", "bound");
  assert.equal((await s.run())!.state, "phone_revised");
  const names = s.calls.map((c) => c.name);
  assert.ok(names.indexOf("record_care_phone_revision") < names.indexOf("finalize"));
  assert.ok(names.indexOf("finalize") < names.indexOf("continue_care_phone_revision"));
  assert.equal(
    s.calls.some((c) => c.name === "bind"),
    false,
  );
  assert.equal(s.calls.find((c) => c.name === "finalize")!.args!.commitToken, token);
});
test("Finalização com resposta perdida consulta committed sem refazer bind/finalize", async () => {
  const s = setup("bound", "committed");
  assert.equal((await s.run())!.state, "phone_revised");
  assert.equal(
    s.calls.some((c) => c.name === "bind" || c.name === "finalize"),
    false,
  );
});
test("Cancelar pendente exige confirmação do fornecedor antes de liberar o grupo", async () => {
  const s = setup();
  s.job.abort = true;
  assert.equal((await s.run())!.state, "phone_aborted");
  assert.equal(
    s.calls.some((c) => c.name === "abort"),
    true,
  );
  assert.equal(
    s.calls.some((c) => c.name === "continue_care_phone_revision"),
    false,
  );
});
test("Sem duas conexões não consulta candidato nem altera vínculo", async () => {
  const s = setup();
  s.observe = async () => [];
  await assert.rejects(
    () => advancePhoneRevision(user, id, s.db, s.db, s.observe, s.transport),
    /GROUP_PARTICIPANTS_CHANGED/,
  );
  assert.equal(
    s.calls.some((c) => c.name === "prepare"),
    false,
  );
  assert.equal(s.calls.at(-1)!.args!.p_failed, true);
});
test("Sem contrato novo não faz lookup, convite ou bind", async () => {
  const s = setup();
  await assert.rejects(
    () =>
      advancePhoneRevision(user, id, s.db, s.db, s.observe, async () => ({
        contract: "bc-groups-v4",
        postAdmissionWelcome: true,
      })),
    /GROUP_REVIEW_REQUIRED/,
  );
  assert.equal(
    s.calls.some((c) => c.name === "prepare"),
    false,
  );
});

test("Pedido LID sem prova retorna pendência explícita sem autorizar vínculo", async () => {
  const s = setup();
  s.diagnostic({ total: 1, unresolved: 1, matching: 0, other: 0 });
  assert.equal((await s.run())!.state, "phone_request_unresolved");
  assert.equal(
    s.calls.some((c) => c.name === "bind" || c.name === "authorize_care_phone_binding"),
    false,
  );
});
test("Diagnóstico ausente ou inválido não fabrica pedido nem vínculo", async () => {
  for (const value of [null, { unresolved: "1" }, { unresolved: -1 }, { unresolved: 101 }]) {
    const s = setup();
    s.diagnostic(value);
    assert.equal((await s.run())!.state, "phone_waiting");
    assert.equal(
      s.calls.some((c) => c.name === "bind"),
      false,
    );
  }
});
