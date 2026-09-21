import { createFileRoute } from "@tanstack/react-router";
import { PlatformShell } from "@/features/platform/PlatformShell";
import { requireRole } from "@/lib/auth/guards";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await requireRole("/platform", ["platform_admin"]);
    return { profile };
  },
  component: PlatformRoute,
});

function PlatformRoute() {
  const { profile } = Route.useRouteContext();
  return <PlatformShell profile={profile} />;
}
