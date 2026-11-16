import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Power, Pause, RefreshCw, UsersRound } from "lucide-react";
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

type State = {
  contract: "bc-pilot-release-v1";
  scoped: boolean;
  isolated: boolean;
  shop_id: string | null;
  customer_id: string | null;
  shop_name: string | null;
  customer_name: string | null;
  policy_version: number;
  pause_version: number;
  paused: boolean;
  cycles: boolean;
  assistance: boolean;
  preparation_ready: boolean;
};

/** Leitura nunca ativa. Liberação/pausa passam pelo mesmo contrato atômico e CAS. */
export function CarePilotRelease({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const demo = useDemo();
  const [data, setData] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [checked, setChecked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const live = useRef(false),
    pending = useRef(false);
  async function action(name: "read" | "activate" | "pause", propagate = false) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setChecked(false);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const next = await Promise.race([
        (async () => {
          const before = (await supabase.auth.getSession()).data.session?.user.id;
          if (!before) throw Error("SESSION_REQUIRED");
          const r = await supabase
            .rpc("care_pilot_admin", {
              p_action: name,
              p_values:
                name === "read"
                  ? {}
                  : {
                      confirmed: true,
                      shop_id: data?.shop_id,
                      customer_id: data?.customer_id,
                      policy_version: data?.policy_version,
                      pause_version: data?.pause_version,
                    },
            })
            .abortSignal(controller.signal);
          if (r.error) throw r.error;
          const next = r.data as unknown as State;
          if (
            next?.contract !== "bc-pilot-release-v1" ||
            [
              next.paused,
              next.cycles,
              next.assistance,
              next.preparation_ready,
              next.scoped,
              next.isolated,
            ].some((value) => typeof value !== "boolean")
          )
            throw Error("CONTRACT_REQUIRED");
          const current = (await supabase.auth.getSession()).data.session?.user.id;
          if (current !== before) throw Error("SESSION_REQUIRED");
          return next;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(Error("PILOT_TIMEOUT"));
            controller.abort();
          }, 15000);
        }),
      ]);
      if (!live.current) return;
      setData(next);
      setChecked(name === "read");
      setConfirm(false);
      if (name !== "read") onChanged();
    } catch (failure) {
      if (live.current) {
        setData(null);
        const code = (failure as { message?: string })?.message;
        setError(
          code === "PILOT_TIMEOUT"
            ? "carePilot.timeout"
            : code === "GROUP_STALE"
              ? "carePilot.stale"
              : code === "GROUP_CAPABILITY_REQUIRED"
                ? "carePilot.checkNumbers"
                : "carePilot.error",
        );
      }
      if (propagate) throw Error("PILOT_CONTROL_FAILED");
    } finally {
      clearTimeout(timer);
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const run = useRef(action);
  run.current = action;
  useEffect(() => {
    live.current = true;
    void run.current("read");
    return () => {
      live.current = false;
    };
  }, [demo]);
  const active = data && !data.paused && data.cycles && data.assistance;
  const canActivate =
    data?.scoped && data.paused && !data.cycles && !data.assistance && data.preparation_ready;
  return (
    <div className="app-action-card min-w-0 space-y-3 p-4 tablet:p-5" aria-busy={busy}>
      <SectionHeader icon={ShieldCheck} title={t("carePilot.title")} />
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={active ? "success" : "warning"}
              label={t(
                active
                  ? "carePilot.active"
                  : data.paused
                    ? "carePilot.paused"
                    : "carePilot.incomplete",
              )}
            />
            <span className="min-w-0 break-words text-sm font-semibold">
              {data.shop_name} · {data.customer_name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t("carePilot.scope")}</p>
          {!data.paused && !active && (
            <Notice tone="warning" title={t("carePilot.incompleteHint")} />
          )}
          {!data.scoped ? (
            <Notice tone="warning" title={t("carePilot.noScope")} />
          ) : (
            data.paused &&
            !data.preparation_ready && <Notice tone="warning" title={t("carePilot.checkNumbers")} />
          )}
        </>
      )}
      {!data && !error && <p role="status">{t("shop.loading")}</p>}
      <ActionResult
        state={error ? "error" : busy ? "saving" : checked ? "saved" : null}
        text={t(error ?? (busy ? "carePilot.checking" : "carePilot.checked"))}
        detail={
          !busy && !error && checked && data
            ? t(
                active
                  ? "carePilot.checkedActive"
                  : !data.paused
                    ? "carePilot.incompleteHint"
                    : !data.scoped
                      ? "carePilot.noScope"
                      : !data.preparation_ready
                        ? "carePilot.checkNumbers"
                        : "carePilot.checkedReady",
              )
            : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        {data?.paused ? (
          <button
            type="button"
            className="action-button action-confirm"
            disabled={busy || !canActivate}
            onClick={() => setConfirm(true)}
          >
            <Power aria-hidden />
            {t("carePilot.activate")}
          </button>
        ) : (
          data && (
            <button
              type="button"
              className="action-button action-danger"
              disabled={busy}
              onClick={() => void action("pause")}
            >
              <Pause aria-hidden />
              {t("carePilot.pause")}
            </button>
          )
        )}
        <button
          type="button"
          className="action-button"
          disabled={busy}
          onClick={() => void action("read")}
        >
          <RefreshCw aria-hidden className={busy ? "motion-safe:animate-spin" : undefined} />
          {t(busy ? "carePilot.checking" : "carePilot.refresh")}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        tone="warning"
        onOpenChange={setConfirm}
        title={t("carePilot.activate")}
        icon={ShieldCheck}
        confirmLabel={t("carePilot.activate")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={busy || !canActivate}
        errorText={t(error ?? "carePilot.error")}
        consequences={[
          {
            key: "scope",
            icon: UsersRound,
            text: `${data?.shop_name ?? ""} · ${data?.customer_name ?? ""}`,
          },
          { key: "sending", icon: ShieldCheck, text: t("carePilot.confirm") },
        ]}
        onConfirm={() => action("activate", true)}
      />
    </div>
  );
}
