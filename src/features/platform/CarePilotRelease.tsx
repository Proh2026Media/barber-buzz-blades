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

import {
  checkPilotConnections,
  pilotState,
  type PilotState as State,
} from "@/lib/whatsapp/pilot-check";
import { guardedFetch } from "@/lib/demo-guard";

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
  async function action(
    name: "read" | "activate" | "pause",
    propagate = false,
    connections = false,
  ) {
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
          if (name === "read" && connections) {
            return checkPilotConnections(
              {
                current: async () =>
                  live.current &&
                  !demo &&
                  (await supabase.auth.getSession()).data.session?.user.id === before,
                read: async () => {
                  const result = await supabase
                    .rpc("care_pilot_connection_check")
                    .abortSignal(controller.signal);
                  if (result.error) throw result.error;
                  return result.data;
                },
                verify: async (target) => {
                  const session = (await supabase.auth.getSession()).data.session;
                  if (!session || session.user.id !== before) throw Error("SESSION_REQUIRED");
                  const response = await guardedFetch(
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
                  const result = await response.json();
                  if (!response.ok)
                    throw Error(
                      response.status === 401 || response.status === 403
                        ? "SESSION_REQUIRED"
                        : "PILOT_CONNECTION_CHECK_FAILED",
                    );
                  return result;
                },
              },
              controller.signal,
              data?.scoped ? data : null,
            );
          }
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
          const next = pilotState(r.data);
          const current = (await supabase.auth.getSession()).data.session?.user.id;
          if (current !== before) throw Error("SESSION_REQUIRED");
          return next;
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => {
              reject(Error("PILOT_TIMEOUT"));
              controller.abort();
            },
            connections ? 30000 : 15000,
          );
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
            : code === "PILOT_CONNECTION_CHECK_FAILED"
              ? "carePilot.connectionFailed"
              : code === "PILOT_SCOPE_REQUIRED"
                ? "carePilot.noScope"
                : code === "SESSION_REQUIRED"
                  ? "errors.integration.session"
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
          {!checked && !busy && !data.paused && !active && (
            <Notice tone="warning" title={t("carePilot.incompleteHint")} />
          )}
          {!checked &&
            !busy &&
            (!data.scoped ? (
              <Notice tone="warning" title={t("carePilot.noScope")} />
            ) : (
              data.paused &&
              !data.preparation_ready && (
                <Notice tone="warning" title={t("carePilot.checkNumbers")} />
              )
            ))}
        </>
      )}
      {!data && !error && <p role="status">{t("shop.loading")}</p>}
      <ActionResult
        state={error ? "error" : busy ? "saving" : null}
        text={t(error ?? (busy ? "carePilot.checking" : "carePilot.checked"))}
      />
      {!busy && !error && checked && data && (
        <Notice
          tone={active || canActivate ? "success" : "warning"}
          title={t(
            active ? "carePilot.active" : canActivate ? "carePilot.checked" : "carePilot.pending",
          )}
        >
          {t(
            active
              ? "carePilot.checkedActive"
              : !data.paused
                ? "carePilot.incompleteHint"
                : !data.scoped
                  ? "carePilot.noScope"
                  : !data.preparation_ready
                    ? "carePilot.checkNumbers"
                    : "carePilot.checkedReady",
          )}
        </Notice>
      )}
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
          onClick={() => void action("read", false, true)}
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
