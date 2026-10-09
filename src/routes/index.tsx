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
import { PlatformLanding } from "@/features/marketing/PlatformLanding";
import { ShopLanding } from "@/features/marketing/ShopLanding";
import { SignedInBar } from "@/features/marketing/SignedInBar";

type PanelHome = "/app" | "/shop" | "/platform";

/**
 * "/" com sessão: no endereço principal e no app instalado, abre a última área usada neste
 * aparelho (ou a mais alta da conta). No domínio de uma barbearia, pelo navegador, mostra a
 * página pública com a barra "Você está vendo como cliente · Abrir painel".
 */
function opensArea() {
  return isPlatformApexHost() || isStandalone();
}

export const Route = createFileRoute("/")({
  // SSR ligado para crawlers (verificação OAuth Google) lerem a landing e os links legais.
  beforeLoad: async () => {
    // A sessão fica no navegador: no servidor nunca há perfil (o IndexPage confere depois).
    if (typeof window === "undefined") return;
    const onShopHost = !isPlatformApexHost();
    if (onShopHost && maybeRedirectToCanonical(await resolveShopFromCurrentHost())) return;
    if (opensArea()) {
      let home = "/auth";
      try {
        home = await resolvePostAuthPath();
      } catch {
        // Falha ao ler o perfil: mostra a landing em vez de quebrar a página.
      }
      if (home !== "/auth") throw redirect({ to: home as PanelHome });
    }
    if (onShopHost) return { shopHost: currentHostname() };
  },
  component: IndexPage,
});

function IndexPage() {
  const context = Route.useRouteContext() as { shopHost?: string };
  const [shopHost, setShopHost] = useState<string | null>(context.shopHost ?? null);
  const navigate = useNavigate();

  // Primeira carga vinda do servidor (ex.: app instalado abrindo "/"): o beforeLoad rodou sem
  // sessão e não roda de novo na hidratação. Aplica a mesma regra aqui.
  useEffect(() => {
    if (!opensArea()) return;
    let active = true;
    void resolvePostAuthPath()
      .then((home) => {
        if (active && home !== "/auth") void navigate({ to: home as PanelHome, replace: true });
      })
      .catch(() => {
        /* sem sessão legível: continua na landing */
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  // Na primeira carga renderizada no servidor o endereço só é conhecido no navegador.
  useEffect(() => {
    if (shopHost || isPlatformApexHost()) return;
    let active = true;
    void resolveShopFromCurrentHost().then((resolved) => {
      if (!active || maybeRedirectToCanonical(resolved)) return;
      setShopHost(currentHostname());
    });
    return () => {
      active = false;
    };
  }, [shopHost]);

  if (shopHost) {
    return <ShopLanding host={shopHost} topBar={<SignedInBar />} />;
  }
  return <PlatformLanding />;
}
