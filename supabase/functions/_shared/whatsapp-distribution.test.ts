import test from "node:test";
import assert from "node:assert/strict";
import { runDistribution } from "./whatsapp-distribution.ts";
const candidates = [{ id: "fixture", instance: "ficticia", phone: "+5511800000111", version: 1 }];
function scenario(
  raw: unknown = [
    { name: "ficticia", connectionStatus: "open", ownerJid: "5511800000111@s.whatsapp.net" },
  ],
) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const db = {
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: name === "whatsapp_distribution_connections" ? candidates : { assigned: 0 } };
    },
  };
  return {
    calls,
    db,
    transport: async (path: string) => {
      assert.equal(path, "/instance/fetchInstances");
      return raw;
    },
  };
}
test("Operador só consulta instâncias e registra identidade/status comprovados", async () => {
  const s = scenario();
  const result = await runDistribution(s.db, s.transport);
  assert.equal(result.checked, 1);
  assert.deepEqual(
    s.calls.map((c) => c.name),
    [
      "whatsapp_distribution_connections",
      "record_whatsapp_distribution_connections",
      "run_whatsapp_distribution",
    ],
  );
  assert.equal(
    (s.calls[1].args!.p_observations as { observed_phone: string }[])[0].observed_phone,
    candidates[0].phone,
  );
});
test("Falha da API não vira desconexão, restrição ou confirmação antiga", async () => {
  const s = scenario();
  assert.equal(
    (
      await runDistribution(s.db, async () => {
        throw new Error("ficticio");
      })
    ).state,
    "unavailable",
  );
  assert.equal(s.calls.length, 1);
});
test("Telefone divergente, LID ou status desconhecido não renova prova de conexão", async () => {
  for (const raw of [
    [{ name: "ficticia", connectionStatus: "open", ownerJid: "12345678@lid" }],
    [{ name: "ficticia", connectionStatus: "open", ownerJid: "5511800000999@s.whatsapp.net" }],
    [{ name: "ficticia", connectionStatus: "inventado" }],
  ]) {
    const s = scenario(raw);
    assert.equal((await runDistribution(s.db, s.transport)).checked, 0);
  }
});
test("Erro no registro não avança para atribuição", async () => {
  const s = scenario();
  const rpc = s.db.rpc;
  s.db.rpc = async (name, args) =>
    name === "record_whatsapp_distribution_connections"
      ? ({ error: true } as never)
      : rpc(name, args);
  await assert.rejects(() => runDistribution(s.db, s.transport), /UNAVAILABLE/);
  assert.equal(
    s.calls.some((c) => c.name === "run_whatsapp_distribution"),
    false,
  );
});
