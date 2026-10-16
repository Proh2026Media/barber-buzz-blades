/**
 * iPhone ou iPad (o iPad se apresenta como Mac, mas tem toque). No app instalado desses aparelhos,
 * endereços de fora (Google) abrem numa janela por cima do app, sem o armazenamento dele; no
 * computador e no Android a volta cai no próprio app ou numa aba que divide o armazenamento.
 */
export function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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
