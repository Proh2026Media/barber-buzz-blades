import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_NATIVE_NAMES, useI18n } from "@/lib/i18n";

type LanguageSwitcherProps = {
  className?: string;
  /** Extra classes for the button (defaults to app-icon-button). */
  buttonClassName?: string;
};

/** Seletor compacto de idioma para o topo das páginas, com ou sem login. */
export function LanguageSwitcher({
  className,
  buttonClassName = "app-icon-button",
}: LanguageSwitcherProps) {
  const { locale, t, setLocale } = useI18n();
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
          >
            <Languages size={20} aria-hidden="true" />
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
