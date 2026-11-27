import { createFileRoute, redirect } from "@tanstack/react-router";
import { PlatformShell } from "@/features/platform/PlatformShell";
import { requireRole } from "@/lib/auth/guards";
import { isPlatformApexHost } from "@/lib/shop/host";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    if (!isPlatformApexHost()) throw redirect({ to: "/shop", replace: true });
    return { profile: await requireRole("/platform", ["platform_admin"]) };
  },
  component: PlatformRoute,
});

function PlatformRoute() {
  const { profile } = Route.useRouteContext();
  return <PlatformShell profile={profile} />;
}
