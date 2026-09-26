import { createFileRoute } from "@tanstack/react-router";
import { LegalPageShell } from "@/features/legal/LegalPageShell";
import { PLATFORM_OPERATOR } from "@/features/legal/operator";
import { legalLinkClass, legalRichText } from "@/features/legal/rich-text";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Termos de uso do aplicativo Barba & Cabelo para barbearias, profissionais e clientes.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const { t } = useI18n();
  return (
    <LegalPageShell title={t("legal.termsLink")} updatedAt="2026-09-24">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s1Title")}</h2>
        <p>
          {legalRichText(t("legal.terms.s1Body"), {
            app: <strong>Barba &amp; Cabelo</strong>,
            site: (
              <a href="https://beauty.contheiner.digital" className={legalLinkClass}>
                beauty.contheiner.digital
              </a>
            ),
            privacy: (
              <a href="/privacidade" className={legalLinkClass}>
                {t("legal.privacyLink")}
              </a>
            ),
          })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s2Title")}</h2>
        <p>{t("legal.terms.s2Body1")}</p>
        <p>{t("legal.terms.s2Body2")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s3Title")}</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("legal.terms.s3Item1")}</li>
          <li>{t("legal.terms.s3Item2")}</li>
          <li>{t("legal.terms.s3Item3")}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s4Title")}</h2>
        <p>{t("legal.terms.s4Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s5Title")}</h2>
        <p>{t("legal.terms.s5Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s6Title")}</h2>
        <p>{t("legal.terms.s6Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">{t("legal.terms.s7Title")}</h2>
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
      </section>
    </LegalPageShell>
  );
}
