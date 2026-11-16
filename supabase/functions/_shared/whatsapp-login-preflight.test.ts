import test from "node:test";
import assert from "node:assert/strict";
import { refreshWhatsappLoginRoute } from "./whatsapp-login-preflight.ts";
const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const calls: string[] = [];
  const target = { id, instance: "ficticia_a", phone: "+5511800000111", version: 2 };
  const candidate = {
    challenge: id,
    targets: [
      target,
      {
        ...target,
        id: "22222222-2222-4222-8222-222222222222",
        instance: "ficticia_b",
        phone: "+5511800000222",
      },
    ],
  };
  let expected: unknown;
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "whatsapp_login_preflight") return { data: candidate };
      expected = args;
      return { data: true };
    },
  };
  const observe = async (path: string) => {
    calls.push(path);
    return candidate.targets.map((t) => ({
      name: t.instance,
      connectionStatus: "open",
      ownerJid: t.phone.slice(1) + "@s.whatsapp.net",
    }));
  };
  return {
    calls,
    candidate,
    db,
    observe,
    expected: () => expected,
    args: { p_challenge_id: id, p_code_hash: "a".repeat(64) },
  };
}
test("Login observa uma vez e grava apenas os números do desafio escolhido pelo banco", async () => {
  const f = fixture();
  assert.equal(await refreshWhatsappLoginRoute(f.db, f.args, f.observe), true);
  assert.deepEqual(f.calls, [
    "whatsapp_login_preflight",
    "/instance/fetchInstances",
    "complete_whatsapp_login_preflight",
  ]);
  const a = f.expected() as { p_expected: unknown; p_observations: { status: string }[] };
  assert.deepEqual(a.p_expected, f.candidate);
  assert.ok(a.p_observations.every((o) => o.status === "open"));
});
test("Desafio alheio, números duplicados ou resposta inválida bloqueiam antes da rede", async () => {
  for (const mode of ["id", "duplicate", "missing"]) {
    const f = fixture();
    if (mode === "id") f.candidate.challenge = "outro";
    if (mode === "duplicate") f.candidate.targets[1] = f.candidate.targets[0];
    if (mode === "missing") f.candidate.targets.length = 1;
    assert.equal(await refreshWhatsappLoginRoute(f.db, f.args, f.observe), false);
    assert.deepEqual(f.calls, ["whatsapp_login_preflight"]);
  }
});
test("Número desconhecido não ganha observação de conectado por ter o mesmo nome de instância", async () => {
  const f = fixture();
  await refreshWhatsappLoginRoute(f.db, f.args, async () =>
    f.candidate.targets.map((t) => ({
      name: t.instance,
      connectionStatus: "open",
      ownerJid: "5511800000999@s.whatsapp.net",
    })),
  );
  assert.ok(
    (f.expected() as { p_observations: { status: string }[] }).p_observations.every(
      (o) => o.status === "unknown",
    ),
  );
});
test("Troca de versão, pausa ou falha de rede não autoriza rota nem retry", async () => {
  const f = fixture();
  assert.equal(
    await refreshWhatsappLoginRoute(
      {
        ...f.db,
        rpc: async (name, args) =>
          name === "complete_whatsapp_login_preflight" ? { data: false } : f.db.rpc(name, args),
      },
      f.args,
      f.observe,
    ),
    false,
  );
  const g = fixture();
  assert.equal(
    await refreshWhatsappLoginRoute(g.db, g.args, async () => {
      throw Error("rede");
    }),
    false,
  );
  assert.deepEqual(g.calls, ["whatsapp_login_preflight"]);
});
