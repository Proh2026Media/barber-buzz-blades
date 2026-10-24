import { useContext, type ReactNode, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useViewportAtLeast } from "@/lib/device";
import { WorkspaceHeaderContext } from "./workspace-header-context";

/** Casca sem elementos extras: mantém o div original e fornece o destino da ação. */
export function WorkspaceFrame({
  actionTarget,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { actionTarget: HTMLDivElement | null }) {
  return (
    <WorkspaceHeaderContext.Provider value={actionTarget}>
      <div {...props}>{children}</div>
    </WorkspaceHeaderContext.Provider>
  );
}

/** O mesmo controle e suas permissões: no computador, a ação passa para o cabeçalho. */
export function WorkspaceHeaderAction({ children }: { children: ReactNode }) {
  const target = useContext(WorkspaceHeaderContext);
  const desktop = useViewportAtLeast(1280);
  return desktop && target ? createPortal(children, target) : children;
}

/** O título da seção passa a ser mostrado pela casca apenas no computador. */
export function WorkspaceHeading({ children }: { children: ReactNode }) {
  const target = useContext(WorkspaceHeaderContext);
  const desktop = useViewportAtLeast(1280);
  return desktop && target ? null : children;
}
