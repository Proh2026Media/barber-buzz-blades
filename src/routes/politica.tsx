import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  CheckCircle,
  Crown,
  Gift,
  Info,
  ListChecks,
  LogIn,
  RefreshCw,
  Scissors,
  Store,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconTile, LoadingState, MoreDetails, Notice, StatTile } from "@/components/visual";
import {
  LegalBackButton,
  LegalCourtesyNotice,
  LegalOtherDocs,
  legalHeaderButton,
} from "@/features/legal/LegalPageShell";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { HowSteps } from "@/features/marketing/HowSteps";
import { legalRichText } from "@/features/legal/rich-text";
import { TierBadge } from "@/features/loyalty/TierBadge";
import { parseLoyaltyProgram, tierStyleKey, type LoyaltyProgram } from "@/features/loyalty/program";
import { supabase } from "@/integrations/supabase/client";

type PoliticaSearch = { shop?: string; lang?: string };

function cleanParam(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

export const Route = createFileRoute("/politica")({
  // `?shop=<slug ou id>` mostra a regra real daquela barbearia; `?lang=` escolhe o idioma.
  validateSearch: (search: Record<string, unknown>): PoliticaSearch => {
    const shop = cleanParam(search.shop, 120);
    const lang = cleanParam(search.lang, 12);
    return { ...(shop ? { shop } : {}), ...(lang ? { lang } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Clube de fidelidade — Barba & Cabelo" },
      {
        name: "description",
        content:
          "Como funciona o clube de fidelidade das barbearias no Barba & Cabelo: pontos, níveis e prêmios definidos por cada barbearia.",
      },
    ],
  }),
  component: PoliticaClube,
});

type Corner = "square" | "soft" | "round";

type Access = "ok" | "signedOut" | "noAccess" | "programError";

type LoadState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "notFound" }
  | { status: "error" }
  | {
      status: "ready";
      shopName: string;
      logoUrl: string | null;
      logoBackground: string | null;
      corner: Corner;
      access: Access;
      program: LoyaltyProgram | null;
    };

function parseCorner(value: string | null | undefined): Corner {
  return value === "square" || value === "round" ? value : "soft";
}

/** Carrega o nome da loja (público) e, para quem tem acesso, a regra de fidelidade em vigor. */
function useShopProgram(shopRef: string | undefined, attempt: number): LoadState {
  const [state, setState] = useState<LoadState>(
    shopRef ? { status: "loading" } : { status: "none" },
  );

  useEffect(() => {
    if (!shopRef) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const branding = await supabase.rpc("get_public_shop_branding", { p_shop_ref: shopRef });
        if (cancelled) return;
        if (branding.error) {
          setState({ status: "error" });
          return;
        }
        const row = branding.data?.[0];
        if (!row) {
          setState({ status: "notFound" });
          return;
        }
        const shopName = row.display_name?.trim() || row.shop_name;
        const corner = parseCorner(row.corner_style);
        const logo = {
          logoUrl: row.logo_url ?? null,
          logoBackground: row.logo_background_color ?? null,
        };

        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!sessionData.session) {
          setState({
            status: "ready",
            shopName,
            ...logo,
            corner,
            access: "signedOut",
            program: null,
          });
          return;
        }

        const programResult = await supabase.rpc("get_shop_loyalty_program", {
          p_shop_id: row.shop_id,
        });
        if (cancelled) return;
        if (programResult.error) {
          // 42501 = sem vínculo com a loja; qualquer outro erro é falha de carregamento.
          const access: Access = programResult.error.code === "42501" ? "noAccess" : "programError";
          setState({ status: "ready", shopName, ...logo, corner, access, program: null });
          return;
        }
        setState({
          status: "ready",
          shopName,
          ...logo,
          corner,
          access: "ok",
          program: parseLoyaltyProgram(programResult.data),
        });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopRef, attempt]);

  return state;
}

const cardClass = "public-card rounded-2xl border border-border p-5 shadow-sm";

type T = ReturnType<typeof useLegalI18n>["t"];

/** Título de seção com ícone, no mesmo desenho dos documentos legais. */
function SectionTitle({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-bold leading-snug">
      <IconTile icon={icon} size="sm" tone="muted" />
      {children}
    </h2>
  );
}

function PoliticaClube() {
  const { shop, lang } = Route.useSearch();
  const { t, locale, intlLocale } = useLegalI18n(lang);
  const [attempt, setAttempt] = useState(0);
  const state = useShopProgram(shop, attempt);
  const corner = state.status === "ready" ? state.corner : "soft";
  const program = state.status === "ready" && state.access === "ok" ? state.program : null;
  const shopName = state.status === "ready" ? state.shopName : null;
  const logoUrl = state.status === "ready" ? state.logoUrl : null;
  const logoBackground = state.status === "ready" ? state.logoBackground : null;
  const retry = () => setAttempt((n) => n + 1);
  const originalHref = `?lang=pt-BR${shop ? `&shop=${encodeURIComponent(shop)}` : ""}`;

  return (
    <div
      className={`public-page brand-page brand-corners-${corner} min-h-dvh bg-background pb-10 font-sans text-foreground`}
    >
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {/* Com as regras abertas, volta ao app já na barbearia certa. */}
          <LegalBackButton
            label={t("legal.backShort")}
            to={program ? "/app" : "/"}
            search={program && shop ? { shop } : undefined}
          />
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold">
            <Crown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-2 leading-tight">{t("legal.club.header")}</span>
          </p>
          <LanguageSwitcher locale={locale} showCode buttonClassName={legalHeaderButton} />
          <ThemeToggle buttonClassName={legalHeaderButton} />
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
        <LegalCourtesyNotice locale={locale} originalHref={originalHref} />

        <section className="space-y-3 text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="mx-auto size-16 rounded-2xl border border-border object-contain p-1.5"
              style={{ background: logoBackground || "#f7f5f0" }}
            />
          ) : (
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-muted text-foreground">
              {shopName ? (
                <Store className="size-8" aria-hidden="true" />
              ) : (
                <Crown className="size-8" aria-hidden="true" />
              )}
            </div>
          )}
          {shopName && <p className="text-base font-bold">{shopName}</p>}
          <h1 className="text-2xl font-bold tracking-tight">{t("legal.club.heroTitle")}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {program
              ? t("legal.club.heroBodyShop", { shop: shopName ?? "" })
              : t("legal.club.heroBodyGeneric")}
          </p>
        </section>

        <StatusNotice state={state} shopRef={shop} t={t} onRetry={retry} />

        {program ? (
          program.enabled ? (
            <ShopProgram program={program} t={t} intlLocale={intlLocale} />
          ) : (
            <Notice
              tone="neutral"
              icon={Info}
              role="status"
              title={t("legal.club.disabled", { shop: shopName ?? "" })}
            />
          )
        ) : state.status === "loading" ? null : (
          <GenericProgram t={t} />
        )}

        <section className="space-y-4">
          <SectionTitle icon={ListChecks}>{t("legal.club.termsTitle")}</SectionTitle>
          <ul className={`${cardClass} space-y-3 text-sm leading-relaxed`}>
            {(
              [
                "legal.club.terms1",
                "legal.club.terms2",
                "legal.club.terms3",
                "legal.club.terms4",
              ] as const
            ).map((key) => (
              <li key={key} className="flex gap-3">
                <CheckCircle
                  className="tone-success mt-0.5 size-4 shrink-0 text-[color:var(--tone-ink)]"
                  aria-hidden="true"
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="space-y-4 border-t border-border/60 pt-6">
          <LegalOtherDocs current="club" locale={locale} langParam={lang} />
          <p className="text-center text-xs text-muted-foreground">
            {t("fix.fidelidade-insights.policyFooter", { year: new Date().getFullYear() })}
          </p>
        </footer>
      </main>
    </div>
  );
}

function StatusNotice({
  state,
  shopRef,
  t,
  onRetry,
}: {
  state: LoadState;
  shopRef: string | undefined;
  t: T;
  onRetry: () => void;
}) {
  if (state.status === "none") return null;
  if (state.status === "loading") {
    return (
      <LoadingState label={t("legal.club.loading")} variant="cards" count={2} onRetry={onRetry} />
    );
  }
  if (state.status === "notFound") {
    return <Notice tone="neutral" icon={Store} title={t("legal.club.shopNotFound")} />;
  }
  if (state.status === "error" || (state.status === "ready" && state.access === "programError")) {
    return (
      <Notice
        tone="danger"
        title={t("legal.club.loadError")}
        action={{ label: t("legal.club.retry"), onClick: onRetry, icon: RefreshCw }}
      />
    );
  }
  if (state.access === "signedOut") {
    return (
      <div className={`${cardClass} space-y-3`}>
        <p className="flex gap-3 text-sm leading-relaxed">
          <LogIn className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t("legal.club.signInHint", { shop: state.shopName })}</span>
        </p>
        <Link
          to="/auth"
          search={{
            next: `/politica?shop=${encodeURIComponent(shopRef ?? "")}`,
            ...(shopRef ? { shop: shopRef } : {}),
          }}
          className="action-button action-confirm min-h-12 w-full"
        >
          <LogIn aria-hidden="true" />
          {t("legal.club.signIn")}
        </Link>
      </div>
    );
  }
  if (state.access === "noAccess") {
    return (
      <Notice
        tone="neutral"
        icon={Info}
        title={t("legal.club.noAccess", { shop: state.shopName })}
      />
    );
  }
  return null;
}

/** Números no formato do idioma da página (1.500 / 1,500), e não no do navegador. */
type Fmt = (n: number) => string;

function pointsLabel(t: T, fmt: Fmt, n: number) {
  return t(n === 1 ? "legal.club.pointsOne" : "legal.club.pointsMany", { n: fmt(n) });
}

function ShopProgram({
  program,
  t,
  intlLocale,
}: {
  program: LoyaltyProgram;
  t: T;
  intlLocale: string;
}) {
  const fmt: Fmt = (n) => n.toLocaleString(intlLocale);
  const rewards = program.rewards
    .filter((reward) => reward.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.cost_points - b.cost_points);
  const tiers = program.tiers;
  return (
    <>
      <section className="space-y-4">
        <SectionTitle icon={Trophy}>{t("legal.club.earnTitle")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            className="public-card"
            icon={Trophy}
            value={t("legal.club.plusPoints", { n: fmt(program.points_per_visit) })}
            label={t("legal.club.perVisitStat")}
          />
          {program.welcome_bonus > 0 && (
            <StatTile
              className="public-card"
              icon={Gift}
              value={t("legal.club.plusPoints", { n: fmt(program.welcome_bonus) })}
              label={t("legal.club.welcomeStat")}
            />
          )}
        </div>
        {/* À vista: os números e a nota; a frase completa fica recolhida em "Como funciona". */}
        <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {program.mode === "custom" ? t("legal.club.modeCustom") : t("legal.club.modeDefault")}
          </p>
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("legal.club.earnNote")}</span>
          </p>
          <MoreDetails>
            <p>
              {legalRichText(t("legal.club.perVisit"), {
                points: <strong>{pointsLabel(t, fmt, program.points_per_visit)}</strong>,
              })}
              {program.welcome_bonus > 0 && (
                <>
                  {" "}
                  {legalRichText(t("legal.club.welcome"), {
                    points: <strong>{pointsLabel(t, fmt, program.welcome_bonus)}</strong>,
                  })}
                </>
              )}
            </p>
          </MoreDetails>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Crown}>{t("legal.club.tiersTitle")}</SectionTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.club.tiersBody")}</p>
        {tiers.length > 1 && (
          // Escada de níveis: uma faixa por nível no gradiente aprovado, com o marco de pontos.
          <div aria-hidden="true" className="flex gap-1">
            {tiers.map((tier, index) => (
              <div key={`${tier.name}-${tier.min_points}`} className="min-w-0 flex-1 space-y-1">
                <div
                  className={`mb-loyalty-tier-mark mb-loyalty-tier-${tierStyleKey(index, tiers.length)} h-3 rounded-full border`}
                />
                <p className="truncate text-[11px] font-bold tabular-nums text-muted-foreground">
                  {fmt(tier.min_points)}
                </p>
              </div>
            ))}
          </div>
        )}
        <ol className="space-y-2">
          {tiers.map((tier, index) => {
            const next = tiers[index + 1] ?? null;
            return (
              <li
                key={`${tier.name}-${tier.min_points}`}
                className="public-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border p-4"
              >
                <TierBadge tier={tierStyleKey(index, tiers.length)} name={tier.name} size="lg" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {next
                    ? t("legal.club.range", {
                        from: fmt(tier.min_points),
                        to: fmt(next.min_points - 1),
                      })
                    : t("legal.club.rangeTop", { from: fmt(tier.min_points) })}
                </span>
                {tier.benefit.trim() && (
                  <p className="w-full break-words text-sm leading-relaxed">{tier.benefit}</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="space-y-4">
        <SectionTitle icon={Gift}>{t("legal.club.rewardsTitle")}</SectionTitle>
        {rewards.length === 0 ? (
          <p className={`${cardClass} text-sm leading-relaxed text-muted-foreground`}>
            {t("legal.club.rewardsEmpty")}
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("legal.club.rewardsBody")}
            </p>
            <ul className="space-y-2">
              {rewards.map((reward) => (
                <li key={reward.id} className={`${cardClass} flex items-start gap-3 p-4`}>
                  <IconTile icon={Gift} size="sm" tone="muted" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{reward.name}</p>
                    {reward.description && (
                      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold tabular-nums text-primary-foreground">
                    {pointsLabel(t, fmt, reward.cost_points)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

/** Sem barbearia: a ideia do clube em 4 passos (atendimento → pontos → nível → prêmio). */
function GenericProgram({ t }: { t: T }) {
  return (
    <section className="space-y-4">
      <SectionTitle icon={Trophy}>{t("legal.club.generalTitle")}</SectionTitle>
      <div className={cardClass}>
        <HowSteps
          orientation="vertical"
          label={t("legal.club.generalTitle")}
          steps={[
            { label: t("legal.club.flow1"), icon: Scissors },
            {
              label: t("legal.club.flow2"),
              icon: Trophy,
              description: t("legal.club.generalEarn"),
            },
            {
              label: t("legal.club.flow3"),
              icon: Crown,
              description: t("legal.club.generalTiers"),
            },
            {
              label: t("legal.club.flow4"),
              icon: Gift,
              description: t("legal.club.generalRewards"),
            },
          ]}
        />
      </div>
      <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("legal.club.generalVaries")}</span>
      </p>
    </section>
  );
}

export default PoliticaClube;
