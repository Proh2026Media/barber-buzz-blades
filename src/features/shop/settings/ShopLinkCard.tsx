import { Eye, Globe2, Link2, PencilLine } from "lucide-react";
import { CopyField, MoreDetails, SectionHeader } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { PageSketch, PageStatusBadge, type PageBlocks } from "./brand-bits";

/**
 * "Sua página": o link que a barbearia divulga, junto do desenho da página e do selo de como
 * ela aparece (completa ou só a marca). É o mesmo cartão em Aparência e em Link e domínio,
 * para que "qual link eu divulgo?" tenha uma só resposta.
 */
export function ShopLinkCard({
  publicUrl,
  openHref,
  autoUrl,
  landingEnabled,
  blocks,
  photo,
  logoUrl,
  logoBackground,
  primary,
  hideLink,
  onEditPage,
  onOpenDomain,
  className,
}: {
  /** Link da página (origem pública: domínio próprio no ar ou o automático). */
  publicUrl: string;
  /**
   * "Ver como cliente": a página neste mesmo endereço e na mesma aba, sem sair da conta (a
   * barra do topo volta ao painel). O "Abrir link público" do campo abre sempre o link de divulgar.
   */
  openHref?: string;
  /** Link automático da plataforma, mostrado só quando o domínio próprio já está no ar. */
  autoUrl?: string | null;
  landingEnabled: boolean;
  blocks?: PageBlocks;
  photo?: string | null;
  logoUrl?: string | null;
  logoBackground?: string | null;
  primary?: string;
  /** Demonstração: o link real não existe, então não aparece para copiar. */
  hideLink?: boolean;
  onEditPage?: () => void;
  /** Leva à seção do domínio próprio. */
  onOpenDomain?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const appUrl = `${publicUrl.replace(/\/$/, "")}/app`;
  return (
    <section className={`app-action-card space-y-4 p-4 sm:p-5 ${className ?? ""}`}>
      <SectionHeader icon={Link2} title={t("shopLink.title")} />
      {/* Desenho da página + como ela aparece + o que dá para fazer, lado a lado. */}
      <div className="flex items-start gap-3">
        <PageSketch
          full={landingEnabled}
          blocks={blocks}
          photo={photo}
          logoUrl={logoUrl}
          logoBackground={logoBackground}
          primary={primary}
          className="w-24 shrink-0 sm:w-28"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <PageStatusBadge enabled={landingEnabled} />
          {onEditPage && (
            <button
              type="button"
              onClick={onEditPage}
              className="action-button action-edit w-full sm:w-auto"
            >
              <PencilLine aria-hidden />
              {t("shopLink.editPage")}
            </button>
          )}
          {openHref && !hideLink && (
            // Mesma aba: a barra "Abrir painel" da página pública é o caminho de volta.
            <a
              href={openHref}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 sm:w-auto"
            >
              <Eye className="size-4 shrink-0" aria-hidden />
              {t("shopLink.viewAsCustomer")}
            </a>
          )}
          {onOpenDomain && (
            <button
              type="button"
              onClick={onOpenDomain}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 sm:w-auto"
            >
              <Globe2 className="size-4 shrink-0" aria-hidden />
              {t("shopLink.ownDomain")}
            </button>
          )}
        </div>
      </div>
      {hideLink ? (
        <p className="text-sm text-muted-foreground">{t("landingEditor.demoOpen")}</p>
      ) : (
        <CopyField
          label={t("shopLink.forSharing")}
          value={publicUrl}
          href={publicUrl}
          openLabel={t("shopLink.openPublic")}
          shareTitle={t("shopLink.title")}
        />
      )}
      {!hideLink && (
        <MoreDetails summary={t("shopLink.otherLinks")}>
          <div className="space-y-3">
            <CopyField label={t("shopLink.appLink")} value={appUrl} />
            {autoUrl && autoUrl !== publicUrl && (
              <CopyField label={t("shopLink.autoLink")} value={autoUrl} />
            )}
          </div>
        </MoreDetails>
      )}
    </section>
  );
}
