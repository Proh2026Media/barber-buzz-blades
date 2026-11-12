import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice, SectionHeader } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import {
  currentPush,
  pushApi,
  pushIdentity,
  pushSupport,
  publicKeyBytes,
  PUSH_OWNER,
} from "@/lib/push-client";
export function PushNotificationsButton({
  className,
  onOpen,
}: {
  className?: string;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className ?? "action-button"}
        onClick={() => {
          onOpen?.();
          setTimeout(() => setOpen(true), 0);
        }}
      >
        <Bell className="size-4 shrink-0" aria-hidden />
        {t("push.title")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md" mobileSheet aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("push.title")}</DialogTitle>
          </DialogHeader>
          <DialogBody>{open && <PushNotificationsCard bare />}</DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function PushNotificationsCard({ id, bare = false }: { id?: string; bare?: boolean }) {
  const { t, locale } = useI18n();
  const demo = useDemo();
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("unsupported");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState(false),
    [subscribed, setSubscribed] = useState(false),
    [available, setAvailable] = useState(false),
    [key, setKey] = useState(""),
    [permission, setPermission] = useState<NotificationPermission>("default");
  const [error, setError] = useState(false),
    [notice, setNotice] = useState<MessageKey | null>(null);
  const live = useRef(true),
    pending = useRef(false);
  const refresh = useCallback(async () => {
    setError(false);
    const supported = pushSupport();
    setSupport(supported);
    if (demo || supported !== "supported") {
      setLoading(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      const { subscription } = await currentPush();
      if (!live.current) return;
      setSubscribed(Boolean(subscription));
      const data = await pushApi("config", { endpoint: subscription?.endpoint });
      if (!live.current) return;
      setAvailable(data.available === true);
      setKey(data.public_key ?? "");
      setActive(
        data.active === true && Notification.permission === "granted" && Boolean(subscription),
      );
    } catch {
      if (live.current) {
        setError(true);
        setAvailable(false);
      }
    } finally {
      if (live.current) setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    live.current = true;
    void refresh();
    return () => {
      live.current = false;
    };
  }, [refresh]);
  async function act(action: "enable" | "disable" | "test") {
    if (demo || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setNotice(null);
    let created: PushSubscription | null = null;
    try {
      // Pedido nativo apenas no clique explícito, antes de aguardar chamadas à rede.
      const grant =
        action === "enable" ? await Notification.requestPermission() : Notification.permission;
      setPermission(grant);
      if (action === "enable" && grant !== "granted") return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error();
      const owner = pushIdentity(session);
      const { registration, subscription } = await currentPush();
      if (action === "enable") {
        if (!registration?.active || !available) throw new Error();
        if (subscription) await subscription.unsubscribe();
        created = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKeyBytes(key),
        });
        const {
          data: { session: current },
        } = await supabase.auth.getSession();
        if (!current || pushIdentity(current) !== owner) throw new Error();
        await pushApi("register", { subscription: created.toJSON(), locale });
        localStorage.setItem(PUSH_OWNER, owner);
        created = null;
        await refresh();
      } else if (action === "disable") {
        if (subscription) {
          try {
            await pushApi("revoke", { endpoint: subscription.endpoint });
          } catch {
            /* A revogação no navegador também invalida o destino. */
          }
          await subscription.unsubscribe();
        }
        localStorage.removeItem(PUSH_OWNER);
        setActive(false);
        setSubscribed(false);
      } else {
        if (!subscription) throw new Error();
        await pushApi("test", { endpoint: subscription.endpoint });
        setNotice("push.testQueued");
      }
    } catch {
      await created?.unsubscribe().catch(() => false);
      if (live.current) setError(true);
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section
      id={id}
      className={bare ? "space-y-4" : "app-action-card scroll-mt-24 space-y-4 p-4 tablet:p-5"}
      aria-busy={loading || busy}
    >
      {!bare && <SectionHeader icon={Bell} title={t("push.title")} />}
      <p className="text-sm text-muted-foreground">{t("push.description")}</p>
      {loading ? (
        <p role="status">{t("shop.loading")}</p>
      ) : demo ? (
        <Notice title={t("waPair.demo")} tone="info" />
      ) : support === "install" ? (
        <Notice title={t("push.install")} tone="info" />
      ) : support === "unsupported" ? (
        <Notice title={t("push.unsupported")} tone="info" />
      ) : permission === "denied" ? (
        <Notice title={t("push.blocked")} tone="warning" />
      ) : !available ? (
        <Notice title={t("push.preparing")} tone="info" />
      ) : (
        <>
          <Notice tone="info" title={t(active ? "push.on" : "push.off")} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="action-button action-confirm"
              disabled={busy}
              onClick={() => void act(active ? "disable" : "enable")}
            >
              {busy ? (
                <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
              ) : active ? (
                <BellOff aria-hidden />
              ) : (
                <Bell aria-hidden />
              )}
              {t(active ? "push.disable" : "push.enable")}
            </button>
            {active && (
              <button
                type="button"
                className="action-button"
                disabled={busy || notice === "push.testQueued"}
                onClick={() => void act("test")}
              >
                <Send aria-hidden />
                {t("push.test")}
              </button>
            )}
          </div>
        </>
      )}
      {subscribed && (!available || permission === "denied") && (
        <button
          type="button"
          className="action-button"
          disabled={busy}
          onClick={() => void act("disable")}
        >
          <BellOff aria-hidden />
          {t("push.disable")}
        </button>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {t(notice)}
        </p>
      )}
      {error && (
        <Notice
          tone="danger"
          title={t("push.error")}
          action={{ label: t("visual.retry"), onClick: () => void refresh() }}
        />
      )}
      <p className="text-xs text-muted-foreground">{t("push.device")}</p>
    </section>
  );
}
