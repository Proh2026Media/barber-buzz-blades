import assert from "node:assert/strict";
import test from "node:test";
import {
  createRefundRequest,
  quoteCancellationRefund,
  refundBalance,
  requestComplementaryRefund,
  transitionRefund,
  type CancellationRefundInput,
  type RefundBalance,
  type RefundProcess,
} from "./refund-policy.ts";

const start = Date.parse("2026-11-07T15:00:00-03:00");
const balance: RefundBalance = {
  currency: "BRL",
  receivedCents: 10_000,
  refundedCents: 0,
  reservedCents: 0,
};
const input: CancellationRefundInput = {
  ...balance,
  agreedPriceCents: 10_000,
  startsAtMs: start,
  cancelledAtMs: start - 2 * 60 * 60 * 1000,
  policyAccepted: true,
  actor: "customer",
  reason: "forgot",
};
const quote = (patch: Partial<CancellationRefundInput> = {}) =>
  quoteCancellationRefund({ ...input, ...patch });
const request = () =>
  createRefundRequest(
    { id: "pedido-1", kind: "initial", currency: "BRL", amountCents: 7_000 },
    balance,
  );
function processing(): RefundProcess {
  const approved = transitionRefund(request(), { id: "aprovar-1", type: "approve" });
  return transitionRefund(approved, { id: "iniciar-1", type: "start" });
}

test("P-49: exatamente três horas e um milissegundo antes não retêm; um depois retém", () => {
  for (const lead of [10_800_000, 10_800_001]) {
    const result = quote({ cancelledAtMs: start - lead });
    assert.equal(result.retentionCents, 0);
    assert.equal(result.refundableNowCents, 10_000);
    assert.equal(result.rule, "at_least_three_hours");
  }
  const result = quote({ cancelledAtMs: start - 10_799_999 });
  assert.equal(result.retentionCents, 3_000);
  assert.equal(result.refundTargetCents, 7_000);
});

test("P-49: compara instantes absolutos equivalentes em fusos diferentes", () => {
  assert.deepEqual(
    quote({ cancelledAtMs: Date.parse("2026-11-07T12:00:00-03:00") }),
    quote({ cancelledAtMs: Date.parse("2026-11-07T15:00:00Z") }),
  );
});

test("P-49: início exato e horário passado não recebem taxa automática", () => {
  for (const cancelledAtMs of [start, start + 1, start + 3_600_000]) {
    assert.equal(quote({ cancelledAtMs }).rule, "after_start");
    assert.equal(quote({ cancelledAtMs }).retentionCents, 0);
  }
});

test("P-49: apenas esquecimento explícito do cliente pode reter", () => {
  for (const actor of ["customer", "shop", "system"] as const) {
    for (const reason of ["forgot", "other", "unspecified", "no_show", "series_stopped"] as const) {
      const result = quote({ actor, reason });
      assert.equal(result.retentionCents, actor === "customer" && reason === "forgot" ? 3_000 : 0);
    }
  }
});

test("P-49: sinal, ausência de aceite, recebimento excedente e preço zero não geram retenção", () => {
  for (const patch of [
    { receivedCents: 2_000 },
    { policyAccepted: false },
    { receivedCents: 12_000 },
    { agreedPriceCents: 0 },
  ]) {
    const result = quote(patch);
    assert.equal(result.retentionCents, 0);
    assert.equal(result.refundTargetCents, patch.receivedCents ?? 10_000);
  }
});

test("P-49: sem recebimento comprovado há zero, independentemente do preço", () => {
  const result = quote({ receivedCents: 0 });
  assert.equal(result.rule, "no_payment");
  assert.equal(result.retentionCents, 0);
  assert.equal(result.refundableNowCents, 0);
  assert.equal(result.complementaryTargetCents, 0);
});

test("P-49: retenção arredonda para baixo e a diferença preserva todos os centavos", () => {
  for (const value of [1, 2, 3, 4, 9, 11, 10_001, Number.MAX_SAFE_INTEGER]) {
    const result = quote({ receivedCents: value, agreedPriceCents: value });
    assert.equal(result.retentionCents, Number((BigInt(value) * 3n) / 10n));
    assert.equal(result.retentionCents + result.refundTargetCents, value);
  }
});

test("P-49: prévia desconta confirmado e reservado, sem saldo ou complemento negativo", () => {
  const partial = quote({ refundedCents: 2_000, reservedCents: 3_000 });
  assert.equal(partial.availableCents, 5_000);
  assert.equal(partial.refundableNowCents, 2_000);
  assert.equal(partial.complementaryTargetCents, 3_000);
  const overBase = quote({ refundedCents: 9_000 });
  assert.equal(overBase.refundableNowCents, 0);
  assert.equal(overBase.complementaryTargetCents, 1_000);
  const allReserved = quote({ reservedCents: 10_000 });
  assert.equal(allReserved.availableCents, 0);
  assert.equal(allReserved.refundableNowCents, 0);
  assert.equal(allReserved.complementaryTargetCents, 0);
});

test("P-49: recusa centavos fracionados, negativos, infinitos e fora da precisão segura", () => {
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of [
      "agreedPriceCents",
      "receivedCents",
      "refundedCents",
      "reservedCents",
    ] as const) {
      assert.throws(() => quote({ [field]: value }));
    }
  }
});

test("P-49: saldo impossível é recusado em vez de mascarado como zero", () => {
  assert.throws(() => refundBalance({ ...balance, refundedCents: 10_001 }));
  assert.throws(() => refundBalance({ ...balance, refundedCents: 8_000, reservedCents: 2_001 }));
  assert.equal(
    refundBalance({
      ...balance,
      receivedCents: Number.MAX_SAFE_INTEGER,
      refundedCents: Number.MAX_SAFE_INTEGER,
    }).availableCents,
    0,
  );
});

test("P-49: rejeita datas, moeda, ator, motivo e aceite inválidos mesmo fora do TypeScript", () => {
  for (const patch of [
    { startsAtMs: NaN },
    { cancelledAtMs: Infinity },
    { startsAtMs: 8_640_000_000_000_001 },
    { cancelledAtMs: 1.5 },
    { currency: "USD" },
    { actor: "admin" },
    { reason: "inventado" },
    { policyAccepted: "sim" },
  ]) {
    assert.throws(() => quoteCancellationRefund({ ...input, ...patch } as CancellationRefundInput));
  }
});

test("P-49: pedir e analisar não reservam nem afirmam dinheiro devolvido", () => {
  const original = request();
  const reviewed = transitionRefund(original, { id: "analisar", type: "review" });
  assert.equal(reviewed.status, "reviewing");
  assert.deepEqual(reviewed.balance, balance);
  assert.equal(original.status, "requested");
  assert.equal(original.events.length, 0);
});

test("P-49: aprovação reserva uma vez, processamento não confirma transferência", () => {
  const approved = transitionRefund(request(), { id: "aprovar", type: "approve" });
  assert.equal(approved.balance.reservedCents, 7_000);
  assert.equal(approved.balance.refundedCents, 0);
  const again = transitionRefund(approved, { id: "aprovar-novamente", type: "approve" });
  assert.deepEqual(again.balance, approved.balance);
  const started = transitionRefund(again, { id: "iniciar", type: "start" });
  assert.equal(started.status, "processing");
  assert.equal(started.attempt, 1);
  assert.equal(started.balance.refundedCents, 0);
  assert.throws(() => transitionRefund(started, { id: "iniciar-duas-vezes", type: "start" }));
});

test("P-49: confirmação exata move só a reserva da operação", () => {
  const withOther = createRefundRequest(
    { id: "pedido", kind: "initial", currency: "BRL", amountCents: 5_000 },
    { ...balance, refundedCents: 1_000, reservedCents: 2_000 },
  );
  const approved = transitionRefund(withOther, { id: "aprovar", type: "approve" });
  const started = transitionRefund(approved, { id: "iniciar", type: "start" });
  const confirmed = transitionRefund(started, {
    id: "confirmar",
    type: "confirm",
    attempt: 1,
    amountCents: 5_000,
  });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.balance.refundedCents, 6_000);
  assert.equal(confirmed.balance.reservedCents, 2_000);
  assert.equal(refundBalance(confirmed.balance).availableCents, 2_000);
});

test("P-49: mesmo evento é idempotente; mesmo ID com outro conteúdo é recusado", () => {
  const event = { id: "evento-provedor", type: "confirm", attempt: 1, amountCents: 7_000 } as const;
  const confirmed = transitionRefund(processing(), event);
  assert.equal(transitionRefund(confirmed, event), confirmed);
  assert.throws(() => transitionRefund(confirmed, { ...event, amountCents: 7_001 }));
  const repeated = transitionRefund(confirmed, { ...event, id: "outra-notificacao" });
  assert.equal(repeated.balance.refundedCents, 7_000);
  const delayedFailure = transitionRefund(repeated, {
    id: "falha-atrasada",
    type: "fail",
    attempt: 1,
  });
  assert.equal(delayedFailure.status, "confirmed");
  assert.equal(delayedFailure.balance.refundedCents, 7_000);
});

test("P-49: confirmação não aceita valor diferente, futuro ou operação ainda não iniciada", () => {
  for (const amountCents of [0, 6_999, 7_001, 10_001]) {
    assert.throws(() =>
      transitionRefund(processing(), { id: "evento", type: "confirm", attempt: 1, amountCents }),
    );
  }
  assert.throws(() =>
    transitionRefund(processing(), {
      id: "futuro",
      type: "confirm",
      attempt: 2,
      amountCents: 7_000,
    }),
  );
  assert.throws(() =>
    transitionRefund(request(), { id: "cedo", type: "confirm", attempt: 1, amountCents: 7_000 }),
  );
});

test("P-49: falha definitiva libera a reserva, permite nova tentativa e ignora evento anterior", () => {
  const failed = transitionRefund(processing(), { id: "falha", type: "fail", attempt: 1 });
  assert.equal(failed.balance.reservedCents, 0);
  assert.equal(failed.balance.refundedCents, 0);
  const approved = transitionRefund(failed, { id: "reaprovar", type: "approve" });
  const retry = transitionRefund(approved, { id: "reiniciar", type: "start" });
  assert.equal(retry.attempt, 2);
  const late = transitionRefund(retry, {
    id: "evento-antigo",
    type: "confirm",
    attempt: 1,
    amountCents: 7_000,
  });
  assert.equal(late.status, "processing");
  assert.equal(late.balance.refundedCents, 0);
  const confirmed = transitionRefund(late, {
    id: "confirmacao-atual",
    type: "confirm",
    attempt: 2,
    amountCents: 7_000,
  });
  assert.equal(confirmed.balance.refundedCents, 7_000);
});

test("P-49: incerteza conserva reserva e impede nova tentativa ou falha sem conciliação", () => {
  const uncertain = transitionRefund(processing(), {
    id: "timeout",
    type: "uncertain",
    attempt: 1,
  });
  assert.equal(uncertain.status, "uncertain");
  assert.equal(uncertain.balance.reservedCents, 7_000);
  assert.equal(uncertain.balance.refundedCents, 0);
  for (const type of ["review", "approve", "start"] as const) {
    assert.throws(() => transitionRefund(uncertain, { id: type, type }));
  }
  assert.throws(() => transitionRefund(uncertain, { id: "liberar", type: "fail", attempt: 1 }));
  assert.throws(() =>
    transitionRefund(uncertain, {
      id: "confirmar",
      type: "confirm",
      attempt: 1,
      amountCents: 7_000,
    }),
  );
});

test("P-49: conciliação confirmada encerra sem repetir; não transferido libera para tentar", () => {
  const uncertain = transitionRefund(processing(), {
    id: "timeout",
    type: "uncertain",
    attempt: 1,
  });
  const doneEvent = {
    id: "conciliar",
    type: "reconcile",
    attempt: 1,
    outcome: "confirmed",
    amountCents: 7_000,
  } as const;
  const confirmed = transitionRefund(uncertain, doneEvent);
  assert.equal(confirmed.balance.refundedCents, 7_000);
  assert.equal(confirmed.balance.reservedCents, 0);
  assert.equal(transitionRefund(confirmed, doneEvent), confirmed);
  const failed = transitionRefund(uncertain, {
    id: "conciliar-nao-transferido",
    type: "reconcile",
    attempt: 1,
    outcome: "not_transferred",
    amountCents: 0,
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.balance.refundedCents, 0);
  assert.equal(failed.balance.reservedCents, 0);
  assert.equal(transitionRefund(failed, { id: "reaprovar", type: "approve" }).status, "approved");
  assert.throws(() => transitionRefund(uncertain, { ...doneEvent, amountCents: 10_000 }));
  assert.throws(() => transitionRefund(uncertain, { ...doneEvent, outcome: "not_transferred" }));
});

test("P-49: complemento solicita só a retenção após cobertura da devolução-base", () => {
  const quoted = quote();
  assert.throws(() => requestComplementaryRefund(quoted, balance, "cedo"));
  const afterBase = { ...balance, refundedCents: 7_000 };
  const complementary = requestComplementaryRefund(quoted, afterBase, "complemento");
  assert.equal(complementary.amountCents, 3_000);
  assert.equal(complementary.status, "requested");
  assert.deepEqual(complementary.balance, afterBase);
  const approved = transitionRefund(complementary, { id: "aprovar", type: "approve" });
  const started = transitionRefund(approved, { id: "iniciar", type: "start" });
  const confirmed = transitionRefund(started, {
    id: "confirmar",
    type: "confirm",
    attempt: 1,
    amountCents: 3_000,
  });
  assert.equal(confirmed.balance.refundedCents, 10_000);
  assert.equal(refundBalance(confirmed.balance).availableCents, 0);
  assert.throws(() => requestComplementaryRefund(quoted, confirmed.balance, "duplicado"));
});

test("P-49: complemento respeita reserva da base e outras devoluções já confirmadas", () => {
  const withBaseReserved = requestComplementaryRefund(
    quote(),
    { ...balance, reservedCents: 7_000 },
    "complemento",
  );
  assert.equal(withBaseReserved.amountCents, 3_000);
  const remaining = requestComplementaryRefund(
    quote(),
    { ...balance, refundedCents: 9_000 },
    "restante",
  );
  assert.equal(remaining.amountCents, 1_000);
  assert.throws(() =>
    requestComplementaryRefund(
      quote({ policyAccepted: false }),
      { ...balance, refundedCents: 10_000 },
      "sem-retencao",
    ),
  );
  assert.throws(() =>
    requestComplementaryRefund(quote(), { ...balance, receivedCents: 20_000 }, "outro-recebimento"),
  );
});

test("P-49: aprovação revalida saldo e não permite operação excedente nem reserva ausente", () => {
  const oldRequest = request();
  assert.throws(() =>
    transitionRefund(
      { ...oldRequest, balance: { ...balance, reservedCents: 4_000 } },
      { id: "aprovar", type: "approve" },
    ),
  );
  assert.throws(() =>
    transitionRefund(
      { ...processing(), balance },
      { id: "confirmar", type: "confirm", attempt: 1, amountCents: 7_000 },
    ),
  );
  assert.throws(() =>
    createRefundRequest(
      { id: "pedido", kind: "initial", currency: "BRL", amountCents: 10_001 },
      balance,
    ),
  );
  assert.throws(() =>
    createRefundRequest(
      { id: "pedido", kind: "initial", currency: "BRL", amountCents: 0 },
      balance,
    ),
  );
});

test("P-49: recusa encerra análise sem reservar ou devolver dinheiro", () => {
  const pending = transitionRefund(request(), { id: "analisar", type: "review" });
  const rejected = transitionRefund(pending, { id: "recusar", type: "reject" });
  assert.equal(rejected.status, "rejected");
  assert.deepEqual(rejected.balance, balance);
  assert.strictEqual(transitionRefund(rejected, { id: "recusar", type: "reject" }), rejected);
  assert.throws(() => transitionRefund(rejected, { id: "aprovar-recusa", type: "approve" }));
  assert.throws(() => transitionRefund(processing(), { id: "recusar-envio", type: "reject" }));
});
