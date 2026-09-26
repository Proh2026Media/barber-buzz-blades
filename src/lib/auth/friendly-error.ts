/** Mensagens de acesso em linguagem cotidiana (MB). */

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /invalid login credentials|invalid_credentials|email.*password/i,
    message: "E-mail ou senha incorretos. Confira e tente de novo.",
  },
  {
    test: /email not confirmed|not confirmed/i,
    message: "Confirme seu e-mail antes de entrar. Veja a caixa de entrada e o spam.",
  },
  {
    test: /user already registered|already been registered/i,
    message: "Este e-mail já tem conta. Entre com a senha ou recupere o acesso.",
  },
  {
    test: /should be different from the old password|same.*password/i,
    message: "A nova senha precisa ser diferente da atual.",
  },
  {
    test: /password should be at least|password.*(too short|weak)/i,
    message: "A senha precisa ter pelo menos 6 caracteres.",
  },
  {
    test: /otp|token|code.*(expired|invalid)|invalid.*(otp|token|code)/i,
    message: "Código inválido ou vencido. Peça um código novo e tente outra vez.",
  },
  {
    test: /rate limit|too many|exceeded/i,
    message: "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.",
  },
  {
    test: /network|fetch failed|failed to fetch|timeout/i,
    message: "Sem conexão no momento. Verifique a internet e tente novamente.",
  },
  {
    test: /session|jwt|expired|refresh/i,
    message: "Sua sessão expirou. Entre novamente para continuar.",
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
    return fallback ?? "Não foi possível continuar. Tente novamente.";
  }

  for (const entry of PATTERNS) {
    if (entry.test.test(text)) return entry.message;
  }

  // Evita jargão técnico na jornada comum.
  if (/supabase|postgres|rpc|edge|function|http\s*\d+/i.test(text)) {
    return fallback ?? "Não foi possível continuar. Tente novamente.";
  }

  return text.length > 160 ? (fallback ?? "Não foi possível continuar. Tente novamente.") : text;
}
