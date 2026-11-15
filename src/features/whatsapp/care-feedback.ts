import type { MessageKey } from "@/lib/i18n";

export type CareOperation = "advance" | "read" | "resume" | "request" | "save" | "close";
const known: Record<string, MessageKey> = {
  GROUP_PHONE_UNAVAILABLE: "careFeedback.phoneReview",
  GROUP_PARTICIPANTS_CHANGED: "careFeedback.numbersReview",
  GROUP_UNAVAILABLE: "careFeedback.unavailable",
  ACCESS_UNAVAILABLE: "careAccess.followFailed",
  GROUP_REVIEW_REQUIRED: "careAccess.review",
  WA_RATE_LIMIT: "careAccess.rate",
  GROUP_STALE: "careFeedback.stale",
};
const fallback: Record<CareOperation, MessageKey> = {
  advance: "careAccess.followFailed",
  read: "careFeedback.read",
  resume: "careFeedback.resume",
  request: "careFeedback.request",
  save: "careFeedback.save",
  close: "careFeedback.close",
};
export type CareFailure = {
  operation: CareOperation;
  code: string;
  httpStatus?: number;
  message: MessageKey;
  at: string;
};
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Retém apenas códigos controlados e status; nunca mensagem SQL, telefone ou sessão. */
export function careRpcFailure(value: unknown, httpStatus?: number) {
  const error = record(value);
  const reason =
    typeof error.message === "string" && Object.hasOwn(known, error.message)
      ? error.message
      : typeof error.code === "string" && Object.hasOwn(known, error.code)
        ? error.code
        : typeof error.code === "string" &&
            /^(?:[0-9]{5}|P[0-9]{4}|PGRST[0-9]{3})$/.test(error.code)
          ? error.code
          : "NAO_IDENTIFICADO";
  const status = httpStatus ?? error.httpStatus;
  return {
    code: reason,
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
      ? { httpStatus: status }
      : {}),
  };
}

export function careFailure(
  operation: CareOperation,
  error: unknown,
  at = new Date().toISOString(),
): CareFailure {
  const sanitized = careRpcFailure(error);
  return {
    ...sanitized,
    operation,
    message:
      known[sanitized.code] ??
      (["42501", "PGRST301", "PGRST302"].includes(sanitized.code)
        ? "careFeedback.session"
        : fallback[operation]),
    at,
  };
}

/** Diagnóstico da interface; não é identificação/correlação comprovada de uma chamada no servidor. */
export function careFailureDiagnostic(failure: CareFailure) {
  return JSON.stringify(
    {
      origem: "interface",
      fluxo: "grupo_atendimento",
      operacao: failure.operation,
      codigo: failure.code,
      status_http: failure.httpStatus ?? null,
      ocorrido_em: failure.at,
    },
    null,
    2,
  );
}

export function keepCareFailure(current: CareFailure | null, reading: CareFailure) {
  return current && current.operation !== "read" ? current : reading;
}
