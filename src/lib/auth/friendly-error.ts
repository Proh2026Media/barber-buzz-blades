import { getLocale, t } from "../i18n/use-i18n.ts";
import type { MessageKey } from "../i18n/translate.ts";

/** Mensagens de acesso em linguagem cotidiana (MB), no idioma escolhido. */

/**
 * Códigos estáveis (`error_code`) devolvidos pelas funções do servidor
 * (auth-otp, register-shop, shop-domain, domain-verify). Têm prioridade sobre a
 * leitura do texto, que continua valendo como reserva para respostas sem código.
 * `null` = código conhecido sem frase própria: usa o `fallback` de quem chamou.
 */
const ERROR_CODE_MESSAGES: Record<string, MessageKey | null> = {
  otp_invalid: "errors.invalidCode",
  otp_expired: "fix2.edge.otpExpired",
  otp_too_many_attempts: "fix2.edge.otpTooManyAttempts",
  rate_limited: "errors.rateLimit",
  whatsapp_unavailable: "fix2.edge.whatsappUnavailable",
  phone_in_use: "fix2.edge.phoneInUse",
  invalid_whatsapp: "register.errorWhatsapp",
  verification_expired: "fix2.edge.verificationExpired",
  email_in_use: "errors.alreadyRegistered",
  email_invalid: "fix2.edge.emailInvalid",
  password_too_short: "errors.passwordShort",
  unauthorized: "errors.sessionExpired",
  permission_denied: "errors.permission",
  domain_nothing_pending: "fix.ajustes-marca.domainNothingPending",
  domain_txt_missing: "fix2.edge.domainDnsPending",
  domain_dns_pending: "fix2.edge.domainDnsPending",
  shop_not_found: "shop.error.shopNotFound",
  shop_required: "fix3.errors.shopRequired",
  shop_whatsapp_unavailable: "fix3.errors.shopWhatsappUnavailable",
  account_not_found: "fix3.errors.accountNotFound",
  account_without_email: "fix3.errors.accountWithoutEmail",
  missing_fields: "register.errorFillAll",
  terms_required: "cad.dono.errTerms",
  internal_error: null,
  server_misconfigured: null,
  session_failed: null,
  invalid_action: null,
  invalid_purpose: null,
  method_not_allowed: null,
  missing_shop: null,
};

/** O app conhece este `error_code` (tem frase própria ou usa o fallback de quem chamou)? */
export function isKnownErrorCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(ERROR_CODE_MESSAGES, code);
}

/** Erro de função do servidor que guarda o `error_code` estável junto da mensagem. */
export class ServerError extends Error {
  readonly errorCode: string | null;
  readonly payload: Record<string, unknown>;

  constructor(message: string, errorCode?: string | null, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "ServerError";
    this.errorCode = errorCode ?? null;
    this.payload = payload;
  }
}

/**
 * Monta o erro a partir da resposta JSON de uma função (`{ error, error_code }`),
 * para quem chama fazer `throw serverError(payload, fallback)` sem perder o código.
 */
export function serverError(payload: unknown, fallback: string): ServerError {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const message = typeof body.error === "string" && body.error.trim() ? body.error : fallback;
  return new ServerError(message, readErrorCode(body), body);
}

/** Lê o código estável de um erro/resposta: `error_code`, `errorCode` ou `code` conhecido. */
export function readErrorCode(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  for (const key of ["error_code", "errorCode"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  // `code` também aparece em erros do Postgres ("23505") e do Auth: só vale se for um dos nossos.
  const code = record.code;
  if (typeof code === "string" && code in ERROR_CODE_MESSAGES) return code;
  return null;
}

const PATTERNS: Array<{ test: RegExp; message: MessageKey }> = [
  {
    test: /invalid login credentials|invalid_credentials|email.*password/i,
    message: "errors.invalidCredentials",
  },
  {
    test: /email not confirmed|not confirmed/i,
    message: "errors.emailNotConfirmed",
  },
  {
    test: /user already registered|already been registered/i,
    message: "errors.alreadyRegistered",
  },
  {
    test: /should be different from the old password|same.*password/i,
    message: "errors.samePassword",
  },
  {
    test: /password should be at least|password.*(too short|weak)/i,
    message: "errors.passwordShort",
  },
  {
    // Antes do padrão de código: "Invalid Refresh Token" e JWT são sessão, não código digitado.
    test: /refresh[ _]token|jwt/i,
    message: "errors.sessionExpired",
  },
  {
    test: /otp|token|code.*(expired|invalid)|invalid.*(otp|token|code)/i,
    message: "errors.invalidCode",
  },
  {
    test: /rate limit|too many|exceeded/i,
    message: "errors.rateLimit",
  },
  {
    test: /permission denied|row-level security|not allowed|forbidden|42501/i,
    message: "errors.permission",
  },
  {
    test: /duplicate key|already exists|23505/i,
    message: "errors.duplicate",
  },
  {
    test: /network|fetch failed|failed to fetch|timeout/i,
    message: "errors.network",
  },
  {
    test: /session|jwt|expired|refresh/i,
    message: "errors.sessionExpired",
  },
];

/**
 * Textos fixos em pt-BR das funções do servidor (cadastro, código por WhatsApp).
 * Em pt-BR passam como estão; nos outros idiomas viram a frase traduzida equivalente.
 */
const PORTUGUESE_SERVER_PATTERNS: Array<{ test: RegExp; message: MessageKey }> = [
  {
    test: /c[óo]digo (inv[áa]lido|incorreto)|c[óo]digo.*(expirado|vencido)/i,
    message: "errors.invalidCode",
  },
  { test: /muitas tentativas com c[óo]digo errado/i, message: "fix2.edge.otpTooManyAttempts" },
  { test: /muitas tentativas/i, message: "errors.rateLimit" },
  { test: /n[ãa]o foi poss[íi]vel enviar o whatsapp/i, message: "fix2.edge.whatsappUnavailable" },
  { test: /e-?mail j[áa] tem conta/i, message: "errors.alreadyRegistered" },
  { test: /j[áa] est[áa] (em uma conta|cadastrad)/i, message: "errors.duplicate" },
  { test: /sem permiss[ãa]o|n[ãa]o tem permiss[ãa]o/i, message: "errors.permission" },
  { test: /sess[ãa]o (expirou|expirada)/i, message: "errors.sessionExpired" },
];

const ENGLISH_HINT =
  /\b(the|is|not|for|with|does|cannot|could|unable|invalid|failed|error|denied|missing|unknown|violates|column|relation)\b/i;
// "com" de domínio ou e-mail (loja.com, nome@site.com) não conta como português.
const PORTUGUESE_HINT = /[ãõçáéíóúâêô]|(^|[^.@\w])(não|você|para|com|está|foi)\b/i;
/** Só o que é exclusivo do português (o espanhol também usa á, é, í, ó, ú, "para", "está"). */
const PORTUGUESE_ONLY_HINT =
  /[ãõçâêô]|(^|[^\p{L}.@])(não|você|com|foi|uma|seu|sua|ao|só|já|é|até|também)(?=$|[^\p{L}])/iu;
/** Em inglês a tela já fala inglês: só o vocabulário do banco denuncia mensagem técnica. */
const TECHNICAL_HINT =
  /\b(violates|column|relation|constraint|schema|null value|syntax|exception|undefined|stack)\b/i;

export function friendlyAuthError(raw: unknown, fallback?: string): string {
  const errorCode = readErrorCode(raw);
  if (errorCode && errorCode in ERROR_CODE_MESSAGES) {
    const key = ERROR_CODE_MESSAGES[errorCode];
    return key ? t(key) : (fallback ?? t("errors.generic"));
  }

  const text =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && "message" in raw
          ? String((raw as { message: unknown }).message)
          : raw && typeof raw === "object" && typeof (raw as { error?: unknown }).error === "string"
            ? String((raw as { error: string }).error)
            : "";

  if (!text.trim()) {
    return fallback ?? t("errors.generic");
  }

  for (const entry of PATTERNS) {
    if (entry.test.test(text)) return t(entry.message);
  }

  // Evita jargão técnico na jornada comum.
  if (/supabase|postgres|rpc|edge|function|http\s*\d+/i.test(text)) {
    return fallback ?? t("errors.generic");
  }

  const locale = getLocale();
  if (locale !== "pt-BR") {
    for (const entry of PORTUGUESE_SERVER_PATTERNS) {
      if (entry.test.test(text)) return t(entry.message);
    }
    // Frase do banco/servidor em português numa tela em inglês ou espanhol: usa a frase padrão.
    const portuguese = locale.startsWith("en")
      ? PORTUGUESE_HINT.test(text)
      : !locale.startsWith("pt") && PORTUGUESE_ONLY_HINT.test(text);
    if (portuguese) {
      return fallback ?? t("errors.generic");
    }
  }

  // Mensagem técnica em inglês que não reconhecemos: melhor a frase padrão do que texto estrangeiro.
  const foreign = locale.startsWith("en")
    ? TECHNICAL_HINT.test(text)
    : ENGLISH_HINT.test(text) && !PORTUGUESE_HINT.test(text);
  if (foreign) {
    return fallback ?? t("errors.generic");
  }

  return text.length > 160 ? (fallback ?? t("errors.generic")) : text;
}
