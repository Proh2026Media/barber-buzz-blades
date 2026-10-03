import { getLocale, t } from "../i18n/use-i18n.ts";
import type { MessageKey } from "../i18n/translate.ts";

/** Mensagens de acesso em linguagem cotidiana (MB), no idioma escolhido. */

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
  { test: /muitas tentativas/i, message: "errors.rateLimit" },
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
  const text =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && "message" in raw
          ? String((raw as { message: unknown }).message)
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
