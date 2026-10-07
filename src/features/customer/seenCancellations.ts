const SEEN_KEY = "barba:customer-seen-shop-cancellations";
const SEEN_LIMIT = 50;

/**
 * Cancelamentos feitos pela barbearia que o cliente já viu (ao abrir Avisos ou tocar em "Agendar
 * outro"). Fica no aparelho, por conta; sem armazenamento disponível, tudo conta como não visto.
 */
export function readSeenCancellations(owner: string | null | undefined): string[] {
  if (!owner || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${SEEN_KEY}:${owner}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeSeenCancellations(owner: string | null | undefined, ids: string[]) {
  if (!owner || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${SEEN_KEY}:${owner}`, JSON.stringify(ids.slice(-SEEN_LIMIT)));
  } catch {
    // Sem armazenamento (janela anônima, bloqueio): o aviso volta na próxima visita.
  }
}
