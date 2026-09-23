import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { requireSession } from "@/lib/auth/guards";
import {
  maybeRedirectToCanonical,
  resolveShopFromCurrentHost,
} from "@/lib/shop/host";

export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    barber: typeof search.barber === "string" ? search.barber : undefined,
    shop: typeof search.shop === "string" ? search.shop : undefined,
  }),
  beforeLoad: async () => {
    await requireSession("/app");
  },
  component: AppRoute,
});

function AppRoute() {
  const { barber, shop } = Route.useSearch();
  const [hostShop, setHostShop] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(Boolean(shop));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (shop) {
        setReady(true);
        return;
      }
      const resolved = await resolveShopFromCurrentHost();
      if (cancelled) return;
      if (maybeRedirectToCanonical(resolved)) return;
      if (resolved?.shop_slug) setHostShop(resolved.shop_slug);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [shop]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return <ArenaApp directBarberSlug={barber} directShopSlug={shop || hostShop} />;
}
