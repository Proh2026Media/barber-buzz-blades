import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { ReservationAccessGate } from "@/features/customer/ReservationAccessGate";
import { requireSession } from "@/lib/auth/guards";
import { getSessionProfile } from "@/lib/auth/session";
import { maybeRedirectToCanonical, resolveShopFromCurrentHost } from "@/lib/shop/host";

export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    barber: typeof search.barber === "string" ? search.barber : undefined,
    shop: typeof search.shop === "string" ? search.shop : undefined,
    join: search.join === "1" || search.join === true || search.join === "true" ? true : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
    reserva: typeof search.reserva === "string" ? search.reserva : undefined,
  }),
  beforeLoad: async ({ location, search }) => {
    const searchStr =
      typeof location.searchStr === "string" && location.searchStr ? location.searchStr : "";
    // Link de reserva: permite entrar sem sessão; o gate pede WhatsApp + OTP.
    if (search.reserva) {
      const profile = await getSessionProfile();
      if (!profile) return { guestReservation: true as const };
    }
    await requireSession(`/app${searchStr}`);
    return { guestReservation: false as const };
  },
  component: AppRoute,
});

function AppRoute() {
  const { barber, shop, join, tab, reserva } = Route.useSearch();
  const ctx = Route.useRouteContext() as { guestReservation?: boolean };
  const [hostShop, setHostShop] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(Boolean(shop));
  const [guestDone, setGuestDone] = useState(false);

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

  if (ctx.guestReservation && reserva && !guestDone) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <ReservationAccessGate
          token={reserva}
          shopSlug={effectiveShop}
          onAuthenticated={() => {
            setGuestDone(true);
            window.location.replace(
              `/app?tab=reservas&reserva=${encodeURIComponent(reserva)}${
                effectiveShop ? `&shop=${encodeURIComponent(effectiveShop)}` : ""
              }`,
            );
          }}
        />
      </div>
    );
  }

  return (
    <ArenaApp
      directBarberSlug={barber}
      directShopSlug={effectiveShop}
      promptJoin={Boolean(join)}
      initialTab={tab === "reservas" ? "reservas" : undefined}
      focusReservationToken={reserva}
    />
  );
}
