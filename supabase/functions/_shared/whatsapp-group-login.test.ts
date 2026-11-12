import test from "node:test";
import assert from "node:assert/strict";
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
  } = {},
) {
  const calls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  let started = false;
  const context = {
    group_id: "11111111-1111-4111-8111-111111111111",
    group_jid: "123-456@g.us",
    version: 3,
    instance_name: "plataforma",
    customer_phone: "+5511999999999",
    platform_phones: ["+5511888888888"],
    sender_phone: "+5511888888888",
  };
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      if (name === "whatsapp_group_login_context") return { data: options.absent ? null : context };
      if (name === "authorize_whatsapp_group_login") {
        if (options.changed || started) return { data: null };
        started = true;
        return {
          data: {
            attempt_id: "tentativa",
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
    if (path.startsWith("/group/bcInspect/"))
      return {
        id: options.wrongGroup ? "999@g.us" : context.group_jid,
        restrict: true,
        memberAddMode: false,
        joinApprovalMode: !options.unknown,
        participants: [
          { id: "5511888888888@s.whatsapp.net", admin: "admin" },
          { id: "5511999999999@s.whatsapp.net", admin: null },
          ...(options.extra ? [{ id: "5511777777777@s.whatsapp.net", admin: null }] : []),
        ],
      };
    bodies.push(JSON.parse(String(init?.body)));
    if (options.timeout) throw new Error("timeout depois da transmissão");
    return { key: { id: "mensagem-ficticia" } };
  };
  return {
    calls,
    bodies,
    run: () =>
      sendGroupLogin(
        db,
        { challengeId: "desafio", codeHash: "hash", text: "Código fictício: 123456" },
        transport,
        options.enabled ?? true,
      ),
  };
}
test("login envia somente ao JID conferido; nunca converte grupo em telefone", async () => {
  const f = fixture();
  assert.equal(await f.run(), "accepted");
  assert.equal(f.bodies.length, 1);
  assert.equal(f.bodies[0].number, "123-456@g.us");
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
