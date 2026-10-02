import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoyaltyAdminPage } from "@/features/loyalty/LoyaltyAdminPage";
import { requireSession } from "@/lib/auth/guards";
import { hasProfessionalAccess, homeForRole } from "@/lib/auth/session";

export const Route = createFileRoute("/shop_/pontos")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await requireSession("/shop/pontos");
    if (!hasProfessionalAccess(profile)) throw redirect({ to: homeForRole(profile.primaryRole) });
    return { profile };
  },
  component: LoyaltyRoute,
});

function LoyaltyRoute() {
  const { profile } = Route.useRouteContext();
  return <LoyaltyAdminPage profile={profile} />;
}
