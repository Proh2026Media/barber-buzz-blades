import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, ExternalLink, RefreshCw, Unplug } from "lucide-react";
import { useDemo } from "@/features/demo/context";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { platformAuthOrigin } from "@/lib/auth/return-origin";
import {
  ActionResult,
  ConfirmDialog,
  LoadingState,
  Notice,
  SectionHeader,
  StatusBadge,
} from "@/components/visual";
import {
  callMercadoPago,
  mercadoPagoErrorKey,
  type MercadoPagoConnection,
} from "@/lib/payments/mercado-pago-client";

type ConnectionProps = {
  shopId: string;
  userId: string;
  receiverScope: "shop" | "professional";
  staffId: string | null;
};

export function MercadoPagoConnectionCard(props: ConnectionProps) {
  return (
    <ConnectionEditor
      key={`${props.shopId}:${props.userId}:${props.receiverScope}:${props.staffId}`}
      {...props}
    />
  );
}

function ConnectionEditor({ shopId, userId, receiverScope }: ConnectionProps) {
  const { t } = useI18n();
  const demo = useDemo();
  const [connection, setConnection] = useState<MercadoPagoConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const mounted = useRef(true);
  const readVersion = useRef(0);
  const flight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback(async () => {
    if (demo) {
      setLoading(false);
      return;
    }
    const version = ++readVersion.current;
    setLoading(true);
    try {
      const data = await callMercadoPago<MercadoPagoConnection>(
        { action: "status", shop_id: shopId, receiver_scope: receiverScope },
        userId,
      );
      if (!mounted.current || version !== readVersion.current) return;
      if (typeof data.connected !== "boolean" || typeof data.can_manage !== "boolean")
        throw new Error();
      setConnection(data);
      setErrorKey(null);
    } catch (error) {
      if (mounted.current && version === readVersion.current)
        setErrorKey(mercadoPagoErrorKey(error));
    } finally {
      if (mounted.current && version === readVersion.current) setLoading(false);
    }
  }, [demo, shopId, userId, receiverScope]);
  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect() {
    if (flight.current || demo || !connection?.can_manage) return;
    flight.current = true;
    setBusy(true);
    setErrorKey(null);
    setDisconnected(false);
    readVersion.current++;
    try {
      await callMercadoPago(
        {
          action: "disconnect",
          shop_id: shopId,
          receiver_scope: receiverScope,
          connection_revision: connection.connection_revision,
        },
        userId,
      );
      if (!mounted.current) return;
      setConfirming(false);
      setDisconnected(true);
      await load();
    } catch (error) {
      if (mounted.current) {
        setErrorKey(mercadoPagoErrorKey(error));
        setConfirming(false);
      }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const blockedKey: MessageKey =
    connection?.management_blocked_reason === "shared_governance"
      ? "mp.sharedGovernance"
      : "mp.denied";
  const canConnect =
    !demo &&
    !loading &&
    !busy &&
    !errorKey &&
    connection?.configured &&
    connection.can_manage &&
    !connection.connected;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <SectionHeader
        icon={CreditCard}
        title={t("mp.title")}
        description={t(receiverScope === "professional" ? "mp.ownDescription" : "mp.description")}
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          tone={connection?.connected ? "success" : "neutral"}
          label={t(
            connection
              ? connection.connected
                ? "mp.connected"
                : "mp.notConnected"
              : loading
                ? "mp.loading"
                : "mp.unknown",
          )}
        />
        <StatusBadge tone="pending" label={t("mp.paymentsOff")} />
        {connection?.connected && (
          <StatusBadge
            tone="info"
            label={t(connection.live_mode ? "mp.realAccount" : "mp.testAccount")}
          />
        )}
      </div>
      <Notice tone="info" title={t("mp.preparation")} />
      {demo && <Notice tone="neutral" title={t("mp.demo")} />}
      {loading && <LoadingState variant="lines" count={2} label={t("mp.loading")} />}
      {errorKey && <ActionResult state="error" text={t(errorKey)} />}
      {disconnected && !errorKey && <ActionResult state="saved" text={t("mp.disconnected")} />}
      {!loading && !errorKey && connection && !connection.configured && (
        <Notice tone="pending" title={t("mp.unavailable")} />
      )}
      {!loading && !errorKey && connection && !connection.can_manage && (
        <Notice tone="neutral" title={t(blockedKey)} />
      )}
      <div className="flex flex-wrap gap-2">
        {canConnect && (
          <a
            className="action-button inline-flex min-h-11 items-center justify-center gap-2 px-4"
            href={`${platformAuthOrigin()}/auth/mercado-pago?shop=${encodeURIComponent(shopId)}&receiver_scope=${receiverScope}`}
            referrerPolicy="no-referrer"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("mp.connect")}
          </a>
        )}
        {!demo && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium"
            onClick={() => void load()}
            disabled={busy || loading}
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("mp.refresh")}
          </button>
        )}
        {connection?.connected && connection.can_manage && !demo && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground"
            disabled={busy || loading || !!errorKey}
            onClick={() => setConfirming(true)}
          >
            <Unplug className="size-4" aria-hidden />
            {t("mp.disconnect")}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("mp.disconnectTitle")}
        description={t("mp.disconnectBody")}
        confirmLabel={t("mp.disconnect")}
        cancelLabel={t("common.cancel")}
        onConfirm={disconnect}
        confirmDisabled={busy}
      />
    </section>
  );
}
