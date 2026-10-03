import { useCallback, useEffect, useState } from "react";
import { INTL_LOCALE, LOCALE_EVENT, parseLocale, readLocale, type Locale } from "@/lib/i18n/locale";
import { translate, type MessageKey, type TranslationVars } from "@/lib/i18n/translate";
import { useI18n } from "@/lib/i18n/use-i18n";

/**
 * Converte uma etiqueta de idioma (`en`, `en-GB`, `pt_PT`, `es-MX`…) num idioma suportado.
 * Inglês sem região vira en-US; português sem região vira pt-BR; qualquer espanhol vira es.
 */
export function localeFromTag(tag: unknown): Locale | null {
  if (typeof tag !== "string") return null;
  const raw = tag.trim();
  if (!raw) return null;
  const exact = parseLocale(raw);
  if (exact) return exact;
  const [language, region = ""] = raw.toLowerCase().replace("_", "-").split("-");
  if (language === "en") return region === "gb" || region === "uk" ? "en-GB" : "en-US";
  if (language === "pt") return region === "pt" ? "pt-PT" : "pt-BR";
  if (language === "es") return "es";
  return null;
}

/** Primeiro idioma suportado da lista do navegador (`navigator.languages`). */
export function localeFromLanguages(tags: readonly unknown[]): Locale | null {
  for (const tag of tags) {
    const locale = localeFromTag(tag);
    if (locale) return locale;
  }
  return null;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

/**
 * Idioma das páginas legais públicas, sem mudar a escolha salva do resto do app.
 *
 * Ordem: escolha feita no seletor desta página > `?lang=` no endereço (também no servidor) >
 * idioma salvo neste aparelho > idioma do navegador na primeira visita > pt-BR.
 * Assim um revisor com navegador em inglês lê a política em inglês, e `?lang=en` funciona
 * em qualquer navegador, sem gravar nada para o app.
 */
export function useLegalI18n(urlLang?: string) {
  const { locale: appLocale } = useI18n();
  const [chosenHere, setChosenHere] = useState(false);
  const [browserLocale, setBrowserLocale] = useState<Locale | null>(null);

  useEffect(() => {
    const onChoice = () => setChosenHere(true);
    window.addEventListener(LOCALE_EVENT, onChoice);
    return () => window.removeEventListener(LOCALE_EVENT, onChoice);
  }, []);

  useEffect(() => {
    let saved: Locale | null = null;
    try {
      saved = readLocale(window.localStorage);
    } catch {
      saved = null;
    }
    // Quem já escolheu um idioma no app continua com ele.
    if (saved) return;
    setBrowserLocale(localeFromLanguages(browserLanguages()));
  }, []);

  const urlLocale = localeFromTag(urlLang);
  const locale: Locale = chosenHere ? appLocale : (urlLocale ?? browserLocale ?? appLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale, appLocale]);

  const t = useCallback(
    (key: MessageKey, vars?: TranslationVars) => translate(locale, key, vars),
    [locale],
  );
  return { locale, intlLocale: INTL_LOCALE[locale], t };
}
