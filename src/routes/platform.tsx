import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PlatformShell } from "@/features/platform/PlatformShell";
import { requireRole } from "@/lib/auth/guards";
import { LoadingState } from "@/components/visual";
import { useI18n } from "@/lib/i18n";
import {
  PLATFORM_BASE_HOST,
  isPlatformApexHost,
  resolveShopFromCurrentHost,
} from "@/lib/shop/host";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    // A plataforma abre sempre no endereço principal, nunca no domínio de uma barbearia.
    if (!isPlatformApexHost() && (await resolveShopFromCurrentHost())) {
      return { moveTo: `https://${PLATFORM_BASE_HOST}/platform`, profile: null };
    }
    const profile = await requireRole("/platform", ["platform_admin"]);
    return { moveTo: null, profile };
  },
  component: PlatformRoute,
});

function PlatformRoute() {
  const { profile, moveTo } = Route.useRouteContext();
  if (moveTo || !profile) return <MoveToMainAddress href={moveTo ?? "/"} />;
  return <PlatformShell profile={profile} />;
}

/** "Abrindo Plataforma…" enquanto troca de endereço (a sessão de lá pode pedir nova entrada). */
function MoveToMainAddress({ href }: { href: string }) {
  const { t } = useI18n();
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <main className="mx-auto max-w-md p-4 pt-16">
      <LoadingState
        variant="lines"
        count={2}
        label={t("shop.switch.opening", { name: t("area.platform") })}
      />
    </main>
  );
}
