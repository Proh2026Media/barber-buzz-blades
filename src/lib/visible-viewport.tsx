import { useEffect } from "react";

/** O teclado do iOS reduz a área visível, mas nem sempre altera 100dvh. */
export function VisibleViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const clear = () => {
      root.style.removeProperty("--app-visible-height");
      root.style.removeProperty("--app-visible-top");
      root.style.removeProperty("--app-keyboard-inset");
      delete root.dataset.keyboardOpen;
    };
    const update = () => {
      // Preserva a ampliação por pinça e a composição do computador.
      if (window.innerWidth >= 1280 || Math.abs(viewport.scale - 1) > 0.01) {
        clear();
        return;
      }
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        active.matches(
          'textarea:not([readonly]), input:not([readonly]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), [contenteditable="true"]',
        );
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--app-visible-height", `${viewport.height}px`);
      root.style.setProperty("--app-visible-top", `${viewport.offsetTop}px`);
      root.style.setProperty("--app-keyboard-inset", `${inset}px`);
      root.dataset.keyboardOpen = String(editing && inset > 120);
      if (!editing) return;
      const scroller = active.closest<HTMLElement>(".dialog-scroll-area, .arena-workspace > main");
      if (!scroller) return;
      const field = active.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      const bottom = Math.min(area.bottom, viewport.offsetTop + viewport.height) - 12;
      const top = Math.max(area.top, viewport.offsetTop) + 12;
      if (field.bottom > bottom) scroller.scrollTop += field.bottom - bottom;
      else if (field.top < top) scroller.scrollTop -= top - field.top;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      clear();
    };
  }, []);
  return null;
}
