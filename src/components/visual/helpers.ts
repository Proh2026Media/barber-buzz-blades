/** Endereço legível: sem "https://", "www." nem barra final. */
export function readableLink(url: string) {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

const PERSON_PALETTE = [
  { bg: "var(--au-forma)", fg: "var(--au-sobre-forma)", linha: "var(--au-detalhe)" },
  { bg: "var(--action-primary)", fg: "var(--ink-on-primary)", linha: "var(--action-primary)" },
  { bg: "var(--bg-subtle)", fg: "var(--ink-primary)", linha: "var(--ink-primary)" },
  { bg: "var(--au-chao-meio)", fg: "var(--ink-primary)", linha: "var(--accent-editorial)" },
] as const;

/** Cada pessoa mantém o mesmo par de papéis de cor ao trocar o tema do menu. */
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

/**
 * Onde termina a parte visível da tela: o topo da barra de navegação quando ela flutua no pé
 * (celular), ou a altura da janela quando ela é a coluna lateral do computador (styles.css).
 */
export function visibleBottomLimit(): number {
  if (typeof document === "undefined") return 0;
  const nav = document.querySelector<HTMLElement>(".app-mobile-nav");
  if (!nav || getComputedStyle(nav).position !== "fixed") return window.innerHeight;
  return nav.getBoundingClientRect().top;
}
