import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import type { MessageKey } from "@/lib/i18n";

/** Versão vigente da política (AAAA-MM-DD). */
const PRIVACY_UPDATED_AT = "2026-10-03";
const GOOGLE_USER_DATA_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
const PAGE_URL = `${PLATFORM_OPERATOR.siteUrl}/privacidade`;

type PrivacySearch = { lang?: string };

export const Route = createFileRoute("/privacidade")({
  // `?lang=en` (ou en-US, en-GB, es, pt-PT, pt-BR) abre a política nesse idioma, também no servidor.
  validateSearch: (search: Record<string, unknown>): PrivacySearch =>
    typeof search.lang === "string" && search.lang.trim() ? { lang: search.lang.trim() } : {},
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Como o Barba & Cabelo trata e protege dados pessoais, inclusive dados obtidos pelas APIs do Google (Privacy Policy available in English with ?lang=en).",
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
  component: PrivacidadePage,
});

const headingClass = "text-lg font-bold text-foreground";
const subheadingClass = "pt-1 text-base font-semibold text-foreground [overflow-wrap:anywhere]";

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className={headingClass}>{title}</h2>
      {children}
    </section>
  );
}

function PrivacidadePage() {
  const { lang } = Route.useSearch();
  const { t, locale } = useLegalI18n(lang);

  const emailLink = (
    <a href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`} className={legalLinkClass}>
      {PLATFORM_OPERATOR.privacyEmail}
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
  const userDataPolicyLink = (
    <a
      href={GOOGLE_USER_DATA_POLICY_URL}
      className={legalLinkClass}
      rel="noopener noreferrer"
      target="_blank"
    >
      {t("legal.privacy.s4LimitedUseLink")}
    </a>
  );
  const nodes = { email: emailLink, link: permissionsLink };

  /** Lista com marcadores; cada item aceita **negrito**, {email} e {link}. */
  const list = (keys: MessageKey[]) => (
    <ul className="list-disc space-y-2 pl-5">
      {keys.map((key) => (
        <li key={key}>{legalRichText(t(key), nodes)}</li>
      ))}
    </ul>
  );
  const paragraph = (key: MessageKey) => <p>{legalRichText(t(key), nodes)}</p>;

  return (
    <LegalPageShell
      title={t("legal.privacyLink")}
      updatedAt={PRIVACY_UPDATED_AT}
      locale={locale}
      langParam={lang}
    >
      <Section title={t("legal.privacy.s1Title")}>
        <p>
          {legalRichText(t("legal.privacy.s1Intro"), {
            app: <strong>Barba &amp; Cabelo</strong>,
            site: (
              <a href={PLATFORM_OPERATOR.siteUrl} className={legalLinkClass}>
                beauty.contheiner.digital
              </a>
            ),
          })}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {legalRichText(t("legal.privacy.legalName"), {
              value: <strong>{PLATFORM_OPERATOR.legalName}</strong>,
            })}
          </li>
          <li>
            {legalRichText(t("legal.privacy.cnpj"), {
              value: <strong>{PLATFORM_OPERATOR.cnpj}</strong>,
            })}
          </li>
          <li>{legalRichText(t("legal.privacy.contactEmail"), { email: emailLink })}</li>
          <li>{legalRichText(t("legal.privacy.s1Dpo"), { email: emailLink })}</li>
        </ul>
        {paragraph("legal.privacy.s1Roles")}
        {paragraph("legal.privacy.s1Body")}
      </Section>

      <Section title={t("legal.privacy.s2Title")}>
        <p>{t("legal.privacy.s2Intro")}</p>
        {list([
          "legal.privacy.s2Item1",
          "legal.privacy.s2Item2",
          "legal.privacy.s2Item3",
          "legal.privacy.s2Item4",
          "legal.privacy.s2Item5",
          "legal.privacy.s2Item6",
          "legal.privacy.s2Item7",
        ])}
        {paragraph("legal.privacy.s2Body")}
      </Section>

      <Section title={t("legal.privacy.s3Title")}>
        <p>{t("legal.privacy.s3Intro")}</p>
        {list([
          "legal.privacy.s3Item1",
          "legal.privacy.s3Item2",
          "legal.privacy.s3Item3",
          "legal.privacy.s3Item4",
        ])}
        {paragraph("legal.privacy.s3Body")}
      </Section>

      <Section id="dados-google" title={t("legal.privacy.s4Title")}>
        <p>{t("legal.privacy.s4Intro")}</p>
        <h3 className={subheadingClass}>{t("legal.privacy.s4LoginTitle")}</h3>
        {paragraph("legal.privacy.s4LoginBody")}
        <h3 className={subheadingClass}>{t("legal.privacy.s4CalendarTitle")}</h3>
        {list([
          "legal.privacy.s4CalendarItem1",
          "legal.privacy.s4CalendarItem2",
          "legal.privacy.s4CalendarItem3",
        ])}
        <h3 className={subheadingClass}>{t("legal.privacy.s4ContactsTitle")}</h3>
        {paragraph("legal.privacy.s4ContactsBody")}
        {paragraph("legal.privacy.s4TokensBody")}
        <h3 className={subheadingClass}>{t("legal.privacy.s4ProtectTitle")}</h3>
        {list([
          "legal.privacy.s4Protect1",
          "legal.privacy.s4Protect2",
          "legal.privacy.s4Protect3",
          "legal.privacy.s4Protect4",
          "legal.privacy.s4Protect5",
          "legal.privacy.s4Protect6",
        ])}
        <h3 className={subheadingClass}>{t("legal.privacy.s4CommitTitle")}</h3>
        {list([
          "legal.privacy.s4Commit1",
          "legal.privacy.s4Commit2",
          "legal.privacy.s4Commit3",
          "legal.privacy.s4Commit4",
          "legal.privacy.s4Commit5",
        ])}
        <p className="rounded-[var(--control-radius)] border border-border/60 bg-card px-4 py-3">
          {legalRichText(t("legal.privacy.s4LimitedUse"), { link: userDataPolicyLink })}
        </p>
        {paragraph("legal.privacy.s4Revoke")}
      </Section>

      <Section id="seguranca" title={t("legal.privacy.s5Title")}>
        <p>{t("legal.privacy.s5Intro")}</p>
        {list([
          "legal.privacy.s5Item1",
          "legal.privacy.s5Item2",
          "legal.privacy.s5Item3",
          "legal.privacy.s5Item4",
          "legal.privacy.s5Item5",
          "legal.privacy.s5Item6",
          "legal.privacy.s5Item7",
          "legal.privacy.s5Item8",
          "legal.privacy.s5Item9",
          "legal.privacy.s5Item10",
        ])}
        {paragraph("legal.privacy.s5Staff")}
        {paragraph("legal.privacy.s5Incident")}
        {paragraph("legal.privacy.s5Limit")}
      </Section>

      <Section title={t("legal.privacy.s6Title")}>
        <p>{t("legal.privacy.s6Intro")}</p>
        {list([
          "legal.privacy.s6Item1",
          "legal.privacy.s6Item2",
          "legal.privacy.s6Item3",
          "legal.privacy.s6Item4",
          "legal.privacy.s6Item5",
          "legal.privacy.s6Item6",
        ])}
        {paragraph("legal.privacy.s6Body")}
      </Section>

      <Section title={t("legal.privacy.s7Title")}>{paragraph("legal.privacy.s7Body")}</Section>

      <Section title={t("legal.privacy.s8Title")}>
        {list([
          "legal.privacy.s8Item1",
          "legal.privacy.s8Item2",
          "legal.privacy.s8Item3",
          "legal.privacy.s8Item4",
          "legal.privacy.s8Item5",
          "legal.privacy.s8Item6",
        ])}
      </Section>

      <Section title={t("legal.privacy.s9Title")}>
        <p>{t("legal.privacy.s9Intro")}</p>
        {list(["legal.privacy.s9Item1", "legal.privacy.s9Item2", "legal.privacy.s9Item3"])}
        {paragraph("legal.privacy.s9Body")}
      </Section>

      <Section title={t("legal.privacy.s10Title")}>
        <p>{t("legal.privacy.s10Intro")}</p>
        {list([
          "legal.privacy.s10Item1",
          "legal.privacy.s10Item2",
          "legal.privacy.s10Item3",
          "legal.privacy.s10Item4",
          "legal.privacy.s10Item5",
          "legal.privacy.s10Item6",
          "legal.privacy.s10Item7",
        ])}
        {paragraph("legal.privacy.s10How")}
        {paragraph("legal.privacy.s10Anpd")}
      </Section>

      <Section title={t("legal.privacy.s11Title")}>
        {list([
          "legal.privacy.s11Item1",
          "legal.privacy.s11Item2",
          "legal.privacy.s11Item3",
          "legal.privacy.s11Item4",
          "legal.privacy.s11Item5",
        ])}
      </Section>

      <Section title={t("legal.privacy.s12Title")}>{paragraph("legal.privacy.s12Body")}</Section>

      <Section title={t("legal.privacy.s13Title")}>{paragraph("legal.privacy.s13Body")}</Section>
    </LegalPageShell>
  );
}
