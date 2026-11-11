import { randomOtp, otpVerifier } from "../_shared/whatsapp-otp.ts";
import { whatsappLogin } from "./login.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, sendAuthorizedWhatsapp, json } from "../_shared/evolution.ts";

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
const CODE_TTL_MS = 10 * 60 * 1000;
/** Espera mínima sugerida ao app antes de reenviar. */
const RESEND_AFTER_SECONDS = 60;

type CheckedRow = { challenge_id: string | null; user_id: string | null };

/**
 * Depois de um código recusado por auth_otp_check_code, descobre o motivo para
 * devolver um error_code útil. Olha só o desafio mais recente do mesmo
 * destino/finalidade/loja (e conta, em verify_phone); não revela se há conta.
 */
async function classifyFailure(
  admin: SupabaseClient,
  opts: { barbershopId: string | null; destination: string; purpose: Purpose; userId?: string },
) {
  let query = admin
    .from("auth_otp_challenges")
    .select("attempts, consumed_at, expires_at")
    .eq("destination", opts.destination)
    .eq("channel", "whatsapp")
    .eq("purpose", opts.purpose);
  query = opts.barbershopId
    ? query.eq("barbershop_id", opts.barbershopId)
    : query.is("barbershop_id", null);
  if (opts.userId) query = query.eq("user_id", opts.userId);

  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  const latest = data as {
    attempts: number | null;
    consumed_at: string | null;
    expires_at: string;
  } | null;

  if (!latest) {
    return fail("otp_expired", "Código expirado. Peça um novo código.", 400);
  }
  if ((latest.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return fail(
      "otp_too_many_attempts",
      "Muitas tentativas com código errado. Peça um novo código.",
      429,
    );
  }
  if (latest.consumed_at || new Date(latest.expires_at).getTime() <= Date.now()) {
    return fail("otp_expired", "Código expirado. Peça um novo código.", 400);
  }
  return fail("otp_invalid", "Código incorreto ou expirado", 400, {
    attempts_left: Math.max(0, MAX_VERIFY_ATTEMPTS - (latest.attempts ?? 0)),
  });
}

/**
 * purpose = 'verify_phone': o usuário AUTENTICADO confirma o próprio WhatsApp.
 * request → envia código ao número informado; verify → confere e grava o
 * número verificado no perfil (apply_verified_whatsapp, só service_role).
 */
async function handleVerifyPhone(req: Request, admin: SupabaseClient, action: string, body: Body) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwt) return fail("unauthorized", "Entre na sua conta para confirmar o WhatsApp.", 401);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) {
    return fail("unauthorized", "Sessão expirada. Entre de novo.", 401);
  }

  const { data: normalizedData, error: normError } = await admin.rpc("normalize_br_whatsapp", {
    p_raw: body.destination?.trim() ?? "",
  });
  const normalized = typeof normalizedData === "string" ? normalizedData : null;
  if (normError || !normalized) {
    return fail("invalid_whatsapp", "Informe um WhatsApp válido com DDD", 400);
  }

  /**
   * Contas que já confirmaram este número. Sem a migration 20261003180000
   * (coluna whatsapp_verified_at ausente) a confirmação fica indisponível em
   * vez de quebrar o cadastro: o app mostra o aviso e deixa seguir.
   */
  const verifiedHolders = async () => {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("whatsapp_e164", normalized)
      .not("whatsapp_verified_at", "is", null);
    if (error) {
      if (error.code === "42703" || /whatsapp_verified_at/.test(error.message)) {
        return { unavailable: true as const };
      }
      return { error: true as const };
    }
    return { ids: ((data ?? []) as Array<{ id: string }>).map((row) => row.id) };
  };
  const unavailable = () =>
    fail("whatsapp_unavailable", "A confirmação do WhatsApp está indisponível no momento.", 503);

  if (action === "request") {
    const holders = await verifiedHolders();
    if ("unavailable" in holders) return unavailable();
    if ("error" in holders) {
      return fail("internal_error", "Não foi possível conferir o WhatsApp. Tente de novo.", 500);
    }
    // Número já confirmado nesta conta: nada a enviar (só revela o próprio estado).
    if (holders.ids.includes(user.id)) {
      return json({ ok: true, channel: "whatsapp", already_verified: true });
    }

    const instance = platformInstance();
    if (!instance) {
      return fail(
        "whatsapp_unavailable",
        "O envio de código por WhatsApp está indisponível no momento.",
        503,
      );
    }

    const takenElsewhere = holders.ids.some((id) => id !== user.id);
    const code = randomOtp();
    // O hash inclui a conta: um código só confirma o número para quem o pediu.
    const codeHash = await codeVerifier(`verify_phone:${user.id}:${normalized}:${code}`);
    const { data: inserted, error: insertError } = await admin
      .from("auth_otp_challenges")
      .insert({
        request_id: body.request_id,
        user_id: user.id,
        barbershop_id: null,
        channel: "whatsapp",
        destination: normalized,
        code_hash: codeHash,
        purpose: "verify_phone",
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        // Número de outra conta: o pedido conta no limite, mas nasce anulado
        // e nenhum código é enviado.
        ...(takenElsewhere ? { consumed_at: new Date().toISOString() } : {}),
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      // 22P02: finalidade 'verify_phone' ainda não existe (migration pendente).
      if (insertError?.message?.includes("WA_RATE_LIMIT"))
        return fail("rate_limited", "Aguarde antes de pedir outro código.", 429);
      if (insertError?.code === "22P02" || insertError?.message?.includes("WA_SENDING_PAUSED"))
        return unavailable();
      console.error("auth-otp: falha ao gravar o desafio (verify_phone)", insertError?.message);
      return fail("internal_error", "Não foi possível gerar o código. Tente de novo.", 500);
    }
    if (takenElsewhere) {
      return fail("phone_in_use", "Este WhatsApp já está em outra conta", 409);
    }

    try {
      const sent = await sendAuthorizedWhatsapp(admin, {
        challengeId: inserted.id,
        instance,
        codeHash,
        text: `Barba & Cabelo\nCódigo para confirmar seu WhatsApp: ${code}\nVálido por 10 minutos. Se não foi você que pediu, ignore esta mensagem.`,
      });
      if (sent.state === "blocked") return unavailable();
      // Resultado incerto ainda permite digitar o código que pode ter chegado.
      return json({
        ok: true,
        channel: "whatsapp",
        delivery_state: sent.state,
        expires_in_seconds: CODE_TTL_MS / 1000,
        resend_after_seconds: RESEND_AFTER_SECONDS,
      });
    } catch (err) {
      console.error("auth-otp: envio da confirmação indisponível");
      return fail(
        "whatsapp_unavailable",
        "Não foi possível enviar o WhatsApp. Confira o número e tente de novo.",
        502,
      );
    }
  }

  // verify
  const code = body.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    return fail("otp_invalid", "Código inválido", 400);
  }

  // Aqui não se olha antes se o número está em outra conta: isso responderia
  // sem código nem tentativa gasta. apply_verified_whatsapp recusa (23505) depois.
  const codeHash = await codeVerifier(`verify_phone:${user.id}:${normalized}:${code}`);
  // Checagem restrita aos desafios desta conta (auth_otp_check_user_code): erros
  // de outra conta no mesmo número não gastam as tentativas do dono.
  const { data: checked, error: checkError } = await admin.rpc("auth_otp_check_user_code", {
    p_user_id: user.id,
    p_destination: normalized,
    p_purpose: "verify_phone",
    p_code_hash: codeHash,
    p_max_attempts: MAX_VERIFY_ATTEMPTS,
  });
  if (checkError) {
    // Função auth_otp_check_user_code ausente (migration pendente).
    if (checkError.code === "PGRST202" || checkError.code === "42883") return unavailable();
    console.error("auth-otp: falha ao validar o código (verify_phone)", checkError.message);
    return fail("internal_error", "Não foi possível validar o código. Tente de novo.", 500);
  }
  const match = (Array.isArray(checked) ? checked[0] : checked) as CheckedRow | null | undefined;
  if (!match?.challenge_id || match.user_id !== user.id) {
    return classifyFailure(admin, {
      barbershopId: null,
      destination: normalized,
      purpose: "verify_phone",
      userId: user.id,
    });
  }

  const { data: saved, error: saveError } = await admin.rpc("apply_verified_whatsapp", {
    p_user_id: user.id,
    p_whatsapp: normalized,
    p_opt_in: body.opt_in === true,
  });
  if (saveError) {
    if (saveError.code === "23505") {
      return fail("phone_in_use", "Este WhatsApp já está em outra conta", 409);
    }
    console.error("auth-otp: falha ao gravar o WhatsApp verificado", saveError.message);
    return fail("internal_error", "Não foi possível salvar o WhatsApp. Tente de novo.", 500);
  }
  const profile = saved as {
    whatsapp_e164?: string | null;
    whatsapp_opt_in_at?: string | null;
    whatsapp_verified_at?: string | null;
  } | null;

  return json({
    ok: true,
    purpose: "verify_phone",
    whatsapp_e164: profile?.whatsapp_e164 ?? normalized,
    whatsapp_opt_in_at: profile?.whatsapp_opt_in_at ?? null,
    whatsapp_verified_at: profile?.whatsapp_verified_at ?? null,
  });
}

/**
 * Conta dona do número para login/recuperação: só número verificado.
 * Indisponibilidade da prova não permite recorrer a um número não confirmado.
 */
async function findAccountByWhatsapp(admin: SupabaseClient, normalized: string) {
  const verified = await admin
    .from("profiles")
    .select("id")
    .eq("whatsapp_e164", normalized)
    .not("whatsapp_verified_at", "is", null)
    .maybeSingle();
  if (!verified.error) return (verified.data as { id: string } | null)?.id ?? null;

  return null;
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
    const shopRef = body.shop?.trim();
    const channel = body.channel ?? "whatsapp";
    const purpose = body.purpose ?? "recovery";
    const destinationRaw = body.destination?.trim() ?? "";

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
        instance: platformInstance(),
        hash: codeVerifier,
        send: async (instance, _phone, text, challengeId, codeHash) => {
          await sendAuthorizedWhatsapp(admin, { instance, text, challengeId, codeHash });
        },
      });
      return json(result.body, result.status);
    }

    if (!shopRef) {
      return fail(
        "shop_required",
        "WhatsApp exige o link da barbearia. Use o e-mail ou abra o login da loja.",
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
      return fail("shop_not_found", "Barbearia não encontrada", 404);
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
        return fail("invalid_whatsapp", "Informe um WhatsApp válido com DDD", 400);
      }

      const linked = await admin.rpc("shop_whatsapp_channel", { p_shop: shop.id });
      let channelRow = linked.error ? null : linked.data;
      if (linked.error && ["PGRST202", "42883"].includes(linked.error.code)) {
        const legacy = await admin
          .from("whatsapp_channels")
          .select("status, enabled")
          .eq("barbershop_id", shop.id)
          .is("staff_id", null)
          .maybeSingle();
        channelRow = legacy.data;
      }

      if (!channelRow?.enabled || channelRow.status !== "open") {
        return fail(
          "shop_whatsapp_unavailable",
          "Esta barbearia ainda não tem WhatsApp conectado. Use o e-mail.",
          409,
        );
      }

      const instance = platformInstance();
      if (!instance) {
        return fail(
          "whatsapp_unavailable",
          "O envio de código por WhatsApp está indisponível. Use o e-mail.",
          503,
        );
      }

      const userId = await findAccountByWhatsapp(admin, normalized as string);

      // Resposta genérica (mesmo status e mesmos campos) para login e recovery:
      // não revela se o WhatsApp tem conta.
      const genericOk = {
        ok: true,
        channel: "whatsapp",
        message: "Se houver conta com este WhatsApp, enviamos um código.",
        expires_in_seconds: CODE_TTL_MS / 1000,
      };

      const code = randomOtp();
      const codeHash = await codeVerifier(`recovery:${shop.id}:${normalized}:${code}`);
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

      // O desafio é gravado mesmo sem conta (user_id nulo, código nunca enviado):
      // assim o limite de pedidos (429) vale igual para todo número e não vira
      // um jeito de descobrir quais WhatsApps têm conta.
      const { data: inserted, error: insertError } = await admin
        .from("auth_otp_challenges")
        .insert({
          request_id: body.request_id,
          user_id: userId,
          barbershop_id: shop.id,
          channel: "whatsapp",
          destination: normalized,
          code_hash: codeHash,
          purpose,
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        if (insertError?.message?.includes("WA_RATE_LIMIT"))
          return fail("rate_limited", "Aguarde antes de pedir outro código.", 429);
        if (insertError?.message?.includes("WA_SENDING_PAUSED"))
          return fail("whatsapp_unavailable", "WhatsApp indisponível. Use o e-mail.", 503);
        console.error("auth-otp: falha ao gravar o desafio");
        return fail("internal_error", "Não foi possível gerar o código. Tente de novo.", 500);
      }
      if (!userId) {
        return json(genericOk);
      }

      const bodyText = `${shop.name}\nCódigo para redefinir a senha: ${code}\nVálido por 10 minutos.`;

      // Envio direto pela instância da plataforma (sem passar pela outbox da loja).
      try {
        await sendAuthorizedWhatsapp(admin, {
          instance,
          challengeId: inserted.id,
          codeHash,
          text: bodyText,
        });
      } catch {
        // Mesma resposta de conta desconhecida. O código possivelmente entregue continua válido.
        console.error("auth-otp: envio de recuperação indisponível");
      }

      return json(genericOk);
    }

    // verify
    const code = body.code?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) {
      return fail("otp_invalid", "Código inválido", 400);
    }

    const { data: normalized } = await admin.rpc("normalize_br_whatsapp", {
      p_raw: destinationRaw,
    });
    if (!normalized) return fail("invalid_whatsapp", "WhatsApp inválido", 400);

    // Checagem atômica no banco: consome o desafio no acerto; no erro, soma a
    // tentativa e invalida os desafios abertos após MAX_VERIFY_ATTEMPTS erros.
    const codeHash = await codeVerifier(`recovery:${shop.id}:${normalized}:${code}`);
    const { data: checked, error: checkError } = await admin.rpc("auth_otp_check_code", {
      p_barbershop_id: shop.id,
      p_destination: normalized,
      p_channel: "whatsapp",
      p_purpose: purpose,
      p_code_hash: codeHash,
      p_max_attempts: MAX_VERIFY_ATTEMPTS,
    });
    if (checkError) {
      console.error("auth-otp: falha ao validar o código", checkError.message);
      return fail("internal_error", "Não foi possível validar o código. Tente de novo.", 500);
    }
    const match = (Array.isArray(checked) ? checked[0] : checked) as CheckedRow | null | undefined;
    if (!match?.challenge_id) {
      return classifyFailure(admin, {
        barbershopId: shop.id,
        destination: normalized as string,
        purpose,
      });
    }

    if (!match.user_id) {
      return fail("account_not_found", "Conta não encontrada para este WhatsApp", 404);
    }

    if ((await findAccountByWhatsapp(admin, normalized as string)) !== match.user_id)
      return fail("otp_invalid", "Código inválido ou expirado", 400);

    // generateLink exige o e-mail da conta.
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(
      match.user_id,
    );
    const bannedUntil = (userData.user as { banned_until?: string } | null)?.banned_until;
    if (
      getUserError ||
      !userData.user?.email ||
      (bannedUntil && Date.parse(bannedUntil) > Date.now())
    ) {
      return fail(
        "account_without_email",
        "Conta sem e-mail vinculado; complete o cadastro com e-mail.",
        409,
      );
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: userData.user.email,
    });

    if (linkError || !link) {
      // A mensagem do GoTrue fica só no log: não expõe detalhes internos ao app.
      console.error("auth-otp: falha ao gerar o link de sessão", linkError?.message);
      return fail("session_failed", "Não foi possível abrir a sessão. Tente de novo.", 500);
    }

    return json({
      ok: true,
      email: userData.user.email,
      action_link: link.properties?.action_link ?? null,
      hashed_token: link.properties?.hashed_token ?? null,
      verification_type: link.properties?.verification_type ?? purpose,
      purpose,
    });
  } catch (err) {
    console.error("auth-otp: erro inesperado");
    if (err instanceof Error && err.message === "WA_OTP_KEY_UNAVAILABLE")
      return fail("whatsapp_unavailable", "WhatsApp indisponível. Use outra forma de acesso.", 503);
    return fail("internal_error", "Não foi possível continuar. Tente de novo.", 500);
  }
});
