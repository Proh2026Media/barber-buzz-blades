/**
 * Trava de rede da demonstração: enquanto a demonstração está aberta, nenhuma chamada ao
 * banco (tabelas, RPC, arquivos, funções) sai do aparelho. Só a manutenção da sessão
 * (/auth/v1) continua, para a pessoa não ser desconectada.
 *
 * A trava fica em dois lugares, que juntos cobrem toda chamada ao banco do app:
 * - no `fetch` do cliente Supabase (src/integrations/supabase/client.ts);
 * - em `guardedFetch`, usado nas chamadas diretas às funções (`${base}/functions/v1/...`).
 * Assim vale para qualquer componente, inclusive os que esquecerem de checar `useDemo()`.
 * O teste demo-guard.test.ts falha se surgir uma chamada direta a /functions/v1 sem
 * `guardedFetch`.
 */

let armed = false;

export class DemoNetworkBlockedError extends Error {
  constructor(url: string) {
    super(`[demo] chamada ao banco bloqueada na demonstração: ${url}`);
    this.name = "DemoNetworkBlockedError";
  }
}

export function armDemoGuard() {
  armed = true;
}

export function disarmDemoGuard() {
  armed = false;
}

export function isDemoGuardArmed() {
  return armed;
}

function requestPath(url: string): string | null {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return null;
  }
}

function currentPagePath(): string {
  try {
    return typeof window === "undefined" ? "" : window.location.pathname;
  } catch {
    return "";
  }
}

/**
 * Verdadeiro quando a chamada deve ser barrada: demonstração aberta, ainda no endereço
 * /demo (ao sair, a checagem de acesso da página seguinte precisa ler a sessão) e fora da
 * manutenção da sessão.
 */
export function demoBlocksRequest(url: string, pagePath: string = currentPagePath()): boolean {
  if (!armed || !pagePath.startsWith("/demo")) return false;
  const path = requestPath(url);
  if (path === null) return true;
  return !path.startsWith("/auth/v1/");
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Barra a chamada e deixa um erro claro no console (com a pilha de quem chamou). */
export function blockedDemoResponse(url: string): Promise<Response> {
  const error = new DemoNetworkBlockedError(url);
  console.error(error);
  return Promise.reject(error);
}

/** `fetch` com a trava da demonstração, para chamadas diretas às funções do banco. */
export function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  if (demoBlocksRequest(url)) return blockedDemoResponse(url);
  return fetch(input, init);
}
