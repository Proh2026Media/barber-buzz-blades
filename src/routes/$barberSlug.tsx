import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
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
    if (error || !data) throw notFound();

    throw redirect({
      to: "/app",
      search: { barber: raw, shop: resolution.shop_slug, join: undefined },
    });
  },
  component: () => null,
});
