import { Crown, PieChart, Scale, type LucideIcon } from "lucide-react";
import { PersonAvatar, StatusBadge } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatPercent, isOwnerRole, type ShopRole } from "./roles";

/** Linha de `list_shop_team_members` (dono/sócio e quem vê a loja toda podem ler). */
export type TeamMember = {
  id: string;
  user_id: string;
  staff_id: string;
  role: ShopRole;
  ownership_percent: number | null;
  active: boolean;
  display_name: string;
  email: string | null;
  is_founder: boolean;
  created_at: string;
};

export async function loadTeamMembers(shopId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc("list_shop_team_members", { p_shop_id: shopId });
  if (error) throw error;
  return Array.isArray(data) ? (data as unknown as TeamMember[]) : [];
}

/** Donos ativos, da maior parte para a menor. */
export function activeOwners(members: TeamMember[]) {
  return members
    .filter((member) => member.active && isOwnerRole(member.role))
    .sort((a, b) => Number(b.ownership_percent ?? 0) - Number(a.ownership_percent ?? 0));
}

export type GovernanceMode = "single" | "equal" | "majority";

/** Mesma regra do banco (`shop_governance_mode`): 1 dono, partes iguais ou maioria. */
export function governanceModeOf(members: TeamMember[]): GovernanceMode {
  const owners = activeOwners(members);
  if (owners.length <= 1) return "single";
  const shares = owners.map((owner) => Number(owner.ownership_percent ?? 0));
  return Math.min(...shares) === Math.max(...shares) ? "equal" : "majority";
}

const MODE_ICON: Record<GovernanceMode, LucideIcon> = {
  single: Crown,
  equal: Scale,
  majority: PieChart,
};

/**
 * Quem decide os pedidos de quem está vendo: a maior parte (maioria) ou os outros donos.
 * Devolve os primeiros nomes ("Ana", "Bruno"); vazio quando não há outro dono conhecido.
 */
export function approversOf(
  members: TeamMember[],
  mode: GovernanceMode | null,
  me: string,
): string[] {
  const others = activeOwners(members).filter((owner) => owner.user_id !== me);
  const effective = mode ?? governanceModeOf(members);
  return (effective === "majority" ? others.slice(0, 1) : others).map((owner) =>
    firstName(owner.display_name),
  );
}

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

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Barra de participação: uma fatia por dono, cada uma numa cor, com avatar (anel na mesma cor) e % embaixo.
 * `preview` mostra a divisão depois de uma mudança (convite de dono, troca de %).
 */
/**
 * Cores das fatias por posição (bem diferentes entre si, ≥3:1 sobre o cartão off-white, que
 * também é off-white no tema escuro): dourado, azul, verde, vinho, roxo, ardósia.
 */
const SHARE_COLORS = ["#a16207", "#1d4ed8", "#15803d", "#9f1239", "#6d28d9", "#475569"];
const shareColor = (index: number) => SHARE_COLORS[index % SHARE_COLORS.length]!;

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
