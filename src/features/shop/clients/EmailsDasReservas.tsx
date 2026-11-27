import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Mail, RefreshCw } from "lucide-react";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/lib/auth/use-auth-session";
import { useI18n } from "@/lib/i18n";

type Ficha = { ficha: string; conta?: never } | { ficha?: never; conta: string };

export function EmailsDasReservas({ shopId, ficha, conta }: { shopId: string } & Ficha) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const habilitada = !demo && shopId === "a5c2b03b-1e30-4446-b013-8cb8a9d8c447";
  const { session } = useAuthSession(!habilitada);
  const usuario = session?.user.id;
  const consulta = useQuery({
    queryKey: ["emails-das-reservas", usuario, shopId, ficha, conta],
    enabled: Boolean(habilitada && usuario),
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .rpc("emails_informados_agendamentos_externa", {
          p_loja: shopId,
          ...(ficha ? { p_ficha: ficha } : { p_conta: conta }),
        })
        .abortSignal(signal);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!habilitada || !usuario) return null;
  if (consulta.isError) return (
    <button type="button" className="action-button" onClick={() => void consulta.refetch()}>
      <RefreshCw className="size-4" aria-hidden />
      {t("team.profile.loadBookingEmails")}
    </button>
  );
  if (!consulta.data?.length) return null;
  const horario = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
  });
  return (
    <details className="group">
      <summary className="action-button w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <Mail className="size-4" aria-hidden />
        {t("team.profile.bookingEmails")}
        <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto">
        {consulta.data.map((item) => (
          <li key={item.reserva} className="grid gap-1 py-2 text-sm">
            <span className="break-all font-semibold">{item.email}</span>
            <time className="text-xs text-muted-foreground" dateTime={item.inicio}>
              {horario.format(new Date(item.inicio))}
            </time>
          </li>
        ))}
      </ul>
    </details>
  );
}
