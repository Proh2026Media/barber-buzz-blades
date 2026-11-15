import test from "node:test";
import assert from "node:assert/strict";
import { instancePhone, readInstancePhone } from "./whatsapp-instance-phone.ts";
test("identidade da conexão exige ownerJid de instância correspondente", () => {
  assert.equal(
    instancePhone([{ name: "a", ownerJid: "5511900000001@s.whatsapp.net" }], "a"),
    "+5511900000001",
  );
  assert.equal(instancePhone([{ name: "b", ownerJid: "5511900000001@s.whatsapp.net" }], "a"), null);
  assert.equal(instancePhone([{ name: "a", ownerJid: "12345678@lid" }], "a"), null);
  assert.equal(instancePhone([{ name: "a", number: "5511900000001" }], "a"), null);
});
test("ambiguidade ou identidades conflitantes não são aceitas", () => {
  assert.equal(
    instancePhone(
      [
        { name: "a", ownerJid: "5511900000001@s.whatsapp.net" },
        { name: "a", ownerJid: "5511900000002@s.whatsapp.net" },
      ],
      "a",
    ),
    null,
  );
  assert.equal(
    instancePhone(
      {
        name: "a",
        ownerJid: "5511900000001@s.whatsapp.net",
        instance: { ownerJid: "5511900000002@s.whatsapp.net" },
      },
      "a",
    ),
    null,
  );
});
test("falha de leitura conserva só a identidade previamente confirmada", async () => {
  assert.equal(
    await readInstancePhone(
      async () => {
        throw new Error("offline");
      },
      "a",
      "+5511900000001",
    ),
    "+5511900000001",
  );
  assert.equal(await readInstancePhone(async () => ({ number: "5511900000001" }), "a"), null);
});
