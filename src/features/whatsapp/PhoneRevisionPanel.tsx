import { useEffect, useRef, useState } from "react";
import { Pencil, Smartphone, ArrowRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import type { PhoneRevisionInfo } from "@/lib/whatsapp/care-access-client";

/** A revisão não confirma telefone: preserva a conta e espera prova/OTP no mesmo grupo. */
export function PhoneRevisionPanel({
  info,
  shopId,
  phone,
  disabled,
  resumeNeeded,
  background = false,
  onKeep,
  onStart,
  onAbort,
}: {
  info: PhoneRevisionInfo;
  shopId: string;
  phone: string;
  disabled: boolean;
  resumeNeeded: boolean;
  background?: boolean;
  onKeep: () => void;
  onStart: (phone: string) => void;
  onAbort: () => void;
}) {
  const { t } = useI18n(),
    demo = useDemo();
  const [editing, setEditing] = useState(false),
    [candidate, setCandidate] = useState(phone),
    [accept, setAccept] = useState(false),
    [invite, setInvite] = useState<string | null>(null);
  const generation = useRef(0),
    polling = useRef(false);
  useEffect(() => {
    setInvite(null);
    setAccept(false);
    generation.current++;
  }, [info.id, info.active, info.phase]);
  useEffect(() => {
    if (info.pending) setEditing(false);
  }, [info.pending]);
  useEffect(() => {
    if (demo || !info.active || info.phase !== "waiting" || info.expired || !info.id) return;
    const version = generation.current;
    let live = true;
    const read = async () => {
      if (document.visibilityState !== "visible" || polling.current) return;
      polling.current = true;
      try {
        const r = await supabase.rpc("care_phone_revision_invite", {
          p_shop: shopId,
          p_id: info.id!,
        });
        if (live && version === generation.current)
          setInvite(
            !r.error &&
              typeof r.data === "string" &&
              /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{8,200}$/.test(r.data)
              ? r.data
              : null,
          );
      } catch {
        if (live) setInvite(null);
      } finally {
        polling.current = false;
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 5000);
    document.addEventListener("visibilitychange", read);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
    };
  }, [demo, info.id, info.active, info.expired, info.phase, shopId]);
  if (!info.enabled && !info.pending) return null;
  if (info.phase === "committed") return null;
  if (info.pending)
    return (
      <div className="space-y-3 rounded-xl border border-border p-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-5 shrink-0" aria-hidden />
          <span className="break-all">{info.declared_phone}</span>
        </p>
        <p role="status" className="flex items-center gap-2 text-sm">
          <RefreshCw className="size-4 shrink-0" aria-hidden />
          {t(
            !info.enabled
              ? "careFeedback.unavailable"
              : info.expired
                ? "carePhone.expired"
                : !info.active
                  ? "carePhone.review"
                  : info.phase === "waiting"
                    ? "carePhone.join"
                    : info.phase === "binding" || info.phase === "bound"
                      ? "carePhone.finishing"
                      : "carePhone.checking",
          )}
        </p>
        {invite && info.active && info.phase === "waiting" && (
          <a
            className="action-button action-confirm inline-flex"
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink aria-hidden />
            {t("care.openGroup")}
          </a>
        )}
        {info.phase === "waiting" && !info.expired && (
          <p className="text-sm text-muted-foreground">
            {t(background ? "careBackground.join" : "careAccess.joinHint")}
          </p>
        )}
        {["requested", "waiting"].includes(info.phase ?? "") && (
          <button
            className="action-button"
            type="button"
            disabled={disabled || !info.enabled}
            onClick={onAbort}
          >
            <X aria-hidden />
            {t("carePhone.cancel")}
          </button>
        )}
      </div>
    );
  return (
    <div className="space-y-3">
      {!editing && resumeNeeded && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">{t("carePhone.reviewNumber")}</p>
          <p className="flex items-center gap-2 text-sm">
            <Smartphone className="size-5" aria-hidden />
            <span className="break-all">{phone}</span>
          </p>
          <button
            className="action-button action-confirm"
            type="button"
            disabled={disabled}
            onClick={onKeep}
          >
            <ArrowRight aria-hidden />
            {t("carePhone.keep")}
          </button>
        </div>
      )}
      {!editing ? (
        <button
          className="action-button"
          type="button"
          disabled={disabled || !info.enabled}
          onClick={() => {
            setCandidate(info.declared_phone ?? phone);
            setAccept(false);
            setEditing(true);
          }}
        >
          <Pencil aria-hidden />
          {t("carePhone.edit")}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="grid gap-1 text-sm font-semibold">
            <span>{t("carePhone.correct")}</span>
            <input
              type="tel"
              autoComplete="tel"
              value={candidate}
              disabled={disabled}
              onChange={(e) => {
                setCandidate(e.target.value);
                setAccept(false);
              }}
              className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>
          <p className="text-sm text-muted-foreground">{t("carePhone.sameGroup")}</p>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={accept}
              disabled={disabled}
              onChange={(e) => setAccept(e.target.checked)}
            />
            {t("carePhone.accept")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="action-button action-confirm"
              disabled={disabled || !accept || !candidate.trim()}
              onClick={() => onStart(candidate)}
            >
              <ArrowRight aria-hidden />
              {t("carePhone.continue")}
            </button>
            <button
              type="button"
              className="action-button"
              disabled={disabled}
              onClick={() => setEditing(false)}
            >
              <X aria-hidden />
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
