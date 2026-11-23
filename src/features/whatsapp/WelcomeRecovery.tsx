import { useEffect, useRef, useState } from "react";
import { BookOpen, RefreshCw } from "lucide-react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { groupWelcome } from "@/lib/whatsapp/care-access-client";

export function WelcomeRecovery({ shop }: { shop: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    groupWelcome(shop)
      .then((r) => {
        if (active) setText(r.welcome ?? "");
      })
      .catch(() => {
        if (active) setMessage("careFeedback.unavailable");
      });
    return () => {
      active = false;
    };
  }, [shop, reload]);
  async function resend() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const r = await groupWelcome(shop, crypto.randomUUID());
      setMessage(r.state === "accepted" ? "recovery.accepted" : "careFeedback.unavailable");
    } catch (e) {
      setMessage(
        (e as { code?: string })?.code === "WA_RATE_LIMIT"
          ? "careAccess.rate"
          : "careFeedback.unavailable",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        <BookOpen className="me-2 inline size-4" aria-hidden />
        {t("recovery.rules")}
      </summary>
      {text && <p className="my-3 whitespace-pre-line break-words text-sm">{text}</p>}
      <button
        type="button"
        className="action-button"
        disabled={busy}
        onClick={() => (text ? void resend() : setReload((n) => n + 1))}
      >
        <RefreshCw aria-hidden />
        {t(text ? "recovery.resend" : "recovery.show")}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm">
          {t(message)}
        </p>
      )}
    </details>
  );
}
