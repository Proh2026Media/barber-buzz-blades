/** Endereço legível: sem "https://", "www." nem barra final. */
export function readableLink(url: string) {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

const PERSON_PALETTE = [
  { bg: "#e8d5b9", fg: "#5c3d14" },
  { bg: "#d9e2d0", fg: "#2f4a24" },
  { bg: "#e5d0c8", fg: "#6b2e1f" },
  { bg: "#d6dbe4", fg: "#2b3a55" },
  { bg: "#e9dcc0", fg: "#5a4510" },
  { bg: "#cfe0dd", fg: "#1f4a45" },
  { bg: "#e2d6cc", fg: "#4e3b2c" },
  { bg: "#dcdcd3", fg: "#3d3d33" },
] as const;

/**
 * Cor fixa de uma pessoa (mesma pessoa = mesma cor em toda tela), dentro da paleta quente da
 * marca e com texto acima de 6,5:1. Serve ao avatar de iniciais e à faixa lateral dos cartões.
 */
export function personColor(seed: string) {
  let hash = 0;
  for (const char of seed.trim().toLocaleLowerCase()) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return PERSON_PALETTE[hash % PERSON_PALETTE.length];
}

/** Iniciais para o avatar: primeira letra do primeiro e do último nome ("Ana Lima" → "AL"). */
export function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = [...parts[0]][0] ?? "";
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

/**
 * Leva a pessoa ao primeiro campo com problema (`aria-invalid="true"`) dentro de `root`:
 * rola até ele e põe o foco. Use depois de validar um formulário que não pôde ser enviado.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined = document) {
  if (!root) return false;
  const field = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!field) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  field.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  field.focus({ preventScroll: true });
  return true;
}
