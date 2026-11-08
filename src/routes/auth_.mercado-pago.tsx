import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { observeSession } from "@/lib/auth/observe-session";
import { platformAuthOrigin } from "@/lib/auth/return-origin";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { ActionResult, LoadingState, Notice, StatusBadge } from "@/components/visual";
import { ResultHero } from "@/features/auth/entry";
import {
  callMercadoPago,
  mercadoPagoErrorKey,
  isMercadoPagoAuthorizationUrl,
  type MercadoPagoConnection,
} from "@/lib/payments/mercado-pago-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/auth_/mercado-pago")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "referrer", content: "no-referrer" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    shop: typeof s.shop === "string" && UUID.test(s.shop) ? s.shop : "",
    receiver_scope:
      s.receiver_scope === "professional" ? ("professional" as const) : ("shop" as const),
    code:
      typeof s.code === "string" && s.code.length > 0 && s.code.length <= 4096 ? s.code : undefined,
    state:
      typeof s.state === "string" && s.state.length > 0 && s.state.length <= 256
        ? s.state
        : undefined,
    error: typeof s.error === "string" && s.error.length > 0 ? "denied" : undefined,
  }),
  component: MercadoPagoConnectionPage,
});

function MercadoPagoConnectionPage() {
  const { t } = useI18n();
  // Segredos de uso único ficam só nesta memória. A URL é limpa antes de qualquer chamada.
  const initial = useRef(Route.useSearch()).current;
  const callback = Boolean(initial.code || initial.state || initial.error);
  const [userId, setUserId] = useState<string | null>();
  const [loaded, setLoaded] = useState<{ userId: string; data: MercadoPagoConnection } | null>(
    null,
  );
  const [error, setError] = useState<{ userId: string; key: MessageKey } | null>(null);
  const [finished, setFinished] = useState<{
    userId: string;
    shopId: string;
    actorId: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const flight = useRef(false);
  const completing = useRef<{
    userId: string;
    promise: Promise<{ shop_id: string; actor_id?: string | null; connected: boolean }>;
  } | null>(null);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const connection = loaded && loaded.userId === userId ? loaded.data : null;
  const errorKey = error && error.userId === userId ? error.key : null;
  const success = finished?.userId === userId ? finished : null;
  const canonical =
    typeof window !== "undefined" && window.location.origin === platformAuthOrigin();

  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of ["code", "state", "error", "error_description"]) url.searchParams.delete(key);
    url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    return observeSession(supabase.auth, (session) => setUserId(session?.user.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId || !canonical) return;
    let active = true;
    const fresh = () => active && currentUser.current === userId;
    if (callback) {
      if (initial.error || !initial.code || !initial.state) return;
      if (completing.current && completing.current.userId !== userId) return;
      completing.current ??= {
        userId,
        promise: callMercadoPago(
          { action: "complete", code: initial.code, state: initial.state },
          userId,
        ),
      };
      void completing.current.promise
        .then((result) => {
          if (!result.connected || !UUID.test(result.shop_id)) throw new Error();
          if (fresh())
            setFinished({
              userId,
              shopId: result.shop_id,
              actorId: result.actor_id && UUID.test(result.actor_id) ? result.actor_id : null,
            });
        })
        .catch((cause) => {
          if (fresh()) setError({ userId, key: mercadoPagoErrorKey(cause) });
        });
    } else if (initial.shop) {
      setError(null);
      void callMercadoPago<MercadoPagoConnection>(
        { action: "status", shop_id: initial.shop, receiver_scope: initial.receiver_scope },
        userId,
      )
        .then((data) => {
          if (typeof data.can_manage !== "boolean" || typeof data.connected !== "boolean")
            throw new Error();
          if (fresh()) setLoaded({ userId, data });
        })
        .catch((cause) => {
          if (fresh()) setError({ userId, key: mercadoPagoErrorKey(cause) });
        });
    }
    return () => {
      active = false;
    };
  }, [userId, canonical, callback, initial, retry]);

  async function start() {
    if (
      !userId ||
      !connection?.can_manage ||
      !connection.configured ||
      connection.connected ||
      flight.current
    )
      return;
    flight.current = true;
    setBusy(true);
    setError(null);
    const actor = userId;
    try {
      const result = await callMercadoPago<{ url: string }>(
        {
          action: "start",
          shop_id: initial.shop,
          receiver_scope: initial.receiver_scope,
          connection_revision: connection.connection_revision,
        },
        actor,
      );
      if (currentUser.current !== actor) return;
      if (!isMercadoPagoAuthorizationUrl(result.url)) throw new Error();
      window.location.assign(result.url);
    } catch (cause) {
      if (currentUser.current === actor)
        setError({ userId: actor, key: mercadoPagoErrorKey(cause) });
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }

  const cancelled = !!initial.error;
  const invalid =
    (!callback && !initial.shop) || (callback && !cancelled && (!initial.code || !initial.state));
  const changedAccount = !!(completing.current && userId && completing.current.userId !== userId);
  const waiting =
    userId === undefined ||
    !!(
      userId &&
      !invalid &&
      !cancelled &&
      !errorKey &&
      !changedAccount &&
      (callback ? !success : !connection)
    );
  const title: MessageKey = success ? "mp.complete" : cancelled ? "mp.cancelled" : "mp.title";
  const actorId = success?.actorId || connection?.actor_id;
  const back = `/shop?secao=pagamentos${actorId && UUID.test(actorId) ? `&unidade=${encodeURIComponent(actorId)}` : ""}`;
  const next =
    !callback && initial.shop
      ? `/auth/mercado-pago?shop=${encodeURIComponent(initial.shop)}&receiver_scope=${initial.receiver_scope}`
      : "/shop";

  return (
    <main className="mb-page flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="entry-result-card w-full max-w-xl space-y-5 p-5 sm:p-8">
        <ResultHero
          icon={CreditCard}
          tone={success ? "success" : cancelled ? "neutral" : "info"}
          title={t(title)}
        >
          {t(
            success
              ? "mp.completeBody"
              : initial.receiver_scope === "professional"
                ? "mp.ownDescription"
                : "mp.description",
          )}
        </ResultHero>
        {connection?.shop_name && (
          <p className="text-center text-lg font-semibold [overflow-wrap:anywhere]">
            {connection.receiver_name || connection.shop_name}
          </p>
        )}
        <div className="flex justify-center">
          <StatusBadge tone="pending" label={t("mp.paymentsOff")} />
        </div>
        {!canonical ? (
          <a
            className="action-button block px-4 py-3 text-center"
            href={`${platformAuthOrigin()}${next}`}
            referrerPolicy="no-referrer"
          >
            {t("mp.openMain")}
          </a>
        ) : (
          <>
            {waiting && (
              <LoadingState
                variant="lines"
                count={2}
                label={t(callback ? "mp.completing" : "mp.loading")}
              />
            )}
            {userId === null && (
              <>
                <Notice tone="info" title={t(callback ? "mp.sessionRestart" : "mp.session")} />
                <a
                  className="action-button block px-4 py-3 text-center"
                  href={`/auth?next=${encodeURIComponent(next)}`}
                >
                  {t("mp.signIn")}
                </a>
              </>
            )}
            {(invalid || changedAccount) && (
              <ActionResult
                state="error"
                text={t(changedAccount ? "mp.sessionRestart" : "mp.invalid")}
              />
            )}
            {errorKey && <ActionResult state="error" text={t(errorKey)} />}
            {cancelled && <Notice tone="neutral" title={t("mp.cancelledBody")} />}
            {connection && !callback && (
              <>
                <Notice tone="info" title={t("mp.preparation")} />
                {!connection.configured && <Notice tone="pending" title={t("mp.unavailable")} />}
                {!connection.can_manage && (
                  <Notice
                    tone="neutral"
                    title={t(
                      connection.management_blocked_reason === "shared_governance"
                        ? "mp.sharedGovernance"
                        : "mp.denied",
                    )}
                  />
                )}
                {connection.connected && <Notice tone="success" title={t("mp.alreadyConnected")} />}
                {connection.configured && connection.can_manage && !connection.connected && (
                  <button
                    type="button"
                    className="action-button flex w-full min-h-11 items-center justify-center gap-2 px-4"
                    disabled={busy || !!errorKey}
                    onClick={() => void start()}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    {t(busy ? "mp.opening" : "mp.authorize")}
                  </button>
                )}
              </>
            )}
            {errorKey && !callback && userId && (
              <button
                className="min-h-11 w-full rounded-xl border border-border px-4"
                type="button"
                disabled={busy}
                onClick={() => {
                  setLoaded(null);
                  setRetry((value) => value + 1);
                }}
              >
                {t("mp.refresh")}
              </button>
            )}
          </>
        )}
        <a
          className="flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold text-muted-foreground"
          href={back}
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("mp.back")}
        </a>
      </div>
    </main>
  );
}
