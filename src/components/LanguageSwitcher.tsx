import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_NATIVE_NAMES, translate, useI18n, type Locale } from "@/lib/i18n";

type LanguageSwitcherProps = {
  className?: string;
  /** Extra classes for the button (defaults to app-icon-button). */
  buttonClassName?: string;
  /**
   * Idioma em que a página está de fato (ex.: páginas legais abertas com `?lang=en` ou pelo
   * idioma do navegador). Sem ele, vale o idioma salvo do app.
   */
  locale?: Locale;
  /** Mostra a sigla do idioma atual ao lado do ícone ("PT", "EN", "ES"). */
  showCode?: boolean;
};

/** Sigla curta do idioma, para o botão. */
function localeCode(locale: Locale) {
  return locale.slice(0, 2).toUpperCase();
}

/** Seletor compacto de idioma para o topo das páginas, com ou sem login. */
export function LanguageSwitcher({
  className,
  buttonClassName = "app-icon-button",
  locale: shownLocale,
  showCode = false,
}: LanguageSwitcherProps) {
  const app = useI18n();
  const { setLocale } = app;
  const locale = shownLocale ?? app.locale;
  const t = (key: "language.button" | "language.title", vars?: Record<string, string>) =>
    translate(locale, key, vars);
  const current = LOCALE_NATIVE_NAMES[locale];
  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("language.button", { language: current })}
            title={current}
            className={buttonClassName}
            style={
              showCode
                ? { width: "auto", flex: "0 0 auto", minWidth: 44, gap: 4, paddingInline: 10 }
                : undefined
            }
          >
            <Languages size={showCode ? 18 : 20} aria-hidden="true" />
            {showCode && (
              <span aria-hidden="true" className="text-xs font-bold tracking-wide">
                {localeCode(locale)}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>{t("language.title")}</DropdownMenuLabel>
          {LOCALES.map((option) => {
            const selected = option === locale;
            return (
              <DropdownMenuItem
                key={option}
                lang={option}
                onSelect={() => setLocale(option)}
                aria-current={selected ? "true" : undefined}
                className="min-h-11 justify-between gap-3"
              >
                {LOCALE_NATIVE_NAMES[option]}
                {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
