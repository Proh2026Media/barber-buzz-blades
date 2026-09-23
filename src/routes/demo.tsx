import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/auth/guards";
import { DemoWorkspace } from "@/features/demo/DemoWorkspace";
import type { DemoRole } from "@/features/demo/chrome";

const DEMO_VIEWS = new Set<DemoRole>([
  "platform",
  "owner",
  "partner",
  "associate",
  "employee",
  "customer",
]);

export const Route = createFileRoute("/demo")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const view = typeof search.view === "string" ? search.view : undefined;
    return {
      shop: typeof search.shop === "string" && search.shop ? search.shop : undefined,
      view: view && DEMO_VIEWS.has(view as DemoRole) ? (view as DemoRole) : undefined,
    };
  },
  beforeLoad: async () => {
    const profile = await requireRole("/demo", ["platform_admin"]);
    return { profile };
  },
  component: DemoRoute,
});

function DemoRoute() {
  const { profile } = Route.useRouteContext();
  const { shop, view } = Route.useSearch();
  return <DemoWorkspace profile={profile} shopId={shop} initialRole={view} />;
}
