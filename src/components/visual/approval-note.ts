import { createContext, useContext } from "react";

/**
 * Frase "Vai para aprovação de Ana" das telas em que a mudança de quem está vendo espera o OK de
 * outro dono (sociedade em conjunto ou sócio minoritário). Quem monta a tela informa o texto
 * pronto; os botões Salvar (`UnsavedBar`, formulários) mostram a frase **antes** de salvar.
 * Fora de um provedor (ou com `null`) nada aparece.
 */
export const ApprovalNoteContext = createContext<string | null>(null);

export function useApprovalNote() {
  return useContext(ApprovalNoteContext);
}
