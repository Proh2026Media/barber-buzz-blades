import { randomOtp } from "../_shared/whatsapp-otp.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Titular já autenticado. O código prova posse do telefone dentro do grupo exclusivo. */
export async function groupPhone(
  admin: SupabaseClient,
  userId: string,
  body: {
    action?: string;
    channel?: string;
    destination?: string;
    code?: string;
    request_id?: string;
  },
  deps: {
    hash: (value: string) => Promise<string>;
    send: (code: string, challengeId: string, codeHash: string) => Promise<string>;
  },
) {
  const fail = (error_code: string, status = 400) => ({ status, body: { ok: false, error_code } });
  if (!userId) return fail("unauthorized", 401);
  if ((body.channel ?? "whatsapp") !== "whatsapp") return fail("invalid_channel");
  const { data: phone, error: invalid } = await admin.rpc("normalize_br_whatsapp", {
    p_raw: body.destination ?? "",
  });
  if (invalid || typeof phone !== "string") return fail("invalid_whatsapp");
  const hash = (code: string) => deps.hash(`verify_phone:${userId}:${phone}:${code}`);
  if ((body.action ?? "request") === "request") {
    const code = randomOtp();
    let codeHash: string;
    try {
      codeHash = await hash(code);
    } catch {
      return fail("whatsapp_unavailable", 503);
    }
    const { data, error } = await admin.rpc("request_whatsapp_group_phone", {
      p_user: userId,
      p_destination: phone,
      p_code_hash: codeHash,
      p_request_id: body.request_id ?? null,
    });
    if (error || !data?.challenge_id)
      return fail(
        error?.message?.includes("WA_RATE_LIMIT") ? "rate_limited" : "whatsapp_unavailable",
        error?.message?.includes("WA_RATE_LIMIT") ? 429 : 503,
      );
    const state = await deps.send(code, data.challenge_id, codeHash);
    if (state === "blocked") return fail("whatsapp_unavailable", 503);
    return {
      status: 200,
      body: {
        ok: true,
        channel: "whatsapp",
        delivery_state: state,
        expires_in_seconds: 600,
        resend_after_seconds: 60,
      },
    };
  }
  if (body.action !== "verify") return fail("invalid_action");
  if (!/^\d{6}$/.test(body.code ?? "")) return fail("otp_invalid");
  const { data, error } = await admin.rpc("check_whatsapp_group_phone", {
    p_user: userId,
    p_destination: phone,
    p_code_hash: await hash(body.code!),
  });
  if (error) return fail(error.code === "23505" ? "phone_in_use" : "whatsapp_unavailable", 503);
  if (!data?.whatsapp_verified_at || data.whatsapp_e164 !== phone) return fail("otp_invalid");
  return {
    status: 200,
    body: {
      ok: true,
      purpose: "verify_phone",
      whatsapp_e164: phone,
      whatsapp_verified_at: data.whatsapp_verified_at,
      whatsapp_opt_in_at: data.whatsapp_opt_in_at,
    },
  };
}
