import { createFileRoute } from "@tanstack/react-router";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { requireSession } from "@/lib/auth/guards";

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
  return <ArenaApp directBarberSlug={barber} directShopSlug={shop} />;
}
