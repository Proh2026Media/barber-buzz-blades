import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionProfile, homeForRole } from "@/lib/auth/session";
import {
  currentHostname,
  isPlatformApexHost,
  maybeRedirectToCanonical,
  resolveShopFromCurrentHost,
} from "@/lib/shop/host";
import { PlatformLanding } from "@/features/marketing/PlatformLanding";
import { ShopLanding } from "@/features/marketing/ShopLanding";

export const Route = createFileRoute("/")({
  // SSR ligado para crawlers (verificação OAuth Google) lerem a landing e os links legais.
  beforeLoad: async () => {
    const profile = await getSessionProfile();
    if (profile) {
      throw redirect({ to: homeForRole(profile.primaryRole) });
    }

    if (typeof window !== "undefined" && !isPlatformApexHost()) {
      const resolved = await resolveShopFromCurrentHost();
      if (maybeRedirectToCanonical(resolved)) return;
      return { shopHost: currentHostname() };
    }
  },
  component: IndexPage,
});

function IndexPage() {
  const context = Route.useRouteContext() as { shopHost?: string };
  const [shopHost, setShopHost] = useState<string | null>(context.shopHost ?? null);

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

  if (shopHost) return <ShopLanding host={shopHost} />;
  return <PlatformLanding />;
}
