/**
 * Regras puras da ponte do login com Google no app instalado (sem navegador nem banco, para o
 * teste do Node). O uso fica em `google-relay.ts`.
 *
 * Por quê: no app instalado na tela de início (principalmente no iPhone), o Google abre numa
 * janela por cima do app que não tem o armazenamento dele. O app começa o login (PKCE) e guarda a
 * chave; a janela só entrega o código, pelo banco, com um id combinado; o app troca o código pela
 * sessão ao voltar ao primeiro plano.
 */

export const RELAY_STORAGE_KEY = "mb_google_relay_v1";

/** Quanto tempo o app espera o código (o banco também descarta depois de 10 minutos). */
export const RELAY_TTL_MS = 10 * 60 * 1000;

export type PendingRelay = {
  id: string;
  startedAt: number;
  /** Destino depois de entrar (já filtrado por `sanitizeNext`). */
  next?: string;
  /** Loja do contexto do login, quando houver. */
  shop?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRelayId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Código de autorização devolvido pelo Auth: o mesmo formato que o banco aceita. */
export function isRelayCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{8,255}$/.test(value);
}

/** Endereço de volta do Google: sempre no endereço principal (já liberado no Auth). */
export function relayReturnUrl(platformOrigin: string, id: string): string {
  return `${platformOrigin.replace(/\/$/, "")}/auth/retorno?relay=${encodeURIComponent(id)}`;
}

/** Lê a espera guardada no aparelho; vencida ou estragada vale como nenhuma. */
export function parsePendingRelay(raw: string | null, now: number): PendingRelay | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingRelay>;
    if (!isRelayId(value.id) || typeof value.startedAt !== "number") return null;
    if (!Number.isFinite(value.startedAt) || now - value.startedAt > RELAY_TTL_MS) return null;
    // Relógio do aparelho voltou no tempo: não confia.
    if (value.startedAt - now > 60_000) return null;
    return {
      id: value.id,
      startedAt: value.startedAt,
      ...(typeof value.next === "string" && value.next ? { next: value.next } : {}),
      ...(typeof value.shop === "string" && value.shop ? { shop: value.shop } : {}),
    };
  } catch {
    return null;
  }
}

/** Parâmetros que a janela do Google recebe em `/auth/retorno`. */
export function readRelayReturn(search: string): {
  relay: string | null;
  code: string | null;
  failed: boolean;
} {
  const params = new URLSearchParams(search);
  const relay = params.get("relay");
  const code = params.get("code");
  return {
    relay: isRelayId(relay) ? relay : null,
    code: isRelayCode(code) ? code : null,
    failed: params.has("error") || params.has("error_code") || params.has("error_description"),
  };
}

/** Erro do Supabase que quer dizer "a função ainda não existe neste banco". */
export function isMissingFunctionError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? "")
  );
}
