import test from "node:test";
import assert from "node:assert/strict";
import type { CareOperation } from "./care-feedback.ts";
import {
  careFailure,
  careRpcFailure,
  careFailureDiagnostic,
  keepCareFailure,
} from "./care-feedback.ts";

test("Renovação, leitura e salvamento desconhecidos têm mensagens distintas", () => {
  const messages = ["read", "resume", "request", "save", "close"].map(
    (op) => careFailure(op as CareOperation, new Error("Falha fictícia")).message,
  );
  assert.equal(new Set(messages).size, 5);
});
test("Código capturado identifica a restrição sem deduzir causa de outro clique", () => {
  assert.equal(
    careFailure("resume", { code: "P0001", message: "GROUP_PHONE_UNAVAILABLE" }).message,
    "careFeedback.phoneReview",
  );
  assert.equal(
    careFailure("resume", { code: "P0001", message: "GROUP_PARTICIPANTS_CHANGED" }).message,
    "careFeedback.numbersReview",
  );
  assert.equal(
    careFailure("resume", { code: "P0001", message: "Grupo qualquer" }).message,
    "careFeedback.resume",
  );
});
test("Diagnóstico contém só operação, código controlado, horário e status da interface", () => {
  const raw = {
    code: "P0001",
    message: "GROUP_PARTICIPANTS_CHANGED",
    details: "telefone-ficticio segredo-ficticio",
    hint: "email@example.invalid",
    token: "nao-copiar",
  };
  const failure = careFailure("resume", careRpcFailure(raw, 400), "2026-11-15T18:00:00.000Z");
  assert.deepEqual(JSON.parse(careFailureDiagnostic(failure)), {
    origem: "interface",
    fluxo: "grupo_atendimento",
    operacao: "resume",
    codigo: "GROUP_PARTICIPANTS_CHANGED",
    status_http: 400,
    ocorrido_em: "2026-11-15T18:00:00.000Z",
  });
  assert.ok(!/ficticio|example|nao-copiar/.test(careFailureDiagnostic(failure)));
});
test("Erro não controlado e status inválido não copiam conteúdo arbitrário", () => {
  const failure = careFailure(
    "resume",
    careRpcFailure({ code: "segredo-ficticio", message: "telefone +5511999999999" }, 999),
  );
  assert.equal(failure.code, "NAO_IDENTIFICADO");
  assert.equal(failure.httpStatus, undefined);
  assert.ok(!/segredo|5511/.test(careFailureDiagnostic(failure)));
});
test("Falha de atualização automática não apaga a falha de renovação", () => {
  const action = careFailure("resume", { message: "GROUP_PHONE_UNAVAILABLE" });
  const read = careFailure("read", {});
  assert.equal(keepCareFailure(action, read), action);
  assert.equal(keepCareFailure(null, read), read);
});
