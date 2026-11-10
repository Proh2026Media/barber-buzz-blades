import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export async function shopWhatsAppNumber(shopId: string) {
  const result = await supabase.rpc("shop_whatsapp_channel", { p_shop: shopId });
  if (result.error && ["PGRST202", "42883"].includes(result.error.code)) {
    return await supabase
      .from("whatsapp_channels")
      .select("*")
      .eq("barbershop_id", shopId)
      .is("staff_id", null)
      .maybeSingle();
  }
  return { data: result.data as Tables<"whatsapp_channels"> | null, error: result.error };
}
