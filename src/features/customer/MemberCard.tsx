import {
  ChevronRight,
  Coins,
  Gift,
  Info,
  Receipt,
  Ticket,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { CountBadge } from "@/components/visual";
import {
  LevelProgress,
  TIER_STYLES,
  TierBadge,
  useTierPosition,
} from "@/features/loyalty/TierBadge";
import type { PendingRedemption } from "@/features/loyalty/usePendingRedemptions";
import type { LoyaltyProgram } from "@/features/loyalty/program";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Cartão de membro único: quem é, em que nível está, quanto tem para trocar, quanto já ganhou
 * (o que define o nível), quanto falta para o próximo e o que dá para fazer com os pontos.
 * Junta o que antes ficava em três cartões (membro, próximo nível e extrato).
 *
 * `home`: com os atalhos (trocar, extrato, como funciona) e o prêmio esperando retirada.
 * `summary`: topo de Meus pontos, só com "Como funciona".
 */
export function MemberCard({
  name,
  program,
  points,
  lifetimePoints,
  pending = [],
  variant = "home",
  onOpenRewards,
  onOpenHistory,
  onOpenClub,
  className,
}: {
  name: string;
  program: LoyaltyProgram;
  points: number;
  lifetimePoints: number;
  pending?: PendingRedemption[];
  variant?: "home" | "summary";
  onOpenRewards?: () => void;
  onOpenHistory?: () => void;
  onOpenClub: () => void;
  className?: string;
}) {
  const { t, intlLocale } = useI18n();
  const position = useTierPosition(program, lifetimePoints);
  const short = t("points.short");
  const available = program.rewards.filter(
    (reward) => reward.active && reward.cost_points <= points,
  ).length;
  const hasRewards = program.rewards.some((reward) => reward.active);
  const shortDate = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit" });
  const home = variant === "home";

  return (
    <section
      aria-labelledby="member-card-name"
      className={cn(
        "app-action-card mb-loyalty-contrast-card mb-loyalty-member-card relative flex flex-col gap-4 overflow-hidden p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("home.member")}
          </p>
          <h2 id="member-card-name" className="brand-loyalty-name break-words text-2xl">
            {name}
          </h2>
        </div>
        <TierBadge tier={position.style} name={position.tier.name} />
      </div>

      {/* Dois números lado a lado: o saldo (o que dá para trocar) e o total ganho (o nível). */}
      <dl className="grid grid-cols-2 divide-x divide-border rounded-2xl border border-border">
        <Figure
          icon={Coins}
          label={t("member.toSpend")}
          value={
            <span className={TIER_STYLES[position.style].textClass}>
              {points}
              <span className="ms-1 text-base font-bold opacity-80">{short}</span>
            </span>
          }
          big
        />
        <Figure
          icon={Trophy}
          label={t("member.earned")}
          hint={t("member.earnedHint")}
          value={
            <>
              {lifetimePoints}
              <span className="ms-1 text-sm font-bold text-muted-foreground">{short}</span>
            </>
          }
        />
      </dl>

      <LevelProgress program={program} lifetimePoints={lifetimePoints} />

      <div className="flex flex-wrap gap-2">
        {home && hasRewards && onOpenRewards && (
          <Chip
            icon={Gift}
            onClick={onOpenRewards}
            highlight={available > 0}
            label={t("member.redeem")}
            badge={
              <CountBadge
                count={available}
                tone="success"
                label={t(available === 1 ? "member.readyOne" : "member.readyMany", {
                  count: available,
                })}
              />
            }
          />
        )}
        {home && onOpenHistory && (
          <Chip icon={Receipt} onClick={onOpenHistory} label={t("member.history")} />
        )}
        <Chip icon={Info} onClick={onOpenClub} label={t("member.howItWorks")} haspopup />
      </div>

      {home && pending.length > 0 && onOpenRewards && (
        // Prêmio trocado esperando retirada: faixa clara (tons do cartão off-white) dentro do cartão.
        <button
          type="button"
          onClick={onOpenRewards}
          className="bg-card tone-pending flex min-h-11 w-full items-center gap-3 rounded-xl border border-[color:var(--tone-border)] border-s-4 border-s-[color:var(--tone-line)] p-3 text-left text-foreground"
        >
          <Ticket className="size-5 shrink-0 text-[color:var(--tone-ink)]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">
              {t("member.pickup", { name: pending[0].reward_name })}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("member.pickupUntil", { date: shortDate.format(new Date(pending[0].expires_at)) })}
              {pending.length > 1 && ` · ${t("member.pickupMore", { count: pending.length - 1 })}`}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
    </section>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  hint,
  big = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  big?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-1 p-3">
      <dt className="text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 text-gold" aria-hidden />
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] font-medium">{hint}</span>}
      </dt>
      <dd
        className={cn(
          "font-black tabular-nums leading-none tracking-tight",
          big ? "text-3xl sm:text-4xl" : "text-2xl",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  onClick,
  badge,
  highlight = false,
  haspopup = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: ReactNode;
  highlight?: boolean;
  haspopup?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={haspopup ? "dialog" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border px-3 text-sm font-semibold transition-colors",
        highlight
          ? "border-[color:var(--loyalty-contrast-accent)] bg-[color:var(--muted)] text-foreground"
          : "border-border text-foreground hover:bg-[color:var(--muted)]",
      )}
    >
      <Icon className="size-4 shrink-0 text-gold" aria-hidden />
      {label}
      {badge}
    </button>
  );
}
