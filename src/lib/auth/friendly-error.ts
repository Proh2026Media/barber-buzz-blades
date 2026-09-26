import { t } from "../i18n/use-i18n.ts";
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
    test: /otp|token|code.*(expired|invalid)|invalid.*(otp|token|code)/i,
    message: "errors.invalidCode",
  },
  {
    test: /rate limit|too many|exceeded/i,
    message: "errors.rateLimit",
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

  return text.length > 160 ? (fallback ?? t("errors.generic")) : text;
}
