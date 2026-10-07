import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/** Estado do WhatsApp da barbearia guardado no banco (sem chamar o serviço externo). */
export type WhatsAppSignal = Pick<
  Tables<"whatsapp_channels">,
  "status" | "enabled" | "last_error"
> | null;

export type SettingsSignals = {
  /** `undefined` = ainda não sabemos (ou o papel não vê); `null` = nunca conectado. */
  whatsapp?: WhatsAppSignal;
  /** Prêmios trocados esperando entrega; `undefined` quando não se aplica. */
  pendingRedemptions?: number;
};

/**
 * Sinais leves para o menu de Ajustes: o estado salvo do WhatsApp e quantos prêmios esperam
 * entrega. Só leitura, com as mesmas permissões das telas de Avisos e do Clube; busca de novo
 * sempre que o menu volta a aparecer.
 */
export function useSettingsSignals({
  shopId,
  active,
  demo,
  channels,
  loyalty,
}: {
  shopId?: string | null;
  /** Só busca enquanto o menu de Ajustes está à vista. */
  active: boolean;
  demo: boolean;
  /** O papel pode ver o canal do WhatsApp (dono ou sócio). */
  channels: boolean;
  /** O clube está ligado e o papel pode geri-lo. */
  loyalty: boolean;
}): SettingsSignals {
  const [signals, setSignals] = useState<SettingsSignals>({});

  useEffect(() => {
    if (!active || demo || !shopId) return;
    let alive = true;
    if (channels) {
      void supabase
        .from("whatsapp_channels")
        .select("status, enabled, last_error")
        .eq("barbershop_id", shopId)
        // Só o canal da loja (staff_id nulo), como o despachante; cada parceiro tem o seu canal.
        // `staff_id` ainda não está nos tipos gerados, por isso o `filter` sem tipo.
        .filter("staff_id", "is", null)
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (alive && !error) setSignals((current) => ({ ...current, whatsapp: data ?? null }));
        });
    }
    if (loyalty) {
      void supabase
        .rpc("list_shop_loyalty_redemptions", { p_shop_id: shopId, p_status: "pending" })
        .then(({ data, error }) => {
          if (alive && !error && Array.isArray(data)) {
            setSignals((current) => ({ ...current, pendingRedemptions: data.length }));
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [active, demo, shopId, channels, loyalty]);

  // Na demonstração o cartão do WhatsApp aparece conectado; o clube não entra no tour.
  if (demo)
    return channels ? { whatsapp: { status: "open", enabled: true, last_error: null } } : {};
  return signals;
}
