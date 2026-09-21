import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/auth/guards";
import { DemoWorkspace } from "@/features/demo/DemoWorkspace";

export const Route = createFileRoute("/demo")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    shop: typeof search.shop === "string" && search.shop ? search.shop : undefined,
  }),
  beforeLoad: async () => {
    const profile = await requireRole("/demo", ["platform_admin"]);
    return { profile };
  },
  component: DemoRoute,
});

function DemoRoute() {
  const { profile } = Route.useRouteContext();
  const { shop } = Route.useSearch();
  return <DemoWorkspace profile={profile} shopId={shop} />;
}
