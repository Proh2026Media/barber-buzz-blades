import { useLayoutEffect, useRef, type ReactNode, type HTMLAttributes } from "react";

/** Mantém uma única casca e o estado das seções ao redimensionar. */
export function WorkspaceFrame({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const surface = frame.current;
    if (!surface) return;
    const celular = window.matchMedia("(max-width: 767.98px)");
    let main: HTMLElement | null = null;
    let header: HTMLElement | null = null;
    const acompanharRolagem = () => {
      surface.toggleAttribute("data-conteudo-sob-menu", Boolean(main && main.scrollTop > 1));
    };
    const measure = () => {
      if (header && celular.matches) {
        const margem = parseFloat(getComputedStyle(header).marginTop) || 0;
        surface.style.setProperty("--altura-menu-mobile", `${header.offsetHeight + margem}px`);
      } else {
        surface.style.removeProperty("--altura-menu-mobile");
      }
      const nav = surface.querySelector<HTMLElement>(":scope > .app-mobile-nav");
      const position = nav && getComputedStyle(nav).position;
      const sobreposta = position === "fixed" || position === "absolute";
      if (nav && nav.offsetHeight > 0 && sobreposta) {
        surface.style.setProperty("--app-nav-height", `${nav.offsetHeight}px`);
      } else if (!sobreposta) {
        surface.style.removeProperty("--app-nav-height");
      }
    };
    const observer = new ResizeObserver(measure);
    const watch = () => {
      observer.disconnect();
      main?.removeEventListener("scroll", acompanharRolagem);
      main = celular.matches ? surface.querySelector(":scope > main") : null;
      header = celular.matches ? surface.querySelector(":scope > header") : null;
      if (header) observer.observe(header, { box: "border-box" });
      main?.addEventListener("scroll", acompanharRolagem, { passive: true });
      acompanharRolagem();
      const nav = surface.querySelector(":scope > .app-mobile-nav");
      if (nav) observer.observe(nav);
      measure();
    };
    const childrenObserver = new MutationObserver(watch);
    childrenObserver.observe(surface, { childList: true });
    celular.addEventListener("change", watch);
    watch();
    return () => {
      celular.removeEventListener("change", watch);
      main?.removeEventListener("scroll", acompanharRolagem);
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
