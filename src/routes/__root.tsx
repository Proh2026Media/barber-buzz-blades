import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ChevronLeft, Home, Link2Off } from "lucide-react";
import { EmptyState } from "../components/visual";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { themeBootstrapScript } from "../lib/theme";
import { localeBootstrapScript } from "../lib/i18n/locale";
import { useI18n } from "../lib/i18n";
import { PwaRegister } from "../lib/pwa";
import { PwaInstallBanner } from "../components/pwa-install-banner";
import { Toaster } from "../components/ui/sonner";

const APP_NAME = "Barba & Cabelo";
const APP_DESCRIPTION =
  "Agendamento, fidelidade e gestão para barbearias: reserve seu horário, acompanhe pontos e organize a agenda da equipe.";

function NotFoundComponent() {
  const { t } = useI18n();
  // Link quebrado em desenho, com saída clara; o "404" fica pequeno, só para o suporte.
  return (
    <main className="public-page flex min-h-dvh items-center justify-center bg-background p-4">
      <EmptyState
        className="public-card w-full max-w-sm"
        status="neutral"
        icon={Link2Off}
        title={t("app.notFound.title")}
        description={t("app.notFound.body")}
        action={
          <Link to="/" className="action-button action-confirm min-h-12 w-full">
            <Home aria-hidden />
            {t("app.common.backHome")}
          </Link>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("common.back")}
          </button>
        }
      >
        <p className="text-xs text-muted-foreground">{t("app.notFound.code")}</p>
      </EmptyState>
    </main>
  );
}

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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: APP_DESCRIPTION },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "format-detection", content: "telephone=no" },
      { name: "color-scheme", content: "light dark" },
      // HeadContent dedupes meta by name, so a single browser-chrome color is declared.
      { name: "theme-color", content: "#20211f" },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary" },
    ],
    // Applies the saved theme before the first paint; kept in sync with `useTheme`.
    scripts: [{ children: themeBootstrapScript }, { children: localeBootstrapScript }],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png" },
    ],
  }),
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
      <PwaRegister />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaInstallBanner />
      <Toaster />
    </QueryClientProvider>
  );
}
