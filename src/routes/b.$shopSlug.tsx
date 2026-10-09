import { createFileRoute } from "@tanstack/react-router";
import { ShopLanding } from "@/features/marketing/ShopLanding";
import { SignedInBar } from "@/features/marketing/SignedInBar";

export const Route = createFileRoute("/b/$shopSlug")({
  ssr: false,
  component: ShopLandingRoute,
});

function ShopLandingRoute() {
  const { shopSlug } = Route.useParams();
  return (
    // "Ver como cliente" do painel abre aqui: a barra leva de volta ao painel. Ela fica dentro
    // da página para seguir o modo de canto da loja.
    <ShopLanding shopRef={shopSlug} topBar={<SignedInBar />} />
  );
}
