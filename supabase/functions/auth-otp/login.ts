import { randomOtp } from "../_shared/whatsapp-otp.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Login global: somente número pessoal confirmado; remetente exclusivo da plataforma. */
export async function whatsappLogin(
  admin: SupabaseClient,
  body: {
    channel?: string;
    action?: string;
    destination?: string;
    code?: string;
    request_id?: string;
  },
  deps: {
    hash: (context: string) => Promise<string>;
    send: (text: string, challengeId: string, codeHash: string) => Promise<void>;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const fail = (error_code: string, status = 400) => ({
    status,
    body: {
      error_code,
      error: "Não foi possível entrar por WhatsApp. Confira os dados ou use o e-mail.",
    },
  });
  if ((body.channel ?? "whatsapp") !== "whatsapp") return fail("invalid_channel");
  const action = body.action ?? "request";
  if (action !== "request" && action !== "verify") return fail("invalid_action");
  // O formulário envia E.164 após sugerir o país; não assumir Brasil no servidor.
  const phone = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return fail("invalid_whatsapp");
  const hash = (code: string) => deps.hash(`login:platform:${phone}:${code}`);
  if (action === "request") {
    const code = randomOtp();
    const codeHash = await hash(code);
    const { data, error } = await admin.rpc("request_whatsapp_group_login", {
      p_destination: phone,
      p_code_hash: codeHash,
      p_request_id: body.request_id ?? null,
    });
    if (error)
      return fail(
        error.message?.includes("WA_RATE_LIMIT") ? "rate_limited" : "whatsapp_unavailable",
        error.message?.includes("WA_RATE_LIMIT") ? 429 : 503,
      );
    if (!data?.challenge_id) return fail("whatsapp_unavailable", 503);
    if (data.user_id) {
      try {
        await deps.send(
          `Barba & Cabelo\nSeu código de acesso: ${code}\nVálido por 10 minutos. Não compartilhe este código. Se não pediu, ignore.`,
          data.challenge_id,
          codeHash,
        );
      } catch {
        // Mesma resposta para número conhecido/desconhecido, inclusive falha de envio.
        // Não repetir: o provedor pode ter aceitado antes do timeout.
        // Não invalida um código que pode ter sido entregue antes do timeout.
        console.error("auth-otp: envio de login indisponível");
      }
    }
    return { status: 200, body: { ok: true, expires_in_seconds: 600, resend_after_seconds: 60 } };
  }
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) return fail("otp_invalid");
  const { data, error } = await admin.rpc("check_whatsapp_group_login", {
    p_destination: phone,
    p_code_hash: await hash(body.code),
  });
  if (error) return fail("whatsapp_unavailable", 503);
  const match = Array.isArray(data) ? data[0] : data;
  if (!match?.challenge_id || !match.user_id) return fail("otp_invalid");
  // Um número alterado/desvinculado depois do pedido não pode abrir a conta antiga.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", match.user_id)
    .eq("whatsapp_e164", phone)
    .not("whatsapp_verified_at", "is", null)
    .maybeSingle();
  if (profileError || !profile) return fail("otp_invalid");
  const { data: account, error: userError } = await admin.auth.admin.getUserById(match.user_id);
  const user = account?.user;
  const bannedUntil = (user as { banned_until?: string } | undefined)?.banned_until;
  if (userError || !user?.email || (bannedUntil && Date.parse(bannedUntil) > Date.now()))
    return fail("otp_invalid");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkError || !link?.properties?.hashed_token || link.user?.id !== match.user_id)
    return fail("session_failed", 503);
  // Não expõe e-mail, action_link nem código em URL/armazenamento.
  return { status: 200, body: { ok: true, hashed_token: link.properties.hashed_token } };
}
