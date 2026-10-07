import { ExternalLink, FileText, Handshake, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Os documentos do aceite como links de verdade, com 44 px ou mais, ícone e seta de nova aba:
 * Termos de Uso, Privacidade e, para quem tem barbearia, o Acordo de dados. A frase jurídica
 * fica intacta num parágrafo à parte; aqui não há margem negativa, então o anel de foco não
 * passa por cima do texto.
 *
 * - `chips` (padrão): pílulas em linha, para baixo do aceite.
 * - `rows`: linhas de 48 px com o nome completo, para a janela de termos atualizados.
 */
export function LegalDocLinks({
  withDpa,
  variant = "chips",
  className,
}: {
  withDpa?: boolean;
  variant?: "chips" | "rows";
  className?: string;
}) {
  const { t, locale } = useI18n();
  const lang = encodeURIComponent(locale);
  const docs = [
    {
      key: "terms",
      href: `/termos?lang=${lang}`,
      icon: FileText,
      short: t("entry.docs.terms"),
      full: t("auth.terms.link"),
    },
    {
      key: "privacy",
      href: `/privacidade?lang=${lang}`,
      icon: ShieldCheck,
      short: t("entry.docs.privacy"),
      full: t("cad.dono.privacyLink"),
    },
    ...(withDpa
      ? [
          {
            key: "dpa",
            href: `/acordo-de-dados?lang=${lang}`,
            icon: Handshake,
            short: t("entry.docs.dpa"),
            full: t("cad.dono.dpaLink"),
          },
        ]
      : []),
  ];

  if (variant === "rows") {
    return (
      <ul aria-label={t("entry.docs.label")} className={cn("grid gap-2", className)}>
        {docs.map(({ key, href, icon: Icon, full }) => (
          <li key={key}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold text-foreground transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <Icon className="size-5 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0 flex-1">{full}</span>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only"> {t("cad.cliente.newTab")}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={t("entry.docs.label")} className={cn("flex flex-wrap gap-2", className)}>
      {docs.map(({ key, href, icon: Icon, short }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3 text-xs font-semibold text-foreground transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <Icon className="size-4 shrink-0 text-gold" aria-hidden />
            {short}
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only"> {t("cad.cliente.newTab")}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
