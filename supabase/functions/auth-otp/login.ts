import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Login global: somente número pessoal confirmado; remetente exclusivo da plataforma. */
export async function whatsappLogin(
  admin: SupabaseClient,
  body: { action?: string; destination?: string; code?: string },
  deps: {
    instance: string;
    send: (instance: string, phone: string, text: string) => Promise<void>;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const fail = (error_code: string, status = 400) => ({
    status,
    body: {
      error_code,
      error: "Não foi possível entrar por WhatsApp. Confira os dados ou use o e-mail.",
    },
  });
  const action = body.action ?? "request";
  if (action !== "request" && action !== "verify") return fail("invalid_action");
  // O formulário envia E.164 após sugerir o país; não assumir Brasil no servidor.
  const phone = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return fail("invalid_whatsapp");
  const hash = async (code: string) => {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`login:platform:${phone}:${code}`),
    );
    return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  if (action === "request") {
    if (!deps.instance) return fail("whatsapp_unavailable", 503);
    // Rejection sampling: todos os códigos de seis dígitos têm a mesma probabilidade.
    const value = new Uint32Array(1);
    do {
      crypto.getRandomValues(value);
    } while (value[0] >= 4_294_000_000);
    const code = String(value[0] % 1_000_000).padStart(6, "0");
    const { data, error } = await admin.rpc("request_whatsapp_login", {
      p_destination: phone,
      p_code_hash: await hash(code),
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
          deps.instance,
          phone,
          `Barba & Cabelo\nSeu código de acesso: ${code}\nVálido por 10 minutos. Não compartilhe este código. Se não pediu, ignore.`,
        );
      } catch {
        // Mesma resposta para número conhecido/desconhecido, inclusive falha de envio.
        // Não repetir: o provedor pode ter aceitado antes do timeout.
        await admin
          .from("auth_otp_challenges")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", data.challenge_id);
        console.error("auth-otp: envio de login indisponível; desafio invalidado");
      }
    }
    return { status: 200, body: { ok: true, expires_in_seconds: 600, resend_after_seconds: 60 } };
  }
  if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)) return fail("otp_invalid");
  const { data, error } = await admin.rpc("auth_otp_check_code", {
    p_barbershop_id: null,
    p_destination: phone,
    p_channel: "whatsapp",
    p_purpose: "login",
    p_code_hash: await hash(body.code),
    p_max_attempts: 5,
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
  if (
    userError ||
    !user?.email ||
    (user.banned_until && Date.parse(user.banned_until) > Date.now())
  )
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
