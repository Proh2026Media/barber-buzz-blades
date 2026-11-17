import { useState } from "react";
import { CareShopRelease } from "./CareShopRelease";
import { CarePilotRelease } from "./CarePilotRelease";
import {
  UsersRound,
  ShieldCheck,
  Clock3,
  TriangleAlert,
  RefreshCw,
  Pause,
  Power,
  Trash2,
} from "lucide-react";
import { ConfirmDialog, Notice, SectionHeader, StatusBadge } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import type { Json } from "@/integrations/supabase/types";
import { careStates } from "@/features/whatsapp/care-states";
export type CareCycleAdminData = {
  enabled: boolean;
  pilot?: boolean;
  policy_version: number;
  capabilities_ready: boolean;
  registry_pending: number;
  cleanup_orphans: number;
  groups: {
    id: string;
    shop_name: string;
    customer_name: string;
    state: string;
    ready: boolean;
    version: number;
    cycle_id: string | null;
    cycle_state: string | null;
    expires_at: string | null;
    reason: string;
    cleanup_pending: boolean | null;
    legacy: boolean;
    approved_count: number;
    observed_count: number;
    numbers_changed: boolean;
  }[];
};
/** Estado operacional sem QR, convite, conversa ou conteúdo de mensagens. */
export function CareCycleOperations({
  data,
  busy,
  error,
  request,
}: {
  data: CareCycleAdminData;
  busy: boolean;
  error: boolean;
  request: (action: string, values?: Json) => Promise<void>;
}) {
  const { t, intlLocale } = useI18n();
  const [policy, setPolicy] = useState(false);
  const [legacy, setLegacy] = useState<CareCycleAdminData["groups"][number] | null>(null);
  const stats = [
    {
      icon: ShieldCheck,
      label: t("careCycle.statsActive"),
      count: data.groups.filter((g) => g.ready === true).length,
    },
    {
      icon: Clock3,
      label: t("careCycle.statsPreparing"),
      count: data.groups.filter((g) =>
        ["draft", "creating", "preparing", "waiting_customer"].includes(g.cycle_state ?? ""),
      ).length,
    },
    {
      icon: TriangleAlert,
      label: t("careCycle.statsReview"),
      count: data.groups.filter(
        (g) =>
          !["closing", "closed"].includes(g.cycle_state ?? "") &&
          (g.legacy ||
            g.numbers_changed ||
            ["paused", "creation_unknown"].includes(g.cycle_state ?? "")),
      ).length,
    },
    {
      icon: Trash2,
      label: t("careCycle.statsCleanup"),
      count:
        data.cleanup_orphans +
        data.groups.filter(
          (g) => g.cycle_state === "closing" || (g.cycle_state === "closed" && g.cleanup_pending),
        ).length,
    },
  ];
  return (
    <section className="min-w-0 space-y-4" aria-busy={busy}>
      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
        {stats.map(({ icon: Icon, label, count }) => (
          <div key={label} className="app-action-card flex min-w-0 items-center gap-3 p-4">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>
      {data.pilot && <CarePilotRelease onChanged={() => void request("read").catch(() => {})} />}
      <CareShopRelease onChanged={() => void request("read").catch(() => {})} />
      <div className="app-action-card space-y-3 p-4 tablet:p-5">
        <SectionHeader icon={UsersRound} title={t("care.adminTitle")} />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={data.enabled ? "success" : "neutral"}
            label={t(data.enabled ? "waOps.on" : "waOps.off")}
          />
          {data.pilot && <StatusBadge tone="warning" label={t("careCycle.pilot")} />}
          {!data.pilot && (
            <button
              className="action-button"
              disabled={busy || (!data.enabled && !data.capabilities_ready)}
              onClick={() => setPolicy(true)}
            >
              <Power aria-hidden />
              {t(data.enabled ? "careCycle.disable" : "careCycle.enable")}
            </button>
          )}
          <button
            className="action-button"
            disabled={busy}
            onClick={() => void request("read").catch(() => {})}
          >
            <RefreshCw aria-hidden />
            {t("waCentral.refresh")}
          </button>
        </div>
        {!data.pilot && !data.capabilities_ready && (
          <Notice tone="warning" title={t("careCycle.requireTwo")} />
        )}
        {error && <Notice tone="danger" title={t("care.error")} />}
      </div>
      <div className="grid gap-3 min-[1100px]:grid-cols-2">
        {data.groups.map((g) => {
          const review =
            g.legacy ||
            g.numbers_changed ||
            ["paused", "creation_unknown"].includes(g.cycle_state ?? "");
          const active = g.ready === true;
          const label =
            g.cycle_state === "closing"
              ? t("careCycle.closing")
              : g.cycle_state === "closed" && g.cleanup_pending
                ? t("careCycle.statsCleanup")
                : g.legacy
                  ? t("careCycle.legacy")
                  : !g.ready && g.cycle_state === "active"
                    ? t("care.unavailable")
                    : t(careStates[g.state] ?? "care.unavailable");
          return (
            <article key={g.id} className="app-action-card min-w-0 space-y-3 p-4 tablet:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{g.shop_name}</p>
                  <h3 className="break-words font-semibold">{g.customer_name}</h3>
                </div>
                <StatusBadge
                  tone={active ? "success" : review ? "warning" : "neutral"}
                  label={label}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-4" aria-hidden />
                  {t(g.approved_count === 1 ? "careCycle.oneNumber" : "careCycle.numbers", {
                    count: g.approved_count,
                  })}
                </span>
                {g.expires_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-4" aria-hidden />
                    {t("careCycle.until", {
                      date: new Date(g.expires_at).toLocaleDateString(intlLocale),
                    })}
                  </span>
                )}
              </div>
              {g.numbers_changed &&
                !g.legacy &&
                !["closing", "closed"].includes(g.cycle_state ?? "") && (
                  <Notice tone="warning" title={t("careCycle.customerReview")} />
                )}
              <div className="flex flex-wrap gap-2">
                {g.legacy ? (
                  <button
                    className="action-button action-danger"
                    disabled={busy}
                    onClick={() => setLegacy(g)}
                  >
                    <Trash2 aria-hidden />
                    {t("careCycle.closeLegacy")}
                  </button>
                ) : (
                  <>
                    <button
                      className="action-button"
                      disabled={busy}
                      onClick={() =>
                        void request("review", { group_id: g.id, version: g.version }).catch(
                          () => {},
                        )
                      }
                    >
                      <RefreshCw aria-hidden />
                      {t("care.review")}
                    </button>
                    {!["closed", "closing"].includes(g.cycle_state ?? "") && (
                      <button
                        className="action-button"
                        disabled={busy}
                        onClick={() =>
                          void request("pause", { group_id: g.id, version: g.version }).catch(
                            () => {},
                          )
                        }
                      >
                        <Pause aria-hidden />
                        {t("care.pause")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {data.cleanup_orphans > 0 && (
        <Notice
          tone="warning"
          title={t(data.cleanup_orphans === 1 ? "careCycle.oneOrphan" : "careCycle.orphans", {
            count: data.cleanup_orphans,
          })}
        />
      )}
      <ConfirmDialog
        open={policy}
        onOpenChange={setPolicy}
        title={t(data.enabled ? "careCycle.disable" : "careCycle.enable")}
        confirmLabel={t(data.enabled ? "careCycle.disable" : "careCycle.enable")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={busy}
        errorText={t("care.error")}
        consequences={[
          { key: "isolation", icon: ShieldCheck, tone: "warning", text: t("care.visibility") },
        ]}
        onConfirm={async () => {
          await request("enrollment", {
            enabled: !data.enabled,
            version: data.policy_version,
            confirmed: true,
          });
          setPolicy(false);
        }}
      />
      <ConfirmDialog
        open={Boolean(legacy)}
        onOpenChange={(open) => {
          if (!open) setLegacy(null);
        }}
        title={t("careCycle.closeLegacy")}
        tone="warning"
        icon={Trash2}
        confirmLabel={t("careCycle.closeLegacy")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={busy}
        errorText={t("care.error")}
        consequences={[
          { key: "legacy", icon: TriangleAlert, tone: "warning", text: t("careCycle.legacyHint") },
        ]}
        onConfirm={async () => {
          if (!legacy) return;
          await request("close_legacy", {
            group_id: legacy.id,
            version: legacy.version,
            confirmed: true,
          });
          setLegacy(null);
        }}
      />
    </section>
  );
}
