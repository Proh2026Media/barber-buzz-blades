import test from "node:test";
import assert from "node:assert/strict";
import { inspectJoinRequests } from "./join-request-diagnostics.ts";
const pn = "5511800000111@s.whatsapp.net",
  other = "5511800000222@s.whatsapp.net",
  lid = "12345678@lid";
test("Pedido ausente é diferente de LID não comprovado", async () => {
  assert.deepEqual((await inspectJoinRequests([], pn, async () => null)).diagnostic, {
    total: 0,
    matching: 0,
    unresolved: 0,
    other: 0,
  });
  assert.deepEqual((await inspectJoinRequests([{ jid: lid }], pn, async () => null)).diagnostic, {
    total: 1,
    matching: 0,
    unresolved: 1,
    other: 0,
  });
});
test("Preserva correspondência estrita, inclusive quando aparência dos números é próxima", async () => {
  const r = await inspectJoinRequests([{ jid: pn }, { jid: other }], pn, async (jid) => jid);
  assert.deepEqual(r.matches, [pn]);
  assert.equal(r.diagnostic.other, 1);
  assert.equal(
    (await inspectJoinRequests([{ jid: other }], pn, async (jid) => jid)).matches.length,
    0,
  );
});
test("LID só corresponde quando o resolvedor autoritativo o comprova", async () => {
  assert.deepEqual(
    (await inspectJoinRequests([{ jid: lid }], pn, async (jid) => (jid === lid ? pn : null)))
      .matches,
    [lid],
  );
});
test("Campos desconhecidos não fabricam identidade e contagens não vazam dados", async () => {
  const r = await inspectJoinRequests(
    [{ jid: lid, phoneNumber: pn, phone_number: pn }, { id: pn }, null],
    pn,
    async () => null,
  );
  assert.deepEqual(r.diagnostic, { total: 3, matching: 0, unresolved: 3, other: 0 });
  assert.equal(JSON.stringify(r.diagnostic).includes(pn), false);
  assert.equal(JSON.stringify(r.diagnostic).includes(lid), false);
});
test("Ambiguidade permanece explícita e erros não viram ausência", async () => {
  assert.equal(
    (await inspectJoinRequests([{ jid: pn }, { jid: pn }], pn, async () => pn)).matches.length,
    2,
  );
  await assert.rejects(() =>
    inspectJoinRequests([{ jid: lid }], pn, async () => {
      throw Error("erro");
    }),
  );
  await assert.rejects(() => inspectJoinRequests(Array(101).fill({ jid: pn }), pn, async () => pn));
});
