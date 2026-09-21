import { createFileRoute } from "@tanstack/react-router";
import { ShopShell } from "@/features/shop/ShopShell";
import { requireSession } from "@/lib/auth/guards";
import { hasProfessionalAccess, homeForRole } from "@/lib/auth/session";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shop")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await requireSession("/shop");
    if (!hasProfessionalAccess(profile)) throw redirect({ to: homeForRole(profile.primaryRole) });
    return { profile };
  },
  component: ShopRoute,
});

function ShopRoute() {
  const { profile } = Route.useRouteContext();
  return <ShopShell profile={profile} />;
}
