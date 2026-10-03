import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { legalHead } from "@/features/legal/legal-head";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import { DPA_VERSION } from "@/features/legal/versions";
import type { MessageKey } from "@/lib/i18n";

const PAGE_URL = `${PLATFORM_OPERATOR.siteUrl}/acordo-de-dados`;

type DpaSearch = { lang?: string };

export const Route = createFileRoute("/acordo-de-dados")({
  // `?lang=en` (ou en-US, en-GB, es, pt-PT, pt-BR) abre o acordo nesse idioma, também no servidor.
  validateSearch: (search: Record<string, unknown>): DpaSearch =>
    typeof search.lang === "string" && search.lang.trim() ? { lang: search.lang.trim() } : {},
  // Título e descrição seguem o `?lang=` já no HTML do servidor.
  head: ({ match }) =>
    legalHead({
      lang: match.search.lang,
      pageUrl: PAGE_URL,
      titleKey: "legal.dpaLink",
      descriptionKey: "legal.dpa.metaDescription",
    }),
  component: AcordoDeDadosPage,
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

function AcordoDeDadosPage() {
  const { lang } = Route.useSearch();
  const { t, locale } = useLegalI18n(lang);

  // Mantém o idioma pedido no endereço ao abrir os outros documentos.
  const withLang = (path: string) => (lang ? `${path}?lang=${encodeURIComponent(lang)}` : path);
  const emailLink = (
    <a href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`} className={legalLinkClass}>
      {PLATFORM_OPERATOR.privacyEmail}
    </a>
  );
  const privacyLink = (
    <a href={withLang("/privacidade")} className={legalLinkClass}>
      {t("legal.privacyLink")}
    </a>
  );
  const nodes = {
    app: <strong>Barba &amp; Cabelo</strong>,
    email: emailLink,
    privacy: privacyLink,
    terms: (
      <a href={withLang("/termos")} className={legalLinkClass}>
        {t("legal.termsLink")}
      </a>
    ),
    security: (
      <a href={`${withLang("/privacidade")}#seguranca`} className={legalLinkClass}>
        {t("legal.dpa.s5Link")}
      </a>
    ),
    name: <strong>{PLATFORM_OPERATOR.legalName}</strong>,
    cnpj: <strong>{PLATFORM_OPERATOR.cnpj}</strong>,
  };

  const paragraph = (key: MessageKey) => <p>{legalRichText(t(key), nodes)}</p>;
  const list = (keys: MessageKey[]) => (
    <ul className="list-disc space-y-2 pl-5">
      {keys.map((key) => (
        <li key={key}>{legalRichText(t(key), nodes)}</li>
      ))}
    </ul>
  );

  return (
    <LegalPageShell
      title={t("legal.dpaLink")}
      updatedAt={DPA_VERSION}
      locale={locale}
      langParam={lang}
    >
      {paragraph("legal.dpa.intro")}

      <Section title={t("legal.dpa.s1Title")}>
        {paragraph("legal.dpa.s1Body")}
        {paragraph("legal.dpa.s1Own")}
        {paragraph("legal.dpa.s1Accept")}
      </Section>

      <Section title={t("legal.dpa.s2Title")}>
        {paragraph("legal.dpa.s2Intro")}
        {list(["legal.dpa.s2Item1", "legal.dpa.s2Item2", "legal.dpa.s2Item3"])}
        {paragraph("legal.dpa.s2Body")}
      </Section>

      <Section title={t("legal.dpa.s3Title")}>
        {paragraph("legal.dpa.s3Body")}
        {paragraph("legal.dpa.s3Unlawful")}
      </Section>

      <Section title={t("legal.dpa.s4Title")}>{paragraph("legal.dpa.s4Body")}</Section>

      <Section title={t("legal.dpa.s5Title")}>{paragraph("legal.dpa.s5Body")}</Section>

      <Section title={t("legal.dpa.s6Title")}>
        {paragraph("legal.dpa.s6Intro")}
        {list(["legal.dpa.s6Item1", "legal.dpa.s6Item2", "legal.dpa.s6Item3", "legal.dpa.s6Item4"])}
        {paragraph("legal.dpa.s6Changes")}
      </Section>

      <Section title={t("legal.dpa.s7Title")}>{paragraph("legal.dpa.s7Body")}</Section>

      <Section title={t("legal.dpa.s8Title")}>
        {paragraph("legal.dpa.s8Body")}
        {paragraph("legal.dpa.s8Self")}
      </Section>

      <Section title={t("legal.dpa.s9Title")}>
        {paragraph("legal.dpa.s9Body")}
        {paragraph("legal.dpa.s9Retention")}
      </Section>

      <Section title={t("legal.dpa.s10Title")}>
        {paragraph("legal.dpa.s10Intro")}
        {list([
          "legal.dpa.s10Item1",
          "legal.dpa.s10Item2",
          "legal.dpa.s10Item3",
          "legal.dpa.s10Item4",
          "legal.dpa.s10Item5",
        ])}
      </Section>

      <Section title={t("legal.dpa.s11Title")}>{paragraph("legal.dpa.s11Body")}</Section>

      <Section title={t("legal.dpa.s12Title")}>
        {paragraph("legal.dpa.s12Body")}
        {paragraph("legal.dpa.s12Changes")}
      </Section>
    </LegalPageShell>
  );
}
