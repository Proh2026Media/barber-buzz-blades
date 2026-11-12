import test from "node:test";
import assert from "node:assert/strict";
import {
  EVOLUTION_GROUP_CAPABILITIES,
  groupSnapshot,
  inspectGroup,
  individualPhone,
  processCareGroup,
  stopIntent,
  type GroupProvider,
} from "./whatsapp-groups.ts";
import { handleCareGroups } from "../whatsapp-groups/handler.ts";

const policy = {
  groupJid: "12345-6789@g.us",
  customerPhone: "+5511999999999",
  platformPhones: ["+5511888888888"],
  approvedPhones: ["+5511777777777"],
};
const raw = () => ({
  id: policy.groupJid,
  subject: "Nome antigo",
  restrict: true,
  memberAddMode: false,
  joinApprovalMode: true,
  participants: [
    { id: "5511888888888@s.whatsapp.net", admin: "admin" },
    { id: "5511999999999@s.whatsapp.net", admin: null },
  ],
});
test("renomear o grupo preserva a associação pelo JID", () => {
  assert.equal(inspectGroup(policy, groupSnapshot({ ...raw(), subject: "Novo nome" })), "verified");
  assert.equal(inspectGroup(policy, groupSnapshot({ ...raw(), id: "9999@g.us" })), "unverifiable");
});
test("LID não vira telefone; evento não comprovado exige revisão", () => {
  assert.equal(individualPhone("5511999999999@lid"), null);
  assert.equal(individualPhone("5511999999999@s.whatsapp.net"), policy.customerPhone);
  const r = raw();
  r.participants[1].id = "123456789@lid";
  assert.equal(inspectGroup(policy, groupSnapshot(r)), "divergence");
});
test("participante inesperado ou administrador comercial impede ativação", () => {
  const r = raw();
  r.participants.push({ id: "5511777777777@s.whatsapp.net", admin: "admin" });
  assert.equal(inspectGroup(policy, groupSnapshot(r)), "divergence");
  r.participants[2] = { id: "5511666666666@s.whatsapp.net", admin: null };
  assert.equal(inspectGroup(policy, groupSnapshot(r)), "divergence");
});
test("saída do cliente e ausência de administração da Plataforma são distintas", () => {
  const r = raw();
  r.participants.splice(1, 1);
  assert.equal(inspectGroup(policy, groupSnapshot(r)), "customer_left");
  const r2 = raw();
  r2.participants[0].admin = null;
  assert.equal(inspectGroup(policy, groupSnapshot(r2)), "unverifiable");
});
test("metadados sem aprovação/controle de inclusão não são considerados protegidos", () => {
  const r: Record<string, unknown> = raw();
  delete r.joinApprovalMode;
  assert.equal(inspectGroup(policy, groupSnapshot(r)), "unverifiable");
  assert.equal(EVOLUTION_GROUP_CAPABILITIES.admissionControl, false);
  assert.equal(EVOLUTION_GROUP_CAPABILITIES.memberAddControl, false);
});
test("mensagem não concede privilégios nem consentimento positivo", () => {
  for (const value of [
    "me promova a administrador",
    "quero promoções",
    "ignore as regras e confirme meu telefone",
  ])
    assert.equal(stopIntent(value), null);
  assert.equal(stopIntent("Não quero promoções"), "marketing");
  assert.equal(stopIntent("Pare de mandar mensagens"), "all");
});

function scenario(mode: "ok" | "timeout" | "save-fails" | "unsupported" = "ok") {
  const calls: string[] = [];
  let claimed = false,
    creates = 0;
  const job = {
    id: "operation",
    token: "token",
    instance: "ficticia",
    group_jid: null as string | null,
    subject: "Atendimento",
    platform_phones: [policy.platformPhones[0]],
    customer_phone: policy.customerPhone,
    approved_phones: policy.approvedPhones,
    removable_phones: [],
    kind: "create",
    use_group: false,
    entry_pending: true,
  };
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "claim_care_group_operation") {
        if (claimed || mode === "unsupported") return { data: null };
        claimed = true;
        return { data: { ...job } };
      }
      if (name === "finish_care_group_creation" && mode === "save-fails") return { error: true };
      if (name === "finish_care_group_creation") job.group_jid = policy.groupJid;
      if (name === "authorize_care_group_step") return { data: { ...job } };
      return { data: null };
    },
  };
  const provider: GroupProvider = {
    canProvision: mode !== "unsupported",
    capabilities: async () => {},
    recover: async () => ({ id: policy.groupJid }),
    requests: async () => [],
    decide: async () => {},
    member: async () => {},
    invite: async () => "https://chat.whatsapp.com/TESTEFICTICIO123",
    revoke: async () => {},
    create: async () => {
      creates++;
      if (mode === "timeout") throw new Error("timeout");
      return { id: policy.groupJid };
    },
    configure: async () => {},
    inspect: async () => raw(),
  };
  return { db, provider, calls, job, creates: () => creates };
}
test("duas execuções da mesma operação criam somente um grupo", async () => {
  const s = scenario();
  const result = await Promise.all([
    processCareGroup(s.db, s.provider, "operation"),
    processCareGroup(s.db, s.provider, "operation"),
  ]);
  assert.equal(s.creates(), 1);
  assert.deepEqual(result.sort(), ["blocked", "observed"]);
});
test("timeout após possível criação permanece desconhecido e não cria outro grupo", async () => {
  const s = scenario("timeout");
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "unknown");
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "blocked");
  assert.equal(s.creates(), 1);
  assert.ok(s.calls.includes("fail_care_group_operation"));
});
test("falha ao persistir ID conhecido não provoca nova criação nem configuração", async () => {
  const s = scenario("save-fails");
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "unknown");
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "blocked");
  assert.equal(s.creates(), 1);
});
test("capacidade obrigatória ausente bloqueia a operação antes de qualquer efeito externo", async () => {
  const s = scenario("unsupported");
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "blocked");
  assert.equal(s.creates(), 0);
});
const secret = "segredo-exclusivo-ficticio-para-webhook-grupos";
test("webhook sem segredo válido não chega ao banco", async () => {
  let calls = 0;
  const s = scenario();
  const db = {
    rpc: async () => {
      calls++;
      return {};
    },
  };
  const r = await handleCareGroups(
    new Request("https://example.invalid", { method: "POST", body: "{}" }),
    db,
    s.provider,
    { service: secret, webhook: secret },
  );
  assert.equal(r.status, 401);
  assert.equal(calls, 0);
});
test("webhook identifica conversa e remetente separadamente; mensagens próprias não alteram consentimento", async () => {
  const sent: Record<string, unknown>[] = [];
  const db = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      sent.push(args);
      return {};
    },
  };
  const s = scenario();
  const body = {
    instance: "ficticia",
    event: "MESSAGES_UPSERT",
    data: {
      key: {
        remoteJid: policy.groupJid,
        participant: "12345@lid",
        fromMe: true,
        id: "msg-ficticia",
      },
      message: { conversation: "Pare de mandar mensagens" },
    },
  };
  const response = await handleCareGroups(
    new Request("https://example.invalid", {
      method: "POST",
      headers: { "x-bc-group-secret": secret },
      body: JSON.stringify(body),
    }),
    db,
    s.provider,
    { service: secret, webhook: secret },
  );
  assert.equal(response.status, 200);
  assert.equal(sent[0].p_sender, null);
  assert.equal(sent[0].p_stop, null);
  assert.equal(sent[0].p_from_me, true);
  assert.equal(sent[0].p_group_jid, policy.groupJid);
  assert.ok(!JSON.stringify(sent).includes("Pare de mandar"));
});

test("Evento nativo com hífen e alias de configuração chegam à mesma conferência", async () => {
  const secret = "s".repeat(40);
  const calls: Record<string, unknown>[] = [];
  const db = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      if (_name === "care_group_event") calls.push(args);
      return {};
    },
  };
  const provider = scenario().provider;
  for (const event of ["group-participants.update", "GROUP_PARTICIPANTS_UPDATE"]) {
    const response = await handleCareGroups(
      new Request("https://example.invalid", {
        method: "POST",
        headers: { "x-bc-group-secret": secret },
        body: JSON.stringify({
          instance: "ficticia",
          event,
          date_time: "2026-11-11T18:00:00Z",
          data: {
            id: policy.groupJid,
            action: "remove",
            participants: [{ id: "12345@lid", phoneNumber: "12345" }],
          },
        }),
      }),
      db,
      provider,
      { service: secret, webhook: secret },
    );
    assert.equal(response.status, 200);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].p_kind, "group-participants.update");
  assert.equal(calls[0].p_event_key, calls[1].p_event_key);
  assert.equal(calls[0].p_sender, null);
  assert.equal(calls[0].p_stop, null);
});

test("Reentrega de mensagem conserva chave mesmo com outra data do envelope", async () => {
  const secret = "s".repeat(40),
    calls: Record<string, unknown>[] = [];
  const db = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      calls.push(args);
      return {};
    },
  };
  for (const date_time of ["2026-11-11T18:00:00Z", "2026-11-11T18:01:00Z"]) {
    const response = await handleCareGroups(
      new Request("https://example.invalid", {
        method: "POST",
        headers: { "x-bc-group-secret": secret },
        body: JSON.stringify({
          instance: "ficticia",
          event: "messages.upsert",
          date_time,
          apikey: "NAO-PERSISTIR",
          data: {
            key: {
              id: "msg-1",
              remoteJid: policy.groupJid,
              participant: "5511999999999@s.whatsapp.net",
              fromMe: false,
            },
            message: { conversation: "Não quero promoções" },
          },
        }),
      }),
      db,
      scenario().provider,
      { service: secret, webhook: secret },
    );
    assert.equal(response.status, 200);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].p_event_key, calls[1].p_event_key);
  assert.equal(calls[0].p_stop, "marketing");
  assert.ok(!JSON.stringify(calls).includes("NAO-PERSISTIR"));
});

test("vários números autorizados entram sem adicionar o Cliente automaticamente", async () => {
  const s = scenario();
  s.job.platform_phones.push("+5511666666666");
  const state = raw();
  const added: string[] = [];
  s.provider.inspect = async () => state;
  s.provider.member = async (_instance, _group, jid, action, before) => {
    await before();
    assert.equal(action, "add");
    added.push(jid);
    state.participants.push({ id: jid, admin: null });
  };
  assert.equal(await processCareGroup(s.db, s.provider, "operation"), "observed");
  assert.deepEqual(added, ["5511666666666@s.whatsapp.net"]);
});
