import { useRef, useState } from "react";
import {
  Activity,
  Check,
  CheckCheck,
  Radio,
  ShieldCheck,
  Shuffle,
  Store,
  UsersRound,
} from "lucide-react";
import { ConfirmDialog, Notice, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import { numberActivityLevel, type NumberActivity } from "@/lib/whatsapp/number-activity";
export type DistributionState = {
  policy: { enabled: boolean; version: number };
  eligible: number;
  waiting: { barbershop_id: string; reason: string }[];
  reviews: { phone: string; restricted: boolean; version: number }[];
};
export type OperationalNumber = {
  id: string;
  display_phone: string | null;
  instance_name: string;
  routing_version: number;
  platform_control_identity?: { phone: string; instance: string } | null;
};
type Plan = {
  id: string;
  assignments: { shop: string; primary: string; backup: string; backup2: string | null }[];
  blocked: { shop: string; reason: string }[];
  applied_at: string | null;
  expires_at: string;
};
export function WhatsAppOperations({
  state,
  numbers,
  shops,
  activities,
  routes,
  request,
  refresh,
}: {
  state: DistributionState;
  numbers: OperationalNumber[];
  shops: { id: string; name: string }[];
  activities: Record<string, NumberActivity>;
  routes: { barbershop_id: string; staff_id: string | null }[];
  request: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [shop, setShop] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [policyConfirm, setPolicyConfirm] = useState(false);
  const pending = useRef(false);
  const key = useRef<string | null>(null);
  const [control, setControl] = useState<OperationalNumber | null>(null);
  const [ack, setAck] = useState(false);
  const [review, setReview] = useState<DistributionState["reviews"][number] | null>(null);
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("reviewed_in_app");
  const physical = [
    ...new Map(
      numbers.filter((n) => n.display_phone).map((n) => [n.display_phone!.replace(/\D/g, ""), n]),
    ).values(),
  ];
  const activity = physical.map((n) => activities[n.id]);
  const assigned = new Set(routes.filter((r) => r.staff_id === null).map((r) => r.barbershop_id))
    .size;
  const counts = [
    activity.reduce((sum, a) => sum + (a?.accepted ?? 0), 0),
    activity.filter((a) => ["regular", "established"].includes(numberActivityLevel(a))).length,
    assigned,
    Math.max(0, shops.length - assigned),
  ];
  async function run(work: () => Promise<void>, propagate = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure(null);
    setDone(false);
    try {
      await work();
    } catch (e) {
      setFailure(
        (e as { message?: string }).message?.includes("STALE")
          ? t("waOps.stale")
          : t("waOps.failed"),
      );
      if (propagate) throw e;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const shown = plan?.assignments.find((a) => a.shop === shop);
  const lookup = (id: string | null) =>
    numbers.find((n) => n.id === id)?.display_phone ?? t("waDistribution.noBackup");
  return (
    <section className="wa-future-stats wa-operation-header" aria-label={t("waRefine.stats")}>
      <div className="wa-operation-row">
        <section className="wa-operation-stats">
          <header>
            <h2>
              <Activity className="size-5" aria-hidden />
              {t("waRefine.stats")}
            </h2>
            <StatusBadge tone="info" label={t("waOps.window")} />
          </header>
          <p>{t("waOps.metricsHint")}</p>
          <div>
            {(["accepted", "consistent", "assigned", "waiting"] as const).map((name, i) => (
              <article key={name}>
                <span>{t(`waOps.${name}`)}</span>
                <strong>{counts[i]}</strong>
              </article>
            ))}
          </div>
        </section>
        <section className="wa-auto-coverage">
          <div>
            <label className="wa-distribution-toggle">
              <button
                type="button"
                role="switch"
                className="wa-toggle-control"
                aria-label={t("waAuto.coverage")}
                aria-checked={state.policy.enabled}
                disabled={busy}
                onClick={() => setPolicyConfirm(true)}
              >
                <span aria-hidden />
              </button>
              <strong>{t("waAuto.coverage")}</strong>
            </label>
            <StatusBadge
              tone={state.policy.enabled ? "info" : "neutral"}
              label={t(state.policy.enabled ? "waOps.on" : "waOps.off")}
            />
          </div>
          <p>{t("waOps.coverageHint")}</p>
          <StatusBadge
            tone={state.eligible >= 2 ? "success" : "warning"}
            icon={UsersRound}
            label={t("waOps.eligible", { count: state.eligible })}
          />
        </section>
        <section className="wa-auto-plan">
          <h3>
            <Shuffle className="size-5" aria-hidden />
            {t("waAuto.title")}
          </h3>
          <p>{t("waAuto.basis")}</p>
          <div className="wa-auto-shops" role="radiogroup" aria-label={t("waAuto.shop")}>
            {shops.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={shop === s.id}
                disabled={busy}
                onClick={() => {
                  setShop(s.id);
                  setPlan(null);
                  setDone(false);
                  key.current = null;
                }}
              >
                <Store className="size-4" aria-hidden />
                {s.name}
                <span className="wa-shop-selection" data-selected={shop === s.id} aria-hidden>
                  <span className="wa-shop-selection-fill" />
                  <Check className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="action-button action-confirm"
            disabled={!shop || busy}
            onClick={() =>
              void run(async () => {
                key.current ??= crypto.randomUUID();
                setPlan(
                  (await request("platform_plan_whatsapp_distribution", {
                    p_request_id: key.current,
                    p_shops: [shop],
                    p_replace: true,
                  })) as Plan,
                );
                key.current = null;
              })
            }
          >
            <Shuffle className="size-4" aria-hidden />
            {t("waAuto.generate")}
          </button>
          {plan && (
            <div className="wa-auto-result" aria-live="polite">
              {shown ? (
                <>
                  <div className="wa-auto-proposal">
                    {[shown.primary, shown.backup, shown.backup2].map((id, i) => (
                      <article key={i}>
                        {i === 0 ? (
                          <Radio className="size-4" aria-hidden />
                        ) : (
                          <ShieldCheck className="size-4" aria-hidden />
                        )}
                        <span>
                          {t(i === 0 ? "waDistribution.primary" : "waDistribution.backup")}
                          {i > 0 ? ` ${i}` : ""}
                        </span>
                        <strong>{lookup(id)}</strong>
                      </article>
                    ))}
                  </div>
                  <p>{t("waOps.applyHint")}</p>
                  <button
                    type="button"
                    disabled={busy || Boolean(plan.applied_at)}
                    className="action-button action-confirm"
                    onClick={() =>
                      void run(async () => {
                        await request("platform_apply_whatsapp_distribution", { p_plan: plan.id });
                        setPlan(null);
                        setDone(true);
                        await refresh();
                      })
                    }
                  >
                    <CheckCheck className="size-4" aria-hidden />
                    {t("waOps.apply")}
                  </button>
                </>
              ) : (
                <Notice tone="warning" title={t("waOps.noPair")} />
              )}
            </div>
          )}
          {done && <StatusBadge tone="success" label={t("waCentral.saved")} />}
        </section>
      </div>
      {failure && (
        <div className="p-3">
          <Notice tone="danger" title={failure} />
        </div>
      )}
      <details className="border-t border-border p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">
          {t("waOps.controlTitle")}
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {numbers
            .filter((n) => n.display_phone)
            .map((n) => (
              <button
                type="button"
                className="action-button"
                disabled={busy}
                key={n.id}
                onClick={() => {
                  setControl(n);
                  setAck(false);
                }}
              >
                <ShieldCheck className="size-4" aria-hidden />
                {n.display_phone}
                {n.platform_control_identity?.phone === n.display_phone?.replace(/\D/g, "") &&
                  n.platform_control_identity?.instance === n.instance_name && (
                    <Check className="size-4" aria-hidden />
                  )}
              </button>
            ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.reviews
            .filter(
              (r) =>
                r.restricted &&
                physical.some((n) => n.display_phone?.replace(/\D/g, "") === r.phone),
            )
            .map((r) => (
              <button
                type="button"
                className="action-button action-edit"
                key={r.phone}
                disabled={busy}
                onClick={() => {
                  setReview(r);
                  setReference("");
                  setAck(false);
                }}
              >
                <Activity className="size-4" aria-hidden />
                {r.phone} · {t("waOps.review")}
              </button>
            ))}
        </div>
      </details>
      <ConfirmDialog
        open={policyConfirm}
        onOpenChange={setPolicyConfirm}
        tone="info"
        title={t("waAuto.coverage")}
        description={t("waOps.coverageHint")}
        confirmLabel={t(state.policy.enabled ? "waOps.disable" : "waOps.enable")}
        cancelLabel={t("common.cancel")}
        onConfirm={() =>
          run(async () => {
            await request("platform_set_whatsapp_automatic", {
              p_enabled: !state.policy.enabled,
              p_version: state.policy.version,
            });
            await refresh();
          }, true)
        }
        errorText={failure ?? undefined}
      />
      <ConfirmDialog
        open={Boolean(control)}
        onOpenChange={(open) => {
          if (!open) setControl(null);
        }}
        tone="warning"
        title={t("waOps.controlTitle")}
        description={control?.display_phone}
        confirmLabel={t("waOps.confirm")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={!ack}
        onConfirm={() =>
          run(async () => {
            if (!control) return;
            await request("platform_confirm_whatsapp_control", {
              p_id: control.id,
              p_version: control.routing_version,
              p_phone: control.display_phone,
              p_instance: control.instance_name,
              p_isolated: true,
            });
            await refresh();
          }, true)
        }
        errorText={failure ?? undefined}
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          {t("waOps.controlAck")}
        </label>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        tone="warning"
        title={t("waOps.review")}
        description={t("waOps.reviewHint")}
        confirmLabel={t("waOps.confirm")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={!ack || !/^[A-Za-z0-9_.:-]{3,100}$/.test(reference)}
        onConfirm={() =>
          run(async () => {
            if (!review) return;
            await request("platform_review_whatsapp_phone", {
              p_phone: review.phone,
              p_version: review.version,
              p_evidence: evidence,
              p_reference: reference,
              p_confirmed: ack,
            });
            await refresh();
          }, true)
        }
        errorText={failure ?? undefined}
      >
        <label className="grid gap-1 text-sm">
          {t("waOps.evidence")}
          <select
            className="min-h-11 rounded-xl border border-border bg-background px-3"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          >
            <option value="reviewed_in_app">{t("waOps.inApp")}</option>
            <option value="provider_confirmed">{t("waOps.provider")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t("waOps.reference")}
          <input
            className="min-h-11 rounded-xl border border-border bg-background px-3"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          {t("waOps.reviewAck")}
        </label>
      </ConfirmDialog>
    </section>
  );
}
