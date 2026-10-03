import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Armchair,
  BadgeCheck,
  CheckCircle,
  ChevronLeft,
  Crown,
  Diamond,
  Gift,
  Info,
  Loader2,
  LogIn,
  RefreshCw,
  Sparkle,
  Store,
  Trophy,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LegalCourtesyNotice } from "@/features/legal/LegalPageShell";
import { useLegalI18n } from "@/features/legal/legal-locale";
import { legalRichText } from "@/features/legal/rich-text";
import {
  parseLoyaltyProgram,
  tierStyleKey,
  type LoyaltyProgram,
  type LoyaltyTier,
} from "@/features/loyalty/program";
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

        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!sessionData.session) {
          setState({ status: "ready", shopName, corner, access: "signedOut", program: null });
          return;
        }

        const programResult = await supabase.rpc("get_shop_loyalty_program", {
          p_shop_id: row.shop_id,
        });
        if (cancelled) return;
        if (programResult.error) {
          // 42501 = sem vínculo com a loja; qualquer outro erro é falha de carregamento.
          const access: Access = programResult.error.code === "42501" ? "noAccess" : "programError";
          setState({ status: "ready", shopName, corner, access, program: null });
          return;
        }
        setState({
          status: "ready",
          shopName,
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

const TIER_STYLES = {
  classic: { icon: Armchair, text: "text-gradient-silver", badge: "bg-silver-metallic text-black" },
  select: {
    icon: BadgeCheck,
    text: "text-gradient-bronze",
    badge: "bg-bronze-metallic text-white",
  },
  privilege: { icon: Sparkle, text: "text-gradient-gold", badge: "bg-gold-metallic text-black" },
  exclusive: {
    icon: Diamond,
    text: "text-gradient-hologram",
    badge: "bg-hologram-metallic text-black",
  },
} as const;

const cardClass =
  "rounded-[var(--panel-radius)] border border-border/70 bg-card p-5 text-card-foreground shadow-sm";
const iconButtonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--control-radius)] border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const actionButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] px-4 text-sm font-semibold transition-colors";

type T = ReturnType<typeof useLegalI18n>["t"];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1 w-8 rounded-full bg-primary" aria-hidden="true" />
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-primary">{children}</h2>
    </div>
  );
}

function PoliticaClube() {
  const { shop, lang } = Route.useSearch();
  const { t, locale } = useLegalI18n(lang);
  const [attempt, setAttempt] = useState(0);
  const state = useShopProgram(shop, attempt);
  const corner = state.status === "ready" ? state.corner : "soft";
  const program = state.status === "ready" && state.access === "ok" ? state.program : null;
  const shopName = state.status === "ready" ? state.shopName : null;
  const retry = () => setAttempt((n) => n + 1);

  return (
    <div
      className={`brand-corners-${corner} min-h-dvh bg-background pb-10 font-sans text-foreground`}
    >
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            to={program ? "/app" : "/"}
            className={iconButtonClass}
            aria-label={t("legal.back")}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <p className="min-w-0 truncate text-sm font-bold">{t("legal.club.header")}</p>
          <div className="flex items-center gap-2">
            <LanguageSwitcher buttonClassName={iconButtonClass} />
            <ThemeToggle buttonClassName={iconButtonClass} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
        <LegalCourtesyNotice locale={locale} />

        <section className="space-y-3 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[var(--panel-radius)] border border-primary/20 bg-primary/10 text-primary">
            <Crown className="size-8" aria-hidden="true" />
          </div>
          {shopName && (
            <p className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Store className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{shopName}</span>
            </p>
          )}
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
            <ShopProgram program={program} t={t} />
          ) : (
            <p role="status" className={`${cardClass} flex gap-3 text-sm leading-relaxed`}>
              <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{t("legal.club.disabled", { shop: shopName ?? "" })}</span>
            </p>
          )
        ) : state.status === "loading" ? null : (
          <GenericProgram t={t} />
        )}

        <section className="space-y-4">
          <SectionTitle>{t("legal.club.termsTitle")}</SectionTitle>
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
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="space-y-3 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4"
            aria-label={t("legal.navAria")}
          >
            <Link
              to="/termos"
              className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {t("legal.termsLink")}
            </Link>
            <Link
              to="/privacidade"
              className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {t("legal.privacyLink")}
            </Link>
          </nav>
          <p>{t("fix.fidelidade-insights.policyFooter", { year: new Date().getFullYear() })}</p>
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
      <p
        role="status"
        className={`${cardClass} flex items-center gap-3 text-sm text-muted-foreground`}
      >
        <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
        {t("legal.club.loading")}
      </p>
    );
  }
  if (state.status === "notFound") {
    return <Notice icon={Info} text={t("legal.club.shopNotFound")} />;
  }
  if (state.status === "error" || (state.status === "ready" && state.access === "programError")) {
    return (
      <div role="alert" className={`${cardClass} space-y-3`}>
        <p className="flex gap-3 text-sm leading-relaxed">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <span>{t("legal.club.loadError")}</span>
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={`${actionButtonClass} w-full bg-foreground text-background hover:opacity-90`}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("legal.club.retry")}
        </button>
      </div>
    );
  }
  if (state.access === "signedOut") {
    return (
      <div className={`${cardClass} space-y-3`}>
        <p className="flex gap-3 text-sm leading-relaxed">
          <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t("legal.club.signInHint", { shop: state.shopName })}</span>
        </p>
        <Link
          to="/auth"
          search={{
            next: `/politica?shop=${encodeURIComponent(shopRef ?? "")}`,
            ...(shopRef ? { shop: shopRef } : {}),
          }}
          className={`${actionButtonClass} w-full bg-foreground text-background hover:opacity-90`}
        >
          <LogIn className="size-4" aria-hidden="true" />
          {t("legal.club.signIn")}
        </Link>
      </div>
    );
  }
  if (state.access === "noAccess") {
    return <Notice icon={Info} text={t("legal.club.noAccess", { shop: state.shopName })} />;
  }
  return null;
}

function Notice({ icon: Icon, text }: { icon: typeof Info; text: string }) {
  return (
    <p role="status" className={`${cardClass} flex gap-3 text-sm leading-relaxed`}>
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

function pointsLabel(t: T, n: number) {
  return t(n === 1 ? "legal.club.pointsOne" : "legal.club.pointsMany", { n });
}

function ShopProgram({ program, t }: { program: LoyaltyProgram; t: T }) {
  const rewards = program.rewards
    .filter((reward) => reward.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.cost_points - b.cost_points);
  return (
    <>
      <section className="space-y-4">
        <SectionTitle>{t("legal.club.earnTitle")}</SectionTitle>
        <div className={`${cardClass} space-y-3 text-sm leading-relaxed`}>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            {program.mode === "custom" ? t("legal.club.modeCustom") : t("legal.club.modeDefault")}
          </p>
          <p className="flex gap-3">
            <Trophy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {legalRichText(t("legal.club.perVisit"), {
                points: <strong>{pointsLabel(t, program.points_per_visit)}</strong>,
              })}
            </span>
          </p>
          {program.welcome_bonus > 0 && (
            <p className="flex gap-3">
              <Gift className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {legalRichText(t("legal.club.welcome"), {
                  points: <strong>{pointsLabel(t, program.welcome_bonus)}</strong>,
                })}
              </span>
            </p>
          )}
          <p className="text-muted-foreground">{t("legal.club.earnNote")}</p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>{t("legal.club.tiersTitle")}</SectionTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("legal.club.tiersBody")}</p>
        <ol className="space-y-3">
          {program.tiers.map((tier, index) => (
            <TierCard
              key={`${tier.name}-${tier.min_points}`}
              tier={tier}
              next={program.tiers[index + 1] ?? null}
              styleKey={tierStyleKey(index, program.tiers.length)}
              t={t}
            />
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <SectionTitle>{t("legal.club.rewardsTitle")}</SectionTitle>
        {rewards.length === 0 ? (
          <p className={`${cardClass} text-sm leading-relaxed text-muted-foreground`}>
            {t("legal.club.rewardsEmpty")}
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("legal.club.rewardsBody")}
            </p>
            <ul className="space-y-3">
              {rewards.map((reward) => (
                <li key={reward.id} className={`${cardClass} flex items-start gap-3`}>
                  <Gift className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{reward.name}</p>
                    {reward.description && (
                      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    {pointsLabel(t, reward.cost_points)}
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

function TierCard({
  tier,
  next,
  styleKey,
  t,
}: {
  tier: LoyaltyTier;
  next: LoyaltyTier | null;
  styleKey: keyof typeof TIER_STYLES;
  t: T;
}) {
  const style = TIER_STYLES[styleKey];
  const Icon = style.icon;
  return (
    <li className={cardClass}>
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-[var(--control-radius)] border border-white/20 shadow-inner ${style.badge}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`break-words text-base font-bold ${style.text}`}>{tier.name}</h3>
          <p className="text-xs font-semibold text-muted-foreground">
            {next
              ? t("legal.club.range", { from: tier.min_points, to: next.min_points - 1 })
              : t("legal.club.rangeTop", { from: tier.min_points })}
          </p>
        </div>
      </div>
      {tier.benefit.trim() && (
        <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
          {tier.benefit}
        </p>
      )}
    </li>
  );
}

function GenericProgram({ t }: { t: T }) {
  const items = [
    { icon: Trophy, key: "legal.club.generalEarn" },
    { icon: Crown, key: "legal.club.generalTiers" },
    { icon: Gift, key: "legal.club.generalRewards" },
  ] as const;
  return (
    <section className="space-y-4">
      <SectionTitle>{t("legal.club.generalTitle")}</SectionTitle>
      <ul className="space-y-3">
        {items.map(({ icon: Icon, key }) => (
          <li key={key} className={`${cardClass} flex gap-3 text-sm leading-relaxed`}>
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <p
        role="note"
        className="flex gap-3 rounded-[var(--control-radius)] border border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("legal.club.generalVaries")}</span>
      </p>
    </section>
  );
}

export default PoliticaClube;
