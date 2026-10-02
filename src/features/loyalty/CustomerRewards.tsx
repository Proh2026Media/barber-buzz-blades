import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LoyaltyProgram, LoyaltyReward } from "./program";

type PendingRedemption = {
  id: string;
  reward_name: string;
  cost_points: number;
  expires_at: string;
};

const MAX_PENDING = 3;

export function CustomerRewards({
  userId,
  shopId,
  program,
  points,
  onChanged,
}: {
  userId: string | null;
  shopId: string | null;
  program: LoyaltyProgram;
  points: number;
  onChanged: () => void;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [pending, setPending] = useState<PendingRedemption[]>([]);
  const [confirming, setConfirming] = useState<LoyaltyReward | null>(null);
  const [cancelling, setCancelling] = useState<PendingRedemption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rewards = program.rewards.filter((reward) => reward.active);

  const load = useCallback(async () => {
    if (demo) {
      setPending(demo.redemptions.filter((row) => row.status === "pending"));
      return;
    }
    if (!userId || !shopId) return;
    const { data } = await supabase
      .from("loyalty_redemptions")
      .select("id, reward_name, cost_points, expires_at")
      .eq("user_id", userId)
      .eq("barbershop_id", shopId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setPending((data ?? []) as PendingRedemption[]);
  }, [demo, userId, shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem(reward: LoyaltyReward) {
    setBusy(true);
    setError(null);
    if (demo) {
      demo.dispatch({ type: "loyalty.redeem", rewardId: reward.id });
    } else {
      const { error: rpcError } = await supabase.rpc("request_loyalty_redemption", {
        p_reward_id: reward.id,
      });
      if (rpcError) {
        setError(friendlyAuthError(rpcError, t("rewards.redeemError")));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setConfirming(null);
    toast.success(t("rewards.redeemDone"));
    onChanged();
    await load();
  }

  async function cancel(row: PendingRedemption) {
    setBusy(true);
    setError(null);
    if (demo) {
      demo.dispatch({ type: "loyalty.cancel", id: row.id });
    } else {
      const { error: rpcError } = await supabase.rpc("resolve_loyalty_redemption", {
        p_redemption_id: row.id,
        p_action: "cancel",
      });
      if (rpcError) {
        setError(friendlyAuthError(rpcError, t("rewards.cancelError")));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setCancelling(null);
    toast.success(t("rewards.cancelDone"));
    onChanged();
    await load();
  }

  if (rewards.length === 0 && pending.length === 0) return null;

  const dateFormat = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "long" });
  const atLimit = pending.length >= MAX_PENDING;

  return (
    <section className="space-y-3" aria-labelledby="rewards-title">
      <div className="flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-gold/10 text-gold">
          <Gift className="size-5" aria-hidden />
        </span>
        <div>
          <h3 id="rewards-title" className="text-lg font-extrabold tracking-tight">
            {t("rewards.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("rewards.hint")}</p>
        </div>
      </div>

      {pending.length > 0 && (
        <ul className="space-y-2" aria-label={t("rewards.pendingLabel")}>
          {pending.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-3"
            >
              <Ticket className="size-5 shrink-0 text-gold" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{row.reward_name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("rewards.pendingLine", { date: dateFormat.format(new Date(row.expires_at)) })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelling(row)}
                className="min-h-11 shrink-0 rounded-xl border border-border px-3 text-xs font-bold"
              >
                {t("rewards.cancel")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {rewards.length > 0 && (
        <ul className="space-y-2">
          {rewards.map((reward) => {
            const missing = Math.max(0, reward.cost_points - points);
            return (
              <li
                key={reward.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{reward.name}</p>
                  {reward.description && (
                    <p className="text-xs text-muted-foreground">{reward.description}</p>
                  )}
                  <p className="mt-1 text-xs font-semibold text-gold">
                    {missing > 0
                      ? t("rewards.costMissing", { n: reward.cost_points, missing })
                      : t("rewards.cost", { n: reward.cost_points })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={missing > 0 || atLimit}
                  onClick={() => {
                    setError(null);
                    setConfirming(reward);
                  }}
                  className="action-button action-confirm shrink-0"
                >
                  {t("rewards.redeem")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {atLimit && (
        <p className="text-xs text-muted-foreground" role="status">
          {t("rewards.limit")}
        </p>
      )}

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && !busy && setConfirming(null)}>
          <DialogContent>
            <DialogTitle>{t("rewards.confirmTitle", { name: confirming.name })}</DialogTitle>
            <DialogDescription>
              {t("rewards.confirmText", {
                n: confirming.cost_points,
                left: points - confirming.cost_points,
              })}
            </DialogDescription>
            <DialogScrollArea>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{t("rewards.confirmStep1")}</li>
                <li>{t("rewards.confirmStep2")}</li>
              </ul>
              {error && (
                <p className="mt-3 text-sm font-semibold text-destructive" role="alert">
                  {error}
                </p>
              )}
            </DialogScrollArea>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(null)}
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold"
              >
                {t("rewards.back")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void redeem(confirming)}
                className="action-button action-confirm"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("rewards.confirm")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {cancelling && (
        <Dialog open onOpenChange={(open) => !open && !busy && setCancelling(null)}>
          <DialogContent>
            <DialogTitle>{t("rewards.cancelTitle", { name: cancelling.reward_name })}</DialogTitle>
            <DialogDescription>
              {t("rewards.cancelText", { n: cancelling.cost_points })}
            </DialogDescription>
            {error && (
              <p className="text-sm font-semibold text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelling(null)}
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold"
              >
                {t("rewards.keep")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancel(cancelling)}
                className="action-button action-danger"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {t("rewards.cancelConfirm")}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
