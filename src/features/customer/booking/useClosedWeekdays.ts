import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type HourRow = Pick<Tables<"business_hours">, "weekday" | "is_open">;

function closedFrom(rows: HourRow[] | null | undefined) {
  if (!rows?.length) return null;
  return new Set(rows.filter((row) => !row.is_open).map((row) => row.weekday));
}

/**
 * Dias da semana em que a barbearia não abre, para apagar esses dias na faixa de datas e dizer
 * "Fechado neste dia" em vez de "lotado". Usa o horário de funcionamento público da loja (o mesmo
 * da página pública); sem resposta, devolve `null` e a tela segue sem essa marcação.
 */
export function useClosedWeekdays(shopId: string | null, demoHours?: HourRow[] | null) {
  const [closed, setClosed] = useState<Set<number> | null>(null);
  const demoKey = demoHours
    ? demoHours.map((row) => `${row.weekday}:${row.is_open}`).join("|")
    : null;

  useEffect(() => {
    if (demoHours) {
      setClosed(closedFrom(demoHours));
      return;
    }
    if (!shopId) {
      setClosed(null);
      return;
    }
    let cancelled = false;
    void supabase.rpc("get_public_shop_landing", { p_shop_ref: shopId }).then(({ data, error }) => {
      if (cancelled || error) return;
      const hours = (data as { hours?: HourRow[] } | null)?.hours;
      setClosed(closedFrom(Array.isArray(hours) ? hours : null));
    });
    return () => {
      cancelled = true;
    };
    // demoKey resume as horas da demonstração (objeto novo a cada tique do relógio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, demoKey]);

  return closed;
}
