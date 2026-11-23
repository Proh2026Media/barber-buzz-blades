import test from "node:test";
import assert from "node:assert/strict";
import { recoverableGroupTransport } from "./recoverable-group-transport.ts";
test("Reutiliza a operação quando a extensão comprova recusa da trava antes do envio", async () => {
  const calls: RequestInit[] = [];
  const transport = recoverableGroupTransport(async (_path, init) => {
    calls.push(init!);
    if (calls.length === 1)
      throw Object.assign(new Error("Operação em andamento; conferir antes de repetir"), {
        status: 409,
      });
    return "aceito";
  });
  assert.equal(
    await transport("/group/bcSendNotice/teste", { method: "POST", body: "mesma operação" }),
    "aceito",
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
});
test("Timeout, falha sem prova, quórum divergente e resultado incerto nunca repetem o envio", async () => {
  for (const err of [
    new TypeError("timeout"),
    Object.assign(new Error("Grupo sem quórum"), { status: 409 }),
    new Error("Falha"),
  ]) {
    let calls = 0;
    const send = recoverableGroupTransport(async () => {
      calls++;
      throw err;
    });
    await assert.rejects(() => send("/group/bcSendCode/teste", { method: "POST" }));
    assert.equal(calls, 1);
  }
});
