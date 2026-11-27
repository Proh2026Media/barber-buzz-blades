import { isPlatformApexHost } from "@/lib/shop/host";

/** As rotas resolvem a loja pelo domínio antes de liberar o catálogo ou o acesso. */
export function emDominioDeLoja() {
  return (
    typeof window !== "undefined" && window.location.protocol === "https:" && !isPlatformApexHost()
  );
}

export function suportaChave() {
  return (
    emDominioDeLoja() && typeof window.PublicKeyCredential === "function" && !!navigator.credentials
  );
}
