import { useEffect, useRef, useState } from "react";
import { UsersRound, ShieldCheck, RefreshCw, UserMinus } from "lucide-react";
import { Notice, SectionHeader, ConfirmDialog } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";

export const careStates: Record<string, MessageKey> = {
  requested: "care.requested",
  creating: "care.creating",
  waiting_customer: "care.waiting",
  active: "care.active",
  paused_divergence: "care.divergence",
  paused_unavailable: "care.unavailable",
  customer_left: "care.left",
  closed: "care.closed",
  creation_unknown: "care.unknown",
};
export const careRoles: Record<string, MessageKey> = {
  owner: "care.owner",
  associate: "care.associate",
  employee: "care.employee",
};
type Group = {
  id: string;
  state: string;
  version: number;
  notifications: boolean;
  review_invites: boolean;
  return_on: string | null;
  reason: string;
};
type Data = {
  enabled: boolean;
  group: Group | null;
  preferences: { monthly_marketing: number; proactive_paused: boolean } | null;
  participants: {
    user_id: string;
    name: string;
    role: string;
    approved: boolean;
    revoked: boolean;
  }[];
  platform_participants: { id: string; name: string | null; phone: string }[];
};
const field = "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm";

/** A montagem por conta/loja impede que uma resposta antiga preencha outra identidade. */
export function CareGroupPanel({
  shopId,
  customerId,
  readOnly = false,
  onAvailable,
}: {
  shopId: string;
  customerId?: string;
  readOnly?: boolean;
  onAvailable?: (value: boolean) => void;
}) {
  return (
    <CareGroupContent
      key={`${shopId}:${customerId ?? "self"}`}
      shopId={shopId}
      customerId={customerId}
      readOnly={readOnly}
      onAvailable={onAvailable}
    />
  );
}
function CareGroupContent({
  shopId,
  customerId,
  readOnly,
  onAvailable,
}: {
  shopId: string;
  customerId?: string;
  readOnly: boolean;
  onAvailable?: (value: boolean) => void;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [preferences, setPreferences] = useState({
    notifications: false,
    review_invites: false,
    monthly_marketing: 0,
    proactive_paused: false,
    return_on: "",
  });
  const [closing, setClosing] = useState(false),
    [saved, setSaved] = useState(false);
  const live = useRef(true),
    pending = useRef(false);
  function apply(value: unknown) {
    if (!live.current) return;
    const next = value as Data;
    setData(next);
    onAvailable?.(next.enabled || Boolean(next.group));
    setPreferences({
      notifications: next.group?.notifications ?? false,
      review_invites: next.group?.review_invites ?? false,
      return_on: next.group?.return_on ?? "",
      monthly_marketing: next.preferences?.monthly_marketing ?? 0,
      proactive_paused: next.preferences?.proactive_paused ?? false,
    });
  }
  async function load() {
    const r = await supabase.rpc("care_group_read", {
      p_shop: shopId,
      ...(customerId ? { p_customer: customerId } : {}),
    });
    if (r.error) throw r.error;
    apply(r.data);
  }
  async function run(work: () => Promise<void>, propagate = false) {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      await work();
    } catch {
      if (live.current) setError(true);
      if (propagate) throw new Error("GROUP_SAVE_FAILED");
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
  }, [demo]);
  async function update(action: string, values: Json = {}) {
    if (!data?.group || readOnly) return;
    await run(async () => {
      const r = await supabase.rpc("care_group_customer_update", {
        p_group: data.group!.id,
        p_version: data.group!.version,
        p_action: action,
        p_values: values,
      });
      if (r.error) throw r.error;
      apply(r.data);
      if (live.current) {
        setSaved(true);
        setClosing(false);
        setAccepted(false);
      }
    }, action === "close");
  }
  if (readOnly && (!data?.group || error)) return null;
  const group = data?.group,
    ended = group && ["closed", "customer_left"].includes(group.state);
  return (
    <section className="app-action-card min-w-0 space-y-4 p-4 tablet:p-5" aria-busy={busy}>
      <SectionHeader icon={UsersRound} title={t("care.title")} />
      {demo ? (
        <Notice tone="info" title={t("waPair.demo")} />
      ) : !data && !error ? (
        <p role="status">{t("shop.loading")}</p>
      ) : null}
      {error && (
        <Notice
          tone="danger"
          title={t("care.error")}
          action={{ label: t("visual.retry"), onClick: () => void run(load) }}
        />
      )}
      {saved && (
        <p role="status" className="text-sm">
          {t("care.saved")}
        </p>
      )}
      {data && (
        <>
          {group ? (
            <Notice
              tone={group.state === "active" ? "info" : "warning"}
              title={t(careStates[group.state] ?? "care.unavailable")}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("care.intro")}</p>
          )}
          {!data.enabled && <Notice tone="info" title={t("care.disabled")} />}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("care.people")}</h3>
            <p className="text-sm text-muted-foreground">{t("care.visibility")}</p>
            {data.platform_participants.map((p) => (
              <div
                key={p.id}
                className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm"
              >
                <ShieldCheck className="size-5 shrink-0" aria-hidden />
                <span className="break-words">
                  {t("care.platform")} · {p.name || p.phone}
                </span>
              </div>
            ))}
            {data.participants
              .filter((p) => !p.revoked)
              .map((p) => (
                <div
                  key={p.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <span>
                    {p.name} · {t(careRoles[p.role])}
                    <small className="block text-muted-foreground">
                      {t(p.approved ? "care.approved" : "care.approvalNeeded")}
                    </small>
                  </span>
                  {!readOnly && !ended && (
                    <div className="flex flex-wrap gap-2">
                      {!p.approved && (
                        <button
                          className="action-button action-confirm"
                          disabled={busy}
                          onClick={() => void update("approve_participant", { user_id: p.user_id })}
                        >
                          {t("care.allowPerson")}
                        </button>
                      )}
                      <button
                        className="action-button"
                        disabled={busy}
                        onClick={() => void update("remove_participant", { user_id: p.user_id })}
                      >
                        <UserMinus aria-hidden />
                        {t("care.removePerson")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
          {!readOnly && (!group || ended) && (
            <div className="space-y-3">
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                {t("care.accept")}
              </label>
              <button
                className="action-button action-confirm w-full tablet:w-auto"
                disabled={
                  busy || !accepted || !data.enabled || data.platform_participants.length === 0
                }
                onClick={() => {
                  if (group)
                    void update("rejoin", {
                      accept: true,
                      accounts: data.platform_participants.map((p) => p.id),
                    });
                  else
                    void run(async () => {
                      const r = await supabase.rpc("care_group_request", {
                        p_shop: shopId,
                        p_accept: accepted,
                        p_accounts: data.platform_participants.map((p) => p.id),
                      });
                      if (r.error) throw r.error;
                      apply(r.data);
                      setAccepted(false);
                    });
                }}
              >
                <UsersRound aria-hidden />
                {t(group ? "care.rejoin" : "care.request")}
              </button>
              <p className="text-xs text-muted-foreground">{t("care.preparation")}</p>
            </div>
          )}
          {!readOnly && group && !ended && (
            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">{t("care.preferences")}</h3>
              {(["notifications", "review_invites", "proactive_paused"] as const).map((key) => (
                <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={preferences[key]}
                    onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })}
                  />
                  {t(
                    (
                      {
                        notifications: "care.notifications",
                        review_invites: "care.reviews",
                        proactive_paused: "care.pauseAll",
                      } as const
                    )[key],
                  )}
                </label>
              ))}
              <div className="grid gap-3 tablet:grid-cols-2">
                <label className="min-w-0 space-y-1 text-sm">
                  <span>{t("care.offers")}</span>
                  <select
                    className={field}
                    value={preferences.monthly_marketing}
                    onChange={(e) =>
                      setPreferences({ ...preferences, monthly_marketing: Number(e.target.value) })
                    }
                  >
                    <option value={0}>{t("care.offersNone")}</option>
                    <option value={1}>{t("care.offersOne")}</option>
                    <option value={3}>{t("care.offersThree")}</option>
                  </select>
                </label>
                <label className="min-w-0 space-y-1 text-sm">
                  <span>{t("care.returnDate")}</span>
                  <input
                    type="date"
                    className={field}
                    value={preferences.return_on}
                    onChange={(e) => setPreferences({ ...preferences, return_on: e.target.value })}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{t("care.globalPreferences")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="action-button action-confirm"
                  disabled={busy}
                  onClick={() =>
                    void update("preferences", {
                      ...preferences,
                      return_on: preferences.return_on || null,
                    })
                  }
                >
                  {t("care.save")}
                </button>
                <button className="action-button" disabled={busy} onClick={() => setClosing(true)}>
                  {t("care.close")}
                </button>
              </div>
            </div>
          )}
          <button className="action-button" disabled={busy} onClick={() => void run(load)}>
            <RefreshCw aria-hidden />
            {t("waCentral.refresh")}
          </button>
          <p className="text-xs text-muted-foreground">{t("care.receipt")}</p>
        </>
      )}
      <ConfirmDialog
        open={closing}
        onOpenChange={(value) => {
          if (!busy) setClosing(value);
        }}
        title={t("care.close")}
        tone="warning"
        icon={UserMinus}
        consequences={[
          { key: "close", icon: UserMinus, tone: "warning", text: t("care.closeHint") },
        ]}
        confirmLabel={t("care.close")}
        cancelLabel={t("common.cancel")}
        confirmDisabled={busy}
        errorText={t("care.error")}
        onConfirm={async () => {
          await update("close");
        }}
      />
    </section>
  );
}
