import { useEffect } from "react";

const DEFAULT_FAVICON = "/icons/icon-192.png";
const DEFAULT_APPLE = "/icons/icon-180.png";

function iconMime(href: string): string | undefined {
  if (href.startsWith("data:image/svg")) return "image/svg+xml";
  if (href.startsWith("data:image/png")) return "image/png";
  if (href.startsWith("data:image/jpeg") || href.startsWith("data:image/jpg")) return "image/jpeg";
  if (href.startsWith("data:image/webp")) return "image/webp";
  if (/\.svg(\?|#|$)/i.test(href)) return "image/svg+xml";
  if (/\.png(\?|#|$)/i.test(href)) return "image/png";
  if (/\.jpe?g(\?|#|$)/i.test(href)) return "image/jpeg";
  if (/\.webp(\?|#|$)/i.test(href)) return "image/webp";
  return undefined;
}

function upsertFaviconLink(rel: string, href: string, type?: string) {
  const selector = `link[rel="${rel}"]`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.setAttribute("data-shop-favicon", "1");
  el.href = href;
  if (type) el.type = type;
  else el.removeAttribute("type");
}

/**
 * Usa a logo da identidade visual da barbearia como favicon (aba / PWA ícone).
 * Sem logo, volta aos ícones padrão do Barba & Cabelo.
 */
export function applyShopFavicon(logoUrl: string | null | undefined) {
  if (typeof document === "undefined") return;
  const custom = (logoUrl ?? "").trim();
  const href = custom || DEFAULT_FAVICON;
  const apple = custom || DEFAULT_APPLE;
  const type = custom ? iconMime(href) : "image/png";
  upsertFaviconLink("icon", href, type);
  upsertFaviconLink("apple-touch-icon", apple, custom ? type : "image/png");
}

/** Aplica favicon da loja enquanto a tela estiver montada. */
export function useShopFavicon(logoUrl: string | null | undefined) {
  useEffect(() => {
    applyShopFavicon(logoUrl);
    return () => applyShopFavicon(null);
  }, [logoUrl]);
}
