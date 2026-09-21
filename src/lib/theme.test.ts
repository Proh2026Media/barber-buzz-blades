import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  themeBootstrapScript,
  writeThemePreference,
} from "./theme.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

test("explicit preference wins and system only applies without a choice", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme(null, false), "light");
});

test("unknown stored values are ignored instead of breaking the theme", () => {
  assert.equal(parseThemePreference("blue"), null);
  assert.equal(parseThemePreference(undefined), null);
  assert.equal(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "purple" })), null);
  assert.equal(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "dark" })), "dark");
  assert.equal(readThemePreference(null), null);
});

test("writing persists a choice, system clears it and storage failures are swallowed", () => {
  const storage = memoryStorage();
  assert.equal(writeThemePreference(storage, "dark"), true);
  assert.equal(storage.data.get(THEME_STORAGE_KEY), "dark");
  assert.equal(writeThemePreference(storage, "system"), true);
  assert.equal(storage.data.has(THEME_STORAGE_KEY), false);
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(writeThemePreference(broken, "light"), false);
  assert.equal(readThemePreference(broken), null);
});

test("applyTheme toggles only the dark class", () => {
  const classes = new Set<string>(["arena"]);
  const root = {
    classList: {
      add: (name: string) => void classes.add(name),
      remove: (name: string) => void classes.delete(name),
    },
  };
  applyTheme(root, "dark");
  assert.deepEqual([...classes], ["arena", "dark"]);
  applyTheme(root, "light");
  assert.deepEqual([...classes], ["arena"]);
});

test("the inline bootstrap agrees with resolveTheme for every combination", () => {
  const run = (stored: string | null, prefersDark: boolean, startsDark: boolean) => {
    const classes = new Set<string>(startsDark ? ["dark"] : []);
    const fakeDocument = {
      documentElement: {
        classList: {
          add: (name: string) => void classes.add(name),
          remove: (name: string) => void classes.delete(name),
        },
      },
    };
    const fakeStorage = { getItem: () => stored };
    const fakeMatchMedia = () => ({ matches: prefersDark });
    new Function("localStorage", "matchMedia", "document", themeBootstrapScript)(
      fakeStorage,
      fakeMatchMedia,
      fakeDocument,
    );
    return classes.has("dark") ? "dark" : "light";
  };
  for (const stored of [null, "dark", "light", "system", "garbage"])
    for (const prefersDark of [true, false])
      for (const startsDark of [true, false])
        assert.equal(
          run(stored, prefersDark, startsDark),
          resolveTheme(parseThemePreference(stored), prefersDark),
          `stored=${stored} prefersDark=${prefersDark} startsDark=${startsDark}`,
        );
});

test("the inline bootstrap never throws when storage is unavailable", () => {
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
  };
  assert.doesNotThrow(() =>
    new Function("localStorage", "matchMedia", "document", themeBootstrapScript)(
      throwing,
      () => ({ matches: true }),
      { documentElement: { classList: { add() {}, remove() {} } } },
    ),
  );
});
