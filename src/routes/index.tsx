import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionProfile, homeForRole } from "@/lib/auth/session";
import { isPlatformApexHost, maybeRedirectToCanonical, resolveShopFromCurrentHost } from "@/lib/shop/host";
import { PlatformLanding } from "@/features/marketing/PlatformLanding";

export const Route = createFileRoute("/")({
  // SSR ligado para crawlers (verificação OAuth Google) lerem a landing e os links legais.
  beforeLoad: async () => {
    const profile = await getSessionProfile();
    if (profile) {
      throw redirect({ to: homeForRole(profile.primaryRole) });
    }

    if (typeof window !== "undefined" && !isPlatformApexHost()) {
      const resolved = await resolveShopFromCurrentHost();
      if (maybeRedirectToCanonical(resolved)) return;
      if (resolved?.shop_slug) {
        throw redirect({
          to: "/app",
          search: { shop: resolved.shop_slug, barber: undefined, join: undefined },
        });
      }
      throw redirect({ to: "/auth", search: { next: "/" } });
    }
  },
  component: IndexPage,
});

function IndexPage() {
  return <PlatformLanding />;
}
