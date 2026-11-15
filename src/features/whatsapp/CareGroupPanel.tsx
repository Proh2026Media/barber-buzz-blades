import { careAccessRequest, type AssistedAccess } from "@/lib/whatsapp/care-access-client";
import {
  careFailure,
  careRpcFailure,
  careFailureDiagnostic,
  keepCareFailure,
  type CareFailure,
  type CareOperation,
} from "./care-feedback";
import { careStates } from "./care-states";
import { GroupPhoneAccess } from "./GroupPhoneAccess";
import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  Check,
  UsersRound,
  ShieldCheck,
  RefreshCw,
  UserMinus,
  ClipboardCopy,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { Notice, SectionHeader, ConfirmDialog } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";

type Group = {
  id: string;
  state: string;
  version: number;
  notifications: boolean;
  review_invites: boolean;
  return_on: string | null;
  reason: string;
  cycle_id?: string;
  cycle_state?: string;
  expires_at?: string | null;
  numbers_changed?: boolean;
  closing?: boolean;
};
type Data = {
  access?: AssistedAccess;
  enabled: boolean;
  phone?: string;
  phone_confirmed?: boolean;
  phone_ready?: boolean;
  enrollment_expired?: boolean;
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
  const { t, intlLocale } = useI18n();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState<CareFailure | null>(null),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [preferences, setPreferences] = useState({
    notifications: false,
    review_invites: false,
    monthly_marketing: 0,
    proactive_paused: false,
    return_on: "",
  });
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const [closing, setClosing] = useState(false),
    [saved, setSaved] = useState(false);
  const live = useRef(true),
    pending = useRef(false),
    dirty = useRef(false),
    polling = useRef(false),
    generation = useRef(0),
    advancing = useRef(false);
  function apply(value: unknown, reset = false) {
    if (!live.current) return;
    const next = value as Data;
    setData(next);
    onAvailable?.(next.enabled || Boolean(next.group));
    if (reset) dirty.current = false;
    if (!dirty.current)
      setPreferences({
        notifications: next.group?.notifications ?? false,
        review_invites: next.group?.review_invites ?? false,
        return_on: next.group?.return_on ?? "",
        monthly_marketing: next.preferences?.monthly_marketing ?? 0,
        proactive_paused: next.preferences?.proactive_paused ?? false,
      });
  }
  async function load(background = false) {
    const requestGeneration = generation.current;
    const r = await supabase.rpc("care_group_read", {
      p_shop: shopId,
      ...(customerId ? { p_customer: customerId } : {}),
    });
    if (background && (pending.current || requestGeneration !== generation.current)) return;
    if (r.error) throw careRpcFailure(r.error, r.status);
    apply(r.data);
    if (background && live.current)
      setError((current) => (current?.operation === "read" ? null : current));
    if (live.current) setPhone((r.data as { phone?: string })?.phone ?? "");
  }
  async function run(
    work: () => Promise<void>,
    propagate = false,
    operation: CareOperation = "read",
  ) {
    if (demo || pending.current) return;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setError(null);
    setCopied(null);
    setSaved(false);
    try {
      await work();
    } catch (failure) {
      if (live.current) setError(careFailure(operation, failure));
      if (propagate) throw new Error("GROUP_SAVE_FAILED");
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  const loadRef = useRef(load),
    runRef = useRef(run);
  loadRef.current = load;
  runRef.current = run;
  useEffect(() => {
    live.current = true;
    void runRef.current(() => loadRef.current());
    return () => {
      live.current = false;
    };
  }, [demo]);
  const groupId = data?.group?.id;
  const compositionKey = data?.platform_participants.map((p) => `${p.id}:${p.phone}`).join("|");
  useEffect(() => {
    setAccepted(false);
  }, [compositionKey]);
  useEffect(() => {
    if (!groupId || demo || readOnly) return;
    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        pending.current ||
        polling.current ||
        advancing.current
      )
        return;
      polling.current = true;
      void loadRef
        .current(true)
        .catch((failure) => {
          if (live.current)
            setError((current) => keepCareFailure(current, careFailure("read", failure)));
        })
        .finally(() => {
          polling.current = false;
        });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [groupId, demo, readOnly]);
  async function startAccess(value: Data, selectedPhone: string, accept: boolean) {
    if (!value.access?.enabled) return;
    const next = await careAccessRequest(shopId, {
      phone: selectedPhone,
      accept,
      accounts: value.platform_participants.map((p) => p.id),
      ...(value.group ? { group: value.group.id, version: value.group.version } : {}),
    });
    apply(next);
    setAccepted(false);
  }
  const access = data?.access;
  const followAllowed =
    access?.enabled === true &&
    access.active &&
    data?.enabled &&
    !data.phone_confirmed &&
    !data.group?.numbers_changed &&
    !data.group?.closing &&
    !["closed", "customer_left", "creation_unknown"].includes(data.group?.cycle_state ?? "");
  const follow = useRef<() => Promise<void>>(async () => {});
  follow.current = async () => {
    if (
      !followAllowed ||
      demo ||
      readOnly ||
      !live.current ||
      document.visibilityState !== "visible" ||
      pending.current ||
      advancing.current ||
      !access
    )
      return;
    if (
      Date.parse(access.expires_at ?? "") <= Date.now() ||
      Date.parse(access.next_check_at ?? "") > Date.now()
    )
      return;
    advancing.current = true;
    const version = ++generation.current;
    try {
      const next = await careAccessRequest(shopId);
      if (!live.current || pending.current || version !== generation.current) return;
      apply(next);
      setError((current) => (current?.operation === "advance" ? null : current));
    } catch (failure) {
      if (live.current && version === generation.current)
        setError((current) => keepCareFailure(current, careFailure("advance", failure)));
    } finally {
      advancing.current = false;
    }
  };
  useEffect(() => {
    if (!followAllowed || demo || readOnly) return;
    const tick = () => void follow.current();
    const timer = window.setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [followAllowed, demo, readOnly]);
  async function update(action: string, values: Json = {}) {
    if (!data?.group || readOnly) return;
    await run(
      async () => {
        const r = await supabase.rpc("care_group_customer_update", {
          p_group: data.group!.id,
          p_version: data.group!.version,
          p_action: action,
          p_values: values,
        });
        if (r.error) throw careRpcFailure(r.error, r.status);
        apply(r.data, action === "preferences");
        if (live.current) {
          setSaved(true);
          setClosing(false);
          setAccepted(false);
        }
      },
      action === "close",
      action === "close" ? "close" : action === "preferences" ? "save" : "request",
    );
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
          title={t(error.message)}
          action={{
            label: t("care.refresh"),
            icon: RefreshCw,
            disabled: busy,
            onClick: () => void run(load),
          }}
        >
          <button
            type="button"
            className="action-button mt-2 min-h-11"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(careFailureDiagnostic(error));
                if (live.current) setCopied("yes");
              } catch {
                if (live.current) setCopied("no");
              }
            }}
          >
            <ClipboardCopy aria-hidden />
            {t(
              copied === "yes"
                ? "careFeedback.copied"
                : copied === "no"
                  ? "careFeedback.copyFailed"
                  : "careFeedback.copy",
            )}
          </button>
        </Notice>
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
              tone={group.state === "active" && data.enabled ? "info" : "warning"}
              title={t(
                group.closing
                  ? "careCycle.closing"
                  : group.cycle_state === "creation_unknown"
                    ? "care.unknown"
                    : !data.enabled && !ended
                      ? "careFeedback.unavailable"
                      : group.reason === "waiting_first_receipt"
                        ? "careCycle.receipt"
                        : (careStates[group.state] ?? "care.unavailable"),
              )}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("care.intro")}</p>
          )}
          {group?.expires_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="size-4" aria-hidden />
              <span>
                {t("careCycle.until", {
                  date: new Date(group.expires_at).toLocaleDateString(intlLocale),
                })}
              </span>
            </div>
          )}
          {!data.enabled && (!group || ended) && <Notice tone="info" title={t("care.disabled")} />}
          {!readOnly && !ended && (
            <ol aria-label={t("care.steps")} className="grid grid-cols-3 gap-2">
              {(["care.stepRequest", "care.stepJoin", "care.stepPhone"] as const).map(
                (label, index) => {
                  const completed = [
                    Boolean(group && ["waiting_customer", "active"].includes(group.state)),
                    group?.state === "active",
                    data.phone_confirmed === true,
                  ][index];
                  const current = !group
                    ? 0
                    : group.state === "waiting_customer"
                      ? 1
                      : data.phone_ready
                        ? 2
                        : 0;
                  return (
                    <li
                      key={label}
                      aria-current={!completed && index === current ? "step" : undefined}
                      className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-border p-2 text-sm aria-[current=step]:border-primary tablet:flex-row tablet:items-center tablet:p-3"
                    >
                      <span
                        className={
                          "flex size-7 shrink-0 items-center justify-center rounded-full " +
                          (completed
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {completed ? (
                          <Check className="size-4" aria-label={t("care.stepDone")} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="min-w-0 break-words">
                        {t(
                          data.access?.enabled
                            ? (
                                [
                                  "careAccess.prepare",
                                  "careAccess.enter",
                                  "careAccess.confirm",
                                ] as const
                              )[index]
                            : label,
                        )}
                      </span>
                    </li>
                  );
                },
              )}
            </ol>
          )}
          <details className="space-y-2" open={!group}>
            <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
              {t("care.people")}
            </summary>
            <p className="text-sm text-muted-foreground">
              {t(data.access?.enabled ? "careAccess.members" : "care.visibility")}
            </p>
            <div className={data.access?.enabled ? "grid grid-cols-2 gap-2" : "space-y-2"}>
              {data.platform_participants.map((p) => (
                <div
                  key={p.id}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm"
                >
                  <ShieldCheck className="size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 break-all">
                    {data.access?.enabled ? (
                      p.phone
                    ) : (
                      <>
                        {t("care.platform")} · {p.name || p.phone}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </details>
          {!readOnly && group?.cycle_id && !ended && group.numbers_changed && (
            <div className="space-y-3">
              <Notice tone="warning" title={t("careCycle.changed")} />
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
                className="action-button action-confirm"
                disabled={
                  busy ||
                  !accepted ||
                  !data.enabled ||
                  data.platform_participants.length < 2 ||
                  data.platform_participants.length > 20
                }
                onClick={() =>
                  void update("approve_numbers", {
                    accept: true,
                    accounts: data.platform_participants.map((p) => p.id),
                  })
                }
              >
                <ShieldCheck aria-hidden />
                {t("careCycle.approve")}
              </button>
            </div>
          )}
          {!readOnly && (!group || ended) && (
            <div className="space-y-3">
              {!group && (
                <label className="grid gap-1 text-sm font-semibold">
                  {t("waPair.phone")}
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    disabled={busy}
                    onChange={(e) => setPhone(e.target.value)}
                    className={field}
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    {t("care.phoneHint")}
                  </span>
                </label>
              )}
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
                  busy ||
                  !accepted ||
                  !data.enabled ||
                  data.platform_participants.length < 2 ||
                  data.platform_participants.length > 20 ||
                  Boolean(group?.closing)
                }
                onClick={() => {
                  if (group)
                    void update("rejoin", {
                      accept: true,
                      accounts: data.platform_participants.map((p) => p.id),
                    });
                  else
                    void run(
                      async () => {
                        if (data.access?.enabled) {
                          await startAccess(data, phone, accepted);
                          return;
                        }
                        const r = await supabase.rpc("care_group_begin", {
                          p_shop: shopId,
                          p_accept: accepted,
                          p_phone: phone,
                          p_accounts: data.platform_participants.map((p) => p.id),
                        });
                        if (r.error) throw careRpcFailure(r.error, r.status);
                        apply(r.data);
                        setAccepted(false);
                      },
                      false,
                      "request",
                    );
                }}
              >
                <UsersRound aria-hidden />
                {t(group ? "care.rejoin" : "care.request")}
              </button>
              <p className="text-xs text-muted-foreground">
                {t(data.access?.enabled ? "careAccess.preparation" : "care.preparation")}
              </p>
            </div>
          )}
          {!readOnly &&
            group &&
            !ended &&
            data.enrollment_expired &&
            !data.phone_confirmed &&
            group.state !== "creation_unknown" && (
              <Notice
                tone="warning"
                title={t("care.expired")}
                action={{
                  label: t("care.resume"),
                  disabled: busy || !data.enabled,
                  onClick: () =>
                    void run(
                      async () => {
                        if (!data.enabled) return;
                        if (data.access?.enabled) {
                          await startAccess(data, data.phone ?? "", true);
                          return;
                        }
                        const r = await supabase.rpc("care_group_begin", {
                          p_shop: shopId,
                          p_accept: true,
                          p_phone: data.phone ?? "",
                          p_accounts: data.platform_participants.map((p) => p.id),
                        });
                        if (r.error) throw careRpcFailure(r.error, r.status);
                        apply(r.data);
                      },
                      false,
                      "resume",
                    ),
                }}
              />
            )}
          {!readOnly &&
            data.access?.enabled &&
            group &&
            !ended &&
            !group.numbers_changed &&
            !group.closing &&
            group.cycle_state !== "creation_unknown" &&
            !data.phone_confirmed &&
            !data.enrollment_expired && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="size-5 shrink-0" aria-hidden />
                  <span className="break-all">{data.phone}</span>
                </p>
                <p className="text-sm text-muted-foreground">{t("careAccess.usePhone")}</p>
                {data.access.active ? (
                  <p role="status" className="flex items-center gap-2 text-sm">
                    <RefreshCw className="size-4 shrink-0" aria-hidden />
                    {t(data.phone_ready ? "careAccess.ready" : "careAccess.following")}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="action-button action-confirm"
                    disabled={busy || !data.enabled}
                    onClick={() =>
                      void run(() => startAccess(data, data.phone ?? "", true), false, "resume")
                    }
                  >
                    <ArrowRight aria-hidden />
                    {t("careAccess.continue")}
                  </button>
                )}
              </div>
            )}
          {!readOnly && group && !ended && data.phone && (
            <GroupPhoneAccess
              key={`${group.id}:${data.phone}`}
              groupId={group.id}
              phone={data.phone}
              available={
                data.enabled &&
                !group.numbers_changed &&
                !group.closing &&
                group.cycle_state !== "creation_unknown"
              }
              ready={data.phone_ready === true}
              confirmed={data.phone_confirmed === true}
              waiting={group.state === "waiting_customer"}
              expired={data.enrollment_expired === true && data.phone_confirmed !== true}
              refreshing={busy}
              assisted={data.access?.enabled === true && data.access.active}
              onRefresh={() => void run(load)}
              onConfirmed={() => void run(load)}
            />
          )}
          {!readOnly && group && !ended && (
            <details className="space-y-4 border-t border-border pt-4">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">
                {t("care.preferences")}
              </summary>
              {(["notifications", "review_invites", "proactive_paused"] as const).map((key) => (
                <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={preferences[key]}
                    onChange={(e) => {
                      dirty.current = true;
                      setSaved(false);
                      setPreferences({ ...preferences, [key]: e.target.checked });
                    }}
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
                    onChange={(e) => (
                      (dirty.current = true),
                      setSaved(false),
                      setPreferences({ ...preferences, monthly_marketing: Number(e.target.value) })
                    )}
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
                    onChange={(e) => {
                      dirty.current = true;
                      setSaved(false);
                      setPreferences({ ...preferences, return_on: e.target.value });
                    }}
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
              <p className="text-xs text-muted-foreground">{t("care.receipt")}</p>
            </details>
          )}
          {(readOnly ||
            !data.enabled ||
            !group ||
            ended ||
            !data.phone ||
            data.phone_ready ||
            data.enrollment_expired) && (
            <button className="action-button" disabled={busy} onClick={() => void run(load)}>
              <RefreshCw aria-hidden />
              {t("care.refresh")}
            </button>
          )}
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
        errorText={t(error?.message ?? "care.error")}
        onConfirm={async () => {
          await update("close");
        }}
      />
    </section>
  );
}
