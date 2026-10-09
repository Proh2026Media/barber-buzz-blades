import { createFileRoute } from "@tanstack/react-router";
import { LoyaltyAdminPage } from "@/features/loyalty/LoyaltyAdminPage";
import { requireProfessional } from "@/lib/auth/guards";

export const Route = createFileRoute("/shop_/pontos")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await requireProfessional("/shop/pontos");
    return { profile };
  },
  component: LoyaltyRoute,
});

function LoyaltyRoute() {
  const { profile } = Route.useRouteContext();
  return <LoyaltyAdminPage profile={profile} />;
}
