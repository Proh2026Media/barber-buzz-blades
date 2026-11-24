import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { requireSession } from "@/lib/auth/guards";
import { parseAccessNotice } from "@/lib/auth/destination";
import { maybeRedirectToCanonical, resolveShopFromCurrentHost } from "@/lib/shop/host";
import { useI18n } from "@/lib/i18n";

/** Dia (AAAA-MM-DD) e hora (HH:MM) no fuso da barbearia, como a página pública mostra. */
const DAY_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Abas que podem vir no endereço (com os apelidos em português do link). */
function initialTabFor(tab: string | undefined, hasSlot: boolean) {
  if (tab === "reservas") return "reservas";
  if (tab === "conta" || tab === "perfil") return "perfil";
  if (tab === "agendar" || tab === "agenda" || hasSlot) return "agenda";
  return undefined;
}

export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    barber: typeof search.barber === "string" ? search.barber : undefined,
    shop: typeof search.shop === "string" ? search.shop : undefined,
    join: search.join === "1" || search.join === true || search.join === "true" ? true : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
    reserva: typeof search.reserva === "string" ? search.reserva : undefined,
    // Horário tocado na página pública: o Agendar abre nesse dia com ele pré-escolhido
    // (se ainda estiver livre). Nunca reserva sozinho: a pessoa confirma.
    ...(typeof search.day === "string" && DAY_KEY.test(search.day) ? { day: search.day } : {}),
    ...(typeof search.time === "string" && TIME_KEY.test(search.time) ? { time: search.time } : {}),
    // ?tab=conta&focus=whatsapp: abre a Conta com o cartão do WhatsApp em foco.
    ...(search.focus === "whatsapp" || search.focus === "grupo"
      ? { focus: search.focus as "whatsapp" | "grupo" }
      : {}),
    // Recusa explicada (painel ou plataforma): o app mostra o motivo.
    ...(parseAccessNotice(search.aviso) ? { aviso: parseAccessNotice(search.aviso) } : {}),
  }),
  beforeLoad: async ({ location, search }) => {
    const searchStr =
      typeof location.searchStr === "string" && location.searchStr ? location.searchStr : "";
    await requireSession(`/app${searchStr}`);
  },
  component: AppRoute,
});

function AppRoute() {
  const { barber, shop, join, tab, reserva, day, time, focus, aviso } = Route.useSearch();
  const { t } = useI18n();
  const [hostShop, setHostShop] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(Boolean(shop));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (shop) {
        setReady(true);
        return;
      }
      const resolved = await resolveShopFromCurrentHost();
      if (cancelled) return;
      if (maybeRedirectToCanonical(resolved)) return;
      if (resolved?.shop_slug) setHostShop(resolved.shop_slug);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [shop]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        {t("app.loading")}
      </div>
    );
  }

  const effectiveShop = shop || hostShop;

  return (
    <ArenaApp
      directBarberSlug={barber}
      directShopSlug={effectiveShop}
      promptJoin={Boolean(join)}
      initialTab={initialTabFor(tab, Boolean(day && time))}
      initialSlot={day && time ? { day, time } : undefined}
      focusWhatsapp={focus === "whatsapp"}
      focusGroup={focus === "grupo"}
      focusReservationToken={reserva}
      accessNotice={aviso}
    />
  );
}
