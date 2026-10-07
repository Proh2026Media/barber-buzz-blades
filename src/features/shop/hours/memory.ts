import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from "react";

/**
 * Memória da aba Horários por barbearia: o painel desmonta a aba a cada troca, então o que ainda
 * não foi salvo (semana em edição, pedidos enviados aos sócios) fica aqui, fora da aba. Quem vai à
 * Agenda conferir algo e volta encontra a semana como deixou. Some ao recarregar a página.
 */
const store = new Map<string, unknown>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Barbearia dona da memória (troca de loja não mistura rascunhos). */
export const HoursMemoryScope = createContext("");

type Update<T> = T | ((current: T) => T);

export function useHoursMemory<T>(key: string, initial: T): [T, (next: Update<T>) => void] {
  const scope = useContext(HoursMemoryScope);
  const id = `${scope}|${key}`;
  const initialRef = useRef(initial);
  const read = useCallback(() => (store.has(id) ? (store.get(id) as T) : initialRef.current), [id]);
  const value = useSyncExternalStore(subscribe, read, () => initialRef.current);
  const set = useCallback(
    (next: Update<T>) => {
      const current = read();
      const resolved =
        typeof next === "function" ? (next as (current: T) => T)(current) : (next as T);
      if (Object.is(resolved, current)) return;
      store.set(id, resolved);
      listeners.forEach((listener) => listener());
    },
    [id, read],
  );
  return [value, set];
}
