import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Como o Barba & Cabelo trata dados pessoais, inclusive informações obtidas via APIs do Google.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  const { t } = useI18n();
  const emailLink = (
    <a href={`mailto:${PLATFORM_OPERATOR.privacyEmail}`} className={legalLinkClass}>
      {PLATFORM_OPERATOR.privacyEmail}
    </a>
  );
  return (
    <LegalPageShell title={t("legal.privacyLink")} updatedAt="2026-09-24">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s1Title")}</h2>
        <p>
          {legalRichText(t("legal.privacy.s1Intro"), {
            app: <strong>Barba &amp; Cabelo</strong>,
            site: (
              <a href="https://beauty.contheiner.digital" className={legalLinkClass}>
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
        </ul>
        <p>{t("legal.privacy.s1Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s2Title")}</h2>
        <p>{t("legal.privacy.s2Intro")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{legalRichText(t("legal.privacy.s2Item1"))}</li>
          <li>{legalRichText(t("legal.privacy.s2Item2"))}</li>
          <li>{legalRichText(t("legal.privacy.s2Item3"))}</li>
          <li>{legalRichText(t("legal.privacy.s2Item4"))}</li>
          <li>{legalRichText(t("legal.privacy.s2Item5"))}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s3Title")}</h2>
        <p>{t("legal.privacy.s3Intro")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{legalRichText(t("legal.privacy.s3Item1"))}</li>
          <li>{legalRichText(t("legal.privacy.s3Item2"))}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s4Title")}</h2>
        <p>{legalRichText(t("legal.privacy.s4Body1"))}</p>
        <p>{t("legal.privacy.s4Body2")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s5Title")}</h2>
        <p>{t("legal.privacy.s5Body1")}</p>
        <p>{t("legal.privacy.s5Body2")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s6Title")}</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>{legalRichText(t("legal.privacy.s6Item1"))}</li>
          <li>{legalRichText(t("legal.privacy.s6Item2"))}</li>
          <li>{legalRichText(t("legal.privacy.s6Item3"))}</li>
          <li>
            {legalRichText(t("legal.privacy.s6Item4"), {
              link: (
                <a
                  href="https://myaccount.google.com/permissions"
                  className={legalLinkClass}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  myaccount.google.com/permissions
                </a>
              ),
            })}
          </li>
          <li>{legalRichText(t("legal.privacy.s6Item5"), { email: emailLink })}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.privacy.s7Title")}</h2>
        <p>{t("legal.privacy.s7Body")}</p>
      </section>
    </LegalPageShell>
  );
}
