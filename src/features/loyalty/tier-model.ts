import { Armchair, BadgeCheck, Diamond, Sparkle, type LucideIcon } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { tierFor, tierStyleKey, type LoyaltyProgram } from "./program";

/**
 * Identidade de cada nível do clube: ícone e gradiente aprovados (prata, bronze, ouro e
 * holográfico). O gradiente fica no fundo do selo (`mb-loyalty-tier-*` em styles.css) e o
 * texto usa uma tinta escura única, legível nos dois temas.
 */
export const TIER_STYLES = {
  classic: { icon: Armchair, textClass: "text-gradient-silver" },
  select: { icon: BadgeCheck, textClass: "text-gradient-bronze" },
  privilege: { icon: Sparkle, textClass: "text-gradient-gold" },
  exclusive: { icon: Diamond, textClass: "text-gradient-hologram" },
} as const satisfies Record<string, { icon: LucideIcon; textClass: string }>;

export type TierStyle = keyof typeof TIER_STYLES;

export const BADGE_SIZE = {
  sm: "min-h-6 gap-1 px-2 text-[11px] [&>svg]:size-3",
  md: "min-h-8 gap-1.5 px-3 text-xs [&>svg]:size-3.5",
  lg: "min-h-10 gap-2 px-3.5 text-sm [&>svg]:size-4",
} as const;

/** Posição do cliente no clube, com o estilo visual de cada nível. */
export function useTierPosition(program: LoyaltyProgram, lifetimePoints: number) {
  const position = tierFor(lifetimePoints, program.tiers);
  const total = program.tiers.length;
  const style = tierStyleKey(position.index, total);
  const nextStyle = position.next ? tierStyleKey(position.index + 1, total) : null;
  return { ...position, style, nextStyle };
}

/** Benefício do nível: o texto da barbearia ou, nas regras padrão, o texto do dicionário. */
export function useTierBenefit(program: LoyaltyProgram) {
  const { t } = useI18n();
  return (index: number) => {
    const row = program.tiers[index];
    if (row?.benefit) return row.benefit;
    if (program.mode !== "default" || !row) return "";
    return t(`tier.${tierStyleKey(index, program.tiers.length)}.benefit` as MessageKey);
  };
}
