/**
 * Shared light/dark theme preference for every workspace (cliente, barbearia, plataforma).
 * The `dark` class on <html> drives Tailwind's dark variant (see `@custom-variant dark` in styles.css).
 */
export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "arena:theme";
export const THEME_EVENT = "arena-theme";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function parseThemePreference(value: unknown): ThemePreference | null {
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

/** An explicit choice wins; otherwise follow the device setting. */
export function resolveTheme(
  preference: ThemePreference | null,
  systemPrefersDark: boolean,
): Theme {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark ? "dark" : "light";
}

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readThemePreference(
  storage: ThemeStorage | null | undefined,
): ThemePreference | null {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeThemePreference(
  storage: ThemeStorage | null | undefined,
  preference: ThemePreference,
): boolean {
  try {
    if (preference === "system") storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(
  root: { classList: Pick<DOMTokenList, "add" | "remove"> },
  theme: Theme,
) {
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Inline bootstrap executed before the first paint so server-rendered pages
 * never flash the wrong theme. Mirrors `resolveTheme` and must stay in sync with it.
 */
export const themeBootstrapScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches);var c=document.documentElement.classList;if(d)c.add("dark");else c.remove("dark");}catch(e){}})();`;
