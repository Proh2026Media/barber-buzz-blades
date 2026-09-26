/** Mensagens de integração (Google, WhatsApp) em linguagem cotidiana. */

function rawText(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message: unknown }).message);
  }
  return "";
}

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /session|expirad|expired|entre novamente|invalid session|missing authorization/i,
    message: "Sua sessão expirou. Entre de novo e tente conectar outra vez.",
  },
  {
    test: /entrypoint|InvalidWorkerCreation|BOOT_ERROR|edge function|fora do ar|indisponível no servidor/i,
    message:
      "A conexão com o serviço está temporariamente indisponível. Tente de novo em alguns minutos.",
  },
  {
    test: /Missing GOOGLE_OAUTH|oauth.*config|client.?id/i,
    message: "A conexão com o Google ainda não está pronta neste ambiente. Fale com o suporte.",
  },
  {
    test: /Escolha qual agenda|calendar_id|informe a agenda/i,
    message: "Escolha qual agenda usar antes de sincronizar.",
  },
  {
    test: /não está disponível nesta conta|calendar.*not/i,
    message: "Essa agenda não está disponível nesta conta Google. Escolha outra.",
  },
  {
    test: /qr|desconect|logout|instance/i,
    message: "A conexão do WhatsApp caiu ou o QR expirou. Toque em Conectar e escaneie de novo.",
  },
  {
    test: /network|fetch failed|failed to fetch|timeout|502|503|504/i,
    message: "Sem conexão no momento. Verifique a internet e tente novamente.",
  },
];

export function friendlyIntegrationError(raw: unknown, fallback: string): string {
  const text = rawText(raw).trim();
  if (!text) return fallback;
  for (const entry of PATTERNS) {
    if (entry.test.test(text)) return entry.message;
  }
  if (/supabase|postgres|rpc|http\s*\d+|stack|trace|deno/i.test(text)) {
    return fallback;
  }
  return text.length > 140 ? fallback : text;
}

export function friendlyChannelLastError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return friendlyIntegrationError(raw, "Houve um problema na última conexão. Tente reconectar.");
}
