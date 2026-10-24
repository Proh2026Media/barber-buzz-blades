import { createContext, useContext } from "react";

export const PreviewDocument = createContext<Document | undefined>(undefined);
/** Fontes da prévia são carregadas no documento da moldura, sem alterar o editor. */
export const usePreviewDocument = () => useContext(PreviewDocument);
