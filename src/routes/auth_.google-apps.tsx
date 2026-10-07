import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Info, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { platformAuthOrigin } from "@/lib/auth/return-origin";
import { t as tNow, useI18n } from "@/lib/i18n";
import { announce, Hint, MoreDetails, Steps } from "@/components/visual";
import { GoogleMark, ResultHero } from "@/features/auth/entry";

export const Route = createFileRoute("/auth_/google-apps")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
    state: typeof s.state === "string" ? s.state : "",
    error: typeof s.error === "string" ? s.error : "",
    error_description: typeof s.error_description === "string" ? s.error_description : "",
  }),
  // Sem requireSession: o cookie de login fica no domínio da loja; o redirect
  // do Google cai no apex. O complete valida o state HMAC sem precisar da sessão.
  component: GoogleAppsCallback,
});

type Phase = "connecting" | "success" | "cancelled" | "error";
type BackTarget = { path: string; origin: string; params: Record<string, string> };

/** Segundos até voltar sozinho: rápido no sucesso, com tempo para ler nos demais. */
const BACK_SECONDS: Record<Exclude<Phase, "connecting">, number> = {
  success: 3,
  cancelled: 6,
  error: 6,
};

function goBack({ path, origin, params }: BackTarget) {
  const query = new URLSearchParams(params);
  const [pathname, existing = ""] = path.split("?");
  const merged = new URLSearchParams(existing);
  for (const [key, value] of query.entries()) merged.set(key, value);
  const target = `${origin.replace(/\/$/, "")}${pathname}?${merged.toString()}`;
  window.location.assign(target);
}

function GoogleAppsCallback() {
  const { code, state, error: oauthError, error_description } = Route.useSearch();
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("connecting");
  // Detalhe técnico (para o suporte) ou a dica do Google: fica recolhido.
  const [detail, setDetail] = useState<string | null>(null);
  const [back, setBack] = useState<BackTarget | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Qualquer toque ou tecla na tela (abrir "Detalhes", ler a dica) para a volta automática:
  // a página não sai no meio da leitura. O botão continua voltando na hora.
  const [paused, setPaused] = useState(false);

  // Volta automática com a contagem à vista; o botão volta na hora.
  useEffect(() => {
    if (secondsLeft === null || !back || paused) return;
    if (secondsLeft <= 0) {
      goBack(back);
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => (value ?? 1) - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, back, paused]);

  useEffect(() => {
    let cancelled = false;

    function settle(next: Exclude<Phase, "connecting">, target: BackTarget, info: string | null) {
      setPhase(next);
      setDetail(info);
      setBack(target);
      setSecondsLeft(BACK_SECONDS[next]);
    }

    async function finish() {
      const fallbackOrigin = platformAuthOrigin();

      if (oauthError) {
        const denied =
          oauthError === "access_denied"
            ? tNow("app.google.denied")
            : tNow("app.google.refused", { detail: error_description || oauthError });
        settle(
          oauthError === "access_denied" ? "cancelled" : "error",
          { path: "/shop", origin: fallbackOrigin, params: { google: "error", reason: denied } },
          denied,
        );
        return;
      }
      if (!code || !state) {
        settle(
          "error",
          { path: "/shop", origin: fallbackOrigin, params: {} },
          tNow("app.google.incomplete"),
        );
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const base = import.meta.env.VITE_SUPABASE_URL || "";
        const headers: Record<string, string> = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${base}/functions/v1/google-connect`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "complete", code, state }),
        });
        const payload = (await response.json()) as {
          error?: string;
          return_path?: string;
          return_origin?: string;
        };
        if (!response.ok) throw new Error(payload.error || tNow("app.google.completeFailed"));

        if (cancelled) return;
        announce(tNow("app.google.connected"));
        settle(
          "success",
          {
            path: payload.return_path || "/shop",
            origin: payload.return_origin || fallbackOrigin,
            params: { google: "connected" },
          },
          null,
        );
      } catch (err) {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : tNow("app.google.failed");
        settle(
          "error",
          { path: "/shop", origin: fallbackOrigin, params: { google: "error", reason: detail } },
          detail,
        );
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [code, state, oauthError, error_description]);

  const hero =
    phase === "connecting"
      ? {
          tone: "progress" as const,
          icon: undefined,
          title: t("entry.gapps.connecting"),
          line: null,
        }
      : phase === "success"
        ? { tone: "success" as const, icon: undefined, title: t("entry.gapps.okTitle"), line: null }
        : phase === "cancelled"
          ? {
              tone: "neutral" as const,
              icon: Info,
              title: t("entry.gapps.cancelTitle"),
              line: t("entry.gapps.cancelLine"),
            }
          : {
              tone: "danger" as const,
              icon: undefined,
              title: t("entry.gapps.errorTitle"),
              line: t("entry.gapps.errorLine"),
            };

  return (
    <main className="mb-page flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <div
        className="entry-result-card w-full max-w-sm space-y-5 p-6 sm:p-8"
        onPointerDownCapture={() => setPaused(true)}
        onKeyDownCapture={() => setPaused(true)}
      >
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <GoogleMark />
          {t("entry.gapps.title")}
        </p>
        <ResultHero tone={hero.tone} icon={hero.icon} title={hero.title}>
          {hero.line}
        </ResultHero>
        {phase !== "cancelled" && phase !== "error" && (
          <Steps
            orientation="vertical"
            label={t("entry.gapps.stepsLabel")}
            className="rounded-2xl border border-border bg-background/60 p-4"
            steps={[
              { key: "auth", label: t("entry.gapps.step.authorized"), status: "done" },
              {
                key: "save",
                label: t("entry.gapps.step.saving"),
                status: phase === "success" ? "done" : "current",
              },
              {
                key: "back",
                label: t("entry.gapps.step.back"),
                status: phase === "success" ? "current" : "upcoming",
              },
            ]}
          />
        )}
        {/* Cancelado no Google: a saída mais provável ("app não verificado") fica à vista. */}
        {phase === "cancelled" && (
          <Hint icon={ShieldAlert} className="text-sm">
            {t("entry.gapps.unverifiedHint")}
          </Hint>
        )}
        {detail && phase !== "cancelled" && (
          <MoreDetails summary={phase === "error" ? t("entry.gapps.details") : undefined}>
            <p className="text-xs [overflow-wrap:anywhere]">{detail}</p>
          </MoreDetails>
        )}
        {back && (
          <div className="grid gap-1.5">
            <button
              type="button"
              className="action-button entry-submit"
              onClick={() => goBack(back)}
            >
              <ArrowLeft aria-hidden="true" />
              {t("entry.gapps.back")}
            </button>
            {!paused && secondsLeft !== null && secondsLeft > 0 && (
              <p className="text-center text-xs text-muted-foreground tabular-nums">
                {t("entry.gapps.backIn", { seconds: secondsLeft })}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
