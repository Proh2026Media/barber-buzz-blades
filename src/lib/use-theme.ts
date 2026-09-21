import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DARK_MEDIA_QUERY,
  THEME_EVENT,
  applyTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type Theme,
  type ThemePreference,
} from "./theme";

// Fallback when browser storage is blocked: the choice still lasts for the current page.
let memoryPreference: ThemePreference | null = null;

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function currentPreference() {
  return readThemePreference(storage()) ?? memoryPreference;
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia(DARK_MEDIA_QUERY).matches;
}

function subscribe(callback: () => void) {
  const media = window.matchMedia(DARK_MEDIA_QUERY);
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}

function getSnapshot(): Theme {
  return resolveTheme(currentPreference(), systemPrefersDark());
}

export function setThemePreference(preference: ThemePreference) {
  memoryPreference = preference;
  writeThemePreference(storage(), preference);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Current theme, kept in sync with the stored preference, other tabs and the device setting.
 * Server rendering always assumes light; the inline bootstrap in the root shell applies the
 * stored theme before hydration so there is no visible flash.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);
  useEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);
  const setTheme = useCallback((next: Theme) => setThemePreference(next), []);
  const toggleTheme = useCallback(
    () => setThemePreference(theme === "dark" ? "light" : "dark"),
    [theme],
  );
  return { theme, isDark: theme === "dark", setTheme, toggleTheme };
}
