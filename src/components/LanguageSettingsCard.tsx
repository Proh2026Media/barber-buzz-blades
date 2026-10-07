import { useId, useState } from "react";
import { Check, Info, Languages, Smartphone } from "lucide-react";
import { Hint, SectionHeader, StatusBadge } from "@/components/visual";
import { DEFAULT_LOCALE, LOCALES, LOCALE_NATIVE_NAMES, translate, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Cartão "Idioma" dos ajustes de cliente, barbearia e plataforma. */
export function LanguageSettingsCard({
  className,
  hideHeading = false,
}: {
  className?: string;
  /** Dentro de janela já chamada "Idioma": sem título nem moldura de cartão. */
  hideHeading?: boolean;
}) {
  const { locale, t, setLocale } = useI18n();
  const [announcement, setAnnouncement] = useState("");
  const titleId = useId();
  const group = useId();

  const deviceBadge = (
    <StatusBadge
      tone="neutral"
      icon={Smartphone}
      size="sm"
      label={t("settingsHub.summary.thisDevice")}
    />
  );

  // Variação local compacta dos cartões de escolha: uma linha por idioma (sigla, nome e
  // frase de exemplo, ✓ à direita), sempre em uma coluna — nomes longos nunca ficam
  // espremidos nem encobertos, e as 5 opções cabem sem empurrar o cartão Tema para longe.
  const choices = (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t("language.title")}</legend>
      {LOCALES.map((option) => {
        const selected = option === locale;
        const optionTitleId = `${group}-${option}-title`;
        const sampleId = `${group}-${option}-sample`;
        return (
          <label
            key={option}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3 py-2 transition has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold",
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <input
              type="radio"
              name={group}
              value={option}
              checked={selected}
              aria-labelledby={optionTitleId}
              aria-describedby={sampleId}
              onChange={() => {
                setLocale(option);
                setAnnouncement(
                  translate(option, "language.changed", {
                    language: LOCALE_NATIVE_NAMES[option],
                  }),
                );
              }}
              className="sr-only"
            />
            {/* Sigla da região (BR, PT, US, GB, ES). */}
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold tracking-wide",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {(option.split("-")[1] ?? option).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span id={optionTitleId} className="block break-words text-sm font-bold">
                {LOCALE_NATIVE_NAMES[option]}
              </span>
              <span
                id={sampleId}
                lang={option}
                className="block break-words text-xs text-muted-foreground"
              >
                “{translate(option, "language.sample")}”
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40",
              )}
            >
              {selected && <Check className="size-3.5" />}
            </span>
          </label>
        );
      })}
    </fieldset>
  );

  const footer = (
    <>
      {locale !== DEFAULT_LOCALE && <Hint icon={Info}>{t("language.partial")}</Hint>}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );

  // Dentro de uma janela que já se chama "Idioma": sem título repetido e sem cartão dentro
  // de cartão — só o selo "Só neste aparelho" acima das opções.
  if (hideHeading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex">{deviceBadge}</div>
        {choices}
        {footer}
      </div>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn("app-action-card space-y-4 p-4 sm:p-5", className)}
    >
      <SectionHeader
        icon={Languages}
        id={titleId}
        as="h3"
        title={t("language.title")}
        aside={deviceBadge}
      />
      {choices}
      {footer}
    </section>
  );
}
