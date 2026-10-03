import { t } from "../i18n/use-i18n.ts";
import type { MessageKey } from "../i18n/translate.ts";

/** Mensagens de integração (Google, WhatsApp) em linguagem cotidiana, no idioma escolhido. */

function rawText(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message: unknown }).message);
  }
  return "";
}

const PATTERNS: Array<{ test: RegExp; message: MessageKey }> = [
  // Antes de "sessão": o token do Google venceu ou foi revogado — reconectar o Google, não entrar no app de novo.
  {
    test: /invalid_grant|has been expired or revoked|Invalid Credentials|Conexão Google expirada/i,
    message: "errors.integration.googleReconnect",
  },
  {
    test: /session|expirad|expired|entre novamente|invalid session|missing authorization/i,
    message: "errors.integration.session",
  },
  {
    test: /entrypoint|InvalidWorkerCreation|BOOT_ERROR|edge function|fora do ar|indisponível no servidor/i,
    message: "errors.integration.unavailable",
  },
  {
    test: /Missing GOOGLE_OAUTH|oauth.*config|client.?id/i,
    message: "errors.integration.googleNotReady",
  },
  {
    test: /Escolha qual agenda|calendar_id|informe a agenda/i,
    message: "errors.integration.chooseCalendar",
  },
  // Erros do Google em inglês: o que a pessoa (ou o técnico) precisa fazer em cada caso.
  // Vêm antes de "agenda indisponível", que antes capturava qualquer "calendar … not".
  {
    test: /has not been used in project|accessNotConfigured|SERVICE_DISABLED|API.*is disabled/i,
    message: "errors.integration.googleApiDisabled",
  },
  {
    test: /insufficient authentication scopes|insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i,
    message: "errors.integration.googleScopeMissing",
  },
  {
    test: /não está disponível nesta conta Google/i,
    message: "errors.integration.calendarUnavailable",
  },
  {
    test: /qr|desconect|logout|instance/i,
    message: "errors.integration.whatsappDisconnected",
  },
  {
    test: /network|fetch failed|failed to fetch|timeout|502|503|504/i,
    message: "errors.network",
  },
];

export function friendlyIntegrationError(raw: unknown, fallback: string): string {
  const text = rawText(raw).trim();
  if (!text) return fallback;
  for (const entry of PATTERNS) {
    if (entry.test.test(text)) return t(entry.message);
  }
  if (/supabase|postgres|rpc|http\s*\d+|stack|trace|deno/i.test(text)) {
    return fallback;
  }
  return text.length > 140 ? fallback : text;
}

export function friendlyChannelLastError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return friendlyIntegrationError(raw, t("errors.integration.lastError"));
}
