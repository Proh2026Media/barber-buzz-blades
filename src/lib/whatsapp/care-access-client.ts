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
type Start = {
  phone: string;
  accounts: string[];
  accept: boolean;
  group?: string;
  version?: number;
};
export async function careAccessRequest(shop: string, start?: Start) {
  return call({ action: start ? "start" : "advance", shop, ...start });
}
export async function reviseCarePhone(shop: string, start: Start) {
  return call({ action: "revise", shop, ...start });
}
export async function abortCarePhoneRevision(shop: string, revision: string) {
  return call({ action: "abort", shop, revision });
}
export async function groupWelcome(
  shop: string,
  request?: string,
): Promise<{ welcome?: string | null; state?: string }> {
  return call(
    request ? { shop, action: "resend_welcome", request_id: request } : { shop, action: "welcome" },
  );
}
async function call(body: Record<string, unknown>) {
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
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    },
  );
  const result = await response.json();
  const {
    data: { session: current },
  } = await supabase.auth.getSession();
  if (current?.user.id !== session.user.id) throw { code: "42501", httpStatus: 401 };
  if (!response.ok) throw { code: result.code, httpStatus: response.status };
  if (body.action === "welcome" || body.action === "resend_welcome") return result;
  if (!result.data || result.data.access?.contract !== "bc-assisted-v1")
    throw Error("ACCESS_UNAVAILABLE");
  return result.data;
}

export type PhoneRevisionInfo = {
  contract: "bc-phone-revision-v1";
  enabled: boolean;
  id: string | null;
  phase: "requested" | "waiting" | "binding" | "bound" | "committed" | "aborted" | null;
  active: boolean;
  pending: boolean;
  expired: boolean;
  old_phone: string | null;
  declared_phone: string | null;
  next_check_at: string | null;
  deadline: string | null;
};
