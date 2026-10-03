import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import { TERMS_VERSION } from "@/features/legal/versions";

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
const PAGE_URL = `${PLATFORM_OPERATOR.siteUrl}/termos`;

type TermsSearch = { lang?: string };

export const Route = createFileRoute("/termos")({
  // `?lang=en` (ou en-US, en-GB, es, pt-PT, pt-BR) abre os termos nesse idioma, também no servidor.
  validateSearch: (search: Record<string, unknown>): TermsSearch =>
    typeof search.lang === "string" && search.lang.trim() ? { lang: search.lang.trim() } : {},
  head: () => ({
    meta: [
      { title: "Termos de Uso — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Termos de uso do aplicativo Barba & Cabelo para barbearias, profissionais e clientes (Terms of Use available in English with ?lang=en).",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [
      { rel: "alternate", hrefLang: "pt-BR", href: PAGE_URL },
      { rel: "alternate", hrefLang: "pt-PT", href: `${PAGE_URL}?lang=pt-PT` },
      { rel: "alternate", hrefLang: "en", href: `${PAGE_URL}?lang=en` },
      { rel: "alternate", hrefLang: "en-GB", href: `${PAGE_URL}?lang=en-GB` },
      { rel: "alternate", hrefLang: "es", href: `${PAGE_URL}?lang=es` },
      { rel: "alternate", hrefLang: "x-default", href: PAGE_URL },
    ],
  }),
  component: TermosPage,
});

const headingClass = "text-lg font-bold text-foreground";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={headingClass}>{title}</h2>
      {children}
    </section>
  );
}

function TermosPage() {
  const { lang } = Route.useSearch();
  const { t, locale } = useLegalI18n(lang);

  // Mantém o idioma pedido no endereço ao abrir a política a partir dos termos.
  const privacyHref = lang ? `/privacidade?lang=${encodeURIComponent(lang)}` : "/privacidade";
  const privacyLink = (
    <a href={privacyHref} className={legalLinkClass}>
      {t("legal.privacyLink")}
    </a>
  );
  const dpaHref = lang ? `/acordo-de-dados?lang=${encodeURIComponent(lang)}` : "/acordo-de-dados";
  const dpaLink = (
    <a href={dpaHref} className={legalLinkClass}>
      {t("legal.dpaLink")}
    </a>
  );
  const permissionsLink = (
    <a
      href={GOOGLE_PERMISSIONS_URL}
      className={`${legalLinkClass} [overflow-wrap:anywhere]`}
      rel="noopener noreferrer"
      target="_blank"
    >
      myaccount.google.com/permissions
    </a>
  );

  return (
    <LegalPageShell
      title={t("legal.termsLink")}
      updatedAt={TERMS_VERSION}
      locale={locale}
      langParam={lang}
    >
      <Section title={t("legal.terms.s1Title")}>
        <p>
          {legalRichText(t("legal.terms.s1Body"), {
            app: <strong>Barba &amp; Cabelo</strong>,
            site: (
              <a href={PLATFORM_OPERATOR.siteUrl} className={legalLinkClass}>
                beauty.contheiner.digital
              </a>
            ),
            privacy: privacyLink,
          })}
        </p>
      </Section>

      <Section title={t("legal.terms.s2Title")}>
        <p>{t("legal.terms.s2Body1")}</p>
        <p>{t("legal.terms.s2Body2")}</p>
      </Section>

      <Section title={t("legal.terms.s3Title")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("legal.terms.s3Item1")}</li>
          <li>{t("legal.terms.s3Item2")}</li>
          <li>{t("legal.terms.s3Item3")}</li>
          <li>{t("legal.terms.s3Item4")}</li>
          <li>{legalRichText(t("legal.terms.s3Item5"), { dpa: dpaLink })}</li>
        </ul>
      </Section>

      <Section title={t("legal.terms.s4Title")}>
        <p>{t("legal.terms.s4Body")}</p>
        <p>
          {legalRichText(t("fix3.terms.googleRevoke"), {
            link: permissionsLink,
            privacy: privacyLink,
          })}
        </p>
      </Section>

      <Section title={t("legal.terms.s5Title")}>
        <p>{t("legal.terms.s5Body")}</p>
      </Section>

      <Section title={t("legal.terms.s6Title")}>
        <p>{t("legal.terms.s6Body")}</p>
      </Section>

      <Section title={t("legal.terms.s7Title")}>
        <p>
          {legalRichText(t("legal.terms.s7Contact"), {
            email: (
              <a href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`} className={legalLinkClass}>
                {PLATFORM_OPERATOR.privacyEmail}
              </a>
            ),
            name: <strong>{PLATFORM_OPERATOR.legalName}</strong>,
            cnpj: <strong>{PLATFORM_OPERATOR.cnpj}</strong>,
          })}
        </p>
        <p>{t("legal.terms.s7Delete")}</p>
        <p>{t("legal.terms.s7Changes")}</p>
      </Section>
    </LegalPageShell>
  );
}
