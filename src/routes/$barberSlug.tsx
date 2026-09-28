import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { resolveShopFromCurrentHost } from "@/lib/shop/host";
import { supabase } from "@/integrations/supabase/client";
import { isValidBookingSlug } from "@/lib/shop/slugify";

/** Paths de primeiro nível que nunca são slug de barbeiro. */
const RESERVED = new Set([
  "app",
  "shop",
  "auth",
  "platform",
  "demo",
  "politica",
  "privacidade",
  "termos",
  "cadastrar",
  "api",
  "assets",
  "icons",
  "sw.js",
  "manifest.webmanifest",
  "favicon.ico",
  ".well-known",
]);

export const Route = createFileRoute("/$barberSlug")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const raw = (params.barberSlug || "").trim().toLowerCase();
    if (!raw || RESERVED.has(raw) || raw.includes(".") || !isValidBookingSlug(raw)) {
      throw notFound();
    }

    const resolution = await resolveShopFromCurrentHost();
    if (!resolution?.shop_id) {
      // Apex / host sem loja: não trata como barbeiro.
      throw notFound();
    }

    const { data, error } = await supabase.rpc("shop_has_booking_slug", {
      p_shop_id: resolution.shop_id,
      p_booking_slug: raw,
    });
    if (error) throw new Error(error.message);
    if (!data) return { missingInShop: resolution.shop_slug ?? undefined };

    throw redirect({
      to: "/app",
      search: {
        barber: raw,
        shop: resolution.shop_slug,
        join: undefined,
        tab: undefined,
        reserva: undefined,
      },
    });
  },
  pendingComponent: BarberLinkOpening,
  component: BarberLinkMissing,
});

function BarberLinkOpening() {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center bg-background px-4 text-sm text-muted-foreground"
    >
      {t("app.barberLink.opening")}
    </div>
  );
}

function BarberLinkMissing() {
  const { t } = useI18n();
  const { missingInShop } = Route.useRouteContext() as { missingInShop?: string };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("app.barberLink.missingTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("app.barberLink.missingBody")}</p>
        <div className="mt-6">
          <Link
            to="/app"
            search={{
              barber: undefined,
              shop: missingInShop,
              join: undefined,
              tab: undefined,
              reserva: undefined,
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("app.barberLink.book")}
          </Link>
        </div>
      </div>
    </div>
  );
}
