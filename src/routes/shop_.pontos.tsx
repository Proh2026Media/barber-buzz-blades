import { useEffect, useState } from "react";
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
  // Decide na entrada. Redimensionar durante uma edição no celular não descarta o rascunho.
  const [inPanel] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (!inPanel) return;
    const search = new URLSearchParams(window.location.search);
    search.set("secao", "pontos");
    window.location.replace(`/shop?${search}`);
  }, [inPanel]);
  return inPanel ? null : <LoyaltyAdminPage profile={profile} />;
}
