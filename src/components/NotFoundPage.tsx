import { Link } from "@tanstack/react-router";
import { ChevronLeft, Home, Link2Off } from "lucide-react";
import { EmptyState } from "@/components/visual";
import { useI18n } from "@/lib/i18n";

/**
 * Página 404: link quebrado em desenho, com saída clara; o "404" fica pequeno, só para o suporte.
 * Usada pela raiz e pelas rotas só do navegador (ssr: false), que a mostram dentro da própria rota
 * para o HTML do servidor e o do navegador coincidirem.
 */
export function NotFoundPage() {
  const { t } = useI18n();
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
