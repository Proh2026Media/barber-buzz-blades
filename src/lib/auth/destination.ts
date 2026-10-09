/**
 * Para onde a pessoa vai depois de entrar (e ao abrir "/" ou o app instalado).
 *
 * Regras (docs/plano-ambientes.md, onda 2):
 * - O destino pedido no link vence a hierarquia quando é um pedido específico de cliente
 *   (/app com loja, profissional, dia, hora ou reserva) ou uma área a que a conta tem acesso.
 * - Sem destino (ou com o /app genérico), abre a última área usada neste aparelho; sem ela,
 *   a área mais alta da conta (plataforma → painel → app do cliente).
 * - Só caminhos internos conhecidos e só parâmetros conhecidos passam (sem redirecionamento
 *   aberto): o resto é descartado.
 *
 * Arquivo sem dependências do navegador nem do banco, para os testes rodarem no Node.
 */

export type AreaKind = "app" | "shop" | "platform";

export const AREA_PATH: Record<AreaKind, "/app" | "/shop" | "/platform"> = {
  app: "/app",
  shop: "/shop",
  platform: "/platform",
};

/** Motivos de recusa do painel, levados no endereço até o /app (`?aviso=`). */
export const ACCESS_NOTICES = ["sem-acesso", "removido", "aguardando", "sem-plataforma"] as const;
export type AccessNotice = (typeof ACCESS_NOTICES)[number];

export function parseAccessNotice(value: unknown): AccessNotice | undefined {
  return typeof value === "string" && (ACCESS_NOTICES as readonly string[]).includes(value)
    ? (value as AccessNotice)
    : undefined;
}

type Check = (value: string) => boolean;

const REF: Check = (v) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(v);
const ID: Check = (v) => /^[A-Za-z0-9-]{1,64}$/.test(v);
const DAY: Check = (v) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v);
const TIME: Check = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const TOKEN: Check = (v) => /^[A-Za-z0-9_-]{8,128}$/.test(v);
const SLUG: Check = (v) => /^[a-z][a-z-]{0,23}$/.test(v);
const oneOf =
  (...values: string[]): Check =>
  (v) =>
    values.includes(v);

/** Caminhos internos aceitos como destino, cada um com os parâmetros que entende. */
const KNOWN_DESTINATIONS: Record<string, Record<string, Check>> = {
  "/app": {
    shop: REF,
    barber: REF,
    join: oneOf("1", "true"),
    tab: oneOf("reservas", "conta", "perfil", "agendar", "agenda"),
    reserva: TOKEN,
    day: DAY,
    time: TIME,
    focus: oneOf("whatsapp"),
  },
  "/shop": {
    secao: SLUG,
    // Loja pedida em "Minhas áreas" (id do vínculo de equipe).
    unidade: ID,
  },
  "/shop/pontos": {},
  "/platform": { aba: SLUG },
  "/demo": { view: SLUG, shop: REF },
  "/politica": { shop: REF, lang: (v) => /^[A-Za-z-]{2,12}$/.test(v) },
  "/cadastrar": {},
};

const BASE = "https://destino.invalid";

/**
 * Limpa um destino vindo do endereço: devolve o caminho interno conhecido só com os
 * parâmetros conhecidos e válidos, ou `null` quando não é um destino aceito.
 */
export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  // Precisa começar com uma única "/"; barra invertida e caracteres de controle nunca passam
  // (navegadores tratam "/\\outro.site" como outro endereço).
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (
    value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  )
    return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const allowed = KNOWN_DESTINATIONS[path];
  if (!allowed) return null;
  // Mantém a ordem do link e só o primeiro valor de cada parâmetro. Os valores aceitos têm só
  // letras, números e . _ - : (conferidos acima), então entram no endereço como estão.
  const kept = new Map<string, string>();
  for (const [key, param] of url.searchParams) {
    const check = Object.prototype.hasOwnProperty.call(allowed, key) ? allowed[key] : undefined;
    if (!check || kept.has(key) || !check(param)) continue;
    kept.set(key, param);
  }
  const query = [...kept].map(([key, param]) => `${key}=${param}`).join("&");
  return query ? `${path}?${query}` : path;
}

function pathOf(destination: string) {
  const index = destination.indexOf("?");
  return index === -1 ? destination : destination.slice(0, index);
}

/**
 * Pedido específico de cliente no /app: loja, profissional, dia, hora, reserva ou o atalho
 * "Número errado? Trocar em Meu perfil" (focus=whatsapp).
 */
export function hasClientIntent(destination: string): boolean {
  if (pathOf(destination) !== "/app" || !destination.includes("?")) return false;
  const params = new URLSearchParams(destination.slice(destination.indexOf("?") + 1));
  return ["shop", "barber", "day", "time", "reserva", "focus"].some((key) => params.has(key));
}

export type AreaAccess = {
  /** Admin da plataforma. */
  platform: boolean;
  /** Tem painel de barbearia (vínculo de equipe ou shop_admin antigo). */
  shop: boolean;
};

export function canOpenArea(area: AreaKind, access: AreaAccess) {
  if (area === "platform") return access.platform;
  if (area === "shop") return access.shop;
  return true;
}

/** Área de entrada sem destino: a última usada (se ainda vale) ou a mais alta da conta. */
export function entryArea(access: AreaAccess, lastArea: AreaKind | null): AreaKind {
  if (lastArea && canOpenArea(lastArea, access)) return lastArea;
  if (access.platform) return "platform";
  if (access.shop) return "shop";
  return "app";
}

export function decidePostAuthPath(input: {
  next?: string | null;
  access: AreaAccess;
  lastArea?: AreaKind | null;
}): string {
  const home = AREA_PATH[entryArea(input.access, input.lastArea ?? null)];
  const next = sanitizeNext(input.next);
  if (!next) return home;
  const path = pathOf(next);
  if (path === "/app") {
    // O /app genérico (padrão de vários fluxos de entrada) não rebaixa ninguém; com pedido
    // de cliente, a pessoa vai ao agendamento mesmo tendo papel profissional.
    return hasClientIntent(next) || home === "/app" ? next : home;
  }
  if (path === "/shop" || path.startsWith("/shop/")) return input.access.shop ? next : home;
  if (path === "/platform" || path === "/demo") return input.access.platform ? next : home;
  // Páginas comuns conhecidas (política do clube, abrir barbearia).
  return next;
}

/* ---------- Última área usada, guardada no aparelho por conta ---------- */

const LAST_AREA_KEY = "arena:last-area";

export function lastAreaKey(userId: string) {
  return `${LAST_AREA_KEY}:${userId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Aba privada ou armazenamento bloqueado.
    return null;
  }
}

function isArea(value: unknown): value is AreaKind {
  return value === "app" || value === "shop" || value === "platform";
}

export function readLastArea(
  userId: string,
  storage: StorageLike | null = browserStorage(),
): AreaKind | null {
  if (!storage || !userId) return null;
  try {
    const value = storage.getItem(lastAreaKey(userId));
    return isArea(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLastArea(
  userId: string,
  area: AreaKind,
  storage: StorageLike | null = browserStorage(),
) {
  if (!userId) return;
  try {
    storage?.setItem(lastAreaKey(userId), area);
  } catch {
    // Sem armazenamento: vale a área mais alta da conta.
  }
}
