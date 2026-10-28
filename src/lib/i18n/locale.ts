/** Idiomas suportados. pt-BR é o idioma principal e o padrão. */
export const LOCALES = ["pt-BR", "pt-PT", "en-US", "en-GB", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_STORAGE_KEY = "arena:locale";
export const LOCALE_EVENT = "arena-locale";

/** Nome de cada idioma escrito no próprio idioma, para quem não lê o atual. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  es: "Español",
};

/** Código para Intl (datas, números, moeda). */
export const INTL_LOCALE: Record<Locale, string> = {
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  "en-US": "en-US",
  "en-GB": "en-GB",
  es: "es-ES",
};

export function parseLocale(value: unknown): Locale | null {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

type LocaleStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLocale(storage: LocaleStorage | null | undefined): Locale | null {
  try {
    return parseLocale(storage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeLocale(storage: LocaleStorage | null | undefined, locale: Locale): boolean {
  try {
    if (locale === DEFAULT_LOCALE) storage?.removeItem(LOCALE_STORAGE_KEY);
    else storage?.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}

/**
 * Aplica o idioma salvo no atributo lang antes da primeira pintura, para leitores de tela
 * e tradutores do navegador. Espelha `parseLocale` e precisa ficar em sincronia com ele.
 */
export const localeBootstrapScript = `(function(){try{var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});var ok=${JSON.stringify(LOCALES)};document.documentElement.lang=ok.indexOf(l)>=0?l:${JSON.stringify(DEFAULT_LOCALE)};}catch(e){}})();`;

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

/** Frases curtas do seletor, sem baixar todos os dicionários para exibir cinco exemplos. */
export const LANGUAGE_SAMPLES: Record<Locale, string> = {
  "pt-BR": "Agendar horário",
  "pt-PT": "Marcar horário",
  "en-US": "Book a time",
  es: "Reservar cita",
  "en-GB": "Book a time",
};
