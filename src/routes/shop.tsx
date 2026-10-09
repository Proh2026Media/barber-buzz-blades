import { createFileRoute } from "@tanstack/react-router";
import { ShopShell } from "@/features/shop/ShopShell";
import { requireProfessional } from "@/lib/auth/guards";

export const Route = createFileRoute("/shop")({
  ssr: false,
  beforeLoad: async () => {
    // Sem acesso ao painel: vai ao app do cliente com o motivo (sem acesso ou removido).
    const profile = await requireProfessional("/shop");
    return { profile };
  },
  component: ShopRoute,
});

function ShopRoute() {
  const { profile } = Route.useRouteContext();
  return <ShopShell profile={profile} />;
}
