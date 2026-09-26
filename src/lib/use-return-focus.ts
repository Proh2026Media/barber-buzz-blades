import { useRef } from "react";

const FOCUSABLE =
  "button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled)";

/**
 * Ao abrir, leva o foco ao primeiro controle da janela; ao fechar, devolve a quem a abriu.
 * Necessário em janelas controladas por estado, sem botão gatilho nem `AlertDialogCancel`.
 * O primeiro controle da janela deve ser uma opção segura. Espalhar no `*DialogContent`.
 */
export function useReturnFocus() {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      origin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const first =
        event.target instanceof HTMLElement
          ? event.target.querySelector<HTMLElement>(FOCUSABLE)
          : null;
      if (first) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const el = origin.current;
      if (el?.isConnected) {
        event.preventDefault();
        el.focus();
      }
    },
  };
}
