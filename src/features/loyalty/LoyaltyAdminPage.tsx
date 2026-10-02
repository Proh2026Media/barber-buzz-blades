import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Gift,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SessionProfile } from "@/lib/auth/session";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DEFAULT_TIERS,
  MAX_TIERS,
  parseLoyaltyProgram,
  validateTiers,
  type LoyaltyProgram,
  type LoyaltyReward,
  type LoyaltyTier,
  type TierProblem,
} from "./program";

type Part = "regras" | "recompensas" | "clientes" | "resgates";

type CustomerRow = {
  user_id: string;
  full_name: string | null;
  points: number;
  lifetime_points: number;
  updated_at: string;
};

type RedemptionRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  reward_name: string;
  cost_points: number;
  status: string;
  created_at: string;
  expires_at: string;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal";

const TIER_PROBLEM_KEY: Record<TierProblem, MessageKey> = {
  count: "loyalty.admin.tierProblem.count",
  first: "loyalty.admin.tierProblem.first",
  order: "loyalty.admin.tierProblem.order",
  name: "loyalty.admin.tierProblem.name",
  duplicate: "loyalty.admin.tierProblem.duplicate",
  benefit: "loyalty.admin.tierProblem.benefit",
};

function clampInt(value: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

export function LoyaltyAdminPage({ profile }: { profile: SessionProfile }) {
  const { t, intlLocale } = useI18n();
  const actor = useMemo(() => {
    const saved =
      typeof window === "undefined" ? null : window.localStorage.getItem("arena:active-shop-actor");
    return (
      profile.shopActors.find((candidate) => candidate.id === saved) ?? profile.activeShopActor
    );
  }, [profile]);
  const shop =
    actor?.barbershop ??
    profile.memberships.find((m) => m.role === "shop_admin")?.barbershop ??
    profile.memberships.find((m) => m.barbershop)?.barbershop ??
    null;
  const canManage = !actor || actor.role === "owner" || actor.role === "partner";

  const [part, setPart] = useState<Part>(canManage ? "regras" : "resgates");
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProgram = useCallback(async () => {
    if (!shop?.id) return;
    setLoadError(null);
    const { data, error } = await supabase.rpc("get_shop_loyalty_program", {
      p_shop_id: shop.id,
    });
    if (error) setLoadError(friendlyAuthError(error, t("loyalty.admin.loadError")));
    else setProgram(parseLoyaltyProgram(data));
    setLoading(false);
  }, [shop?.id, t]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  const parts: Array<{ id: Part; label: string; icon: typeof Gift }> = [
    ...(canManage
      ? [
          { id: "regras" as const, label: t("loyalty.admin.part.rules"), icon: Trophy },
          { id: "recompensas" as const, label: t("loyalty.admin.part.rewards"), icon: Gift },
        ]
      : []),
    { id: "resgates", label: t("loyalty.admin.part.redemptions"), icon: ShieldCheck },
    { id: "clientes", label: t("loyalty.admin.part.customers"), icon: Users },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-4 backdrop-blur-xl">
        <a
          href="/shop?secao=pontos"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card"
          aria-label={t("loyalty.admin.back")}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </a>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-gold">{shop?.name ?? ""}</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">
            {t("loyalty.admin.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4 pb-10">
        {!shop ? (
          <EmptyState tone="bell" title={t("loyalty.admin.noShop")} />
        ) : loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("loyalty.admin.loading")}
          </p>
        ) : loadError ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4" role="alert">
            <p className="text-sm">{loadError}</p>
            <button
              type="button"
              className="action-button action-confirm"
              onClick={() => void loadProgram()}
            >
              {t("loyalty.admin.retry")}
            </button>
          </div>
        ) : program && !program.enabled ? (
          <EmptyState
            tone="bell"
            title={t("loyalty.admin.disabledTitle")}
            description={t("loyalty.admin.disabledText")}
          />
        ) : program ? (
          <>
            <p className="text-sm text-muted-foreground">{t("loyalty.admin.intro")}</p>
            <nav
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              aria-label={t("loyalty.admin.partsLabel")}
            >
              {parts.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPart(id)}
                  aria-pressed={part === id}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-colors ${
                    part === id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </nav>

            {part === "regras" && canManage && (
              <RulesPart shopId={shop.id} program={program} onSaved={setProgram} />
            )}
            {part === "recompensas" && canManage && (
              <RewardsPart shopId={shop.id} program={program} onChanged={loadProgram} />
            )}
            {part === "resgates" && <RedemptionsPart shopId={shop.id} intlLocale={intlLocale} />}
            {part === "clientes" && (
              <CustomersPart shopId={shop.id} canAdjust={canManage} myId={profile.user.id} />
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

function RulesPart({
  shopId,
  program,
  onSaved,
}: {
  shopId: string;
  program: LoyaltyProgram;
  onSaved: (program: LoyaltyProgram) => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState(program.mode);
  const [perVisit, setPerVisit] = useState(String(program.points_per_visit));
  const [welcome, setWelcome] = useState(String(program.welcome_bonus));
  const [tiers, setTiers] = useState<LoyaltyTier[]>(program.tiers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const custom = mode === "custom";
  const problem = custom ? validateTiers(tiers) : null;

  function updateTier(index: number, patch: Partial<LoyaltyTier>) {
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  function addTier() {
    setTiers((current) => {
      if (current.length >= MAX_TIERS) return current;
      const last = current[current.length - 1];
      return [...current, { name: "", min_points: (last?.min_points ?? 0) + 100, benefit: "" }];
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (problem) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("save_loyalty_program", {
      p_shop_id: shopId,
      p_mode: mode,
      p_points_per_visit: clampInt(perVisit, 1, 1000),
      p_welcome_bonus: clampInt(welcome, 0, 1000),
      p_tiers: (custom ? tiers : DEFAULT_TIERS).map((tier) => ({
        name: tier.name.trim(),
        min_points: tier.min_points,
        benefit: tier.benefit.trim(),
      })),
    });
    if (rpcError) {
      setError(friendlyAuthError(rpcError, t("loyalty.admin.saveError")));
      setSaving(false);
      return;
    }
    const { data } = await supabase.rpc("get_shop_loyalty_program", { p_shop_id: shopId });
    const next = parseLoyaltyProgram(data);
    onSaved(next);
    setMode(next.mode);
    setTiers(next.tiers);
    setSaving(false);
    toast.success(t("loyalty.admin.saved"));
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-bold">{t("loyalty.admin.modeTitle")}</legend>
        {(["default", "custom"] as const).map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              mode === option ? "border-foreground" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="loyalty-mode"
              value={option}
              checked={mode === option}
              onChange={() => {
                setMode(option);
                if (option === "default") setTiers(DEFAULT_TIERS);
              }}
              className="mt-1 size-4"
            />
            <span>
              <span className="block text-sm font-bold">
                {t(option === "default" ? "loyalty.admin.modeDefault" : "loyalty.admin.modeCustom")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  option === "default"
                    ? "loyalty.admin.modeDefaultHint"
                    : "loyalty.admin.modeCustomHint",
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-semibold">
          {t("loyalty.admin.perVisit")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            required
            value={perVisit}
            onChange={(e) => setPerVisit(e.target.value)}
            className={fieldClass}
          />
          <span className="block font-normal text-muted-foreground">
            {t("loyalty.admin.perVisitHint")}
          </span>
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          {t("loyalty.admin.welcome")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1000}
            required
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            className={fieldClass}
          />
          <span className="block font-normal text-muted-foreground">
            {t("loyalty.admin.welcomeHint")}
          </span>
        </label>
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-bold">{t("loyalty.admin.tiersTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("loyalty.admin.tiersHint")}</p>
        </div>
        <ol className="space-y-3">
          {(custom ? tiers : DEFAULT_TIERS).map((tier, index) => (
            <li key={index} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("loyalty.admin.tierN", { n: index + 1 })}
                </span>
                {custom && index > 0 && (
                  <button
                    type="button"
                    onClick={() => setTiers((current) => current.filter((_, i) => i !== index))}
                    className="flex size-11 items-center justify-center rounded-xl text-destructive"
                    aria-label={t("loyalty.admin.tierRemove", { n: index + 1 })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                <label className="block space-y-1 text-xs font-semibold">
                  {t("loyalty.admin.tierName")}
                  <input
                    value={tier.name}
                    disabled={!custom}
                    maxLength={30}
                    required
                    onChange={(e) => updateTier(index, { name: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block space-y-1 text-xs font-semibold">
                  {t("loyalty.admin.tierMin")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={tier.min_points}
                    disabled={!custom || index === 0}
                    onChange={(e) =>
                      updateTier(index, { min_points: clampInt(e.target.value, 0, 1000000) })
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-semibold">
                {t("loyalty.admin.tierBenefit")}
                <input
                  value={tier.benefit}
                  disabled={!custom}
                  maxLength={160}
                  placeholder={t("loyalty.admin.tierBenefitPlaceholder")}
                  onChange={(e) => updateTier(index, { benefit: e.target.value })}
                  className={fieldClass}
                />
              </label>
            </li>
          ))}
        </ol>
        {custom && tiers.length < MAX_TIERS && (
          <button
            type="button"
            onClick={addTier}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold"
          >
            <Plus className="size-4" aria-hidden />
            {t("loyalty.admin.tierAdd")}
          </button>
        )}
        {problem && (
          <p className="text-sm font-semibold text-destructive" role="alert">
            {t(TIER_PROBLEM_KEY[problem])}
          </p>
        )}
      </section>

      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        {t("loyalty.admin.noRetroactive")}
      </p>
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving || Boolean(problem)}
        className="action-button action-confirm w-full"
      >
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("loyalty.admin.saveRules")}
      </button>
    </form>
  );
}

function RewardsPart({
  shopId,
  program,
  onChanged,
}: {
  shopId: string;
  program: LoyaltyProgram;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<LoyaltyReward | "new" | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggle(reward: LoyaltyReward) {
    setTogglingId(reward.id);
    const { error } = await supabase.rpc("save_loyalty_reward", {
      p_shop_id: shopId,
      p_reward_id: reward.id,
      p_name: reward.name,
      p_description: reward.description,
      p_cost_points: reward.cost_points,
      p_active: !reward.active,
      p_sort_order: reward.sort_order,
    });
    if (error) toast.error(friendlyAuthError(error, t("loyalty.admin.saveError")));
    await onChanged();
    setTogglingId(null);
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("loyalty.admin.rewardsHint")}</p>
      {program.rewards.length === 0 ? (
        <EmptyState
          tone="scissors"
          title={t("loyalty.admin.rewardsEmpty")}
          description={t("loyalty.admin.rewardsEmptyText")}
        />
      ) : (
        <ul className="space-y-2">
          {program.rewards.map((reward) => (
            <li
              key={reward.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => setEditing(reward)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-bold">{reward.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("loyalty.admin.rewardCost", { n: reward.cost_points })}
                  {!reward.active && ` · ${t("loyalty.admin.rewardPaused")}`}
                </span>
              </button>
              <Switch
                checked={reward.active}
                disabled={togglingId === reward.id}
                onCheckedChange={() => void toggle(reward)}
                aria-label={t("loyalty.admin.rewardToggle", { name: reward.name })}
              />
            </li>
          ))}
        </ul>
      )}
      {program.rewards.length < 30 && (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="action-button action-confirm w-full"
        >
          <Plus className="size-4" aria-hidden />
          {t("loyalty.admin.rewardAdd")}
        </button>
      )}
      {editing && (
        <RewardDialog
          shopId={shopId}
          reward={editing === "new" ? null : editing}
          nextOrder={program.rewards.length}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function RewardDialog({
  shopId,
  reward,
  nextOrder,
  onClose,
  onSaved,
}: {
  shopId: string;
  reward: LoyaltyReward | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [cost, setCost] = useState(String(reward?.cost_points ?? 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("save_loyalty_reward", {
      p_shop_id: shopId,
      p_reward_id: reward?.id ?? null,
      p_name: name.trim(),
      p_description: description.trim(),
      p_cost_points: clampInt(cost, 1, 100000),
      p_active: reward?.active ?? true,
      p_sort_order: reward?.sort_order ?? nextOrder,
    });
    setSaving(false);
    if (rpcError) {
      setError(friendlyAuthError(rpcError, t("loyalty.admin.saveError")));
      return;
    }
    toast.success(t("loyalty.admin.rewardSaved"));
    await onSaved();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>
          {t(reward ? "loyalty.admin.rewardEdit" : "loyalty.admin.rewardAdd")}
        </DialogTitle>
        <DialogDescription>{t("loyalty.admin.rewardDialogHint")}</DialogDescription>
        <DialogScrollArea>
          <form id="reward-form" onSubmit={save} className="space-y-3">
            <label className="block space-y-1 text-xs font-semibold">
              {t("loyalty.admin.rewardName")}
              <input
                value={name}
                required
                minLength={2}
                maxLength={60}
                placeholder={t("loyalty.admin.rewardNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              {t("loyalty.admin.rewardDescription")}
              <textarea
                value={description}
                maxLength={200}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              {t("loyalty.admin.rewardCostLabel")}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                required
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={fieldClass}
              />
              <span className="block font-normal text-muted-foreground">
                {t("loyalty.admin.rewardCostHint")}
              </span>
            </label>
            {error && (
              <p className="text-sm font-semibold text-destructive" role="alert">
                {error}
              </p>
            )}
          </form>
        </DialogScrollArea>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold"
          >
            {t("loyalty.admin.cancel")}
          </button>
          <button
            type="submit"
            form="reward-form"
            disabled={saving}
            className="action-button action-confirm"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("loyalty.admin.rewardSave")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsPart({ shopId, intlLocale }: { shopId: string; intlLocale: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<RedemptionRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("list_shop_loyalty_redemptions", {
      p_shop_id: shopId,
      p_status: "pending",
    });
    if (rpcError) setError(friendlyAuthError(rpcError, t("loyalty.admin.loadError")));
    else {
      setError(null);
      setRows((data ?? []) as RedemptionRow[]);
    }
  }, [shopId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(row: RedemptionRow, action: "fulfill" | "cancel") {
    setBusyId(row.id);
    const { error: rpcError } = await supabase.rpc("resolve_loyalty_redemption", {
      p_redemption_id: row.id,
      p_action: action,
    });
    setBusyId(null);
    if (rpcError) {
      toast.error(friendlyAuthError(rpcError, t("loyalty.admin.saveError")));
      return;
    }
    toast.success(
      t(action === "fulfill" ? "loyalty.admin.redeemFulfilled" : "loyalty.admin.redeemCancelled"),
    );
    await load();
  }

  const dateFormat = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "short" });

  if (error)
    return (
      <p className="text-sm font-semibold text-destructive" role="alert">
        {error}
      </p>
    );
  if (!rows)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("loyalty.admin.loading")}
      </p>
    );

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("loyalty.admin.redemptionsHint")}</p>
      {rows.length === 0 ? (
        <EmptyState tone="waiting" title={t("loyalty.admin.redemptionsEmpty")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-bold">{row.reward_name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("loyalty.admin.redemptionLine", {
                    name: row.full_name || t("loyalty.admin.customerUnnamed"),
                    n: row.cost_points,
                    date: dateFormat.format(new Date(row.expires_at)),
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void resolve(row, "cancel")}
                  className="action-button action-danger"
                >
                  {t("loyalty.admin.redeemCancel")}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void resolve(row, "fulfill")}
                  className="action-button action-success"
                >
                  {t("loyalty.admin.redeemFulfill")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("loyalty.admin.redeemCancelHint")}</p>
    </section>
  );
}

function CustomersPart({
  shopId,
  canAdjust,
  myId,
}: {
  shopId: string;
  canAdjust: boolean;
  myId: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<CustomerRow | null>(null);

  const load = useCallback(
    async (query: string) => {
      const { data, error: rpcError } = await supabase.rpc("list_shop_loyalty_customers", {
        p_shop_id: shopId,
        p_search: query || null,
        p_limit: 50,
      });
      if (rpcError) setError(friendlyAuthError(rpcError, t("loyalty.admin.loadError")));
      else {
        setError(null);
        setRows((data ?? []) as CustomerRow[]);
      }
    },
    [shopId, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  return (
    <section className="space-y-3">
      <label className="relative block">
        <span className="sr-only">{t("loyalty.admin.customerSearch")}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("loyalty.admin.customerSearch")}
          className={`${fieldClass} min-h-11 pl-9`}
        />
      </label>
      {error ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : !rows ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("loyalty.admin.loading")}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState tone="waiting" title={t("loyalty.admin.customersEmpty")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.user_id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {row.full_name || t("loyalty.admin.customerUnnamed")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("loyalty.admin.customerPoints", {
                    n: row.points,
                    total: row.lifetime_points,
                  })}
                </p>
              </div>
              {canAdjust && row.user_id !== myId && (
                <button
                  type="button"
                  onClick={() => setAdjusting(row)}
                  className="min-h-11 shrink-0 rounded-xl border border-border px-3 text-xs font-bold"
                >
                  {t("loyalty.admin.adjust")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adjusting && (
        <AdjustDialog
          shopId={shopId}
          customer={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={async () => {
            setAdjusting(null);
            await load(search.trim());
          }}
        />
      )}
    </section>
  );
}

function AdjustDialog({
  shopId,
  customer,
  onClose,
  onDone,
}: {
  shopId: string;
  customer: CustomerRow;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = clampInt(amount, 1, 1000);
  const delta = direction === "add" ? value : -value;
  const result = customer.points + delta;
  const invalid = result < 0 || reason.trim().length < 10;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("adjust_loyalty_points", {
      p_shop_id: shopId,
      p_user_id: customer.user_id,
      p_delta: delta,
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (rpcError) {
      setError(friendlyAuthError(rpcError, t("loyalty.admin.saveError")));
      return;
    }
    toast.success(t("loyalty.admin.adjustDone"));
    await onDone();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>
          {t("loyalty.admin.adjustTitle", {
            name: customer.full_name || t("loyalty.admin.customerUnnamed"),
          })}
        </DialogTitle>
        <DialogDescription>{t("loyalty.admin.adjustHint")}</DialogDescription>
        <DialogScrollArea>
          <form id="adjust-form" onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {(["add", "remove"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={direction === option}
                  onClick={() => setDirection(option)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
                    direction === option
                      ? "border-foreground bg-foreground text-background"
                      : "border-border"
                  }`}
                >
                  {option === "add" ? (
                    <Plus className="size-4" aria-hidden />
                  ) : (
                    <Minus className="size-4" aria-hidden />
                  )}
                  {t(option === "add" ? "loyalty.admin.adjustAdd" : "loyalty.admin.adjustRemove")}
                </button>
              ))}
            </div>
            <label className="block space-y-1 text-xs font-semibold">
              {t("loyalty.admin.adjustAmount")}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              {t("loyalty.admin.adjustReason")}
              <textarea
                value={reason}
                required
                minLength={10}
                maxLength={240}
                rows={2}
                placeholder={t("loyalty.admin.adjustReasonPlaceholder")}
                onChange={(e) => setReason(e.target.value)}
                className={fieldClass}
              />
              <span className="block font-normal text-muted-foreground">
                {t("loyalty.admin.adjustReasonHint")}
              </span>
            </label>
            <p
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                result < 0 ? "bg-destructive/10 text-destructive" : "bg-muted"
              }`}
              aria-live="polite"
            >
              {result < 0
                ? t("loyalty.admin.adjustNegative")
                : t("loyalty.admin.adjustPreview", { from: customer.points, to: result })}
            </p>
            {error && (
              <p className="text-sm font-semibold text-destructive" role="alert">
                {error}
              </p>
            )}
          </form>
        </DialogScrollArea>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold"
          >
            {t("loyalty.admin.cancel")}
          </button>
          <button
            type="submit"
            form="adjust-form"
            disabled={saving || invalid}
            className="action-button action-confirm"
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("loyalty.admin.adjustSave")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
