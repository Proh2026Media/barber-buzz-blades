import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";

export type AssistedAccess = {
  contract: "bc-assisted-v1";
  enabled: boolean;
  active: boolean;
  expires_at: string | null;
  next_check_at: string | null;
};
/** Intenção explícita inicia a janela; acompanhamento não envia OTP nem troca telefone/números. */
export async function careAccessRequest(
  shop: string,
  start?: { phone: string; accounts: string[]; accept: boolean; group?: string; version?: number },
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw { code: "42501", httpStatus: 401 };
  const response = await guardedFetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-group-access`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: start ? "start" : "advance", shop, ...start }),
      signal: AbortSignal.timeout(45000),
    },
  );
  const result = await response.json();
  const {
    data: { session: current },
  } = await supabase.auth.getSession();
  if (current?.user.id !== session.user.id) throw { code: "42501", httpStatus: 401 };
  if (!response.ok) throw { code: result.code, httpStatus: response.status };
  if (!result.data || result.data.access?.contract !== "bc-assisted-v1")
    throw Error("ACCESS_UNAVAILABLE");
  return result.data;
}
