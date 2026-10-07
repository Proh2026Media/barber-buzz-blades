import { useCallback, useState } from "react";

/**
 * Janela que mostra uma senha temporária: a senha não aparece de novo, então o primeiro
 * fechamento (X, Esc, toque fora) só avisa. Fecha de vez por "Já copiei a senha" ou
 * "Fechar mesmo assim" (`closeNow`).
 */
export function useTempPasswordClose(hasPassword: boolean, close: () => void) {
  const [warned, setWarned] = useState(false);
  const request = useCallback(
    (open: boolean) => {
      if (open) return;
      if (hasPassword && !warned) {
        setWarned(true);
        return;
      }
      setWarned(false);
      close();
    },
    [hasPassword, warned, close],
  );
  const closeNow = useCallback(() => {
    setWarned(false);
    close();
  }, [close]);
  const reset = useCallback(() => setWarned(false), []);
  return { warned, request, closeNow, reset };
}
