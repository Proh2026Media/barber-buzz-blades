import { useDemo } from "@/features/demo/context";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { otpRequestBody } from "@/lib/auth/otp-request";
import { CodeInput } from "@/features/auth/entry";
import { Notice } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";

/** O convite não autentica: confirmação só pelo desafio vinculado à sessão. */
export function GroupPhoneAccess({
  simple = false,
  groupId,
  available = true,
  assisted = false,
  background = false,
  phone,
  ready,
  confirmed,
  waiting,
  expired,
  refreshing,
  onRefresh,
  onConfirmed,
}: {
  simple?: boolean;
  groupId: string;
  available?: boolean;
  assisted?: boolean;
  background?: boolean;
  phone: string;
  ready: boolean;
  confirmed: boolean;
  waiting: boolean;
  expired: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onConfirmed: () => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<MessageKey | null>(null),
    [requested, setRequested] = useState(false),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState<string | null>(null),
    [cooldown, setCooldown] = useState(0);
  const pending = useRef(false),
    live = useRef(true),
    invitationPolling = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (cooldown) {
      const timer = setTimeout(() => setCooldown((x) => x - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);
  async function run(action: "invite" | "request" | "verify", background = false) {
    if (
      demo ||
      !available ||
      pending.current ||
      (background && invitationPolling.current) ||
      refreshing ||
      expired ||
      (action !== "invite" && !ready) ||
      (action === "request" && cooldown > 0)
    )
      return;
    if (background) invitationPolling.current = true;
    else {
      pending.current = true;
      generation.current++;
      setBusy(true);
      setError(null);
    }
    const requestGeneration = generation.current;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error();
      if (action === "invite") {
        const { data, error } = await supabase.rpc("care_group_invite", { p_group: groupId });
        if (requestGeneration !== generation.current) return;
        if (!error && data == null) {
          if (!background) {
            if (live.current) setError("careCycle.inviteQueued");
            onRefresh();
          }
          return;
        }
        if (
          error ||
          typeof data !== "string" ||
          !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,100}$/.test(data)
        )
          throw new Error();
        const {
          data: { session: current },
        } = await supabase.auth.getSession();
        if (
          live.current &&
          current?.user.id === session.user.id &&
          requestGeneration === generation.current
        )
          setInvite(data);
        return;
      }
      const response = await guardedFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-otp`,
        {
          method: "POST",
          signal: AbortSignal.timeout(25000),
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: otpRequestBody({
            action,
            purpose: "verify_phone",
            channel: "whatsapp",
            destination: phone,
            ...(action === "verify" ? { code } : {}),
          }),
        },
      );
      const payload = await response.json();
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      if (
        !live.current ||
        current?.user.id !== session.user.id ||
        requestGeneration !== generation.current
      )
        return;
      if (!response.ok || payload.ok !== true) {
        if (payload.error_code === "rate_limited") {
          setError("waLogin.limit");
          setCooldown(900);
          return;
        }
        if (payload.error_code === "otp_invalid") {
          setError("waLogin.invalid");
          return;
        }
        throw new Error();
      }
      if (action === "request") {
        if (payload.delivery_state === "unknown") setError("care.codeUnavailable");
        setRequested(true);
        setCode("");
        setCooldown(60);
      } else {
        setRequested(false);
        setCode("");
        onConfirmed();
      }
    } catch {
      if (live.current && !background && requestGeneration === generation.current) {
        setError(
          action === "invite"
            ? "care.inviteUnavailable"
            : action === "request"
              ? "care.codeUnavailable"
              : "care.error",
        );
        if (action === "request") {
          setRequested(true);
          setCooldown(60);
        }
      }
    } finally {
      if (background) invitationPolling.current = false;
      else {
        pending.current = false;
        if (live.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (!available) {
      generation.current++;
      setInvite(null);
      setCode("");
      setRequested(false);
      setError(null);
    }
  }, [available]);
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!available || !waiting || expired || invite || demo) return;
    if ((simple || assisted) && !refreshing && document.visibilityState === "visible")
      void runRef.current("invite", true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void runRef.current("invite", true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [available, waiting, expired, invite, demo, refreshing, assisted, simple]);
  if ((!available || expired) && !confirmed) return null;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      {available && waiting && !expired && (
        <>
          {!assisted && <p className="break-all text-sm font-semibold">{phone}</p>}
          {invite ? (
            <a
              className="action-button inline-flex"
              href={invite}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              {t(simple ? "care.enterGroup" : "care.openGroup")}
            </a>
          ) : assisted || simple ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <RefreshCw className="size-4" aria-hidden />
              {t("careAccess.preparingInvite")}
            </p>
          ) : (
            <button
              className="action-button"
              disabled={busy || refreshing}
              onClick={() => void run("invite")}
            >
              <ExternalLink aria-hidden />
              {t("care.getInvite")}
            </button>
          )}
        </>
      )}
      {available && waiting && invite && assisted && (
        <p className="text-sm text-muted-foreground">
          {t(background ? "careBackground.join" : "careAccess.joinHint")}
        </p>
      )}
      {available && !confirmed && ready && !expired && (
        <>
          <p className="text-sm">{t(assisted ? "careAccess.codeHint" : "care.verifyHint")}</p>
          {!assisted && <p className="text-sm font-semibold break-all">{phone}</p>}
          {requested && (
            <CodeInput
              id={"group-code-" + groupId}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              invalid={error === "waLogin.invalid"}
              describedBy={error ? "group-phone-error-" + groupId : undefined}
              label={t("auth.field.otp")}
              disabled={busy}
              autoFocus
            />
          )}
          <button
            className="action-button action-confirm"
            disabled={
              busy || refreshing || !ready || (requested ? code.length !== 6 : cooldown > 0)
            }
            onClick={() => void run(requested ? "verify" : "request")}
          >
            <KeyRound aria-hidden />
            {t(requested ? "care.verifyCode" : "care.sendCode")}
          </button>
          {requested && (
            <button
              className="action-button"
              disabled={busy || refreshing || !ready || cooldown > 0}
              onClick={() => void run("request")}
            >
              {t("waLogin.resend")}
            </button>
          )}
          {cooldown > 0 && (
            <p role="status" className="text-sm">
              {t("waLogin.wait", { seconds: cooldown })}
            </p>
          )}
        </>
      )}
      {!simple && available && !ready && !expired && !assisted && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-muted-foreground">
            {t(waiting ? "care.awaitEntry" : "care.awaitPreparation")}
          </p>
          <button className="action-button" disabled={busy || refreshing} onClick={onRefresh}>
            <RefreshCw aria-hidden />
            {t(waiting ? "care.checkEntry" : "care.refresh")}
          </button>
        </div>
      )}
      {!simple && confirmed && <Notice tone="info" title={t("care.phoneConfirmed")} />}
      {available && error && (
        <Notice
          id={"group-phone-error-" + groupId}
          tone={error === "careCycle.inviteQueued" ? "info" : "danger"}
          title={t(error)}
        />
      )}
    </div>
  );
}
