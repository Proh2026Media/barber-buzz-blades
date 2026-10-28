import { PersonAvatar, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatPercent } from "./roles-model";
import {
  type TeamMember,
  type GovernanceMode,
  MODE_ICON,
  firstName,
  shareColor,
} from "./team-model";

/** Selo "como as decisões funcionam aqui" (sozinho, em conjunto ou pela maior parte). */
export function GovernanceModeBadge({
  mode,
  leader,
  youDecideAlone,
  short = false,
  size = "md",
  variant = "pill",
  className,
}: {
  mode: GovernanceMode;
  /** Quem tem a maior parte (modo maioria). */
  leader?: TeamMember | null;
  /** O dono único é quem está vendo. */
  youDecideAlone?: boolean;
  /** Rótulo curto para o topo do painel ("Decide sozinho", "Maior parte decide"). */
  short?: boolean;
  size?: "sm" | "md";
  /** `icon`: só o ícone (o rótulo vira nome acessível), para telas estreitas. */
  variant?: "pill" | "icon";
  className?: string;
}) {
  const { t, intlLocale } = useI18n();
  const label = short
    ? t(`eq.mode.short.${mode}` as const)
    : mode === "single"
      ? youDecideAlone
        ? t("eq.mode.singleYou")
        : t("eq.mode.single")
      : mode === "equal"
        ? t("eq.mode.equal")
        : leader
          ? t("eq.mode.majorityOf", {
              name: firstName(leader.display_name),
              percent: formatPercent(Number(leader.ownership_percent ?? 0), intlLocale),
            })
          : t("eq.mode.majority");
  return (
    <StatusBadge
      tone="highlight"
      icon={MODE_ICON[mode]}
      label={label}
      size={size}
      variant={variant}
      className={className}
    />
  );
}

export function OwnershipBar({
  owners,
  className,
}: {
  owners: { key: string; name: string; percent: number; isNew?: boolean }[];
  className?: string;
}) {
  const { t, intlLocale } = useI18n();
  const total = owners.reduce((sum, owner) => sum + owner.percent, 0) || 1;
  const summary = owners
    .map((owner) => `${owner.name} ${formatPercent(owner.percent, intlLocale)}%`)
    .join(" · ");
  return (
    <figure className={cn("space-y-2", className)}>
      <div
        role="img"
        aria-label={t("eq.share.aria", { summary })}
        className="flex h-4 gap-0.5 overflow-hidden rounded-[var(--control-radius)] bg-muted"
      >
        {owners.map((owner, index) => (
          <span
            key={owner.key}
            className={cn(
              "h-full",
              owner.isNew &&
                "bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(255,255,255,.35)_3px_6px)]",
            )}
            style={{
              width: `${(owner.percent / total) * 100}%`,
              backgroundColor: shareColor(index),
            }}
          />
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1.5" aria-hidden>
        {owners.map((owner, index) => (
          <span key={owner.key} className="inline-flex items-center gap-1.5 text-xs font-semibold">
            {/* O anel na cor da fatia liga a pessoa ao pedaço dela na barra. */}
            <span
              className="inline-flex rounded-full"
              style={{ boxShadow: `0 0 0 2px ${shareColor(index)}` }}
            >
              <PersonAvatar name={owner.name} seed={owner.key} size="xs" />
            </span>
            {firstName(owner.name)}
            <span className="tabular-nums text-muted-foreground">
              {formatPercent(owner.percent, intlLocale)}%
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
