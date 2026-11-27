import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { Abertura } from "@/components/Abertura";
import { useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { resolvePostAuthPath } from "@/lib/auth/session";
import {
  currentHostname,
  isPlatformApexHost,
  maybeRedirectToCanonical,
  resolveShopFromCurrentHost,
} from "@/lib/shop/host";
import { isStandalone } from "@/lib/standalone";
import { readPendingRelay } from "@/lib/auth/google-relay";
import { PlatformLanding } from "@/features/marketing/PlatformLanding";
import { ShopLanding } from "@/features/marketing/ShopLanding";
import { SignedInBar } from "@/features/marketing/SignedInBar";

type PanelHome = "/app" | "/shop" | "/platform" | "/gerencia/estabelecimentos";

/**
 * "/" com sessão: no endereço principal e no app instalado, abre a última área usada neste
 * aparelho (ou a mais alta da conta). No domínio de uma barbearia, pelo navegador, mostra a
 * página pública com a barra "Você está vendo como cliente · Abrir painel".
 */
function opensArea() {
  return isPlatformApexHost() || isStandalone();
}

const dominioInicial = createIsomorphicFn()
  .server(() => getRequestHost({ xForwardedHost: true }).split(",")[0].trim().toLowerCase().split(":")[0])
  .client(currentHostname);

export const Route = createFileRoute("/")({
  // SSR ligado para crawlers (verificação OAuth Google) lerem a landing e os links legais.
  beforeLoad: async () => {
    // A sessão fica no navegador: no servidor nunca há perfil (o IndexPage confere depois).
    if (typeof window === "undefined") return;
    const onShopHost = !isPlatformApexHost();
    if (onShopHost && opensArea() && maybeRedirectToCanonical(await resolveShopFromCurrentHost())) return;
    if (opensArea()) {
      let home = "/auth";
      try {
        home = await resolvePostAuthPath();
      } catch {
        // Falha ao ler o perfil: mostra a landing em vez de quebrar a página.
      }
      if (home !== "/auth") throw redirect({ to: home as PanelHome });
      // App instalado reaberto no meio do login com Google: volta para a tela que espera a janela.
      const pending = isStandalone() ? readPendingRelay() : null;
      if (pending) {
        throw redirect({
          to: "/auth",
          search: { next: pending.next ?? "", ...(pending.shop ? { shop: pending.shop } : {}) },
        });
      }
    }
  },
  loader: () => dominioInicial(),
  component: IndexPage,
});

function IndexPage() {
  const host = Route.useLoaderData();
  const shopHost = host && !isPlatformApexHost(host) ? host : null;
  const [destinoResolvido, setDestinoResolvido] = useState(false);
  const navigate = useNavigate();

  // Primeira carga vinda do servidor (ex.: app instalado abrindo "/"): o beforeLoad rodou sem
  // sessão e não roda de novo na hidratação. Aplica a mesma regra aqui.
  useEffect(() => {
    if (!opensArea()) return;
    let active = true;
    void resolvePostAuthPath()
      .then((home) => {
        if (!active) return;
        if (home !== "/auth") {
          void navigate({ to: home as PanelHome, replace: true });
          return;
        }
        // App instalado reaberto no meio do login com Google (abertura a frio, sem o beforeLoad):
        // volta para a tela que espera a janela.
        const pending = isStandalone() ? readPendingRelay() : null;
        if (pending) {
          void navigate({
            to: "/auth",
            search: { next: pending.next ?? "", ...(pending.shop ? { shop: pending.shop } : {}) },
            replace: true,
          });
          return;
        }
        setDestinoResolvido(true);
      })
      .catch(() => {
        if (active) setDestinoResolvido(true);
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!shopHost) return;
    let atual = true;
    void resolveShopFromCurrentHost().then((loja) => {
      if (atual) maybeRedirectToCanonical(loja);
    });
    return () => { atual = false; };
  }, [shopHost]);

  return (
    <div className={destinoResolvido ? undefined : "entrada-pendente"}>
      <div className="entrada-espera"><Abertura /></div>
      <div className="entrada-publica">
        {shopHost ? <ShopLanding key={shopHost} host={shopHost} topBar={<SignedInBar />} /> : <PlatformLanding />}
      </div>
    </div>
  );
}
