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
  groupId,
  phone,
  ready,
  confirmed,
  waiting,
  expired,
  refreshing,
  onRefresh,
  onConfirmed,
}: {
  groupId: string;
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
    live = useRef(true);
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
  async function run(action: "invite" | "request" | "verify") {
    if (
      demo ||
      pending.current ||
      refreshing ||
      expired ||
      (action !== "invite" && !ready) ||
      (action === "request" && cooldown > 0)
    )
      return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error();
      if (action === "invite") {
        const { data, error } = await supabase.rpc("care_group_invite", { p_group: groupId });
        if (
          error ||
          typeof data !== "string" ||
          !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,100}$/.test(data)
        )
          throw new Error();
        const {
          data: { session: current },
        } = await supabase.auth.getSession();
        if (live.current && current?.user.id === session.user.id) setInvite(data);
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
      if (!live.current || current?.user.id !== session.user.id) return;
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
      if (live.current) {
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
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t border-border pt-4">
      {waiting && !expired && (
        <>
          <p className="break-all text-sm font-semibold">{phone}</p>
          {invite ? (
            <a
              className="action-button inline-flex"
              href={invite}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              {t("care.openGroup")}
            </a>
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
      {!confirmed && ready && !expired && (
        <>
          <p className="text-sm">{t("care.verifyHint")}</p>
          <p className="text-sm font-semibold break-all">{phone}</p>
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
              className="entry-link-button"
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
      {!ready && !expired && (
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
      {confirmed && <Notice tone="info" title={t("care.phoneConfirmed")} />}
      {error && <Notice id={"group-phone-error-" + groupId} tone="danger" title={t(error)} />}
    </div>
  );
}
