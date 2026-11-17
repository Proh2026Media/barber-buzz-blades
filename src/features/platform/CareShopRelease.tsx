import { useEffect, useRef, useState } from "react";
import { Store, RefreshCw, Power, Pause, UserRound, X } from "lucide-react";
import {
  ActionResult,
  ConfirmDialog,
  Notice,
  SectionHeader,
  StatusBadge,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
import { guardedFetch } from "@/lib/demo-guard";
import {
  shopReleaseState,
  checkShopReleaseNumbers,
  type ReleaseShop,
  type ReleaseCustomer,
  type ShopReleaseState,
} from "@/lib/whatsapp/shop-release";
type Decision = {
  action: "allow" | "pause" | "revoke";
  shop: ReleaseShop;
  customer?: ReleaseCustomer;
};
/** Ampliação sempre explícita; leitura e conferência não concedem acesso. */
export function CareShopRelease({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n(),
    demo = useDemo();
  const [data, setData] = useState<ShopReleaseState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<MessageKey | null>(null),
    [decision, setDecision] = useState<Decision | null>(null);
  const live = useRef(false),
    pending = useRef(false),
    abort = useRef<AbortController | null>(null);
  async function run(choice?: Decision, check?: { shop: ReleaseShop; customer: ReleaseCustomer }) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const user = (await supabase.auth.getSession()).data.session?.user.id;
      if (!user) throw Error("SESSION_REQUIRED");
      if (check)
        await checkShopReleaseNumbers(
          {
            current: async () =>
              live.current && (await supabase.auth.getSession()).data.session?.user.id === user,
            read: async () => {
              const r = await supabase
                .rpc("care_shop_release_check", {
                  p_shop: check.shop.id,
                  p_customer: check.customer.id,
                })
                .abortSignal(controller.signal);
              if (r.error) throw r.error;
              return r.data;
            },
            verify: async (target) => {
              const session = (await supabase.auth.getSession()).data.session;
              if (!session || session.user.id !== user) throw Error("SESSION_REQUIRED");
              const r = await guardedFetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-whatsapp`,
                {
                  method: "POST",
                  signal: controller.signal,
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ action: "status", channel_id: target.id }),
                },
              );
              if (!r.ok) throw Error("PILOT_CONNECTION_CHECK_FAILED");
              return r.json();
            },
          },
          controller.signal,
        );
      const r = await supabase
        .rpc("care_shop_release_admin", {
          p_action: choice?.action ?? "read",
          p_values: choice
            ? {
                confirmed: true,
                shop_id: choice.shop.id,
                customer_id: choice.customer?.id,
                version: choice.shop.version,
                policy_version: data?.policy_version,
                pause_version: data?.pause_version,
              }
            : {},
        })
        .abortSignal(controller.signal);
      if (r.error) throw r.error;
      if (!live.current || (await supabase.auth.getSession()).data.session?.user.id !== user)
        throw Error("SESSION_REQUIRED");
      setData(shopReleaseState(r.data));
      setDecision(null);
      if (choice) onChanged();
    } catch (e) {
      const code = (e as Error).message;
      if (live.current)
        setError(
          code === "GROUP_STALE"
            ? "carePilot.stale"
            : code === "GROUP_CAPABILITY_REQUIRED" || code === "PILOT_CONNECTION_CHECK_FAILED"
              ? "carePilot.checkNumbers"
              : code === "WA_SENDING_PAUSED"
                ? "careRelease.enginePaused"
                : "carePilot.error",
        );
      if (choice) throw Error("RELEASE_FAILED");
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    live.current = true;
    void latest.current();
    return () => {
      live.current = false;
      abort.current?.abort();
    };
  }, [demo]);
  return (
    <section className="app-action-card min-w-0 space-y-4 p-4 tablet:p-5" aria-busy={busy}>
      <SectionHeader
        icon={Store}
        title={t("careRelease.title")}
        aside={
          <button
            className="action-button"
            disabled={busy || Boolean(demo)}
            onClick={() => void run()}
          >
            <RefreshCw aria-hidden />
            {t("waCentral.refresh")}
          </button>
        }
      />
      <p className="text-sm text-muted-foreground">{t("careRelease.scope")}</p>
      {data && !data.running && <Notice tone="warning" title={t("careRelease.enginePaused")} />}
      <ActionResult
        state={error ? "error" : busy ? "saving" : null}
        text={t(error ?? "carePilot.checking")}
        onRetry={() => void run()}
      />
      <div className="grid min-w-0 gap-3 pc:grid-cols-2">
        {data?.shops.map((shop) => (
          <article key={shop.id} className="min-w-0 space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 break-words font-semibold">{shop.name}</h3>
              <StatusBadge
                tone={shop.enabled ? "success" : "neutral"}
                label={t(shop.enabled ? "careRelease.released" : "careRelease.blocked")}
              />
            </div>
            {shop.enabled && (
              <button
                className="action-button action-danger"
                disabled={busy}
                onClick={() => setDecision({ action: "pause", shop })}
              >
                <Pause aria-hidden />
                {t("careRelease.pause")}
              </button>
            )}
            {!shop.customers.length && (
              <p className="text-sm text-muted-foreground">{t("careRelease.empty")}</p>
            )}
            {shop.customers.map((customer) => (
              <div key={customer.id} className="space-y-2 border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <UserRound className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words text-sm font-medium">{customer.name}</span>
                  <StatusBadge
                    tone={shop.enabled && customer.allowed ? "success" : "neutral"}
                    label={t(
                      shop.enabled && customer.allowed
                        ? "careRelease.allowed"
                        : "careRelease.blocked",
                    )}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="action-button"
                    disabled={busy}
                    onClick={() => void run(undefined, { shop, customer })}
                  >
                    <RefreshCw aria-hidden />
                    {t("careRelease.check")}
                  </button>
                  {shop.enabled && customer.allowed ? (
                    <button
                      className="action-button action-danger"
                      disabled={busy}
                      onClick={() => setDecision({ action: "revoke", shop, customer })}
                    >
                      <X aria-hidden />
                      {t("careRelease.revoke")}
                    </button>
                  ) : (
                    <button
                      className="action-button action-confirm"
                      disabled={busy || !data.running || !customer.ready}
                      onClick={() => setDecision({ action: "allow", shop, customer })}
                    >
                      <Power aria-hidden />
                      {t("careRelease.allow")}
                    </button>
                  )}
                </div>
                {!customer.ready && (
                  <p className="text-xs text-muted-foreground">{t("careRelease.needsCheck")}</p>
                )}
              </div>
            ))}
          </article>
        ))}
      </div>
      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        tone={decision?.action === "allow" ? "info" : "warning"}
        title={t(
          decision?.action === "allow"
            ? "careRelease.allow"
            : decision?.action === "pause"
              ? "careRelease.pause"
              : "careRelease.revoke",
        )}
        summary={
          <p className="break-words">
            {decision?.shop.name}
            {decision?.customer ? ` · ${decision.customer.name}` : ""}
          </p>
        }
        description={t("careRelease.confirmScope")}
        confirmLabel={t("careRelease.confirm")}
        cancelLabel={t("common.back")}
        errorText={t("carePilot.error")}
        errorDetail={error ? t(error) : undefined}
        onConfirm={() => (decision ? run(decision) : undefined)}
      />
    </section>
  );
}
