import { useEffect, useId, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FolderLock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ActionResult,
  ConfirmDialog,
  IconList,
  IconTile,
  LoadingState,
  Notice,
  SectionHeader,
  Tag,
  type ActionState,
} from "@/components/visual";
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

/**
 * Antes de excluir a conta, pede ao Google a revogação do acesso dado ao app
 * (Agenda/Contatos). Melhor esforço: qualquer falha ou demora segue para a exclusão,
 * que apaga tokens e eventos do banco de qualquer forma.
 */
async function revokeGoogleBeforeDelete() {
  try {
    const { data } = await supabase.rpc("get_my_google_connection");
    if (!(data as { connected?: boolean } | null)?.connected) return;
    // Dono/sócio ativo não consegue excluir a conta (o banco recusa): não desconectar à toa.
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;
    const owners = await supabase
      .from("shop_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("active", true)
      .in("role", ["owner", "partner"]);
    if (owners.error || (owners.count ?? 0) > 0) return;
    await Promise.race([
      supabase.functions.invoke("google-connect", { body: { action: "disconnect" } }),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  } catch {
    /* segue com a exclusão */
  }
}

export function DataRights({
  admin = false,
  id,
}: {
  admin?: boolean;
  /** id da seção (Conta do cliente), para os atalhos do resumo. */
  id?: string;
}) {
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
  const [downloadState, setDownloadState] = useState<ActionState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [demoDeleted, setDemoDeleted] = useState(false);
  const confirmInputId = useId();

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
    setDownloadState("saving");
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
      setDownloadState("saved");
    } catch {
      setDownloadState("error");
    } finally {
      setBusy(false);
    }
  }

  /** Exclui a conta. Em falha, rejeita: a janela de confirmação mostra o erro e fica aberta. */
  async function deleteAccountForever() {
    if (confirmText.trim().toUpperCase() !== confirmWord) return;
    if (demo) {
      demo.dispatch({ type: "privacy.erase" });
      setConfirmText("");
      setDemoDeleted(true);
      return;
    }
    setDeleteError(null);
    try {
      await revokeGoogleBeforeDelete();
      const result = await supabase.rpc("delete_my_account");
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      setDeleteError(friendlyAuthError(err, t("dataRights.deleteError")));
      throw err;
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

  if (!admin) {
    const titleId = `${confirmInputId}-title`;
    return (
      <section
        id={id}
        aria-labelledby={titleId}
        className="app-action-card scroll-mt-24 space-y-4 p-4 sm:p-5"
      >
        <SectionHeader icon={FolderLock} id={titleId} title={t("conta.data.title")} />
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Baixar uma cópia: o que vem no arquivo, em pílulas. */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={Download} size="sm" />
              <p className="min-w-0 text-sm font-bold">{t("conta.data.copyTitle")}</p>
            </div>
            <ul aria-label={t("conta.data.includes")} className="flex flex-wrap gap-1.5">
              <li>
                <Tag icon={UserRound}>{t("conta.data.incAccount")}</Tag>
              </li>
              <li>
                <Tag icon={CalendarDays}>{t("conta.data.incBookings")}</Tag>
              </li>
              <li>
                <Tag icon={Star}>{t("conta.data.incPoints")}</Tag>
              </li>
              <li>
                <Tag icon={ShieldCheck}>{t("conta.data.incChoices")}</Tag>
              </li>
            </ul>
            <button
              type="button"
              disabled={busy}
              aria-busy={downloadState === "saving" || undefined}
              onClick={() => void downloadData()}
              className="action-button action-confirm mt-auto w-full"
            >
              {downloadState === "saving" ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
              ) : (
                <Download aria-hidden />
              )}
              {t("dataRights.download")}
            </button>
            <ActionResult
              state={downloadState === "saving" ? null : downloadState}
              text={
                downloadState === "error"
                  ? t("dataRights.errorGeneric")
                  : t("conta.data.downloaded")
              }
              onRetry={() => void downloadData()}
              onDismiss={() => setDownloadState(null)}
              autoHideMs={8000}
            />
          </div>

          {/* Excluir conta: na cor de alerta e sempre por uma janela de confirmação. */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center gap-3">
              <IconTile icon={Trash2} tone="danger" size="sm" />
              <p className="min-w-0">
                <span className="block text-sm font-bold">{t("conta.data.deleteTitle")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("conta.data.deleteShort")}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmText("");
                setDeleteError(null);
                setConfirm(true);
              }}
              className="action-button action-danger mt-auto w-full"
            >
              <Trash2 aria-hidden />
              {t("conta.data.deleteOpen")}
            </button>
            <ActionResult
              state={demoDeleted ? "saved" : null}
              text={t("dataRights.deleteDemo")}
              onDismiss={() => setDemoDeleted(false)}
            />
          </div>
        </div>

        <ConfirmDialog
          open={confirm}
          onOpenChange={(next) => {
            setConfirm(next);
            if (!next) setConfirmText("");
          }}
          tone="danger"
          icon={Trash2}
          title={t("conta.data.deleteQuestion")}
          consequences={[
            {
              tone: "danger",
              text: t("conta.data.willDelete"),
              detail: t("conta.data.willDeleteWhat"),
              key: "delete",
            },
            {
              tone: "success",
              text: t("conta.data.mayKeep"),
              detail: t("conta.data.mayKeepWhat"),
              key: "keep",
            },
            { tone: "warning", text: t("conta.data.noUndo"), key: "undo" },
          ]}
          confirmLabel={t("conta.data.deleteConfirm")}
          confirmIcon={Trash2}
          cancelLabel={t("conta.data.deleteCancel")}
          confirmDisabled={confirmText.trim().toUpperCase() !== confirmWord}
          // A janela guarda o texto do erro no clique (antes de deleteError existir): ela diz o
          // resultado ("nada foi apagado") e o motivo do servidor aparece logo acima, por children.
          errorText={t("conta.data.notDeleted")}
          onConfirm={deleteAccountForever}
        >
          <Notice tone="warning" role="none" title={t("conta.data.ownerWarning")} />
          <div className="space-y-2">
            <label htmlFor={confirmInputId} className="block text-sm font-semibold">
              {t("conta.data.typeWord", { word: confirmWord })}
            </label>
            <input
              id={confirmInputId}
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold tracking-wide"
            />
          </div>
          {/* Motivo do servidor, logo acima do resultado "nada foi apagado" da janela. */}
          {deleteError && <Notice tone="danger" title={deleteError} />}
        </ConfirmDialog>
      </section>
    );
  }

  return (
    <section
      aria-label={t("ins.rights.title")}
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
    >
      <SectionHeader
        as="h3"
        icon={ShieldCheck}
        title={t("ins.rights.title")}
        aside={
          admin ? (
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => setVersion((v) => v + 1)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw
                className={`size-4 ${loading ? "motion-safe:animate-spin" : ""}`}
                aria-hidden
              />
              {t("ins.rights.refresh")}
            </button>
          ) : null
        }
      />

      {admin &&
        (loading ? (
          <LoadingState variant="list" count={1} label={t("ins.rights.loading")} />
        ) : (
          <>
            {rows.map((row) => (
              <div key={row.id} className="space-y-2 rounded-xl border border-border p-3 text-xs">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Trash2 className="size-4 shrink-0 text-gold" aria-hidden />
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
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-60"
                  >
                    <Search className="size-4" aria-hidden />
                    {t("ins.rights.startReview")}
                  </button>
                )}
              </div>
            ))}
            {rows.length === 0 && !error && (
              <IconList
                items={[
                  {
                    key: "empty",
                    icon: CheckCircle2,
                    tone: "success",
                    text: t("ins.rights.empty"),
                  },
                ]}
              />
            )}
          </>
        ))}

      {error && <Notice tone="danger" title={error} />}
      {message && <ActionResult state="saved" text={message} reveal={false} />}
    </section>
  );
}
