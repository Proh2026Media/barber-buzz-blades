import { useEffect, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Hourglass,
  Loader2,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import {
  ActionResult,
  ChoiceCards,
  Hint,
  Notice,
  PreviewPanel,
  StatusBadge,
  STATE,
  type ActionState,
} from "@/components/visual";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";

const PRESETS = [
  {
    id: "reminder_next" as const,
    icon: CalendarClock,
    titleKey: "team.notice.reminderNext",
    hintKey: "team.notice.reminderNextHint",
    sampleKey: "team.notice.sample.reminderNext",
  },
  {
    id: "confirm_today" as const,
    icon: CalendarCheck,
    titleKey: "team.notice.confirmToday",
    hintKey: "team.notice.confirmTodayHint",
    sampleKey: "team.notice.sample.confirmToday",
  },
  {
    id: "slot_open" as const,
    icon: Sparkles,
    titleKey: "team.notice.slotOpen",
    hintKey: "team.notice.slotOpenHint",
    sampleKey: "team.notice.sample.slotOpen",
  },
  {
    id: "shop_hello" as const,
    icon: Megaphone,
    titleKey: "team.notice.shopHello",
    hintKey: "team.notice.shopHelloHint",
    sampleKey: "team.notice.sample.shopHello",
  },
] as const satisfies readonly {
  id: string;
  icon: LucideIcon;
  titleKey: MessageKey;
  hintKey: MessageKey;
  sampleKey: MessageKey;
}[];

type NoticePreset = (typeof PRESETS)[number]["id"];

function formatWait(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return m === 1 ? tNow("team.notice.minuteOne") : tNow("team.notice.minutes", { count: m });
}

function channelLabel(channel: string) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return tNow("team.notice.channelEmail");
  return channel;
}

/**
 * "Avisar" o cliente em dois passos: escolher a mensagem (com o exemplo do que ele recebe) e
 * tocar em "Enviar aviso". O resultado aparece com ícone e cor: enviado ✓, agendado ⏳, erro ✕.
 */
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
  const [choice, setChoice] = useState<NoticePreset | null>(null);
  const [state, setState] = useState<ActionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const name = customerName ?? t("team.notice.theClient");
  const firstName = (customerName ?? "").trim().split(/\s+/)[0] || t("team.notice.theClient");

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
    setChoice(null);
    setState(null);
    setError(null);
    void refreshPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao abrir
  }, [open, shopId, customerId]);

  async function send() {
    if (!choice || state === "saving") return;
    setState("saving");
    setError(null);
    try {
      if (demo) {
        setOpen(false);
        toast.info(t("team.notice.demo"), { description: name });
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("send_client_notice", {
        p_shop_id: shopId,
        p_customer_id: customerId,
        p_preset: choice,
      });
      if (rpcError) throw rpcError;
      const result = data as {
        channels?: string[];
        status?: string;
        wait_seconds?: number;
        preset?: string;
      } | null;
      if (result?.status === "queued") {
        const wait = Number(result.wait_seconds) || 0;
        setPendingPreset(result.preset ?? choice);
        setWaitSeconds(wait);
        setOpen(false);
        toast(t("team.notice.queuedTitle"), {
          description: t("team.notice.queuedShort", { wait: formatWait(wait) }),
          icon: <Hourglass aria-hidden />,
        });
        return;
      }
      const channels = result?.channels ?? [];
      setPendingPreset(null);
      setWaitSeconds(0);
      setOpen(false);
      toast.success(
        channels.length
          ? t("team.notice.sentBy", {
              channels: channels.map(channelLabel).join(t("team.notice.and")),
            })
          : t("team.notice.recorded"),
        { description: name },
      );
    } catch (cause) {
      // Nunca a frase crua do banco: sempre a versão amigável, com o que fazer.
      setError(friendlyAuthError(cause, t("team.notice.sendError")));
      setState("error");
    } finally {
      setState((current) => (current === "saving" ? null : current));
    }
  }

  const pending = PRESETS.find((row) => row.id === pendingPreset);
  const chosen = PRESETS.find((row) => row.id === choice);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={t("team.notice.sendTo", {
          name: customerName ?? t("team.clients.clientLower"),
        })}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
          pendingPreset
            ? "tone-pending border-[color:var(--tone-border)] bg-[color:var(--tone-soft)] text-[color:var(--tone-ink)]"
            : "border-border bg-background hover:border-primary/40"
        }`}
      >
        {pendingPreset ? (
          <Hourglass className="size-4" aria-hidden />
        ) : (
          <MessageSquareText className="size-4 text-gold" aria-hidden />
        )}
        <span className="max-[359px]:sr-only">
          {pendingPreset ? t("team.notice.scheduledShort") : t("team.notice.notify")}
        </span>
      </button>

      <Dialog open={open} onOpenChange={(next) => state !== "saving" && setOpen(next)}>
        <DialogContent
          className="max-h-[88dvh] max-w-md overflow-y-auto rounded-3xl border-border bg-card p-5"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-1 pr-10">
            <DialogTitle className="text-base font-extrabold">
              {t("team.notice.titleFor", { name: firstName })}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("team.notice.pick")}
            </DialogDescription>
          </div>

          {pending && (
            <Notice
              tone="pending"
              icon={Hourglass}
              role="none"
              title={t("team.notice.alreadyQueued", { name: t(pending.titleKey) })}
            >
              <div className="flex flex-col items-start gap-1.5">
                {waitSeconds > 0 ? (
                  <StatusBadge
                    {...STATE.waiting}
                    size="sm"
                    label={t("team.notice.sendsInShort", { wait: formatWait(waitSeconds) })}
                  />
                ) : null}
                <Hint icon={RefreshCw} tone="pending" className="text-inherit">
                  {t("team.notice.replaces")}
                </Hint>
              </div>
            </Notice>
          )}

          <ChoiceCards
            legend={t("team.notice.pick")}
            columns={1}
            value={choice}
            onChange={(value) => {
              setChoice(value);
              setState(null);
              setError(null);
            }}
            disabled={state === "saving"}
            options={PRESETS.map((preset) => ({
              value: preset.id,
              title: t(preset.titleKey),
              description: t(preset.hintKey),
              icon: preset.icon,
            }))}
          />

          {chosen && (
            <PreviewPanel
              title={t("team.notice.previewTitle")}
              icon={MessageSquareText}
              badge={t("catalog.preview.badge")}
              live
            >
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
                {t(chosen.sampleKey, { name: firstName })}
              </div>
              <Hint>{t("team.notice.channels")}</Hint>
            </PreviewPanel>
          )}

          <ActionResult
            state={state === "error" ? "error" : null}
            text={error ?? t("team.notice.sendError")}
            onRetry={() => void send()}
            reveal={false}
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === "saving"}
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              disabled={!choice || state === "saving"}
              onClick={() => void send()}
              className="action-button action-confirm flex-1"
            >
              {state === "saving" ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {state === "saving" ? t("team.notice.sending") : t("team.notice.sendButton")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
