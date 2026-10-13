import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleAlert, Clock3, KeyRound, LogIn, Users } from "lucide-react";
import { LoadingState, Notice } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { useI18n } from "@/lib/i18n";
import { RoleBadge } from "@/features/shop/roles";

type InviteSearch = { t?: string };

type InviteInfo = {
  status?: "invalid" | "expired" | "has_password" | "ready";
  shop?: { name: string; slug: string; logo_url: string | null };
  role?: string;
  email_hint?: string;
  token_hash?: string;
  error?: string;
};

export const Route = createFileRoute("/convite")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): InviteSearch =>
    typeof search.t === "string" && search.t.trim() ? { t: search.t.trim() } : {},
  component: InvitePage,
});

/** Função do servidor que lê e aceita o link de convite (sem sessão: só o token do link). */
async function callInvite(action: "info" | "accept", token: string): Promise<InviteInfo> {
  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await guardedFetch(`${base}/functions/v1/shop-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    },
    body: JSON.stringify({ action, token }),
  });
  const payload = (await response.json().catch(() => ({}))) as InviteInfo;
  if (!response.ok) throw new Error(payload.error || "invite");
  return payload;
}

/**
 * Link de convite da equipe (`/convite?t=…`, no endereço da barbearia): mostra a loja e o papel
 * e, com um toque, entra na conta nova para criar a senha. Conta que já tem senha vai ao login.
 */
function InvitePage() {
  const { t } = useI18n();
  const { t: token } = Route.useSearch();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInfo({ status: "invalid" });
      return;
    }
    let cancelled = false;
    callInvite("info", token)
      .then((payload) => {
        if (!cancelled) setInfo(payload);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setAcceptError(null);
    try {
      const payload = await callInvite("accept", token);
      if (payload.status !== "ready" || !payload.token_hash) {
        setInfo(payload);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({
        token_hash: payload.token_hash,
        type: "magiclink",
      });
      if (error) throw error;
      window.location.assign("/shop");
    } catch {
      setAcceptError(t("invite.page.acceptError"));
    } finally {
      setBusy(false);
    }
  }

  const shopName = info?.shop?.name || t("eq.invite.theShop");
  const loginHref = "/auth?next=%2Fshop";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="app-action-card w-full max-w-md space-y-4 p-5" aria-live="polite">
        {loadError ? (
          <Notice
            tone="danger"
            icon={CircleAlert}
            title={t("invite.page.loadError")}
            action={{ label: t("invite.page.retry"), onClick: () => window.location.reload() }}
          />
        ) : !info ? (
          <LoadingState label={t("invite.page.loading")} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              {info.shop?.logo_url ? (
                <img
                  src={info.shop.logo_url}
                  alt=""
                  className="size-12 shrink-0 rounded-[var(--control-radius)] object-cover"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-gold/15 text-gold">
                  <Users className="size-6" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold leading-snug break-words">
                  {info.status === "ready" || info.status === "has_password"
                    ? t("invite.page.title", { shop: shopName })
                    : t("invite.page.titleGeneric")}
                </h1>
                {info.role && <RoleBadge role={info.role} size="md" />}
              </div>
            </div>

            {info.status === "ready" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("invite.page.readyLead", { email: info.email_hint ?? "" })}
                </p>
                {acceptError && <Notice tone="danger" icon={CircleAlert} title={acceptError} />}
                <button
                  type="button"
                  onClick={() => void accept()}
                  disabled={busy}
                  className="action-button action-confirm min-h-12 w-full justify-center"
                >
                  <KeyRound aria-hidden />
                  {busy ? t("invite.page.entering") : t("invite.page.accept")}
                </button>
              </>
            )}

            {info.status === "has_password" && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("invite.page.hasPassword", { email: info.email_hint ?? "" })}
                </p>
                <a
                  href={loginHref}
                  className="action-button action-confirm min-h-12 w-full justify-center"
                >
                  <LogIn aria-hidden />
                  {t("invite.page.login")}
                </a>
              </>
            )}

            {(info.status === "expired" || info.status === "invalid" || !info.status) && (
              <>
                <Notice
                  tone="warning"
                  icon={info.status === "expired" ? Clock3 : CircleAlert}
                  title={t(
                    info.status === "expired" ? "invite.page.expired" : "invite.page.invalid",
                  )}
                >
                  {t("invite.page.askNew")}
                </Notice>
                <a
                  href={loginHref}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--button-radius)] px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogIn className="size-4" aria-hidden />
                  {t("invite.page.login")}
                </a>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
