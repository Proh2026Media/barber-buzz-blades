import { useRef } from "react";

const FOCUSABLE =
  "button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";

type FocusHandlers = {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/**
 * Foco de janelas controladas por estado (sem botão gatilho): ao fechar, devolve o foco a quem
 * estava focado ao abrir; com `moveIn`, garante que o foco entre na janela ao abrir (primeiro
 * controle, que deve ser uma opção segura). Os handlers recebidos rodam antes e, se chamarem
 * `preventDefault`, assumem o controle.
 */
export function useDialogFocus(handlers: FocusHandlers, { moveIn = false } = {}) {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      origin.current = active instanceof HTMLElement && active !== document.body ? active : null;
      handlers.onOpenAutoFocus?.(event);
      if (!moveIn || event.defaultPrevented) return;
      const content = event.target instanceof HTMLElement ? event.target : null;
      queueMicrotask(() => {
        if (!content || content.contains(document.activeElement)) return;
        content.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
      });
    },
    onCloseAutoFocus: (event: Event) => {
      handlers.onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const el = origin.current;
      if (el?.isConnected) {
        event.preventDefault();
        el.focus();
      }
    },
  };
}
