import { useSyncExternalStore } from "react";
import { THEME_EVENT, readThemePreference, type ThemePreference } from "./theme";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ThemePreference {
  try {
    return readThemePreference(window.localStorage) ?? "system";
  } catch {
    return "system";
  }
}

/**
 * Preferência de tema escolhida neste aparelho: "light", "dark" ou "system" (seguir o celular).
 * Complementa `useTheme`, que devolve só o tema já resolvido.
 */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getSnapshot, () => "system" as ThemePreference);
}
