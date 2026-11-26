/**
 * Paleta da plataforma: as cores da marca (padrão) ou os neutros, como opção de uso. Vale no
 * claro e no escuro e é independente do tema claro/escuro (src/lib/theme.ts). Dentro das telas
 * de um estabelecimento quem manda é o tema da loja (`data-tema-loja`), não esta escolha.
 */
export type Paleta = "marca" | "neutra";

export const PALETA_STORAGE_KEY = "aurset:paleta";
export const PALETA_EVENT = "aurset-paleta";
export const PALETA_ATTRIBUTE = "data-paleta";

export function parsePaleta(value: unknown): Paleta {
  return value === "neutra" ? "neutra" : "marca";
}

export function readPaleta(): Paleta {
  try {
    return parsePaleta(window.localStorage.getItem(PALETA_STORAGE_KEY));
  } catch {
    return "marca";
  }
}

export function applyPaleta(paleta: Paleta) {
  const root = document.documentElement;
  if (paleta === "neutra") root.setAttribute(PALETA_ATTRIBUTE, "neutra");
  else root.removeAttribute(PALETA_ATTRIBUTE);
}

export function writePaleta(paleta: Paleta) {
  try {
    if (paleta === "neutra") window.localStorage.setItem(PALETA_STORAGE_KEY, paleta);
    else window.localStorage.removeItem(PALETA_STORAGE_KEY);
  } catch {
    /* Sem armazenamento, a escolha vale só nesta visita. */
  }
  applyPaleta(paleta);
  window.dispatchEvent(new Event(PALETA_EVENT));
}

/** Aplica a paleta salva antes da primeira pintura (mesmo papel do themeBootstrapScript). */
export const paletaBootstrapScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(PALETA_STORAGE_KEY)})==="neutra")document.documentElement.setAttribute(${JSON.stringify(PALETA_ATTRIBUTE)},"neutra");}catch(e){}})();`;
