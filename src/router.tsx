import { DEFAULT_LOCALE, localeFromTag, readLocale } from "./lib/i18n/locale";
import { loadLocale } from "./lib/i18n/translate";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = async () => {
  // A hidratação precisa do mesmo dicionário usado no HTML de ?lang=.
  if (typeof window !== "undefined") {
    let saved = null;
    try {
      saved = readLocale(window.localStorage);
    } catch {
      /* memória da visita */
    }
    const requested = localeFromTag(new URLSearchParams(window.location.search).get("lang"));
    await Promise.all([
      loadLocale(requested ?? DEFAULT_LOCALE),
      loadLocale(saved ?? DEFAULT_LOCALE),
    ]).catch(() => {});
  }
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // WordPress usava /ezequiel/ — normaliza para /ezequiel e a rota $barberSlug resolve.
    trailingSlash: "never",
  });

  return router;
};
