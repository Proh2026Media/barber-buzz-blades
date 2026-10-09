/**
 * Link de barbearia colado pelo cliente sem loja ("Peça o link à sua barbearia"). Aceita o
 * link da página da loja (subdomínio, domínio próprio ou /b/<loja>), o link do profissional
 * (/<profissional> no endereço da loja), o link do app (/app?shop=<loja>) ou só o nome curto.
 * Sem banco: o domínio próprio volta como `host` e é conferido depois pela consulta pública
 * `resolve_shop_by_host`.
 */
export type ShopLink = { slug: string; barber?: string } | { host: string; barber?: string };

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** Primeiros trechos de endereço que são páginas do sistema, não o link de um profissional. */
const RESERVED = new Set([
  "app",
  "b",
  "auth",
  "cadastrar",
  "politica",
  "shop",
  "platform",
  "demo",
  "termos",
  "privacidade",
]);

function cleanSlug(value: string | null | undefined) {
  const slug = (value ?? "").trim().toLowerCase();
  return SLUG.test(slug) ? slug : null;
}

export function parseShopLink(input: string, baseHost: string): ShopLink | null {
  const raw = input.trim();
  if (!raw) return null;
  // Só o nome curto da loja ("arena-barber").
  const plain = cleanSlug(raw);
  if (plain && !raw.includes(".")) return { slug: plain };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const base = baseHost.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  const barberParam = cleanSlug(url.searchParams.get("barber"));
  const barberPath =
    segments.length === 1 && !RESERVED.has(segments[0]!.toLowerCase())
      ? cleanSlug(segments[0])
      : null;
  const barber = barberParam ?? barberPath ?? undefined;
  const withBarber = <T extends object>(link: T) => (barber ? { ...link, barber } : link);

  // /app?shop=<loja> e /b/<loja> valem em qualquer endereço.
  const fromQuery = cleanSlug(url.searchParams.get("shop"));
  if (fromQuery) return withBarber({ slug: fromQuery });
  if (segments[0]?.toLowerCase() === "b") {
    const fromPath = cleanSlug(segments[1]);
    return fromPath ? { slug: fromPath } : null;
  }

  // Subdomínio da plataforma: <loja>.<endereço principal>.
  if (host.endsWith(`.${base}`)) {
    const sub = cleanSlug(host.slice(0, -(base.length + 1)));
    return sub ? withBarber({ slug: sub }) : null;
  }
  // Endereço principal sem loja no caminho: não aponta nenhuma barbearia.
  if (host === base || host === "localhost" || host === "127.0.0.1") return null;
  // Domínio próprio da loja: precisa da consulta pública para saber qual é.
  if (!host.includes(".")) return null;
  return withBarber({ host });
}

/** Endereço do app do cliente na loja do link (a janela de "Adicionar…" abre lá). */
export function shopLinkAppHref(slug: string, barber?: string) {
  const params = new URLSearchParams({ shop: slug });
  if (barber) params.set("barber", barber);
  return `/app?${params.toString()}`;
}
