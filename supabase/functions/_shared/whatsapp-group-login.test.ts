import test from "node:test";
import assert from "node:assert/strict";
import { cycleHash } from "./care-cycles.ts";
import { sendGroupLogin } from "./whatsapp-group-login.ts";
function fixture(
  options: {
    extra?: boolean;
    absent?: boolean;
    wrongGroup?: boolean;
    unknown?: boolean;
    changed?: boolean;
    timeout?: boolean;
    enabled?: boolean;
    recordFails?: boolean;
    stale?: boolean;
    preflightBlocked?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  let started = false;
  let refreshed = false;
  const context = {
    cycle_id: "22222222-2222-4222-8222-222222222222",
    cycle_revision: 1,
    cycle_expires_at: new Date(Date.now() + 86400000).toISOString(),
    first_message_id: "boas-vindas",
    admission_id: "44444444-4444-4444-8444-444444444444",
    welcome_message_id: "boas-vindas",
    creator_phone: "+5511888888888",
    group_id: "11111111-1111-4111-8111-111111111111",
    group_jid: "123-456@g.us",
    version: 3,
    instance_name: "plataforma",
    customer_phone: "+5511999999999",
    platform_phones: ["+5511888888888", "+5511666666666"],
    sender_phone: "+5511888888888",
    purpose: "login",
    expires_at: new Date(Date.now() + 600000).toISOString(),
  };
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "whatsapp_group_login_context")
        return { data: options.absent || (options.stale && !refreshed) ? null : context };
      if (name === "whatsapp_login_preflight")
        return {
          data: {
            challenge: "desafio",
            targets: context.platform_phones.map((phone, i) => ({
              id: i === 0 ? context.group_id : context.cycle_id,
              instance: i === 0 ? "plataforma" : "reserva",
              phone,
              version: 1,
            })),
          },
        };
      if (name === "complete_whatsapp_login_preflight") {
        refreshed = !options.preflightBlocked;
        return { data: refreshed };
      }
      if (name === "authorize_whatsapp_group_login") {
        if (options.changed || started) return { data: null };
        started = true;
        return {
          data: {
            attempt_id: "33333333-3333-4333-8333-333333333333",
            group_jid: context.group_jid,
            instance_name: context.instance_name,
          },
        };
      }
      if (options.recordFails) throw new Error("registro indisponível");
      return { data: null };
    },
  };
  const transport = async (path: string, init?: RequestInit) => {
    calls.push(path);
    if (path.startsWith("/group/bcCapabilities/"))
      return {
        contract: "bc-groups-v4",
        protectedCodes: true,
        protectedNotices: true,
        serializedCommands: true,
        protectedCycle: true,
        postAdmissionWelcome: true,
        twoPlatformAdmins: true,
      };
    if (path.startsWith("/group/bcInspect/"))
      return {
        id: options.wrongGroup ? "999@g.us" : context.group_jid,
        restrict: true,
        memberAddMode: false,
        joinApprovalMode: !options.unknown,
        participants: [
          { id: "5511888888888@s.whatsapp.net", admin: "admin" },
          { id: "5511666666666@s.whatsapp.net", admin: "admin" },
          { id: "5511999999999@s.whatsapp.net", admin: null },
          ...(options.extra ? [{ id: "5511777777777@s.whatsapp.net", admin: null }] : []),
        ],
      };
    if (path.startsWith("/group/bcCycle/"))
      return {
        ready: true,
        cycle: {
          cycleId: context.cycle_id,
          groupJid: context.group_jid,
          customerJid: context.customer_phone.slice(1) + "@s.whatsapp.net",
          creatorJid: context.creator_phone.slice(1) + "@s.whatsapp.net",
          firstMessageId: context.first_message_id,
          firstReceived: true,
          lastWelcomeReceived: true,
          lastWelcomeAdmissionId: context.admission_id,
          lastWelcomeMessageId: context.welcome_message_id,
          firstSenderJid: "5511666666666@s.whatsapp.net",
          firstViolation: false,
          closing: false,
          closed: false,
          expiresAt: context.cycle_expires_at,
          platformJids: context.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net"),
        },
      };
    bodies.push(JSON.parse(String(init?.body)));
    if (options.timeout) throw new Error("timeout depois da transmissão");
    return {
      state: "code_accepted",
      messageId: "mensagem-ficticia",
      operationKey: "33333333-3333-4333-8333-333333333333",
      instanceId: "group:" + context.group_jid,
      groupJid: context.group_jid,
      requestHash: await cycleHash([
        "code",
        context.sender_phone.slice(1) + "@s.whatsapp.net",
        context.customer_phone.slice(1) + "@s.whatsapp.net",
        context.platform_phones.map((p) => p.slice(1) + "@s.whatsapp.net").sort(),
        context.purpose,
        context.expires_at,
      ]),
    };
  };
  return {
    calls,
    bodies,
    run: () =>
      sendGroupLogin(
        db,
        { challengeId: "desafio", codeHash: "hash", code: "123456" },
        transport,
        options.enabled ?? true,
        options.stale
          ? async () =>
              context.platform_phones.map((phone, i) => ({
                name: i === 0 ? "plataforma" : "reserva",
                connectionStatus: "open",
                ownerJid: phone.slice(1) + "@s.whatsapp.net",
              }))
          : undefined,
      ),
  };
}
test("login envia somente ao JID conferido; nunca converte grupo em telefone", async () => {
  const f = fixture();
  assert.equal(await f.run(), "accepted");
  assert.equal(f.bodies.length, 1);
  assert.equal(f.bodies[0].groupJid, "123-456@g.us");
  assert.ok(
    f.calls.indexOf("authorize_whatsapp_group_login") >
      f.calls.findIndex((c) => c.startsWith("/group/bcInspect/")),
  );
});
for (const [label, options] of Object.entries({
  desativado: { enabled: false },
  "sem grupo": { absent: true },
  "profissional presente": { extra: true },
  "grupo diferente": { wrongGroup: true },
  "controles desconhecidos": { unknown: true },
  "versão alterada após leitura": { changed: true },
}))
  test(`login bloqueia ${label}, sem mensagem privada`, async () => {
    const f = fixture(options);
    assert.equal(await f.run(), "blocked");
    assert.equal(f.bodies.length, 0);
  });
test("timeout não reenvia no grupo nem usa destino privado", async () => {
  const f = fixture({ timeout: true });
  assert.equal(await f.run(), "unknown");
  assert.equal(await f.run(), "blocked");
  assert.equal(f.bodies.length, 1);
});
test("falha ao salvar resultado não repete transmissão", async () => {
  const f = fixture({ recordFails: true });
  assert.equal(await f.run(), "accepted");
  assert.equal(await f.run(), "blocked");
  assert.equal(f.bodies.length, 1);
});
test("duas chamadas concorrentes compartilham autorização de tentativa única", async () => {
  const f = fixture();
  assert.deepEqual((await Promise.all([f.run(), f.run()])).sort(), ["accepted", "blocked"]);
  assert.equal(f.bodies.length, 1);
});

test("Login com observação envelhecida revalida a rota e envia uma única vez ao mesmo grupo", async () => {
  const f = fixture({ stale: true });
  assert.equal(await f.run(), "accepted");
  assert.equal(f.calls.filter((c) => c === "whatsapp_login_preflight").length, 1);
  assert.equal(f.calls.filter((c) => c === "whatsapp_group_login_context").length, 2);
  assert.equal(f.bodies.length, 1);
});
test("Falha no preflight não dispara código nem usa a observação anterior", async () => {
  const f = fixture({ stale: true, preflightBlocked: true });
  assert.equal(await f.run(), "blocked");
  assert.equal(f.bodies.length, 0);
  assert.equal(f.calls.includes("authorize_whatsapp_group_login"), false);
});
