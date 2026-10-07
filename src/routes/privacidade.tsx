import { createFileRoute } from "@tanstack/react-router";
import {
  Cpu,
  Database,
  Info,
  KeyRound,
  Scale,
  Target,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { IconTile } from "@/components/visual";
import { LegalPageShell, LegalSection as Section } from "@/features/legal/LegalPageShell";
import { LegalRolesDiagram } from "@/features/legal/LegalVisuals";
import { legalHead } from "@/features/legal/legal-head";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import { PRIVACY_VERSION } from "@/features/legal/versions";
import type { MessageKey } from "@/lib/i18n";

const GOOGLE_USER_DATA_POLICY_URL =
  "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";
const PAGE_URL = `${PLATFORM_OPERATOR.siteUrl}/privacidade`;

type PrivacySearch = { lang?: string };

export const Route = createFileRoute("/privacidade")({
  // `?lang=en` (ou en-US, en-GB, es, pt-PT, pt-BR) abre a política nesse idioma, também no servidor.
  validateSearch: (search: Record<string, unknown>): PrivacySearch =>
    typeof search.lang === "string" && search.lang.trim() ? { lang: search.lang.trim() } : {},
  // Título e descrição seguem o `?lang=` já no HTML do servidor.
  head: ({ match }) =>
    legalHead({
      lang: match.search.lang,
      pageUrl: PAGE_URL,
      titleKey: "legal.privacyLink",
      descriptionKey: "legal.privacy.metaDescription",
    }),
  component: PrivacidadePage,
});

const subheadingClass = "pt-1 text-base font-semibold text-foreground";

/**
 * Subtítulo da parte do Google: o nome do serviço em destaque e o escopo técnico entre
 * parênteses em letra monoespaçada menor, para o leigo ver que pode pular (texto igual).
 */
function TechTitle({ text }: { text: string }) {
  const match = /^(.*?)\s*(\(.*\))$/.exec(text);
  return (
    <h3 className={subheadingClass}>
      {match ? (
        <>
          {match[1]}{" "}
          <span className="block break-all font-mono text-xs font-normal text-muted-foreground">
            {match[2]}
          </span>
        </>
      ) : (
        text
      )}
    </h3>
  );
}

/** "Em resumo": atalhos com ícone para as partes que mais importam; o texto completo vale. */
const SUMMARY: { icon: LucideIcon; key: MessageKey; target: string; part: number }[] = [
  { icon: UserCheck, key: "legal.summary.who", target: "parte-1", part: 1 },
  { icon: Database, key: "legal.summary.what", target: "parte-2", part: 2 },
  { icon: Target, key: "legal.summary.why", target: "parte-3", part: 3 },
  { icon: KeyRound, key: "legal.summary.google", target: "dados-google", part: 4 },
  { icon: Scale, key: "legal.summary.rights", target: "parte-10", part: 10 },
  { icon: UserX, key: "legal.summary.delete", target: "parte-11", part: 11 },
];

function PrivacidadePage() {
  const { lang } = Route.useSearch();
  const { t, locale } = useLegalI18n(lang);

  const emailLink = (
    <a
      href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`}
      className={`${legalLinkClass} whitespace-nowrap`}
    >
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
  const dpaLink = (
    <a
      href={lang ? `/acordo-de-dados?lang=${encodeURIComponent(lang)}` : "/acordo-de-dados"}
      className={legalLinkClass}
    >
      {t("legal.dpaLink")}
    </a>
  );
  const nodes = { email: emailLink, link: permissionsLink, dpa: dpaLink };

  /** Lista com marcadores; cada item aceita **negrito**, {email}, {link} e {dpa}. */
  const list = (keys: MessageKey[]) => (
    <ul className="list-disc space-y-2 pl-5">
      {keys.map((key) => (
        <li key={key}>{legalRichText(t(key), nodes)}</li>
      ))}
    </ul>
  );
  const paragraph = (key: MessageKey) => <p>{legalRichText(t(key), nodes)}</p>;

  const summary = (
    <section aria-labelledby="privacy-summary" className="space-y-3">
      <h2 id="privacy-summary" className="text-lg font-bold">
        {t("legal.summaryTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SUMMARY.map(({ icon, key, target, part }) => (
          <li key={key}>
            <a
              href={`#${target}`}
              className="public-card flex h-full min-h-16 items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconTile icon={icon} size="sm" tone="muted" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug">{t(key)}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("legal.summaryPart", { n: part })}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {t("legal.summaryNote")}
      </p>
    </section>
  );

  return (
    <LegalPageShell
      doc="privacy"
      title={t("legal.privacyLink")}
      updatedAt={PRIVACY_VERSION}
      locale={locale}
      langParam={lang}
      summary={summary}
    >
      <Section title={t("legal.privacy.s1Title")}>
        <LegalRolesDiagram t={t} withAccount />
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
              value: <strong className="whitespace-nowrap">{PLATFORM_OPERATOR.cnpj}</strong>,
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
          "legal.privacy.s2Item8",
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
        <div className="public-card space-y-3 rounded-2xl border border-border p-4">
          <p className="flex items-center gap-3 font-bold">
            <IconTile icon={Cpu} size="sm" tone="muted" />
            {t("legal.techDetails")}
          </p>
          <TechTitle text={t("legal.privacy.s4LoginTitle")} />
          {paragraph("legal.privacy.s4LoginBody")}
          <TechTitle text={t("legal.privacy.s4CalendarTitle")} />
          {list([
            "legal.privacy.s4CalendarItem1",
            "legal.privacy.s4CalendarItem2",
            "legal.privacy.s4CalendarItem3",
          ])}
          <TechTitle text={t("legal.privacy.s4ContactsTitle")} />
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
          <p className="rounded-xl border border-border bg-muted px-4 py-3">
            {legalRichText(t("legal.privacy.s4LimitedUse"), { link: userDataPolicyLink })}
          </p>
        </div>
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
          "legal.privacy.s6ItemPostalCode",
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
