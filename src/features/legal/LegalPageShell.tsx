import { Link } from "@tanstack/react-router";
import { ChevronLeft, Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { INTL_LOCALE, translate, useI18n, type Locale, type MessageKey } from "@/lib/i18n";

type LegalPageShellProps = {
  title: string;
  /** Data da versão vigente no formato AAAA-MM-DD. */
  updatedAt: string;
  /** Idioma próprio da página (ex.: detectado do navegador); sem ele, vale o idioma do app. */
  locale?: Locale;
  /** `?lang=` recebido no endereço; mantido nos links do rodapé entre os documentos legais. */
  langParam?: string;
  children: ReactNode;
};

/** Idioma e tradução da página legal: o informado pela página ou o idioma do app. */
function useShellI18n(override?: Locale) {
  const app = useI18n();
  const locale = override ?? app.locale;
  return {
    locale,
    intlLocale: INTL_LOCALE[locale],
    t: (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
  };
}

/** Aviso de tradução de cortesia; só aparece fora do pt-BR, que é o texto oficial. */
export function LegalCourtesyNotice({
  className = "",
  locale: localeOverride,
}: {
  className?: string;
  locale?: Locale;
}) {
  const { t, locale } = useShellI18n(localeOverride);
  if (locale === "pt-BR") return null;
  return (
    <p
      role="note"
      className={`rounded-[var(--control-radius)] border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground ${className}`}
    >
      {t("legal.courtesyNotice")}
    </p>
  );
}

/** Layout compartilhado das páginas públicas legais (SSR). */
export function LegalPageShell({
  title,
  updatedAt,
  locale,
  langParam,
  children,
}: LegalPageShellProps) {
  const { t, intlLocale } = useShellI18n(locale);
  const legalSearch = langParam ? { lang: langParam } : {};
  const updatedLabel = new Date(`${updatedAt}T12:00:00Z`).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <Link
            to="/"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--control-radius)] border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("legal.back")}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-muted">
              <Scissors className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate">Barba &amp; Cabelo</span>
          </p>
          <LanguageSwitcher buttonClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--control-radius)] border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <LegalCourtesyNotice className="mb-6" locale={locale} />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("legal.updatedAt", { date: updatedLabel })}
        </p>
        <article className="legal-doc mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/90">
          {children}
        </article>
      </main>

      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
          aria-label={t("legal.navAria")}
        >
          <Link
            to="/privacidade"
            search={legalSearch}
            className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {t("legal.privacyLink")}
          </Link>
          <Link
            to="/termos"
            search={legalSearch}
            className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {t("legal.termsLink")}
          </Link>
          <Link
            to="/acordo-de-dados"
            search={legalSearch}
            className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {t("legal.dpaLink")}
          </Link>
          <Link
            to="/"
            className="min-h-11 inline-flex items-center font-semibold text-foreground underline-offset-2 hover:underline"
          >
            {t("legal.home")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
