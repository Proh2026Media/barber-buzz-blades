import { createContext } from "react";

/** Destino da ação principal, fornecido pela casca sem duplicar o botão da seção. */
export const WorkspaceHeaderContext = createContext<HTMLDivElement | null>(null);
