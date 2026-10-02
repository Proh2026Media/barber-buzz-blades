import { createFileRoute } from "@tanstack/react-router";
import { ShopLanding } from "@/features/marketing/ShopLanding";

export const Route = createFileRoute("/b/$shopSlug")({
  ssr: false,
  component: ShopLandingRoute,
});

function ShopLandingRoute() {
  const { shopSlug } = Route.useParams();
  return <ShopLanding shopRef={shopSlug} />;
}
