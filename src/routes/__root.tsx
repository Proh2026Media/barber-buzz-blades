import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { NotFoundPage } from "../components/NotFoundPage";

import { dominioDaPlataforma, redirecionarEnderecoAntigo } from "../lib/shop/platform-domain";
import appCss from "../styles.css?url";
import fonteTexto from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import fonteTitulos from "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url";
import deviceCss from "../dispositivos.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { themeBootstrapScript } from "../lib/theme";
import { deviceBootstrapScript } from "../lib/device";
import { DEFAULT_LOCALE, localeFromTag, localeBootstrapScript } from "../lib/i18n/locale";
import { useI18n } from "../lib/i18n";
import { PushAccountGuard } from "@/features/notifications/PushAccountGuard";
import { PwaRegister } from "../lib/pwa";
import { VisibleViewport } from "../lib/visible-viewport";
import { PwaInstallBanner, PwaInstallProvider } from "../components/pwa-install-banner";
import { Toaster } from "../components/ui/sonner";

import { loadLocale, translate } from "../lib/i18n/translate";
import { APP_DESCRIPTION_KEY, APP_NAME, themeColorBootstrapScript } from "../lib/brand";
import { paletaBootstrapScript } from "../lib/paleta";

import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";

async function identidadeInicial(dominio: string, consultar: (url: URL) => Promise<Response>) {
  const plataforma = [dominioDaPlataforma, "localhost", "127.0.0.1"].includes(dominio);
  const inicial = { dominio, nome: plataforma ? APP_NAME : dominio, fundo: "", fonte: "" };
  if (plataforma) return inicial;
  try {
    const url = new URL("/identidade/manifesto", "https://" + dominio);
    url.searchParams.set("dominio", dominio);
    const resposta = await consultar(url);
    if (resposta.ok) {
      const manifesto = await resposta.json();
      inicial.fonte =
        resposta.headers.get("Link")?.match(/^<(https:\/\/[^>]+)>; rel=preload; as=font;/)?.[1] ??
        "";
      if (typeof manifesto.name === "string" && manifesto.name.trim())
        inicial.nome = manifesto.name;
      if (/^#[0-9a-f]{6}$/i.test(manifesto.background_color))
        inicial.fundo = manifesto.background_color;
    }
  } catch {
    // O domínio ainda identifica a loja quando o cadastro está indisponível.
  }
  return inicial;
}

const identidadeDaPagina = createIsomorphicFn()
  .server(async () => {
    const host = getRequestHost({ xForwardedHost: true })
      .split(",")[0]
      .trim()
      .split(":")[0]
      .toLowerCase();
    const { shopIdentity } = await import("../lib/shop/installation");
    return identidadeInicial(host, shopIdentity);
  })
  .client(() =>
    identidadeInicial(window.location.hostname, (url) =>
      fetch(url.pathname + url.search, {
        signal: AbortSignal.timeout(5000),
      }),
    ),
  );
// Página 404 compartilhada com as rotas só do navegador (ver NotFoundPage).
const NotFoundComponent = NotFoundPage;

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("app.error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("app.error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("app.error.retry")}
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {t("app.common.backHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const lang = new URLSearchParams(location.searchStr).get("lang");
    await loadLocale(localeFromTag(lang) ?? DEFAULT_LOCALE);
  },
  loader: () => identidadeDaPagina(),
  head: ({ loaderData, match }) => {
    // Descrição no idioma de `?lang=` já no HTML do servidor (o mesmo critério do beforeLoad).
    const lang = (match.search as { lang?: unknown }).lang;
    const consultaDominio = loaderData?.dominio
      ? "?dominio=" + encodeURIComponent(loaderData.dominio)
      : "";
    const description = translate(localeFromTag(lang) ?? DEFAULT_LOCALE, APP_DESCRIPTION_KEY);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: loaderData?.nome || "Agendamento" },
        { name: "description", content: description },
        { name: "application-name", content: loaderData?.nome || "Agendamento" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: loaderData?.nome || "Agendamento" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "format-detection", content: "telephone=no" },
        { name: "color-scheme", content: "light dark" },
        // A meta theme-color é criada e mantida só pelo themeColorBootstrapScript (src/lib/brand.ts).
        { property: "og:title", content: loaderData?.nome || "Agendamento" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary" },
      ],
      // Aplica o tema salvo, o idioma e a faixa de dispositivo antes da primeira pintura
      // (em sincronia com `useTheme`, `useI18n` e `useDevice`).
      scripts: [
        { children: `(${redirecionarEnderecoAntigo.toString()})();` },
        {
          children: `try {
          if (location.pathname === "/" && (matchMedia("(display-mode: standalone)").matches || navigator.standalone ||
            ([${JSON.stringify(dominioDaPlataforma)}, "localhost", "127.0.0.1"].includes(location.hostname) && localStorage.getItem("sb-supabasebeauty-auth-token"))))
            document.documentElement.setAttribute("data-resolver-entrada", "");
        } catch {}`,
        },
        { children: themeBootstrapScript },
        { children: paletaBootstrapScript },
        { children: themeColorBootstrapScript },
        { children: localeBootstrapScript },
        { children: deviceBootstrapScript },
      ],
      styles: loaderData?.fundo
        ? [{ children: ":root{--fundo-abertura-loja:" + loaderData.fundo + "}" }]
        : [],
      links: [
        { rel: "manifest", href: "/identidade/manifesto" + consultaDominio },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          type: "image/png",
          href: "/apple-touch-icon.png" + consultaDominio,
        },
        ...(loaderData?.fonte
          ? [
              {
                rel: "preload",
                as: "font",
                crossOrigin: "anonymous" as const,
                href: loaderData.fonte,
              },
            ]
          : []),
        ...[fonteTexto, fonteTitulos].map((href) => ({
          rel: "preload",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous" as const,
          href,
        })),
        { rel: "stylesheet", href: appCss },
        // CSS por dispositivo (src/dispositivos.css → src/styles/*.css) depois do styles.css:
        // vence em igualdade de especificidade.
        { rel: "stylesheet", href: deviceCss },
        { rel: "icon", href: "/identidade/icone?tamanho=32" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <VisibleViewport />
      <PwaRegister />
      <PushAccountGuard />
      <PwaInstallProvider>
        <PwaInstallBanner fallback />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </PwaInstallProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
