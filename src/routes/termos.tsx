import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell, LegalSection as Section } from "@/features/legal/LegalPageShell";
import { legalHead } from "@/features/legal/legal-head";
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
  // Título e descrição seguem o `?lang=` já no HTML do servidor.
  head: ({ match }) =>
    legalHead({
      lang: match.search.lang,
      pageUrl: PAGE_URL,
      titleKey: "legal.termsLink",
      descriptionKey: "legal.terms.metaDescription",
    }),
  component: TermosPage,
});

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
      doc="terms"
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
              <a
                href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`}
                className={`${legalLinkClass} whitespace-nowrap`}
              >
                {PLATFORM_OPERATOR.privacyEmail}
              </a>
            ),
            name: <strong>{PLATFORM_OPERATOR.legalName}</strong>,
            cnpj: <strong className="whitespace-nowrap">{PLATFORM_OPERATOR.cnpj}</strong>,
          })}
        </p>
        <p>{t("legal.terms.s7Delete")}</p>
        <p>{t("legal.terms.s7Changes")}</p>
      </Section>
    </LegalPageShell>
  );
}
