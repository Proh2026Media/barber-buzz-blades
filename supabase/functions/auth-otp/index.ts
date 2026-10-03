import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, digitsOnlyPhone, evolutionFetch, json } from "../_shared/evolution.ts";

type Body = {
  action?: "request" | "verify";
  shop?: string;
  channel?: "whatsapp" | "email";
  purpose?: "login" | "recovery";
  destination?: string;
  code?: string;
};

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Códigos de acesso saem sempre pela instância de WhatsApp da plataforma.
 * Nunca pela instância da loja nem pela whatsapp_outbox: o lojista leria o código
 * (outbox visível ao dono e mensagem enviada do aparelho dele) e poderia
 * tomar a conta de qualquer usuário pelo número de WhatsApp.
 */
function platformInstance() {
  return (Deno.env.get("PLATFORM_EVOLUTION_INSTANCE") ?? "").trim();
}

const MAX_VERIFY_ATTEMPTS = 5;

function randomOtp() {
  const n = crypto.getRandomValues(new Uint8Array(3));
  const num = ((n[0] << 16) | (n[1] << 8) | n[2]) % 1_000_000;
  return String(num).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing Supabase env" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const action = body.action ?? "request";
    const shopRef = body.shop?.trim();
    const channel = body.channel ?? "whatsapp";
    const purpose = body.purpose ?? "recovery";
    const destinationRaw = body.destination?.trim() ?? "";

    if (purpose !== "login" && purpose !== "recovery") {
      return json({ error: "Finalidade inválida" }, 400);
    }

    if (!shopRef) {
      return json(
        {
          error: "WhatsApp exige o link da barbearia. Use o e-mail ou abra o login da loja.",
        },
        400,
      );
    }

    const { data: shopBySlug } = await admin
      .from("barbershops")
      .select("id, name, slug, status")
      .eq("slug", shopRef)
      .maybeSingle();
    const { data: shopById } = shopBySlug
      ? { data: null }
      : await admin
          .from("barbershops")
          .select("id, name, slug, status")
          .eq("id", shopRef)
          .maybeSingle();
    const shop = shopBySlug ?? shopById;

    if (!shop || shop.status !== "active") {
      return json({ error: "Barbearia não encontrada" }, 404);
    }

    if (action === "request") {
      if (channel === "email") {
        // Mantém o fluxo nativo do GoTrue no cliente; aqui só confirma contexto.
        return json({
          ok: true,
          channel: "email",
          message: "Use o envio de e-mail do formulário de login.",
        });
      }

      const { data: normalized, error: normError } = await admin.rpc("normalize_br_whatsapp", {
        p_raw: destinationRaw,
      });
      if (normError || !normalized) {
        return json({ error: "Informe um WhatsApp válido com DDD" }, 400);
      }

      const { data: channelRow } = await admin
        .from("whatsapp_channels")
        .select("status, enabled")
        .eq("barbershop_id", shop.id)
        .maybeSingle();

      if (!channelRow?.enabled || channelRow.status !== "open") {
        return json(
          {
            error: "Esta barbearia ainda não tem WhatsApp conectado. Use o e-mail.",
          },
          409,
        );
      }

      const instance = platformInstance();
      if (!instance) {
        return json(
          {
            error: "O envio de código por WhatsApp está indisponível. Use o e-mail.",
          },
          503,
        );
      }

      // Limite por destino em todas as lojas: trocar de loja não libera mais códigos
      // (e, portanto, mais tentativas de verificação).
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("auth_otp_challenges")
        .select("id", { count: "exact", head: true })
        .eq("destination", normalized)
        .eq("channel", "whatsapp")
        .not("barbershop_id", "is", null)
        .gte("created_at", since);

      if ((count ?? 0) >= 3) {
        return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("whatsapp_e164", normalized)
        .maybeSingle();

      const userId = profile?.id ?? null;

      // Resposta genérica (mesmo status e mesmos campos) para login e recovery:
      // não revela se o WhatsApp tem conta.
      const genericOk = {
        ok: true,
        channel: "whatsapp",
        message: "Se houver conta com este WhatsApp, enviamos um código.",
        expires_in_seconds: 600,
      };

      const code = randomOtp();
      const codeHash = await sha256Hex(`${shop.id}:${normalized}:${code}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // O desafio é gravado mesmo sem conta (user_id nulo, código nunca enviado):
      // assim o limite de pedidos (429) vale igual para todo número e não vira
      // um jeito de descobrir quais WhatsApps têm conta.
      const { error: insertError } = await admin.from("auth_otp_challenges").insert({
        user_id: userId,
        barbershop_id: shop.id,
        channel: "whatsapp",
        destination: normalized,
        code_hash: codeHash,
        purpose,
        expires_at: expiresAt,
      });
      if (insertError) return json({ error: insertError.message }, 500);

      if (!userId) {
        return json(genericOk);
      }

      const bodyText =
        purpose === "login"
          ? `${shop.name}\nSeu código de acesso: ${code}\nVálido por 10 minutos.`
          : `${shop.name}\nCódigo para redefinir a senha: ${code}\nVálido por 10 minutos.`;

      // Envio direto pela instância da plataforma (sem passar pela outbox da loja).
      try {
        await evolutionFetch(`/message/sendText/${instance}`, {
          method: "POST",
          body: JSON.stringify({
            number: digitsOnlyPhone(normalized),
            text: bodyText,
          }),
        });
      } catch {
        return json(
          { error: "Não foi possível enviar o WhatsApp. Tente de novo ou use o e-mail." },
          502,
        );
      }

      return json(genericOk);
    }

    // verify
    const code = body.code?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) {
      return json({ error: "Código inválido" }, 400);
    }

    const { data: normalized } = await admin.rpc("normalize_br_whatsapp", {
      p_raw: destinationRaw,
    });
    if (!normalized) return json({ error: "WhatsApp inválido" }, 400);

    // Checagem atômica no banco: consome o desafio no acerto; no erro, soma a
    // tentativa e invalida os desafios abertos após MAX_VERIFY_ATTEMPTS erros.
    const codeHash = await sha256Hex(`${shop.id}:${normalized}:${code}`);
    const { data: checked, error: checkError } = await admin.rpc("auth_otp_check_code", {
      p_barbershop_id: shop.id,
      p_destination: normalized,
      p_channel: "whatsapp",
      p_purpose: purpose,
      p_code_hash: codeHash,
      p_max_attempts: MAX_VERIFY_ATTEMPTS,
    });
    if (checkError) {
      return json({ error: "Não foi possível validar o código. Tente de novo." }, 500);
    }
    const match = (Array.isArray(checked) ? checked[0] : checked) as
      | { challenge_id: string | null; user_id: string | null }
      | null
      | undefined;
    if (!match?.challenge_id) {
      return json({ error: "Código incorreto ou expirado" }, 400);
    }

    if (!match.user_id) {
      return json({ error: "Conta não encontrada para este WhatsApp" }, 404);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: purpose === "login" ? "magiclink" : "recovery",
      email: "",
      options: { redirectTo: Deno.env.get("GOTRUE_SITE_URL") ?? undefined },
    });

    // generateLink exige email — buscar e-mail do usuário.
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(
      match.user_id,
    );
    if (getUserError || !userData.user?.email) {
      // Fallback: sessão via update user + custom — usar magiclink com email.
      return json({ error: "Conta sem e-mail vinculado; complete o cadastro com e-mail." }, 409);
    }

    const { data: recovery, error: recoveryError } = await admin.auth.admin.generateLink({
      type: purpose === "login" ? "magiclink" : "recovery",
      email: userData.user.email,
    });
    void linkData;
    void linkError;

    if (recoveryError || !recovery) {
      return json({ error: recoveryError?.message ?? "Não foi possível abrir a sessão" }, 500);
    }

    return json({
      ok: true,
      email: userData.user.email,
      action_link: recovery.properties?.action_link ?? null,
      hashed_token: recovery.properties?.hashed_token ?? null,
      verification_type: recovery.properties?.verification_type ?? purpose,
      purpose,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "OTP failed" }, 500);
  }
});
