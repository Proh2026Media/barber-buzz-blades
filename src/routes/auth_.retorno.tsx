import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingRelay,
  deliverGoogleRelayCode,
  readPendingRelay,
} from "@/lib/auth/google-relay";
import { isStandalone } from "@/lib/standalone";
import { readRelayReturn } from "@/lib/auth/google-relay-model";
import { useI18n } from "@/lib/i18n";
import { GoogleMark, ResultHero } from "@/features/auth/entry";

/**
 * Volta do Google quando o login começou no app instalado (PWA). Dois casos:
 * - a página abre na janela que o sistema põe por cima do app (no iPhone, a folha do Safari), sem
 *   o armazenamento do app: ela só entrega o código ao app pelo banco e pede para fechar a janela;
 *   quem abre a sessão é o app, com a chave que só ele tem;
 * - a página abre com o armazenamento do app que começou o login (app instalado no computador,
 *   que vai ao Google na própria janela, ou o Android): a chave está aqui, então a sessão abre aqui
 *   mesmo e, dentro do app, segue para a área certa. Antes (16/10) esse caso terminava numa tela
 *   "feche esta janela" sem saída, porque o código ia para o banco e ninguém o retirava.
 * Detalhes em `src/lib/auth/google-relay-model.ts`.
 */
export const Route = createFileRoute("/auth_/retorno")({
  ssr: false,
  component: GoogleRelayReturn,
});

type Phase = "working" | "done" | "error";

function GoogleRelayReturn() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("working");
  const [closeTried, setCloseTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { relay, code, failed } = readRelayReturn(window.location.search);
    // O código não fica no endereço (histórico, captura de tela).
    window.history.replaceState(window.history.state, "", window.location.pathname);
    void (async () => {
      const pending = readPendingRelay();
      // Mesmo armazenamento do app que começou o login (app instalado no computador, Android).
      const sameApp = Boolean(pending && relay && pending.id === relay);
      const authUrl = (failedLogin: boolean) => {
        const params = new URLSearchParams();
        if (pending?.next) params.set("next", pending.next);
        if (pending?.shop) params.set("shop", pending.shop);
        if (failedLogin) params.set("google", "falhou");
        const query = params.toString();
        return `/auth${query ? `?${query}` : ""}`;
      };
      // Cancelado no Google ou troca recusada: a espera deste aparelho some (o app não fica
      // esperando à toa) e, dentro do próprio app, volta para a tela de entrar com o aviso.
      const fail = () => {
        if (sameApp) {
          clearPendingRelay();
          if (isStandalone()) {
            window.location.replace(authUrl(true));
            return;
          }
        }
        if (!cancelled) setPhase("error");
      };
      if (failed || !relay) {
        fail();
        return;
      }
      if (pending && sameApp) {
        // Abre a sessão aqui: a chave do PKCE está neste armazenamento.
        const { data: current } = await supabase.auth.getSession();
        let signedIn = Boolean(current.session);
        if (!signedIn && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          signedIn = !error && Boolean(data.session);
        }
        if (!signedIn) {
          fail();
          return;
        }
        clearPendingRelay();
        if (isStandalone()) {
          // A volta caiu dentro do próprio app: a tela de entrar leva à área certa.
          window.location.replace(authUrl(false));
          return;
        }
        // Aba que divide o armazenamento com o app (Android): o app acha a sessão ao voltar.
        if (!cancelled) setPhase("done");
        return;
      }
      // Janela por cima do app, sem o armazenamento dele (iPhone): entrega o código pelo banco.
      const ok = code ? await deliverGoogleRelayCode(relay, code) : false;
      if (!cancelled) setPhase(ok ? "done" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function closeWindow() {
    setCloseTried(true);
    window.close();
  }

  return (
    <main className="mb-page flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="entry-result-card w-full max-w-sm space-y-5 p-6 sm:p-8">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <GoogleMark />
          {t("relay.title")}
        </p>
        {phase === "working" ? (
          <ResultHero tone="progress" title={t("relay.working")} />
        ) : phase === "done" ? (
          <ResultHero tone="success" title={t("relay.doneTitle")}>
            {t("relay.doneLine")}
          </ResultHero>
        ) : (
          <ResultHero tone="danger" title={t("relay.errorTitle")}>
            {t("relay.errorLine")}
          </ResultHero>
        )}
        {phase !== "working" && (
          <div className="grid gap-1.5">
            <button type="button" className="action-button entry-submit" onClick={closeWindow}>
              <X aria-hidden="true" />
              {t("relay.close")}
            </button>
            {/* Janela aberta pelo sistema não fecha por código: o botão OK/X dela fecha. */}
            {closeTried && (
              <p className="text-center text-sm text-muted-foreground">{t("relay.closeHint")}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
