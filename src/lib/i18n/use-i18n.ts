import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALE_EVENT,
  readLocale,
  writeLocale,
  type Locale,
} from "./locale.ts";
import { translate, type MessageKey, type TranslationVars } from "./translate.ts";

// Reserva quando o armazenamento do navegador está bloqueado: a escolha vale para esta página.
let memoryLocale: Locale | null = null;
// Só usa a reserva quando gravar no armazenamento falhou; senão o salvo (ou a falta dele) manda.
let storageBlocked = false;

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Idioma atual fora do React (mensagens de erro, formatação). No servidor, sempre pt-BR. */
export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const store = storage();
  if (store && !storageBlocked) return readLocale(store) ?? DEFAULT_LOCALE;
  return memoryLocale ?? DEFAULT_LOCALE;
}

/** Tradução fora do React, com o idioma atual. */
export function t(key: MessageKey, vars?: TranslationVars): string {
  return translate(getLocale(), key, vars);
}

export function setLocale(locale: Locale) {
  memoryLocale = locale;
  const store = storage();
  storageBlocked = !store || !writeLocale(store, locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  window.dispatchEvent(new Event(LOCALE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(LOCALE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LOCALE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Idioma atual e função de tradução, sincronizados com a escolha salva e outras abas.
 * No servidor a página sai em pt-BR; no navegador passa ao idioma salvo.
 */
export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const tr = useCallback(
    (key: MessageKey, vars?: TranslationVars) => translate(locale, key, vars),
    [locale],
  );
  return { locale, intlLocale: INTL_LOCALE[locale], t: tr, setLocale };
}
