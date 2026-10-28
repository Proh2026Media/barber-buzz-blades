import { Crown, PieChart, Scale, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerRole, type ShopRole } from "./roles-model";

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

export const MODE_ICON: Record<GovernanceMode, LucideIcon> = {
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
export const SHARE_COLORS = ["#a16207", "#1d4ed8", "#15803d", "#9f1239", "#6d28d9", "#475569"];

export const shareColor = (index: number) => SHARE_COLORS[index % SHARE_COLORS.length]!;
