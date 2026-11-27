import { useEffect } from "react";

const ICONE_DO_DOMINIO = "/identidade/icone?tamanho=32";
let revisao = 0;

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

/** A aba usa o mesmo enquadramento que o ícone instalado. Uma arte em edição
 * ainda é local, por isso sua miniatura é montada no navegador. */
export function applyShopFavicon(logoUrl: string | null | undefined) {
  if (typeof document === "undefined") return;
  const agora = ++revisao;
  const url = logoUrl?.trim() || "";
  if (!url.startsWith("blob:") && !url.startsWith("data:image/")) {
    const versao = url.match(/[?&]v=([0-9]+)/)?.[1];
    upsertFaviconLink("icon", ICONE_DO_DOMINIO + (versao ? "&v=" + versao : ""));
    return;
  }
  const imagem = new Image();
  imagem.onload = () => {
    if (revisao !== agora || !imagem.naturalWidth || !imagem.naturalHeight) return;
    const tela = document.createElement("canvas");
    tela.width = tela.height = 32;
    const ctx = tela.getContext("2d");
    if (!ctx) return;
    const escala = 22 / Math.max(imagem.naturalWidth, imagem.naturalHeight);
    const largura = escala * imagem.naturalWidth,
      altura = escala * imagem.naturalHeight;
    ctx.drawImage(imagem, (32 - largura) / 2, (32 - altura) / 2, largura, altura);
    upsertFaviconLink("icon", tela.toDataURL(), "image/png");
  };
  imagem.src = url;
}

/** Aplica a marca salva da loja enquanto a tela estiver montada. */
export function useShopFavicon(logoUrl: string | null | undefined) {
  useEffect(() => {
    applyShopFavicon(logoUrl);
    return () => applyShopFavicon(null);
  }, [logoUrl]);
}
