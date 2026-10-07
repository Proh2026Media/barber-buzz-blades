import { useState } from "react";
import {
  CalendarClock,
  Check,
  Coins,
  Gift,
  Lock,
  RotateCcw,
  Store,
  Ticket,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ConfirmDialog,
  DetailList,
  Hint,
  Notice,
  SectionHeader,
  StatusBadge,
  STATE,
  TONE_CLASS,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useDemo } from "@/features/demo/context";
import type { LoyaltyProgram, LoyaltyReward } from "./program";
import { MAX_PENDING_REDEMPTIONS, type PendingRedemption } from "./usePendingRedemptions";

/**
 * Trocar pontos: cada prêmio mostra o custo, a barra "saldo até o custo" e o estado — disponível
 * (✓ verde, com o botão Trocar) ou bloqueado (cadeado, "faltam 100"). Os prêmios já trocados
 * ficam no topo, com a faixa âmbar de "Aguardando retirada" e o prazo. Confirmar e desistir
 * mostram o antes → depois do saldo.
 */
export function CustomerRewards({
  program,
  points,
  pending,
  now,
  onChanged,
}: {
  program: LoyaltyProgram;
  points: number;
  /** Prêmios esperando retirada (mesma consulta do Início e dos Avisos). */
  pending: PendingRedemption[];
  /** Relógio da loja (ou da demonstração), para "faltam X dias". */
  now?: Date;
  onChanged: () => void;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [confirming, setConfirming] = useState<LoyaltyReward | null>(null);
  const [cancelling, setCancelling] = useState<PendingRedemption | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const rewards = program.rewards.filter((reward) => reward.active);
  if (rewards.length === 0 && pending.length === 0) return null;

  const short = t("points.short");
  const pts = (n: number) => `${n} ${short}`;
  const shortDate = new Intl.DateTimeFormat(intlLocale, { day: "2-digit", month: "2-digit" });
  const atLimit = pending.length >= MAX_PENDING_REDEMPTIONS;
  const today = (now ?? new Date()).getTime();

  /**
   * Falha ao trocar ou desistir: atualiza saldo e pendentes. Com motivo do servidor ("Pontos
   * insuficientes", "3 resgates aguardando"), fecha a janela e mostra o motivo junto dos prêmios;
   * falha genérica (rede) segue para a janela, que mostra o erro e deixa tentar de novo.
   */
  function explainFailure(error: unknown, fallback: string) {
    onChanged();
    const message = friendlyAuthError(error, fallback);
    if (message === fallback) return false;
    setFailure(message);
    return true;
  }

  async function redeem(reward: LoyaltyReward) {
    setFailure(null);
    if (demo) {
      demo.dispatch({ type: "loyalty.redeem", rewardId: reward.id });
    } else {
      const { error } = await supabase.rpc("request_loyalty_redemption", {
        p_reward_id: reward.id,
      });
      if (error) {
        if (explainFailure(error, t("rewards.redeemError"))) return;
        throw error;
      }
    }
    toast.success(t("rewards.redeemDone"));
    onChanged();
  }

  async function cancel(row: PendingRedemption) {
    setFailure(null);
    if (demo) {
      demo.dispatch({ type: "loyalty.cancel", id: row.id });
    } else {
      const { error } = await supabase.rpc("resolve_loyalty_redemption", {
        p_redemption_id: row.id,
        p_action: "cancel",
      });
      if (error) {
        if (explainFailure(error, t("rewards.cancelError"))) return;
        throw error;
      }
    }
    toast.success(t("rewards.cancelDone"));
    onChanged();
  }

  return (
    <section className="space-y-3" aria-labelledby="rewards-title">
      <SectionHeader
        id="rewards-title"
        icon={Gift}
        title={t("rewards.title")}
        description={t("rewards.hint")}
        as="h3"
      />

      {failure && <Notice tone="danger" title={failure} onDismiss={() => setFailure(null)} />}

      {pending.length > 0 && (
        <ul className="space-y-2" aria-label={t("rewards.pendingLabel")}>
          {pending.map((row) => {
            const days = Math.max(0, Math.ceil((Date.parse(row.expires_at) - today) / 86_400_000));
            return (
              <li
                key={row.id}
                className="app-action-card tone-pending flex flex-wrap items-center gap-3 p-3.5"
                style={{ borderInlineStartWidth: 4, borderInlineStartColor: "var(--tone-line)" }}
              >
                <Ticket className="size-5 shrink-0 text-[color:var(--tone-ink)]" aria-hidden />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-bold">{row.reward_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(days === 1 ? "rewards.daysLeftOne" : "rewards.daysLeftMany", {
                      count: days,
                      date: shortDate.format(new Date(row.expires_at)),
                    })}
                  </p>
                </div>
                <StatusBadge {...STATE.waiting} label={t("rewards.pendingBadge")} size="sm" />
                <button
                  type="button"
                  onClick={() => setCancelling(row)}
                  className="ms-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold"
                >
                  <Undo2 className="size-4 text-muted-foreground" aria-hidden />
                  {t("rewards.cancelPrize")}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {atLimit && <Hint tone="warning">{t("rewards.limit")}</Hint>}

      {rewards.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              points={points}
              canRedeem={!atLimit}
              onRedeem={() => setConfirming(reward)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        tone="info"
        icon={Gift}
        title={confirming ? t("rewards.confirmTitle", { name: confirming.name }) : ""}
        summary={
          confirming ? (
            <DetailList
              items={[
                {
                  key: "balance",
                  icon: Coins,
                  label: t("rewards.balance"),
                  previous: pts(points),
                  value: pts(points - confirming.cost_points),
                  delta: { label: `−${confirming.cost_points}`, tone: "neutral" },
                },
              ]}
            />
          ) : null
        }
        consequencesLabel={t("rewards.howTitle")}
        consequences={[
          { key: "store", icon: Store, text: t("rewards.stepStore") },
          { key: "days", icon: CalendarClock, text: t("rewards.stepDays") },
          { key: "back", icon: RotateCcw, tone: "success", text: t("rewards.stepRefund") },
        ]}
        confirmLabel={t("rewards.confirm")}
        confirmIcon={Check}
        cancelLabel={t("rewards.back")}
        errorText={t("rewards.redeemError")}
        onConfirm={() => (confirming ? redeem(confirming) : undefined)}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        tone="danger"
        icon={Undo2}
        title={cancelling ? t("rewards.cancelTitle", { name: cancelling.reward_name }) : ""}
        summary={
          cancelling ? (
            <DetailList
              items={[
                {
                  key: "balance",
                  icon: Coins,
                  label: t("rewards.balance"),
                  previous: pts(points),
                  value: pts(points + cancelling.cost_points),
                  delta: { label: `+${cancelling.cost_points}`, tone: "success" },
                },
              ]}
            />
          ) : null
        }
        consequences={
          cancelling
            ? [
                {
                  key: "refund",
                  icon: RotateCcw,
                  tone: "success",
                  text: t("rewards.cancelText", { n: cancelling.cost_points }),
                },
              ]
            : undefined
        }
        confirmLabel={t("rewards.cancelConfirm")}
        cancelLabel={t("rewards.keep")}
        errorText={t("rewards.cancelError")}
        onConfirm={() => (cancelling ? cancel(cancelling) : undefined)}
      />
    </section>
  );
}

/** Prêmio com o custo, a barra do saldo até o custo e o estado (disponível ou bloqueado). */
function RewardCard({
  reward,
  points,
  canRedeem,
  onRedeem,
}: {
  reward: LoyaltyReward;
  points: number;
  canRedeem: boolean;
  onRedeem: () => void;
}) {
  const { t } = useI18n();
  const missing = Math.max(0, reward.cost_points - points);
  const ready = missing === 0;
  const progress =
    reward.cost_points > 0 ? Math.min(100, (points / reward.cost_points) * 100) : 100;
  const StateIcon: LucideIcon = ready ? Check : Lock;
  const stateText = ready
    ? t("rewards.available")
    : t(missing === 1 ? "rewards.missingOne" : "rewards.missingMany", { n: missing });
  return (
    <li className="app-action-card flex flex-col gap-3 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{reward.name}</p>
          {reward.description && (
            <p className="text-xs text-muted-foreground">{reward.description}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--button-radius)] bg-muted px-2 py-1 text-xs font-bold tabular-nums">
          <Coins className="size-3.5 text-gold" aria-hidden />
          {t(reward.cost_points === 1 ? "rewards.costOne" : "rewards.costMany", {
            n: reward.cost_points,
          })}
        </span>
      </div>
      <div className={cn(TONE_CLASS[ready ? "success" : "neutral"], "space-y-1.5")}>
        <div
          role="progressbar"
          aria-label={reward.name}
          aria-valuemin={0}
          aria-valuemax={reward.cost_points}
          aria-valuenow={Math.min(points, reward.cost_points)}
          aria-valuetext={stateText}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-[color:var(--tone-line)]"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>
        <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--tone-ink)]">
          <StateIcon className="size-3.5 shrink-0" aria-hidden />
          {stateText}
        </p>
      </div>
      {ready && (
        <button
          type="button"
          disabled={!canRedeem}
          onClick={onRedeem}
          className="action-button action-confirm min-h-11 w-full"
        >
          <Gift className="size-4" aria-hidden />
          {t("rewards.redeem")}
        </button>
      )}
    </li>
  );
}
