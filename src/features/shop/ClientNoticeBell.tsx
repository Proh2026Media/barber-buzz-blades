import { Fragment, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";

const PRESETS = [
  {
    id: "reminder_next" as const,
    titleKey: "team.notice.reminderNext",
    hintKey: "team.notice.reminderNextHint",
  },
  {
    id: "confirm_today" as const,
    titleKey: "team.notice.confirmToday",
    hintKey: "team.notice.confirmTodayHint",
  },
  {
    id: "slot_open" as const,
    titleKey: "team.notice.slotOpen",
    hintKey: "team.notice.slotOpenHint",
  },
  {
    id: "shop_hello" as const,
    titleKey: "team.notice.shopHello",
    hintKey: "team.notice.shopHelloHint",
  },
] as const satisfies readonly { id: string; titleKey: MessageKey; hintKey: MessageKey }[];

type NoticePreset = (typeof PRESETS)[number]["id"];

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

function formatWait(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? tNow("team.notice.minuteOne") : tNow("team.notice.minutes", { count: m });
}

function channelLabel(channel: string) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return tNow("team.notice.channelEmail");
  return channel;
}

export function ClientNoticeBell({
  shopId,
  customerId,
  customerName,
}: {
  shopId: string;
  customerId: string;
  customerName: string | null;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);

  async function refreshPending() {
    if (demo) return;
    const { data } = await supabase.rpc("get_client_notice_pending", {
      p_shop_id: shopId,
      p_customer_id: customerId,
    });
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const payload = data as {
      pending?: { preset?: string } | null;
      wait_seconds?: number;
    };
    setPendingPreset(payload.pending?.preset ?? null);
    setWaitSeconds(Number(payload.wait_seconds) || 0);
  }

  useEffect(() => {
    if (!open) return;
    void refreshPending();
  }, [open, shopId, customerId]);

  // A confirmação de envio fica visível por alguns segundos depois que o diálogo fecha.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function send(preset: NoticePreset) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (demo) {
        setMessage(t("team.notice.demo"));
        setOpen(false);
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("send_client_notice", {
        p_shop_id: shopId,
        p_customer_id: customerId,
        p_preset: preset,
      });
      if (rpcError) {
        throw new Error(rpcError.message || t("team.notice.sendError"));
      }
      const result = data as {
        channels?: string[];
        status?: string;
        wait_seconds?: number;
        preset?: string;
      } | null;
      if (result?.status === "queued") {
        const wait = Number(result.wait_seconds) || 0;
        setPendingPreset(result.preset ?? preset);
        setWaitSeconds(wait);
        setMessage(t("team.notice.queued", { wait: formatWait(wait) }));
        setOpen(false);
        return;
      }
      const channels = result?.channels ?? [];
      setPendingPreset(null);
      setWaitSeconds(0);
      setMessage(
        channels.length
          ? t("team.notice.sentBy", {
              channels: channels.map(channelLabel).join(t("team.notice.and")),
            })
          : t("team.notice.recorded"),
      );
      setOpen(false);
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : null;
      setError(detail || t("team.notice.sendError"));
    } finally {
      setBusy(false);
    }
  }

  const pendingKey = PRESETS.find((row) => row.id === pendingPreset)?.titleKey;
  const pendingLabel = pendingKey ? t(pendingKey) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
          setError(null);
        }}
        aria-label={t("team.notice.sendTo", {
          name: customerName ?? t("team.clients.clientLower"),
        })}
        title={pendingPreset ? t("team.notice.scheduledTitle") : t("team.notice.send")}
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
          pendingPreset
            ? "border-gold text-gold"
            : "border-border text-muted-foreground hover:border-gold hover:text-gold"
        }`}
      >
        <Bell className="size-4" />
      </button>

      {message &&
        !open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="status"
            className="pointer-events-none fixed inset-x-4 bottom-[var(--app-banner-bottom,1.5rem)] z-[110] mx-auto w-auto max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-card-foreground shadow-lg"
          >
            {message}
          </div>,
          // Na raiz do painel (sem transform) o aviso segue o modo de canto e o cartão off-white.
          document.querySelector<HTMLElement>(".arena-workspace") ?? document.body,
        )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-sm rounded-3xl border-border bg-card p-5"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogTitle className="text-base font-extrabold">{t("team.notice.send")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("team.notice.description", { name: customerName ?? t("team.notice.theClient") })}
          </DialogDescription>
          {pendingPreset && (
            <p className="mt-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground">
              {richText(t("team.notice.scheduled"), {
                name: <strong>{pendingLabel ?? pendingPreset}</strong>,
              })}
              {waitSeconds > 0 ? t("team.notice.sendsIn", { wait: formatWait(waitSeconds) }) : "."}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => void send(preset.id)}
                className="flex w-full flex-col gap-0.5 rounded-xl border border-border px-3 py-3 text-left hover:border-primary disabled:opacity-50"
              >
                <span className="text-sm font-semibold">{t(preset.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{t(preset.hintKey)}</span>
              </button>
            ))}
          </div>
          {busy && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {t("team.notice.sending")}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
