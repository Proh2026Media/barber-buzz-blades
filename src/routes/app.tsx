import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { requireSession } from "@/lib/auth/guards";
import { maybeRedirectToCanonical, resolveShopFromCurrentHost } from "@/lib/shop/host";

export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    barber: typeof search.barber === "string" ? search.barber : undefined,
    shop: typeof search.shop === "string" ? search.shop : undefined,
    join: search.join === "1" || search.join === true || search.join === "true" ? true : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const search =
      typeof location.searchStr === "string" && location.searchStr ? location.searchStr : "";
    await requireSession(`/app${search}`);
  },
  component: AppRoute,
});

function AppRoute() {
  const { barber, shop, join } = Route.useSearch();
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

  const effectiveShop = shop || hostShop;
  // Sempre avalia o contexto da loja (Host ou ?shop=); o diálogo só aparece se ainda não for cliente.
  return (
    <ArenaApp directBarberSlug={barber} directShopSlug={effectiveShop} promptJoin={Boolean(join)} />
  );
}
