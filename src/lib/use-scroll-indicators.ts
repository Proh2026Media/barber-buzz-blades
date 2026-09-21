import { useEffect } from "react";

/** Reveal each scroll area's indicator only while it is being used. */
export function useScrollIndicators() {
  useEffect(() => {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    const onScroll = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLElement)) return;
      if (!element.closest(".arena-workspace, [data-radix-popper-content-wrapper], [role=dialog]"))
        return;
      clearTimeout(timers.get(element));
      element.dataset.scrolling = "true";
      timers.set(
        element,
        setTimeout(() => {
          delete element.dataset.scrolling;
          timers.delete(element);
        }, 900),
      );
    };
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      timers.forEach((timer, element) => {
        clearTimeout(timer);
        delete element.dataset.scrolling;
      });
    };
  }, []);
}
