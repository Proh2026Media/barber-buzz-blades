import type { Json } from "@/integrations/supabase/types";

export type LoyaltyTier = { name: string; min_points: number; benefit: string };

export type LoyaltyReward = {
  id: string;
  name: string;
  description: string;
  cost_points: number;
  active: boolean;
  sort_order: number;
};

export type LoyaltyProgram = {
  enabled: boolean;
  mode: "default" | "custom";
  points_per_visit: number;
  welcome_bonus: number;
  tiers: LoyaltyTier[];
  version: number;
  rewards: LoyaltyReward[];
};

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: "Classic", min_points: 0, benefit: "" },
  { name: "Select", min_points: 100, benefit: "" },
  { name: "Privilege", min_points: 300, benefit: "" },
  { name: "Exclusive", min_points: 500, benefit: "" },
];

/** Regra usada enquanto a do servidor não chega ou se ela vier incompleta. */
export const FALLBACK_PROGRAM: LoyaltyProgram = {
  enabled: true,
  mode: "default",
  points_per_visit: 50,
  welcome_bonus: 0,
  tiers: DEFAULT_TIERS,
  version: 0,
  rewards: [],
};

export const MAX_TIERS = 6;

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseTiers(value: unknown): LoyaltyTier[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_TIERS;
  const tiers = value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        name: typeof row.name === "string" ? row.name : "",
        min_points: asNumber(row.min_points, 0),
        benefit: typeof row.benefit === "string" ? row.benefit : "",
      };
    })
    .filter((tier) => tier.name.trim());
  if (tiers.length === 0) return DEFAULT_TIERS;
  return tiers.sort((a, b) => a.min_points - b.min_points);
}

export function parseLoyaltyProgram(raw: Json | null | undefined): LoyaltyProgram {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return FALLBACK_PROGRAM;
  const data = raw as Record<string, unknown>;
  const rewards = Array.isArray(data.rewards)
    ? (data.rewards as Record<string, unknown>[]).map((row) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        description: String(row.description ?? ""),
        cost_points: asNumber(row.cost_points, 0),
        active: row.active !== false,
        sort_order: asNumber(row.sort_order, 0),
      }))
    : [];
  return {
    enabled: data.enabled !== false,
    mode: data.mode === "custom" ? "custom" : "default",
    points_per_visit: asNumber(data.points_per_visit, 50),
    welcome_bonus: asNumber(data.welcome_bonus, 0),
    tiers: parseTiers(data.tiers),
    version: asNumber(data.version, 0),
    rewards,
  };
}

export type TierPosition = {
  index: number;
  tier: LoyaltyTier;
  next: LoyaltyTier | null;
  /** 0–100 dentro do nível atual. */
  progress: number;
  pointsToNext: number;
};

/** Nível pelo total ganho na vida: resgatar pontos não derruba o nível. */
export function tierFor(lifetimePoints: number, tiers: LoyaltyTier[]): TierPosition {
  const list = tiers.length ? tiers : DEFAULT_TIERS;
  let index = 0;
  list.forEach((tier, i) => {
    if (lifetimePoints >= tier.min_points) index = i;
  });
  const tier = list[index];
  const next = list[index + 1] ?? null;
  const span = next ? next.min_points - tier.min_points : 0;
  const progress = next
    ? Math.max(0, Math.min(100, ((lifetimePoints - tier.min_points) / span) * 100))
    : 100;
  return {
    index,
    tier,
    next,
    progress,
    pointsToNext: next ? Math.max(0, next.min_points - lifetimePoints) : 0,
  };
}

/** Estilo visual do nível: os quatro estilos do clube distribuídos pela posição. */
export function tierStyleKey(
  index: number,
  total: number,
): "classic" | "select" | "privilege" | "exclusive" {
  const keys = ["classic", "select", "privilege", "exclusive"] as const;
  if (total <= 1) return "classic";
  if (index >= total - 1) return "exclusive";
  const slot = Math.round((index / (total - 1)) * (keys.length - 1));
  return keys[Math.min(keys.length - 1, Math.max(0, slot))];
}

export type TierProblem = "count" | "first" | "order" | "name" | "duplicate" | "benefit";

export function validateTiers(tiers: LoyaltyTier[]): TierProblem | null {
  if (tiers.length < 1 || tiers.length > MAX_TIERS) return "count";
  if (tiers[0].min_points !== 0) return "first";
  const names = new Set<string>();
  for (let i = 0; i < tiers.length; i += 1) {
    const name = tiers[i].name.trim();
    if (name.length < 1 || name.length > 30) return "name";
    if (names.has(name.toLowerCase())) return "duplicate";
    names.add(name.toLowerCase());
    if (!Number.isInteger(tiers[i].min_points)) return "order";
    if (i > 0 && tiers[i].min_points <= tiers[i - 1].min_points) return "order";
    if (tiers[i].benefit.length > 160) return "benefit";
  }
  return null;
}
