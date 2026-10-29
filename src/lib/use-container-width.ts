import { useEffect, useState } from "react";

/** Largura útil em rem: considera a fonte e o espaço do painel, inclusive após trocar seu nó. */
export function useContainerWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [widthRem, setWidthRem] = useState(0);

  useEffect(() => {
    const view = element?.ownerDocument.defaultView;
    if (!element || !view) return;
    const measure = () => {
      const fontSize = parseFloat(
        view.getComputedStyle(element.ownerDocument.documentElement).fontSize,
      );
      setWidthRem(element.clientWidth / fontSize);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    // A fonte pode mudar sem redimensionar a janela.
    observer?.observe(element.ownerDocument.documentElement);
    view.addEventListener("resize", measure);
    measure();
    return () => {
      observer?.disconnect();
      view.removeEventListener("resize", measure);
    };
  }, [element]);

  return [setElement, widthRem] as const;
}
