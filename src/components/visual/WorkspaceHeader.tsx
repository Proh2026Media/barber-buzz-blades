import { type ReactNode, type HTMLAttributes } from "react";

/** Mantém uma única casca e o estado das seções ao redimensionar. */
export function WorkspaceFrame({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

/** A ação permanece junto ao título e aos controles da tarefa em todas as larguras. */
export function WorkspaceHeaderAction({ children }: { children: ReactNode }) {
  return children;
}

/** O título pertence ao conteúdo da tarefa; o cabeçalho global identifica a loja. */
export function WorkspaceHeading({ children }: { children: ReactNode }) {
  return children;
}
