/** O app foi aberto pelo ícone instalado (PWA), e não por uma aba do navegador. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone))
    );
  } catch {
    return false;
  }
}
