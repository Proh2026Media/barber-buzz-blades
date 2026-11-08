/**
 * P-49: preparação e simulação local. Não comprova pagamentos, autoriza movimentações ou
 * substitui a transação/validação do futuro servidor. Valores de entrada precisam vir de
 * recebimentos conferidos; preço de serviço não é um recebimento.
 */
export const REFUND_POLICY_VERSION = "2026-11-07-preparacao";
export const REFUND_FREE_WINDOW_MS = 3 * 60 * 60 * 1000;

export type RefundCurrency = "BRL";
export type RefundBalance = Readonly<{
  currency: RefundCurrency;
  receivedCents: number;
  refundedCents: number;
  /** Inclui devoluções aprovadas, em processamento ou com resultado incerto. */
  reservedCents: number;
}>;
export type CancellationActor = "customer" | "shop" | "system";
export type RefundCancellationReason =
  | "forgot"
  | "other"
  | "unspecified"
  | "no_show"
  | "series_stopped";
export type CancellationRefundInput = RefundBalance &
  Readonly<{
    agreedPriceCents: number;
    startsAtMs: number;
    cancelledAtMs: number;
    policyAccepted: boolean;
    actor: CancellationActor;
    reason: RefundCancellationReason;
  }>;
export type RefundRule =
  | "no_payment"
  | "partial_payment"
  | "payment_mismatch"
  | "without_acceptance"
  | "not_customer_forgetting"
  | "after_start"
  | "at_least_three_hours"
  | "late_forgetting";
export type CancellationRefundQuote = Readonly<{
  policyVersion: typeof REFUND_POLICY_VERSION;
  currency: RefundCurrency;
  receivedCents: number;
  retentionCents: number;
  /** Total previsto pela política, antes de descontar devoluções anteriores. */
  refundTargetCents: number;
  availableCents: number;
  refundableNowCents: number;
  complementaryTargetCents: number;
  rule: RefundRule;
}>;

function requireCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cents(value: number, name: string): void {
  requireCondition(
    Number.isSafeInteger(value) && value >= 0,
    `${name} deve ser um número inteiro seguro de centavos, sem valor negativo.`,
  );
}

function currency(value: RefundCurrency): void {
  requireCondition(value === "BRL", "A preparação atual aceita somente BRL.");
}

function identifier(value: string): void {
  requireCondition(
    typeof value === "string" && value.trim().length > 0 && value.length <= 128,
    "Identificador ausente ou inválido.",
  );
}

function instant(value: number): void {
  requireCondition(
    Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000,
    "Instante inválido: informe milissegundos absolutos, com fuso já resolvido.",
  );
}

/** Não corrige silenciosamente um saldo impossível; recusa a entrada inconsistente. */
export function refundBalance(balance: RefundBalance): { availableCents: number } {
  currency(balance.currency);
  cents(balance.receivedCents, "Recebido");
  cents(balance.refundedCents, "Devolvido");
  cents(balance.reservedCents, "Reservado");
  requireCondition(balance.refundedCents <= balance.receivedCents, "Devolução excede o recebido.");
  const remaining = balance.receivedCents - balance.refundedCents;
  requireCondition(balance.reservedCents <= remaining, "Reserva excede o saldo recebido.");
  return { availableCents: remaining - balance.reservedCents };
}

/** Prévia pura; o futuro servidor deve recalcular com seu relógio antes de confirmar a ação. */
export function quoteCancellationRefund(input: CancellationRefundInput): CancellationRefundQuote {
  const { availableCents } = refundBalance(input);
  cents(input.agreedPriceCents, "Preço acordado");
  instant(input.startsAtMs);
  instant(input.cancelledAtMs);
  requireCondition(typeof input.policyAccepted === "boolean", "Aceite da política inválido.");
  requireCondition(["customer", "shop", "system"].includes(input.actor), "Autor inválido.");
  requireCondition(
    ["forgot", "other", "unspecified", "no_show", "series_stopped"].includes(input.reason),
    "Motivo inválido.",
  );
  const lead = input.startsAtMs - input.cancelledAtMs;
  let rule: RefundRule;
  if (input.receivedCents === 0) rule = "no_payment";
  else if (!input.policyAccepted) rule = "without_acceptance";
  else if (input.receivedCents < input.agreedPriceCents) rule = "partial_payment";
  else if (input.receivedCents !== input.agreedPriceCents) rule = "payment_mismatch";
  else if (input.actor !== "customer" || input.reason !== "forgot")
    rule = "not_customer_forgetting";
  else if (lead <= 0) rule = "after_start";
  else if (lead >= REFUND_FREE_WINDOW_MS) rule = "at_least_three_hours";
  else rule = "late_forgetting";

  // BigInt evita perder centavos na multiplicação, inclusive no limite do inteiro seguro.
  const retentionCents =
    rule === "late_forgetting" ? Number((BigInt(input.receivedCents) * 3n) / 10n) : 0;
  const refundTargetCents = input.receivedCents - retentionCents;
  const refundableNowCents = Math.min(
    availableCents,
    Math.max(0, refundTargetCents - input.refundedCents - input.reservedCents),
  );
  return {
    policyVersion: REFUND_POLICY_VERSION,
    currency: input.currency,
    receivedCents: input.receivedCents,
    retentionCents,
    refundTargetCents,
    availableCents,
    refundableNowCents,
    complementaryTargetCents: Math.min(retentionCents, availableCents - refundableNowCents),
    rule,
  };
}

export type RefundStatus =
  | "requested"
  | "reviewing"
  | "rejected"
  | "approved"
  | "processing"
  | "confirmed"
  | "failed"
  | "uncertain";
export type RefundRequest = Readonly<{
  id: string;
  kind: "initial" | "complementary";
  amountCents: number;
  currency: RefundCurrency;
}>;
export type RefundProcess = RefundRequest &
  Readonly<{
    status: RefundStatus;
    attempt: number;
    balance: RefundBalance;
    events: ReadonlyArray<Readonly<{ id: string; fingerprint: string }>>;
  }>;
export type RefundEvent =
  | Readonly<{ id: string; type: "review" }>
  | Readonly<{ id: string; type: "reject" }>
  | Readonly<{ id: string; type: "approve" }>
  | Readonly<{ id: string; type: "start" }>
  | Readonly<{ id: string; type: "confirm"; attempt: number; amountCents: number }>
  | Readonly<{ id: string; type: "fail"; attempt: number }>
  | Readonly<{ id: string; type: "uncertain"; attempt: number }>
  | Readonly<{
      id: string;
      type: "reconcile";
      attempt: number;
      outcome: "confirmed" | "not_transferred";
      amountCents: number;
    }>;

/** Cria uma solicitação, sem reservar ou confirmar uma transferência. */
export function createRefundRequest(request: RefundRequest, balance: RefundBalance): RefundProcess {
  identifier(request.id);
  currency(request.currency);
  cents(request.amountCents, "Valor solicitado");
  requireCondition(["initial", "complementary"].includes(request.kind), "Tipo de pedido inválido.");
  requireCondition(request.currency === balance.currency, "Moedas diferentes.");
  requireCondition(request.amountCents > 0, "Não há valor a devolver.");
  requireCondition(
    request.amountCents <= refundBalance(balance).availableCents,
    "Saldo insuficiente.",
  );
  return { ...request, status: "requested", attempt: 0, balance: { ...balance }, events: [] };
}

/** O complemento pede a parcela retida; a devolução-base já deve estar coberta. */
export function requestComplementaryRefund(
  quote: CancellationRefundQuote,
  balance: RefundBalance,
  id: string,
): RefundProcess {
  const { availableCents } = refundBalance(balance);
  cents(quote.retentionCents, "Retenção");
  cents(quote.refundTargetCents, "Devolução prevista");
  requireCondition(
    quote.policyVersion === REFUND_POLICY_VERSION &&
      quote.currency === balance.currency &&
      quote.receivedCents === balance.receivedCents &&
      quote.retentionCents <= balance.receivedCents &&
      quote.refundTargetCents === balance.receivedCents - quote.retentionCents,
    "Prévia incompatível com o recebimento.",
  );
  requireCondition(
    balance.receivedCents - availableCents >= quote.refundTargetCents,
    "A devolução-base precisa estar confirmada ou reservada antes do complemento.",
  );
  return createRefundRequest(
    {
      id,
      kind: "complementary",
      currency: balance.currency,
      amountCents: Math.min(quote.retentionCents, availableCents),
    },
    balance,
  );
}

function eventFingerprint(event: RefundEvent): string {
  identifier(event.id);
  if (
    event.type === "review" ||
    event.type === "reject" ||
    event.type === "approve" ||
    event.type === "start"
  )
    return event.type;
  requireCondition(
    ["confirm", "fail", "uncertain", "reconcile"].includes(event.type),
    "Evento inválido.",
  );
  requireCondition(Number.isSafeInteger(event.attempt) && event.attempt > 0, "Tentativa inválida.");
  if (event.type === "confirm" || event.type === "reconcile")
    cents(event.amountCents, "Valor confirmado");
  if (event.type === "reconcile") {
    requireCondition(
      ["confirmed", "not_transferred"].includes(event.outcome),
      "Conciliação inválida.",
    );
    return `${event.type}:${event.attempt}:${event.outcome}:${event.amountCents}`;
  }
  return `${event.type}:${event.attempt}:${event.type === "confirm" ? event.amountCents : ""}`;
}

/**
 * Máquina de simulação de UMA operação sobre uma cópia do saldo. O servidor futuro deve
 * bloquear o saldo compartilhado e deduplicar eventos de TODAS as operações numa transação.
 * `fail` significa falha definitiva verificada; timeout deve produzir `uncertain`.
 */
export function transitionRefund(process: RefundProcess, event: RefundEvent): RefundProcess {
  const { availableCents } = refundBalance(process.balance);
  identifier(process.id);
  cents(process.amountCents, "Valor solicitado");
  requireCondition(
    process.amountCents > 0 && process.currency === process.balance.currency,
    "Pedido inválido.",
  );
  requireCondition(
    Number.isSafeInteger(process.attempt) && process.attempt >= 0,
    "Tentativa inválida.",
  );
  requireCondition(
    [
      "requested",
      "reviewing",
      "rejected",
      "approved",
      "processing",
      "confirmed",
      "failed",
      "uncertain",
    ].includes(process.status),
    "Estado inválido.",
  );
  const reserved = ["approved", "processing", "uncertain"].includes(process.status);
  requireCondition(
    !reserved || process.balance.reservedCents >= process.amountCents,
    "Reserva da operação ausente.",
  );
  requireCondition(
    process.status !== "confirmed" || process.balance.refundedCents >= process.amountCents,
    "Devolução confirmada ausente.",
  );
  const fingerprint = eventFingerprint(event);
  const previous = process.events.find((item) => item.id === event.id);
  if (previous) {
    requireCondition(
      previous.fingerprint === fingerprint,
      "Evento repetido com conteúdo diferente.",
    );
    return process;
  }
  const finish = (patch: Partial<RefundProcess> = {}): RefundProcess => ({
    ...process,
    ...patch,
    events: [...process.events, { id: event.id, fingerprint }],
  });
  const confirm = (): RefundProcess =>
    finish({
      status: "confirmed",
      balance: {
        ...process.balance,
        refundedCents: process.balance.refundedCents + process.amountCents,
        reservedCents: process.balance.reservedCents - process.amountCents,
      },
    });
  const fail = (): RefundProcess =>
    finish({
      status: "failed",
      balance: {
        ...process.balance,
        reservedCents: process.balance.reservedCents - process.amountCents,
      },
    });

  if (event.type === "reject") {
    requireCondition(
      ["requested", "reviewing", "rejected"].includes(process.status),
      "Só um pedido ainda não aprovado pode ser recusado.",
    );
    return finish({ status: "rejected" });
  }
  if (event.type === "review") {
    requireCondition(
      ["requested", "reviewing", "failed"].includes(process.status),
      "Pedido não pode voltar à análise.",
    );
    return finish({ status: "reviewing" });
  }
  if (event.type === "approve") {
    if (process.status === "approved") return finish();
    requireCondition(
      ["requested", "reviewing", "failed"].includes(process.status),
      "Pedido não pode ser aprovado neste estado.",
    );
    requireCondition(process.amountCents <= availableCents, "Saldo insuficiente para aprovar.");
    return finish({
      status: "approved",
      balance: {
        ...process.balance,
        reservedCents: process.balance.reservedCents + process.amountCents,
      },
    });
  }
  if (event.type === "start") {
    requireCondition(process.status === "approved", "Só uma devolução aprovada pode iniciar.");
    requireCondition(process.attempt < Number.MAX_SAFE_INTEGER, "Limite de tentativas atingido.");
    return finish({ status: "processing", attempt: process.attempt + 1 });
  }

  requireCondition(event.attempt <= process.attempt, "Evento de tentativa ainda não iniciada.");
  // Eventos antigos não confirmam dinheiro nem encerram uma tentativa mais recente.
  if (event.attempt < process.attempt) return finish();
  if (event.type === "confirm") {
    requireCondition(
      event.amountCents === process.amountCents,
      "Valor confirmado difere do solicitado.",
    );
    if (process.status === "confirmed") return finish();
    requireCondition(
      process.status === "processing",
      "Confirmação exige processamento; resultado incerto exige conciliação.",
    );
    return confirm();
  }
  if (event.type === "reconcile") {
    const transferred = event.outcome === "confirmed";
    requireCondition(
      event.amountCents === (transferred ? process.amountCents : 0),
      "Valor da conciliação incompatível.",
    );
    if (
      (transferred && process.status === "confirmed") ||
      (!transferred && process.status === "failed")
    )
      return finish();
    requireCondition(process.status === "uncertain", "Conciliação exige uma operação incerta.");
    return transferred ? confirm() : fail();
  }
  if (process.status === "confirmed") return finish();
  if (event.type === "fail") {
    if (process.status === "failed") return finish();
    requireCondition(
      process.status === "processing",
      "Resultado incerto exige conciliação antes de liberar o saldo.",
    );
    return fail();
  }
  requireCondition(
    process.status === "processing" || process.status === "uncertain",
    "Incerteza exige uma operação em processamento.",
  );
  return finish({ status: "uncertain" });
}
