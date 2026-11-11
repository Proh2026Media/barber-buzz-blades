import { useDemo } from "@/features/demo/context";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { ConfirmDialog, Notice } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Control = {
  scope: string;
  paused: boolean;
  reason: string;
  changed_at: string;
  version: number;
};
type Dashboard = {
  controls: Control[];
  accepted_24h: number;
  unknown_24h: number;
  in_flight: number;
  pending: number;
};
const reasonKeys: Record<string, MessageKey> = {
  review: "waSafety.review",
  restriction: "waSafety.restriction",
  maintenance: "waSafety.maintenance",
  resumed: "waSafety.resumed",
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";

export function WhatsAppSendingControls({
  numbers,
}: {
  numbers: { id: string; label?: string | null; display_phone?: string | null }[];
}) {
  const { t, locale } = useI18n();
  const demo = useDemo();
  const [data, setData] = useState<Dashboard | null>(null);
  const [scope, setScope] = useState("global");
  const [reason, setReason] = useState("review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);
  const live = useRef(false);
  async function load() {
    const result = await supabase.rpc("whatsapp_send_dashboard");
    if (result.error) throw result.error;
    if (live.current) setData(result.data as unknown as Dashboard);
  }
  async function run(work: () => Promise<void>, propagate = false) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await work();
    } catch {
      if (live.current) setError(true);
      if (propagate) throw new Error("WA_CONTROL_FAILED");
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  useEffect(() => {
    live.current = true;
    void run(load);
    return () => {
      live.current = false;
    };
    // A central é remontada na troca de conta; a consulta não acompanha seleção de cartões.
  }, [demo]);
  const selected = data?.controls.find((c) => c.scope === scope);
  const globalPaused = data?.controls.some((c) => c.scope === "global" && c.paused);
  async function save() {
    await run(async () => {
      const result = await supabase.rpc("set_whatsapp_send_pause", {
        p_scope: scope,
        p_paused: !selected?.paused,
        p_reason: selected?.paused ? "resumed" : reason,
        p_version: selected?.version ?? 0,
      });
      if (result.error) {
        await load();
        throw result.error;
      }
      if (live.current) setConfirm(false);
      await load();
    }, true);
  }
  return (
    <details className="min-w-0 rounded-2xl border border-border bg-card p-4 tablet:p-5">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
        {t("waSafety.title")} ·{" "}
        {t(
          !data
            ? "waSafety.unchecked"
            : globalPaused
              ? "waSafety.globalPaused"
              : "waSafety.globalEnabled",
        )}
      </summary>
      <div className="mt-3 space-y-4">
        {error && <Notice tone="danger" title={t("waSafety.error")} />}
        <div className="grid gap-3 tablet:grid-cols-2">
          <label className="min-w-0 space-y-1 text-sm">
            <span>{t("waSafety.scope")}</span>
            <select
              aria-label={t("waSafety.scope")}
              className={field}
              value={scope}
              disabled={busy || confirm}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="global">{t("waSafety.global")}</option>
              <option value="platform">{t("waOrg.access")}</option>
              {numbers
                .filter((n) => n.display_phone)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.display_phone} · {n.display_phone}
                  </option>
                ))}
            </select>
          </label>
          {!selected?.paused && (
            <label className="min-w-0 space-y-1 text-sm">
              <span>{t("waSafety.reason")}</span>
              <select
                aria-label={t("waSafety.reason")}
                className={field}
                value={reason}
                disabled={busy || confirm}
                onChange={(e) => setReason(e.target.value)}
              >
                {["review", "restriction", "maintenance"].map((r) => (
                  <option key={r} value={r}>
                    {t(reasonKeys[r])}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected?.paused && (
            <Notice tone="warning" title={t("waSafety.paused")}>
              {t(reasonKeys[selected.reason] ?? "waSafety.review")} ·{" "}
              {new Date(selected.changed_at).toLocaleString(locale)}
            </Notice>
          )}
        </div>
        {globalPaused && scope !== "global" && (
          <Notice tone="info" title={t("waSafety.globalWins")} />
        )}
        <p className="text-sm text-muted-foreground">{t("waSafety.inFlightHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            className="action-button"
            disabled={Boolean(demo) || !data || busy}
            onClick={() => setConfirm(true)}
          >
            {selected?.paused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
            {t(selected?.paused ? "waSafety.resume" : "waSafety.pause")}
          </button>
          <button
            className="action-button"
            disabled={Boolean(demo) || busy}
            onClick={() => void run(load)}
          >
            <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
            {t("waCentral.refresh")}
          </button>
        </div>
        {data && (
          <dl className="grid grid-cols-2 gap-3 text-sm min-[900px]:grid-cols-4" aria-live="polite">
            {(
              [
                ["waSafety.accepted", data.accepted_24h],
                ["waSafety.unknown", data.unknown_24h],
                ["waSafety.inFlight", data.in_flight],
                ["waSafety.pending", data.pending],
              ] as [MessageKey, number][]
            ).map(([key, value]) => (
              <div key={key} className="min-w-0 rounded-xl bg-muted/50 p-3">
                <dt>{t(key)}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-muted-foreground">{t("waSafety.receiptHint")}</p>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value);
        }}
        tone="warning"
        icon={ShieldAlert}
        title={t(selected?.paused ? "waSafety.resume" : "waSafety.pause")}
        consequences={[
          {
            key: "effect",
            icon: ShieldAlert,
            tone: "warning",
            text: t(selected?.paused ? "waSafety.resumeHint" : "waSafety.inFlightHint"),
          },
        ]}
        confirmLabel={t(selected?.paused ? "waSafety.resume" : "waSafety.pause")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={busy}
        errorText={t("waSafety.error")}
        onConfirm={save}
      />
    </details>
  );
}
