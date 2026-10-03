import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate, type MessageKey } from "@/lib/i18n/translate";
import { localeFromTag } from "./legal-locale";

/**
 * `<head>` das páginas legais no idioma pedido por `?lang=`.
 *
 * Roda também no servidor: o título e a descrição já saem traduzidos no HTML gerado,
 * para revisores (ex.: verificação do Google) e buscadores que leem `?lang=en`.
 * Sem `?lang=` válido, fica em pt-BR (idioma padrão do produto).
 */
export function legalHead({
  lang,
  pageUrl,
  titleKey,
  descriptionKey,
}: {
  lang?: string;
  pageUrl: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}) {
  const locale = localeFromTag(lang) ?? DEFAULT_LOCALE;
  return {
    meta: [
      { title: `${translate(locale, titleKey)} — Barba & Cabelo` },
      { name: "description", content: translate(locale, descriptionKey) },
      { name: "robots", content: "index,follow" },
    ],
    links: [
      { rel: "alternate", hrefLang: "pt-BR", href: pageUrl },
      { rel: "alternate", hrefLang: "pt-PT", href: `${pageUrl}?lang=pt-PT` },
      { rel: "alternate", hrefLang: "en", href: `${pageUrl}?lang=en` },
      { rel: "alternate", hrefLang: "en-GB", href: `${pageUrl}?lang=en-GB` },
      { rel: "alternate", hrefLang: "es", href: `${pageUrl}?lang=es` },
      { rel: "alternate", hrefLang: "x-default", href: pageUrl },
    ],
  };
}
