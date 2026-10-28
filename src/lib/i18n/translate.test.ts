import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCALE, LOCALES, parseLocale } from "./locale.ts";
import { MESSAGES, translate, loadLocale, isLocaleLoaded } from "./translate.ts";

test("idiomas secundários só são carregados quando pedidos e compartilham a transferência", async () => {
  assert.equal(isLocaleLoaded("pt-BR"), true);
  assert.equal(isLocaleLoaded("es"), false);
  assert.equal(translate("es", "language.sample"), translate("pt-BR", "language.sample"));
  const first = loadLocale("es");
  assert.equal(loadLocale("es"), first);
  await first;
  assert.equal(translate("es", "language.sample"), "Reservar cita");
});

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("every locale has the same keys as pt-BR", async () => {
  await Promise.all(LOCALES.map(loadLocale));
  const base = Object.keys(MESSAGES[DEFAULT_LOCALE]!).sort();
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(MESSAGES[locale]!).sort(), base, locale);
  }
});

test("every translation keeps the same placeholders and is not empty", () => {
  const base = MESSAGES[DEFAULT_LOCALE]!;
  for (const locale of LOCALES) {
    for (const [key, text] of Object.entries(MESSAGES[locale]!)) {
      assert.ok(text.trim().length > 0, `${locale} ${key} empty`);
      assert.deepEqual(
        placeholders(text),
        placeholders(base[key as keyof typeof base]),
        `${locale} ${key}`,
      );
    }
  }
});

test("translate interpolates and keeps unknown placeholders", () => {
  assert.equal(
    translate("pt-BR", "language.changed", { language: "English" }).includes("English"),
    true,
  );
  assert.equal(translate("en-US", "language.changed").includes("{language}"), true);
});

test("parseLocale accepts only supported locales", () => {
  assert.equal(parseLocale("pt-PT"), "pt-PT");
  assert.equal(parseLocale("fr"), null);
  assert.equal(parseLocale(null), null);
});
