import { useId, useState } from "react";
import { Check, Languages } from "lucide-react";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NATIVE_NAMES, translate, useI18n } from "@/lib/i18n";

/** Cartão "Idioma" dos ajustes de cliente, barbearia e plataforma. */
export function LanguageSettingsCard({
  className,
  hideHeading = false,
}: {
  className?: string;
  /** Esconde o título visível quando a tela já mostra "Idioma" logo acima. */
  hideHeading?: boolean;
}) {
  const { locale, t, setLocale } = useI18n();
  const [announcement, setAnnouncement] = useState("");
  const titleId = useId();
  const hintId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={`space-y-4 rounded-2xl border border-border bg-card p-4 ${className ?? ""}`}
    >
      <div className={hideHeading ? undefined : "space-y-4"}>
        {/* Título visível no mesmo padrão dos cartões vizinhos (WhatsApp, Senha). */}
        <h3
          id={titleId}
          className={hideHeading ? "sr-only" : "flex items-center gap-2 text-sm font-semibold"}
        >
          <Languages className="size-4 shrink-0 text-gold" aria-hidden="true" />
          {t("language.title")}
        </h3>
        <p
          id={hintId}
          className={
            hideHeading
              ? "text-sm text-muted-foreground"
              : "text-xs leading-relaxed text-muted-foreground"
          }
        >
          {t("language.hint")}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="grid gap-2 sm:grid-cols-2"
      >
        {LOCALES.map((option) => {
          const selected = option === locale;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={option}
              onClick={() => {
                setLocale(option);
                setAnnouncement(
                  translate(option, "language.changed", {
                    language: LOCALE_NATIVE_NAMES[option],
                  }),
                );
              }}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {LOCALE_NATIVE_NAMES[option]}
              {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {locale !== DEFAULT_LOCALE && (
        <p className="text-xs leading-relaxed text-muted-foreground">{t("language.partial")}</p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
