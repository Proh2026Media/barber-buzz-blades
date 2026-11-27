import { PerfilProfissional, type PerfilPublico } from "@/features/marketing/PerfilProfissional";
import { createFileRoute, Link, redirect, notFound } from "@tanstack/react-router";
import { CalendarSearch, UserX, Users } from "lucide-react";
import { Abertura } from "@/components/Abertura";
import { EmptyState } from "@/components/visual";
import { NotFoundPage } from "@/components/NotFoundPage";
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

    const perfil = await supabase.rpc("perfil_publico_profissional", {
      p_host: window.location.hostname,
      p_slug: raw,
    });
    if (perfil.error) throw new Error(perfil.error.message);
    if (perfil.data) return { perfil: perfil.data as unknown as PerfilPublico };
    // Uma equipe privada ou um endereço antigo conserva o fluxo de agendamento existente.
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
        tab: "agendar",
        reserva: undefined,
      },
    });
  },
  pendingComponent: Abertura,
  component: PaginaDoBarbeiro,
  // A 404 desta rota fica nela mesma: a rota é só do navegador (ssr: false), e a 404 da raiz,
  // desenhada já na hidratação, não batia com o HTML do servidor (aviso de hidratação).
  notFoundComponent: NotFoundPage,
});

function PaginaDoBarbeiro() {
  const { perfil } = Route.useRouteContext();
  return perfil ? (
    <PerfilProfissional key={perfil.loja.id + perfil.profissional.slug} perfil={perfil} />
  ) : (
    <BarberLinkMissing />
  );
}

function BarberLinkMissing() {
  const { t } = useI18n();
  const { missingInShop } = Route.useRouteContext() as { missingInShop?: string };
  // Principal: a página pública desta loja ("/" neste domínio), sem precisar entrar.
  return (
    <main className="public-page flex min-h-dvh items-center justify-center bg-background p-4">
      <EmptyState
        className="public-card w-full max-w-sm"
        status="neutral"
        icon={UserX}
        title={t("app.barberLink.missingTitle")}
        description={t("app.barberLink.missingBody")}
        action={
          <Link to="/" className="action-button action-confirm min-h-12 w-full">
            <Users aria-hidden />
            {t("app.barberLink.seeTeam")}
          </Link>
        }
        secondaryAction={
          <Link
            to="/app"
            search={{
              barber: undefined,
              shop: missingInShop,
              join: undefined,
              tab: undefined,
              reserva: undefined,
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            <CalendarSearch className="size-4" aria-hidden />
            {t("app.barberLink.book")}
          </Link>
        }
      />
    </main>
  );
}
