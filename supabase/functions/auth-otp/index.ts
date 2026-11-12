import { groupPhone } from "./group-phone.ts";
import { otpVerifier } from "../_shared/whatsapp-otp.ts";
import { whatsappLogin } from "./login.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, sendAuthorizedGroupLogin, json } from "../_shared/evolution.ts";

type Purpose = "login" | "recovery" | "verify_phone";

type Body = {
  request_id?: string;
  action?: "request" | "verify";
  shop?: string;
  channel?: "whatsapp" | "email";
  purpose?: Purpose;
  destination?: string;
  code?: string;
  /** verify_phone: liga os avisos somente com escolha explícita. */
  opt_in?: boolean;
};

/**
 * Códigos de erro estáveis devolvidos em `error_code` junto da mensagem em pt-BR.
 * O app traduz pelo código; a mensagem fica como reserva para clientes antigos.
 */
type ErrorCode =
  | "method_not_allowed"
  | "server_misconfigured"
  | "invalid_action"
  | "invalid_purpose"
  | "unauthorized"
  | "shop_required"
  | "shop_not_found"
  | "shop_whatsapp_unavailable"
  | "invalid_whatsapp"
  | "phone_in_use"
  | "rate_limited"
  | "whatsapp_unavailable"
  | "otp_invalid"
  | "otp_expired"
  | "otp_too_many_attempts"
  | "account_not_found"
  | "account_without_email"
  | "session_failed"
  | "internal_error";

function fail(
  errorCode: ErrorCode,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return json({ ...extra, error: message, error_code: errorCode }, status);
}

async function codeVerifier(value: string) {
  return otpVerifier(value, Deno.env.get("WHATSAPP_OTP_HMAC_KEY") ?? "");
}

async function handleVerifyPhone(req: Request, admin: SupabaseClient, action: string, body: Body) {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return fail("unauthorized", "Entre na sua conta.", 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return fail("unauthorized", "Entre na sua conta.", 401);
  const result = await groupPhone(
    admin,
    data.user.id,
    { ...body, action },
    {
      hash: codeVerifier,
      send: (code, challengeId, codeHash) =>
        sendAuthorizedGroupLogin(admin, { code, challengeId, codeHash }),
    },
  );
  return json(result.body, result.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail("method_not_allowed", "Method not allowed", 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return fail("server_misconfigured", "Missing Supabase env", 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const action = body.action ?? "request";
    const channel = body.channel ?? "whatsapp";
    const purpose = body.purpose ?? "recovery";

    if (action !== "request" && action !== "verify") {
      return fail("invalid_action", "Ação inválida", 400);
    }

    if (purpose === "verify_phone") {
      return await handleVerifyPhone(req, admin, action, body);
    }

    if (purpose !== "login" && purpose !== "recovery") {
      return fail("invalid_purpose", "Finalidade inválida", 400);
    }

    if (purpose === "login") {
      const result = await whatsappLogin(admin, body, {
        hash: codeVerifier,
        send: async (code, challengeId, codeHash) => {
          await sendAuthorizedGroupLogin(admin, { code, challengeId, codeHash });
        },
      });
      return json(result.body, result.status);
    }

    // Recuperação continua pelo GoTrue/e-mail. Nenhum código privado ou link de recuperação no grupo.
    if (channel === "email" && action === "request")
      return json({
        ok: true,
        channel: "email",
        message: "Use o envio de e-mail do formulário de login.",
      });
    return fail("whatsapp_unavailable", "Use o e-mail para recuperar a conta.", 503);
  } catch (err) {
    console.error("auth-otp: erro inesperado");
    if (err instanceof Error && err.message === "WA_OTP_KEY_UNAVAILABLE")
      return fail("whatsapp_unavailable", "WhatsApp indisponível. Use outra forma de acesso.", 503);
    return fail("internal_error", "Não foi possível continuar. Tente de novo.", 500);
  }
});
