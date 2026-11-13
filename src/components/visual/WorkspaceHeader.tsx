import { useEffect, useRef, type ReactNode, type HTMLAttributes } from "react";

/** Mantém uma única casca e o estado das seções ao redimensionar. */
export function WorkspaceFrame({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = frame.current;
    if (!surface) return;
    const measure = () => {
      const nav = surface.querySelector<HTMLElement>(":scope > .app-mobile-nav");
      if (nav && nav.offsetHeight > 0 && getComputedStyle(nav).position === "fixed") {
        surface.style.setProperty("--app-nav-height", `${nav.offsetHeight}px`);
      } else if (!nav || getComputedStyle(nav).position !== "fixed") {
        surface.style.removeProperty("--app-nav-height");
      }
    };
    const observer = new ResizeObserver(measure);
    const watch = () => {
      observer.disconnect();
      const nav = surface.querySelector(":scope > .app-mobile-nav");
      if (nav) observer.observe(nav);
      measure();
    };
    const childrenObserver = new MutationObserver(watch);
    childrenObserver.observe(surface, { childList: true });
    watch();
    return () => {
      observer.disconnect();
      childrenObserver.disconnect();
    };
  }, []);
  return (
    <div ref={frame} {...props}>
      {children}
    </div>
  );
}

/** A ação permanece junto ao título e aos controles da tarefa em todas as larguras. */
export function WorkspaceHeaderAction({ children }: { children: ReactNode }) {
  return children;
}

/** O título pertence ao conteúdo da tarefa; o cabeçalho global identifica a loja. */
export function WorkspaceHeading({ children }: { children: ReactNode }) {
  return children;
}
