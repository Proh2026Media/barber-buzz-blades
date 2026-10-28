import { type Locale } from "./locale.ts";
import { ptBR, type MessageKey } from "./messages/pt-BR.ts";

export type { MessageKey };

export type TranslationVars = Record<string, string | number>;

export const MESSAGES: Partial<Record<Locale, Record<MessageKey, string>>> & {
  "pt-BR": Record<MessageKey, string>;
} = { "pt-BR": ptBR };

const pending = new Map<Locale, Promise<void>>();
const loaders = {
  "pt-PT": () => import("./messages/pt-PT.ts").then((module) => module.ptPT),
  "en-US": () => import("./messages/en-US.ts").then((module) => module.enUS),
  "en-GB": () => import("./messages/en-GB.ts").then((module) => module.enGB),
  es: () => import("./messages/es.ts").then((module) => module.es),
};

export function isLocaleLoaded(locale: Locale): boolean {
  return !!MESSAGES[locale];
}

/** Uma transferência por idioma. Remove a promessa rejeitada; o navegador pode exigir recarga após falha de rede. */
export function loadLocale(locale: Locale): Promise<void> {
  if (isLocaleLoaded(locale)) return Promise.resolve();
  const existing = pending.get(locale);
  if (existing) return existing;
  const request = loaders[locale as keyof typeof loaders]()
    .then((messages) => {
      MESSAGES[locale] = messages;
    })
    .finally(() => {
      pending.delete(locale);
    });
  pending.set(locale, request);
  return request;
}

/** Texto no idioma pedido; cai para pt-BR se faltar. `{nome}` é trocado por `vars.nome`. */
export function translate(locale: Locale, key: MessageKey, vars?: TranslationVars): string {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES["pt-BR"][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (full, name: string) =>
    name in vars ? String(vars[name]) : full,
  );
}
