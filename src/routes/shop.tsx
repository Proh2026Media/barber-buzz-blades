import { createFileRoute, notFound } from "@tanstack/react-router";
import { isPlatformApexHost, resolveShopFromCurrentHost } from "@/lib/shop/host";
import { ShopShell } from "@/features/shop/ShopShell";
import { idLojaGerenciada } from "@/lib/auth/destination";
import { requireProfessional, requireRole } from "@/lib/auth/guards";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/shop")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const parametros = new URLSearchParams(location.searchStr);
    const solicitado = parametros.get("gestao");
    const next = location.pathname + location.searchStr;
    const profile =
      solicitado === null
        ? await requireProfessional(next)
        : await requireRole(next, ["platform_admin"]);
    let id = solicitado;
    if (!isPlatformApexHost() && profile.primaryRole === "platform_admin") {
      const loja = await resolveShopFromCurrentHost();
      if (!loja || (solicitado !== null && solicitado !== loja.shop_id)) throw notFound();
      id = loja.shop_id;
    }
    if (id === null) return { profile, managedShop: null };
    if (!idLojaGerenciada(id)) throw notFound();
    const { data, error } = await supabase
      .from("barbershops")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { profile, managedShop: data };
  },
  component: ShopRoute,
});

function ShopRoute() {
  const { profile, managedShop } = Route.useRouteContext();
  return (
    <ShopShell
      key={managedShop?.id ?? profile.user.id}
      profile={profile}
      managedShop={managedShop}
    />
  );
}
