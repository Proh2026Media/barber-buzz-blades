import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleWarning, RefreshCw, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice, StatusBadge } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
type Health = {
  checked_at: string | null;
  provider_available: boolean;
  global_paused: boolean;
  numbers: {
    id: string;
    name: string;
    phone: string;
    state: string;
    paused: boolean;
    severity: "danger" | "warning" | "ok";
    issues: string[];
  }[];
};
const issueKey: Record<string, MessageKey> = {
  unknown_connection: "waHealth.unknownConnection",
  disconnected: "waHealth.disconnected",
  failed: "waHealth.failed",
  unknown_delivery: "waHealth.unknownDelivery",
  pending: "waHealth.pending",
};
export function WhatsAppHealthIndicator({ onOpenCentral }: { onOpenCentral: () => void }) {
  const { t, locale } = useI18n();
  const demo = useDemo();
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Health | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false);
  const flight = useRef(false),
    live = useRef(true),
    abort = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (demo || flight.current || document.hidden) return;
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setOffline(false);
    flight.current = true;
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error();
      const r = await guardedFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-health`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
          signal: controller.signal,
        },
      );
      const next = await r.json();
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      if (!live.current || current?.user.id !== session.user.id) return;
      if (!r.ok || next.ok !== true || !Array.isArray(next.numbers)) {
        if (r.status === 401 || r.status === 403) setData(null);
        throw new Error();
      }
      setData(next);
      setError(false);
    } catch {
      if (live.current) setError(true);
    } finally {
      clearTimeout(timer);
      flight.current = false;
      if (live.current) setBusy(false);
    }
  }, [demo]);
  useEffect(() => {
    live.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    const change = () => void refresh();
    const off = () => setOffline(true);
    document.addEventListener("visibilitychange", change);
    window.addEventListener("online", change);
    window.addEventListener("offline", off);
    return () => {
      live.current = false;
      abort.current?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", change);
      window.removeEventListener("online", change);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);
  const alerts = data?.numbers.filter((n) => n.severity !== "ok") ?? [];
  const warning =
    error || offline || !data?.provider_available || data?.global_paused || alerts.length > 0;
  const label =
    error || offline
      ? t("waHealth.unavailable")
      : alerts.length
        ? t("waHealth.alertCount", { count: alerts.length })
        : data
          ? t(data.global_paused ? "waHealth.paused" : "waHealth.title")
          : t("waHealth.checking");
  return (
    <>
      <button
        type="button"
        className="app-icon-button relative"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
      >
        <MessageCircleWarning className="size-5" aria-hidden />
        <span
          aria-hidden
          className={
            "absolute right-1 top-1 size-2.5 rounded-full border-2 border-background " +
            (alerts.some((n) => n.severity === "danger")
              ? "bg-destructive"
              : warning
                ? "bg-amber-500"
                : "bg-emerald-600")
          }
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md" mobileSheet aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("waHealth.title")}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("waHealth.refreshHint")}</p>
            {(error || offline) && <Notice tone="warning" title={t("waHealth.unavailable")} />}
            {data?.global_paused && <Notice tone="warning" title={t("waHealth.paused")} />}
            {data && !data.provider_available && (
              <Notice tone="warning" title={t("waHealth.unknownConnection")} />
            )}
            {!data && busy && <p role="status">{t("waHealth.checking")}</p>}
            {data && data.numbers.length === 0 && <p>{t("waHealth.empty")}</p>}
            <ul className="space-y-2">
              {[...(data?.numbers ?? [])]
                .sort((a, b) => Number(b.severity !== "ok") - Number(a.severity !== "ok"))
                .map((n) => (
                  <li key={n.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{n.name}</p>
                        <p className="text-sm break-all text-muted-foreground">{n.phone}</p>
                      </div>
                      <StatusBadge
                        tone={
                          n.severity === "danger"
                            ? "danger"
                            : n.severity === "warning"
                              ? "warning"
                              : "success"
                        }
                        label={t(n.severity === "ok" ? "waHealth.connected" : "waHealth.attention")}
                      />
                    </div>
                    {n.issues.map((issue) => (
                      <p key={issue} className="text-sm">
                        {t(issueKey[issue] ?? "waHealth.unknownConnection")}
                      </p>
                    ))}
                    {n.paused && (
                      <p className="text-xs text-muted-foreground">{t("waHealth.numberPaused")}</p>
                    )}
                  </li>
                ))}
            </ul>
            {data?.checked_at && (
              <p className="text-xs text-muted-foreground">
                {t("waHealth.checked", {
                  time: new Date(data.checked_at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="action-button"
                disabled={busy || offline}
                onClick={() => void refresh()}
              >
                <RefreshCw aria-hidden />
                {t("care.refresh")}
              </button>
              <button
                type="button"
                className="action-button action-confirm"
                onClick={() => {
                  setOpen(false);
                  onOpenCentral();
                }}
              >
                <ArrowRight aria-hidden />
                {t("waHealth.openCentral")}
              </button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
