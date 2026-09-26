import { DEFAULT_LOCALE, type Locale } from "./locale.ts";
import { enGB } from "./messages/en-GB.ts";
import { enUS } from "./messages/en-US.ts";
import { es } from "./messages/es.ts";
import { ptBR, type MessageKey } from "./messages/pt-BR.ts";
import { ptPT } from "./messages/pt-PT.ts";

export type { MessageKey };

export type TranslationVars = Record<string, string | number>;

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  "en-US": enUS,
  "en-GB": enGB,
  es,
};

/** Texto no idioma pedido; cai para pt-BR se faltar. `{nome}` é trocado por `vars.nome`. */
export function translate(locale: Locale, key: MessageKey, vars?: TranslationVars): string {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (full, name: string) =>
    name in vars ? String(vars[name]) : full,
  );
}
