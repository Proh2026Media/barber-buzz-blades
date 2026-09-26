import { useEffect, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n } from "@/lib/i18n";

export type PrivacyRequest = {
  id: string;
  user_id: string;
  status: "requested" | "reviewing" | "cancelled";
  created_at: string;
  updated_at: string;
};

export function DataRights({ admin = false }: { admin?: boolean }) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const confirmWord = t("dataRights.confirmWord");
  const [rows, setRows] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!admin) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (demo) {
      setRows(demo.privacyRequests.filter((row) => row.status !== "cancelled"));
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const { data, error: failure } = await supabase.rpc("list_privacy_requests", {
          p_admin: true,
        });
        if (cancelled) return;
        if (failure) {
          setError(tNow("ins.rights.loadError"));
        } else {
          setRows(Array.isArray(data) ? (data as unknown as PrivacyRequest[]) : []);
          setError("");
        }
      } catch {
        if (cancelled) return;
        setError(tNow("ins.rights.loadError"));
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, admin, version]);

  async function downloadData() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let data: unknown;
      if (demo) {
        const appointments = demo.appointments.filter((row) => row.customer_id === demo.customerId);
        data = {
          format_version: 1,
          environment: "demo",
          exported_at: new Date().toISOString(),
          profile: { id: demo.customerId, name: demo.customerName },
          appointments,
          privacy: demo.privacy,
          responses: demo.surveys,
          requests: demo.privacyRequests,
          points: demo.points,
          prices: Object.fromEntries(appointments.map((row) => [row.id, demo.prices[row.id]])),
        };
      } else {
        const result = await supabase.rpc("export_my_data");
        if (result.error) throw result.error;
        data = result.data;
      }
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(t("dataRights.downloaded"));
    } catch {
      setError(t("dataRights.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccountForever() {
    if (busy || confirmText.trim().toUpperCase() !== confirmWord) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        demo.dispatch({ type: "privacy.erase" });
        setConfirm(false);
        setConfirmText("");
        setMessage(t("dataRights.deleteDemo"));
        return;
      }
      const result = await supabase.rpc("delete_my_account");
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      setError(friendlyAuthError(err, t("dataRights.deleteError")));
    } finally {
      setBusy(false);
    }
  }

  async function adminUpdate(action: "reviewing" | "cancelled", id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (demo) {
        demo.dispatch({ type: "privacy.request", status: action, id });
      } else {
        const result = await supabase.rpc("update_privacy_request", {
          p_id: id,
          p_status: action,
        });
        if (result.error) throw result.error;
      }
      setVersion((v) => v + 1);
      setMessage(t("ins.rights.updated"));
    } catch {
      setError(t("ins.rights.actionError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={admin ? t("ins.rights.title") : t("dataRights.region")}
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        {admin ? t("ins.rights.title") : t("dataRights.title")}
      </h3>

      {!admin && (
        <>
          <p className="text-xs text-muted-foreground">{t("dataRights.downloadHint")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadData()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Download size={16} aria-hidden="true" />
            {t("dataRights.download")}
          </button>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">{t("dataRights.deleteHint")}</p>
            {!confirm ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm(true)}
                className="min-h-11 text-xs font-semibold text-destructive underline"
              >
                {t("dataRights.deleteStart")}
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p>
                  {t("dataRights.confirmBefore")} <span className="font-bold">{confirmWord}</span>{" "}
                  {t("dataRights.confirmAfter")}
                </p>
                <label className="block space-y-1">
                  <span className="font-semibold text-foreground">
                    {t("dataRights.confirmLabel")}
                  </span>
                  <input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    autoComplete="off"
                    placeholder={confirmWord}
                    className="flex min-h-11 w-full rounded-[var(--control-radius)] border border-border bg-background px-3 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    disabled={busy || confirmText.trim().toUpperCase() !== confirmWord}
                    onClick={() => void deleteAccountForever()}
                    className="min-h-11 font-bold text-destructive disabled:opacity-40"
                  >
                    {t("dataRights.deleteNow")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(false);
                      setConfirmText("");
                    }}
                    className="min-h-11"
                  >
                    {t("common.back")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {admin &&
        (loading ? (
          <p role="status" className="text-xs">
            {t("ins.rights.loading")}
          </p>
        ) : (
          <>
            {rows.map((row) => (
              <div key={row.id} className="space-y-2 rounded-xl border border-border p-3 text-xs">
                <p className="font-semibold">
                  {t("ins.rights.deletion", {
                    status:
                      row.status === "reviewing"
                        ? t("ins.rights.reviewing")
                        : t("ins.rights.requested"),
                  })}
                </p>
                <p>
                  {t("ins.rights.protocol")} <span className="break-all">{row.id}</span>
                </p>
                <p>{new Date(row.created_at).toLocaleString(intlLocale)}</p>
                <p className="break-all text-muted-foreground">
                  {t("ins.rights.account", { id: row.user_id })}
                </p>
                {row.status === "requested" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void adminUpdate("reviewing", row.id)}
                    className="font-semibold underline"
                  >
                    {t("ins.rights.startReview")}
                  </button>
                )}
              </div>
            ))}
            {rows.length === 0 && !error && (
              <p className="text-xs text-muted-foreground">{t("ins.rights.empty")}</p>
            )}
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setVersion((v) => v + 1)}
              className="text-xs text-muted-foreground underline"
            >
              {t("ins.rights.refresh")}
            </button>
          </>
        ))}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </section>
  );
}
