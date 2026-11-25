const dominioAnterior = "beauty.contheiner.digital";
const configurado = import.meta.env.VITE_PLATFORM_BASE_HOST?.trim().toLowerCase();

export const dominioDaPlataforma =
  configurado && configurado !== dominioAnterior ? configurado : "aurset.app";

// Links já distribuídos mantêm loja, caminho, consulta e fragmento.
export function redirecionarEnderecoAntigo() {
  const url = new URL(window.location.href);
  if (url.hostname === "www.aurset.app") {
    url.hostname = "aurset.app";
    window.location.replace(url.href);
    return;
  }
  const antigo = "beauty.contheiner.digital";
  const loja = url.hostname.endsWith("." + antigo)
    ? url.hostname.slice(0, -(antigo.length + 1))
    : "";
  if (url.hostname !== antigo && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loja)) return;
  if (url.pathname === "/auth/google-apps") return;
  url.hostname = loja && loja !== "www" ? loja + ".aurset.app" : "aurset.app";
  window.location.replace(url.href);
}
