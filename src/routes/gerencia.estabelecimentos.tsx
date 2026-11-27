import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LayoutTemplate, LogOut, Palette, RefreshCw, Store, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AursetLogo } from "@/components/visual/AursetLogo";
import { LoadingState, Notice } from "@/components/visual";
import { MyAreasSection } from "@/features/account/MyAreas";
import { useAreaSwitch, useMyAreas, useRememberArea } from "@/features/account/useAreas";
import { PasswordChangeGate } from "@/features/auth/PasswordChangeGate";
import { TermsUpdateGate } from "@/features/legal/TermsUpdateGate";
import {
  ShopAppearanceDialog,
  type ShopAppearanceTarget,
} from "@/features/platform/ShopAppearanceDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { requireRole } from "@/lib/auth/guards";
import { hasAnyRole, type SessionProfile } from "@/lib/auth/session";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { t as traduzir, useI18n } from "@/lib/i18n";
import type { RequestAppearanceChanges, ShopAppearanceSettings } from "@/lib/shop/branding";
import { isPlatformApexHost } from "@/lib/shop/host";

export const Route = createFileRoute("/gerencia/estabelecimentos")({
  ssr: false,
  beforeLoad: async () => {
    if (!isPlatformApexHost()) {
      throw redirect({
        to: "/shop",
        replace: true,
      });
    }
    const profile = await requireRole("/gerencia/estabelecimentos", [
      "account_manager",
      "platform_admin",
    ]);
    if (hasAnyRole(profile.memberships, ["platform_admin"])) {
      throw redirect({ href: "/platform?aba=barbearias" });
    }
    return { profile };
  },
  component: Gerencia,
});

async function carregarAparencia(shopId: string): Promise<ShopAppearanceSettings> {
  const { data, error } = await supabase.rpc("get_managed_brand_settings", { p_shop_id: shopId });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.barbershop_id !== shopId) {
    throw new Error(traduzir("plat.shell.brandOpenError"));
  }
  return data as ShopAppearanceSettings;
}

const solicitarMudanca: RequestAppearanceChanges = async (shopId, changes) => {
  const { data, error } = await supabase.rpc("request_shop_change", {
    p_shop_id: shopId,
    p_kind: "identity.update",
    p_payload: { changes: changes as Json },
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.status !== "pending") {
    throw new Error(traduzir("manager.requestFailed"));
  }
};

function Gerencia() {
  const { profile } = Route.useRouteContext();
  const { session, loading } = useAuthSession();
  const mesmaConta = session?.user.id === profile.user.id;
  useEffect(() => {
    if (!loading && !mesmaConta) window.location.replace("/gerencia/estabelecimentos");
  }, [loading, mesmaConta]);
  return mesmaConta ? <Estabelecimentos key={profile.user.id} profile={profile} /> : null;
}

function Estabelecimentos({ profile }: { profile: SessionProfile }) {
  const { t } = useI18n();
  const areas = useMyAreas(profile);
  const troca = useAreaSwitch();
  const [target, setTarget] = useState<ShopAppearanceTarget | null>(null);
  useRememberArea(profile.user.id, "manager");
  const lojas = useQuery({
    queryKey: ["estabelecimentos-gerenciados", profile.user.id],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("list_managed_brand_shops").abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const lojaAberta = !lojas.isError && lojas.data?.find((shop) => shop.id === target?.shop.id);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PasswordChangeGate userId={profile.user.id} />
      <TermsUpdateGate userId={profile.user.id} />
      <header className="border-b border-border bg-card px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <AursetLogo className="h-7 w-auto" title="Aurset" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="action-button min-h-11"
                aria-label={t("plat.account.menuAria", {
                  name: profile.profile?.full_name ?? profile.user.email ?? "",
                })}
              >
                <UserRound className="size-5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[80dvh] overflow-y-auto">
              <MyAreasSection
                areas={areas}
                current={{ kind: "manager" }}
                onPick={(area) => {
                  if (area.kind !== "manager") troca.open(area);
                }}
              />
              <button
                type="button"
                className="action-button mt-3 min-h-11 w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.assign("/auth");
                }}
              >
                <LogOut className="size-4" aria-hidden />
                {t("plat.account.signOut")}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">{t("area.managerTitle")}</h1>
        {lojas.isPending ? (
          <LoadingState variant="list" count={2} label={t("manager.loading")} />
        ) : lojas.isError ? (
          <Notice
            tone="danger"
            title={t("manager.loadFailed")}
            action={{
              label: t("visual.retry"),
              icon: RefreshCw,
              onClick: () => void lojas.refetch(),
            }}
          />
        ) : !lojas.data?.length ? (
          <Notice tone="neutral" icon={Store} title={t("manager.noShops")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lojas.data.map((shop) => (
              <li
                key={shop.id}
                className="min-w-0 space-y-3 rounded-[var(--panel-radius)] border border-border bg-card p-4"
              >
                <h2 className="flex items-center gap-2 break-words text-lg font-bold">
                  <Store className="size-5 shrink-0" aria-hidden />
                  {shop.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="action-button min-h-11"
                    onClick={() => setTarget({ shop, editor: "identity" })}
                  >
                    <Palette className="size-4" aria-hidden />
                    {t("shop.settings.brand")}
                  </button>
                  <button
                    type="button"
                    className="action-button min-h-11"
                    onClick={() => setTarget({ shop, editor: "landing" })}
                  >
                    <LayoutTemplate className="size-4" aria-hidden />
                    {t("landingEditor.title")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      {lojaAberta && target && (
        <ShopAppearanceDialog
          key={lojaAberta.id}
          target={{ ...target, shop: lojaAberta }}
          onOpen={setTarget}
          onClose={() => setTarget(null)}
          loadSettings={carregarAparencia}
          requestChanges={solicitarMudanca}
        />
      )}
      {troca.overlay}
    </div>
  );
}
