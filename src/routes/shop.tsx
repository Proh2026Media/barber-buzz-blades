import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { isPlatformApexHost, PLATFORM_BASE_HOST } from "@/lib/shop/host";
import { ShopShell } from "@/features/shop/ShopShell";
import { idLojaGerenciada } from "@/lib/auth/destination";
import { requireProfessional, requireRole } from "@/lib/auth/guards";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/shop")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const parametros = new URLSearchParams(location.searchStr);
    const id = parametros.get("gestao");
    if (id === null) return { profile: await requireProfessional("/shop"), managedShop: null };
    if (!isPlatformApexHost()) {
      throw redirect({ href: `https://${PLATFORM_BASE_HOST}/shop${location.searchStr}` });
    }
    const profile = await requireRole(location.pathname + location.searchStr, ["platform_admin"]);
    if (!idLojaGerenciada(id)) throw notFound();
    const { data, error } = await supabase.from("barbershops").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { profile, managedShop: data };
  },
  component: ShopRoute,
});

function ShopRoute() {
  const { profile, managedShop } = Route.useRouteContext();
  return <ShopShell key={managedShop?.id ?? profile.user.id} profile={profile} managedShop={managedShop} />;
}
