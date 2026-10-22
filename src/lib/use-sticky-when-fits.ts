import { useEffect, useState, type RefObject } from "react";
import { visibleBottomLimit } from "@/components/visual/helpers";
import { useViewportAtLeast } from "@/lib/device";

/**
 * A partir de 1024 px, uma coluna lateral (a do dia na Agenda, a ficha da barbearia na
 * plataforma) acompanha a rolagem só quando cabe inteira na área que rola (o `main`, abaixo do
 * cabeçalho) e acima de qualquer barra flutuante. Se não couber (tela baixa, conteúdo longo),
 * rola junto com a página: nada fica escondido nem atrás da barra, e não há rolagem dentro da
 * coluna. Devolve o `top` em px, ou `null` sem fixar. O `top` conta a partir do topo do `main`,
 * que é quem rola: somar a altura do cabeçalho empurrava a coluna para baixo em repouso
 * (corrigido em 16/10/2026).
 */
export function useStickyWhenFits(ref: RefObject<HTMLElement | null>) {
  const [top, setTop] = useState<number | null>(null);
  const desktop = useViewportAtLeast(1024);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const GAP = 16;
    const measure = () => {
      if (!desktop) return setTop(null);
      const scroller = element.closest("main")?.getBoundingClientRect();
      const viewTop = scroller ? scroller.top : 0;
      const viewBottom = Math.min(
        scroller ? scroller.bottom : window.innerHeight,
        visibleBottomLimit(),
      );
      const room = viewBottom - viewTop - GAP * 2;
      setTop(element.offsetHeight <= room ? GAP : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, desktop]);
  return top;
}
