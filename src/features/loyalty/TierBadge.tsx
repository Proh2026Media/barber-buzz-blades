import { Check, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { tierStyleKey, type LoyaltyProgram } from "./program";
import {
  TIER_STYLES,
  type TierStyle,
  BADGE_SIZE,
  useTierPosition,
  useTierBenefit,
} from "./tier-model";

/** Selo do nível: gradiente do nível, ícone e nome. Um só selo por cartão. */
export function TierBadge({
  tier,
  name,
  size = "md",
  className,
}: {
  tier: TierStyle;
  name: string;
  size?: keyof typeof BADGE_SIZE;
  className?: string;
}) {
  const Icon = TIER_STYLES[tier].icon;
  return (
    <span
      className={cn(
        "mb-loyalty-tier-mark",
        `mb-loyalty-tier-${tier}`,
        "inline-flex max-w-full shrink-0 items-center rounded-[var(--button-radius)] border font-bold leading-tight",
        BADGE_SIZE[size],
        className,
      )}
    >
      <Icon aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

/** Medalha só com o ícone do nível (pontas da barra de progresso, escada de níveis). */
export function TierMedal({
  tier,
  locked = false,
  size = "md",
  className,
}: {
  tier: TierStyle;
  /** Nível ainda não alcançado: cinza, com cadeado. */
  locked?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = locked ? Lock : TIER_STYLES[tier].icon;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border",
        size === "sm" ? "size-7 [&>svg]:size-3.5" : "size-9 [&>svg]:size-4",
        locked
          ? "border-border bg-muted text-muted-foreground"
          : cn("mb-loyalty-tier-mark", `mb-loyalty-tier-${tier}`),
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/**
 * Barra entre o nível atual e o próximo, medida pelo TOTAL GANHO (trocar pontos não derruba o
 * nível). Mostra os dois selos nas pontas e a conta real: "450 de 500 pts ganhos · faltam 50 ≈
 * 1 atendimento" (atendimentos pela regra de pontos da barbearia).
 */
export function LevelProgress({
  program,
  lifetimePoints,
  className,
}: {
  program: LoyaltyProgram;
  lifetimePoints: number;
  className?: string;
}) {
  const { t } = useI18n();
  const position = useTierPosition(program, lifetimePoints);
  const short = t("points.short");

  if (!position.next || !position.nextStyle) {
    return (
      <div className={cn("flex items-center gap-2 text-sm font-semibold", className)}>
        <TierMedal tier={position.style} size="sm" />
        <span className="min-w-0">
          {t("member.maxLevel")}
          <span className="block text-xs font-medium text-muted-foreground">
            {t("member.earnedTotal", { points: lifetimePoints, unit: short })}
          </span>
        </span>
      </div>
    );
  }

  const target = position.next.min_points;
  const remaining = position.pointsToNext;
  const perVisit = program.points_per_visit;
  const visits = perVisit > 0 ? Math.ceil(remaining / perVisit) : 0;
  const caption = t("member.earnedOf", { earned: lifetimePoints, target, unit: short });
  const missing = t(remaining === 1 ? "member.missingOne" : "member.missingMany", {
    points: remaining,
    name: position.next.name,
  });
  const visitsText =
    visits > 0 ? t(visits === 1 ? "member.visitsOne" : "member.visitsMany", { count: visits }) : "";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <TierMedal tier={position.style} size="sm" />
        <div
          role="progressbar"
          aria-label={t("member.progressAria", { name: position.next.name })}
          aria-valuemin={position.tier.min_points}
          aria-valuemax={target}
          aria-valuenow={Math.min(lifetimePoints, target)}
          aria-valuetext={`${caption} · ${missing}`}
          className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-border bg-muted"
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-foreground"
            style={{ width: `${Math.max(4, position.progress)}%` }}
          />
        </div>
        <TierMedal tier={position.nextStyle} size="sm" className="opacity-90" />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">{caption}</span>
        <span aria-hidden>·</span>
        <span>{missing}</span>
        {visitsText && (
          <>
            <span aria-hidden>·</span>
            <span>{visitsText}</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Escada de níveis: alcançados com ✓, o atual com anel e "Você está aqui", o próximo com
 * "faltam X" e os seguintes com cadeado. Cada nível mostra a faixa de pontos e o benefício.
 */
export function TierLadder({
  program,
  lifetimePoints,
  className,
}: {
  program: LoyaltyProgram;
  lifetimePoints: number;
  className?: string;
}) {
  const { t } = useI18n();
  const position = useTierPosition(program, lifetimePoints);
  const benefitFor = useTierBenefit(program);
  const total = program.tiers.length;

  return (
    <ol className={cn("space-y-0", className)} aria-label={t("club.levels")}>
      {program.tiers.map((row, index) => {
        const style = tierStyleKey(index, total);
        const state =
          index < position.index ? "reached" : index === position.index ? "current" : "locked";
        const next = program.tiers[index + 1];
        const range = next
          ? t("club.range", { from: row.min_points, to: next.min_points - 1 })
          : t("club.rangeTop", { from: row.min_points });
        const benefit = benefitFor(index);
        const last = index === total - 1;
        const missing = Math.max(0, row.min_points - lifetimePoints);
        return (
          <li
            key={`${row.name}-${index}`}
            aria-current={state === "current" ? "step" : undefined}
            className={cn("relative flex gap-3", !last && "pb-3")}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-[1.125rem] top-9 w-0.5 -translate-x-1/2",
                  state === "locked" ? "bg-border" : "bg-[color:var(--gold)]",
                )}
              />
            )}
            <TierMedal
              tier={style}
              locked={state === "locked"}
              className={cn(
                state === "current" &&
                  "ring-2 ring-[color:var(--gold)] ring-offset-2 ring-offset-card",
              )}
            />
            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl border p-3",
                state === "current"
                  ? "border-[color:var(--gold)] bg-[color:color-mix(in_oklab,var(--gold)_8%,var(--card))]"
                  : "border-border/70",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "min-w-0 text-sm font-bold",
                    state === "locked" && "text-muted-foreground",
                  )}
                >
                  {row.name}
                </span>
                {state === "reached" && (
                  <span className="tone-success inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--tone-ink)]">
                    <Check className="size-3" aria-hidden />
                    {t("club.reached")}
                  </span>
                )}
                {state === "current" && (
                  <span className="inline-flex items-center rounded-[var(--button-radius)] bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">
                    {t("club.youAreHere")}
                  </span>
                )}
                {state === "locked" && (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    <span className="sr-only">{t("club.locked")} · </span>
                    {t(missing === 1 ? "rewards.missingOne" : "rewards.missingMany", {
                      n: missing,
                    })}
                  </span>
                )}
                <span className="ms-auto shrink-0 rounded-[var(--button-radius)] bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {range}
                </span>
              </div>
              {benefit && (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{benefit}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
