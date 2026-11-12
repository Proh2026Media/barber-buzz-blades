import test from "node:test";
import assert from "node:assert/strict";
import { evolutionGroupProvider } from "./evolution-groups.ts";
import {
  processCareGroup,
  recoverCareGroup,
  groupSnapshot,
  inspectGroup,
  type CareGroupJob,
} from "./whatsapp-groups.ts";
import { fakeEvolution } from "../../tests/helpers/evolution-groups.ts";
import { handleCareGroups } from "../whatsapp-groups/handler.ts";

const operation = "11111111-1111-4111-8111-111111111111";
const customer = "+5511999999999",
  staff = "+5511777777777";
function fixture(existing = false) {
  const evo = fakeEvolution();
  const job: CareGroupJob = {
    id: operation,
    token: "token",
    instance: "ficticia",
    group_jid: existing ? evo.groupId : null,
    subject: "Atendimento · Barba & Cabelo",
    platform_phones: ["+5511888888888"],
    customer_phone: customer,
    approved_phones: [],
    removable_phones: [],
    kind: existing ? "reconcile" : "create",
    use_group: false,
    entry_pending: true,
  };
  const state = {
    claimed: false,
    valid: true,
    saved: false,
    unknown: false,
    invite: null as unknown,
    status: "requested",
    dbCalls: [] as string[],
  };
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.dbCalls.push(name);
      if (name === "claim_care_group_operation") {
        if (state.claimed || args.p_capable !== true) return { data: null };
        state.claimed = true;
        return { data: structuredClone(job) };
      }
      if (name === "authorize_care_group_step")
        return state.valid ? { data: structuredClone(job) } : { error: true };
      if (name === "finish_care_group_creation") {
        job.group_jid = String(args.p_group_jid);
        return {};
      }
      if (name === "fail_care_group_operation") {
        state.unknown = true;
        return {};
      }
      if (name === "complete_care_group_operation") {
        state.saved = true;
        state.invite = args.p_invite;
        state.status =
          job.kind === "close"
            ? "closed"
            : inspectGroup(
                {
                  groupJid: job.group_jid!,
                  customerPhone: customer,
                  platformPhones: job.platform_phones,
                  approvedPhones: job.approved_phones,
                },
                args.p_snapshot as ReturnType<typeof groupSnapshot>,
              );
        return {};
      }
      if (name === "care_group_recovery_context")
        return state.unknown ? { data: job } : { data: null };
      if (name === "recover_care_group_creation") {
        job.group_jid = String(args.p_group_jid);
        return {};
      }
      throw new Error("RPC não simulada: " + name);
    },
  };
  const provider = evolutionGroupProvider(evo.transport, true);
  return { evo, job, state, db, provider, run: () => processCareGroup(db, provider, operation) };
}
const add = (f: ReturnType<typeof fixture>, phone = customer) =>
  f.evo.state.group.participants.push({ id: phone.slice(1) + "@s.whatsapp.net", admin: null });
const protect = (f: ReturnType<typeof fixture>) =>
  Object.assign(f.evo.state.group, {
    restrict: true,
    memberAddMode: false,
    joinApprovalMode: true,
  });

test("Adaptador nasce bloqueado e não consulta nem cria no provedor", async () => {
  const f = fixture();
  assert.equal(
    await processCareGroup(f.db, evolutionGroupProvider(f.evo.transport), operation),
    "blocked",
  );
  assert.equal(f.evo.state.calls.length, 0);
});
test("Contrato incompleto impede criação mesmo com execução de bancada habilitada", async () => {
  const f = fixture();
  f.evo.state.contract = "outro";
  assert.equal(await f.run(), "unknown");
  assert.equal(f.evo.state.creates, 0);
});
test("Criação usa chave persistente, protege grupo e guarda convite sem adicionar Cliente", async () => {
  const f = fixture();
  assert.equal(await f.run(), "observed");
  assert.equal(f.evo.state.creates, 1);
  assert.equal(f.state.status, "customer_left");
  assert.match(String(f.state.invite), /^https:\/\/chat.whatsapp.com\//);
  const create = f.evo.state.calls.find((c) => c.route === "bcCreate")!;
  assert.equal(create.body.operationId, operation);
  assert.deepEqual(create.body.participants, []);
  assert.equal(f.evo.state.group.participants.length, 1);
  assert.ok(f.evo.state.group.restrict);
  assert.equal(f.evo.state.group.memberAddMode, false);
  assert.ok(f.evo.state.group.joinApprovalMode);
  assert.equal(await f.run(), "blocked");
  assert.equal(f.evo.state.creates, 1);
});
test("Somente Cliente é admitido; aprovação antiga da equipe não concede entrada", async () => {
  const f = fixture(true);
  f.job.approved_phones = [staff];
  f.evo.state.requests = [customer.slice(1) + "@s.whatsapp.net"];
  assert.equal(await f.run(), "observed");
  assert.equal(f.state.status, "verified");
  assert.equal(f.state.invite, null);
  assert.equal(f.evo.state.group.participants.filter((p) => p.admin).length, 1);
  assert.ok(
    !f.evo.state.group.participants.some((p) => p.id === staff.slice(1) + "@s.whatsapp.net"),
  );
  assert.ok(!JSON.stringify(f.evo.state.calls).includes('"promote"'));
});
test("Convite vazado não aprova terceiro; pedido LID sem prova também é rejeitado", async () => {
  const f = fixture(true);
  f.evo.state.requests = ["5511666666666@s.whatsapp.net", "12345@lid"];
  assert.equal(await f.run(), "observed");
  assert.equal(f.evo.state.group.participants.length, 1);
  assert.deepEqual(
    f.evo.state.calls
      .filter((c) => c.route === "joinRequests" && c.method === "POST")
      .map((c) => c.body.action),
    ["reject", "reject"],
  );
});
test("Pedido do profissional é recusado mesmo com aprovação antiga", async () => {
  const f = fixture(true);
  f.job.approved_phones = [staff];
  f.evo.state.requests = [staff.slice(1) + "@s.whatsapp.net"];
  assert.equal(await f.run(), "observed");
  assert.equal(f.evo.state.group.participants.length, 1);
});
test("Revogação entre etapas interrompe configuração antes da próxima chamada", async () => {
  const f = fixture();
  f.evo.state.before = async (route) => {
    if (route === "updateSetting") f.state.valid = false;
  };
  assert.equal(await f.run(), "paused");
  assert.ok(!f.evo.state.calls.some((c) => c.route === "updateMemberAddMode"));
  assert.equal(f.state.saved, false);
});
test("Admin comercial ou intruso exige revisão, sem alterações automáticas", async () => {
  for (const admin of [null, "admin"]) {
    const f = fixture(true);
    f.evo.state.group.participants.push({ id: "5511666666666@s.whatsapp.net", admin });
    assert.equal(await f.run(), "paused");
    assert.equal(f.evo.state.calls.filter((c) => c.method === "POST").length, 0);
  }
});
test("Remoção só termina após nova consulta provar que o profissional saiu", async () => {
  for (const failure of [false, true]) {
    const f = fixture(true);
    add(f);
    add(f, staff);
    protect(f);
    f.job.kind = "remove";
    f.job.removable_phones = [staff];
    f.evo.state.removalFails = failure;
    assert.equal(await f.run(), failure ? "paused" : "observed");
    assert.equal(f.state.saved, !failure);
  }
});
test("Saída do Cliente de grupo usado nunca provoca readmissão, convite ou inclusão de equipe", async () => {
  const f = fixture(true);
  protect(f);
  f.job.use_group = true;
  f.job.entry_pending = false;
  f.job.approved_phones = [staff];
  f.evo.state.requests = [customer.slice(1) + "@s.whatsapp.net"];
  assert.equal(await f.run(), "customer_left");
  assert.equal(f.state.invite, null);
  assert.equal(f.evo.state.calls.filter((c) => c.method === "POST").length, 0);
});
test("Encerramento revoga convite e remove participantes registrados, preservando Plataforma", async () => {
  const f = fixture(true);
  f.job.kind = "close";
  f.job.removable_phones = [staff];
  add(f);
  add(f, staff);
  assert.equal(await f.run(), "closed");
  assert.equal(f.evo.state.group.participants.length, 1);
  assert.equal(f.state.invite, null);
  assert.ok(f.evo.state.calls.some((c) => c.route === "revokeInviteCode"));
});
test("Resposta perdida recupera por chave/hash sem repetir criação", async () => {
  const f = fixture();
  f.evo.state.lostCreateResponse = true;
  assert.equal(await f.run(), "unknown");
  assert.equal(await recoverCareGroup(f.db, f.provider, operation), "recovered");
  assert.equal(f.evo.state.creates, 1);
  assert.equal(f.job.group_jid, f.evo.groupId);
  assert.equal(f.state.saved, false);
});
test("Recuperação rejeita outro hash ou estado desconhecido sem chamar criação", async () => {
  for (const wrong of [{ state: "unknown" }, { requestHash: "outro" }, { operationKey: "outro" }]) {
    const f = fixture();
    f.evo.state.lostCreateResponse = true;
    await f.run();
    Object.assign(f.evo.state.records.get(operation) as object, wrong);
    assert.equal(await recoverCareGroup(f.db, f.provider, operation), "unknown");
    assert.equal(f.evo.state.creates, 1);
    assert.equal(f.job.group_jid, null);
  }
});
test("PN associado ao mesmo LID é aceito; associação conflitante continua bloqueada", () => {
  const raw = {
    id: "123@g.us",
    restrict: true,
    memberAddMode: false,
    joinApprovalMode: true,
    participants: [{ id: "1234@lid", phoneNumber: "5511999999999@s.whatsapp.net", admin: null }],
  };
  assert.equal(groupSnapshot(raw)?.participants[0].jid, "5511999999999@s.whatsapp.net");
  assert.equal(
    groupSnapshot({
      ...raw,
      participants: [{ ...raw.participants[0], id: "5511777777777@s.whatsapp.net" }],
    })?.participants[0].jid,
    "",
  );
  assert.equal(
    groupSnapshot({ ...raw, participants: [{ id: "1234@lid", admin: null }] })?.participants[0].jid,
    "",
  );
});
test("Ausência de controles não libera convite mesmo sem Cliente presente", () => {
  const f = fixture(true);
  assert.equal(
    inspectGroup(
      {
        groupJid: f.evo.groupId,
        customerPhone: customer,
        platformPhones: f.job.platform_phones,
        approvedPhones: [],
      },
      groupSnapshot(f.evo.state.group),
    ),
    "unverifiable",
  );
});
test("Grupo já protegido é apenas conferido, sem reconfiguração que gere eventos repetidos", async () => {
  const f = fixture(true);
  protect(f);
  add(f);
  assert.equal(await f.run(), "observed");
  assert.equal(f.evo.state.calls.filter((c) => c.method === "POST").length, 0);
});
test("Resposta de inclusão sem participante observado não ativa o grupo", async () => {
  const f = fixture(true);
  protect(f);
  f.evo.state.requests = [customer.slice(1) + "@s.whatsapp.net"];
  f.evo.state.admissionFails = true;
  assert.equal(await f.run(), "paused");
  assert.equal(f.state.saved, false);
});
test("Webhook de pedido com ID estável tolera outra data sem executar admissão", async () => {
  const f = fixture(true),
    secret = "x".repeat(40),
    calls: Record<string, unknown>[] = [];
  for (const date_time of ["2026-11-11T10:00:00Z", "2026-11-11T10:01:00Z"]) {
    const req = new Request("https://example.invalid", {
      method: "POST",
      headers: { "x-bc-group-secret": secret },
      body: JSON.stringify({
        instance: "ficticia",
        event: "group.join-request",
        event_id: operation,
        date_time,
        data: { id: f.evo.groupId, participant: "1234@lid" },
      }),
    });
    assert.equal(
      (
        await handleCareGroups(
          req,
          {
            rpc: async (_name, args) => {
              calls.push(args);
              return {};
            },
          },
          f.provider,
          { service: secret, webhook: secret },
        )
      ).status,
      200,
    );
  }
  assert.equal(calls[0].p_kind, "group.join-request");
  assert.equal(calls[0].p_event_key, calls[1].p_event_key);
  assert.equal(f.evo.state.calls.length, 0);
});
