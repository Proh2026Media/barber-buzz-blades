import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, digitsOnlyPhone, evolutionFetch, json } from "../_shared/evolution.ts";

type Purpose = "login" | "recovery" | "verify_phone";

type Body = {
  action?: "request" | "verify";
  shop?: string;
  channel?: "whatsapp" | "email";
  purpose?: Purpose;
  destination?: string;
  code?: string;
  /** verify_phone: liga os avisos por WhatsApp ao gravar o número (padrão: true). */
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
const CODE_TTL_MS = 10 * 60 * 1000;
/** Envios por número em 15 minutos (todas as lojas / todas as contas). */
const MAX_SENDS_PER_DESTINATION = 3;
/** verify_phone: envios por conta em 1 hora (impede disparar códigos para muitos números). */
const MAX_VERIFY_PHONE_SENDS_PER_USER = 6;
/** Espera mínima sugerida ao app antes de reenviar. */
const RESEND_AFTER_SECONDS = 60;

function randomOtp() {
  const n = crypto.getRandomValues(new Uint8Array(3));
  const num = ((n[0] << 16) | (n[1] << 8) | n[2]) % 1_000_000;
  return String(num).padStart(6, "0");
}

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

async function sendWhatsapp(instance: string, normalized: string, text: string) {
  await evolutionFetch(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({ number: digitsOnlyPhone(normalized), text }),
  });
}

/**
 * Pedidos em paralelo passam juntos pela contagem feita antes de gravar. Depois
 * de gravar o desafio, a contagem é refeita: se o novo desafio passou do limite,
 * ele é anulado (consumed_at) e nenhum código é enviado. Assim o limite de envios
 * (e, com ele, o de códigos válidos ao mesmo tempo) não é contornado por corrida.
 */
async function voidIfOverLimit(
  admin: SupabaseClient,
  challengeId: string,
  counts: Array<{ count: Promise<number | null>; max: number }>,
) {
  const values = await Promise.all(counts.map((entry) => entry.count));
  const over = values.some((value, index) => (value ?? 0) > counts[index].max);
  if (over) {
    await admin
      .from("auth_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challengeId);
  }
  return over;
}

async function countChallenges(
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number | null> {
  const { count } = await query;
  return count;
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

    const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const countDestination = () =>
      countChallenges(
        admin
          .from("auth_otp_challenges")
          .select("id", { count: "exact", head: true })
          .eq("destination", normalized)
          .eq("channel", "whatsapp")
          .eq("purpose", "verify_phone")
          .gte("created_at", since15),
      );
    const countUser = () =>
      countChallenges(
        admin
          .from("auth_otp_challenges")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("purpose", "verify_phone")
          .gte("created_at", since60),
      );
    // O limite vem ANTES de dizer se o número está em outra conta: sem isso,
    // qualquer conta logada testaria números à vontade (enumeração).
    const [destCount, userCount] = await Promise.all([countDestination(), countUser()]);
    if (
      (destCount ?? 0) >= MAX_SENDS_PER_DESTINATION ||
      (userCount ?? 0) >= MAX_VERIFY_PHONE_SENDS_PER_USER
    ) {
      return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
    }

    const takenElsewhere = holders.ids.some((id) => id !== user.id);
    const code = randomOtp();
    // O hash inclui a conta: um código só confirma o número para quem o pediu.
    const codeHash = await sha256Hex(`verify_phone:${user.id}:${normalized}:${code}`);
    const { data: inserted, error: insertError } = await admin
      .from("auth_otp_challenges")
      .insert({
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
      if (insertError?.code === "22P02") return unavailable();
      console.error("auth-otp: falha ao gravar o desafio (verify_phone)", insertError?.message);
      return fail("internal_error", "Não foi possível gerar o código. Tente de novo.", 500);
    }
    if (takenElsewhere) {
      return fail("phone_in_use", "Este WhatsApp já está em outra conta", 409);
    }
    if (
      await voidIfOverLimit(admin, (inserted as { id: string }).id, [
        { count: countDestination(), max: MAX_SENDS_PER_DESTINATION },
        { count: countUser(), max: MAX_VERIFY_PHONE_SENDS_PER_USER },
      ])
    ) {
      return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
    }

    try {
      await sendWhatsapp(
        instance,
        normalized,
        `Barba & Cabelo\nCódigo para confirmar seu WhatsApp: ${code}\nVálido por 10 minutos. Se não foi você que pediu, ignore esta mensagem.`,
      );
    } catch (err) {
      console.error(
        "auth-otp: falha ao enviar o WhatsApp (verify_phone)",
        err instanceof Error ? err.message : err,
      );
      return fail(
        "whatsapp_unavailable",
        "Não foi possível enviar o WhatsApp. Confira o número e tente de novo.",
        502,
      );
    }

    return json({
      ok: true,
      channel: "whatsapp",
      expires_in_seconds: CODE_TTL_MS / 1000,
      resend_after_seconds: RESEND_AFTER_SECONDS,
    });
  }

  // verify
  const code = body.code?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    return fail("otp_invalid", "Código inválido", 400);
  }

  // Aqui não se olha antes se o número está em outra conta: isso responderia
  // sem código nem tentativa gasta. apply_verified_whatsapp recusa (23505) depois.
  const codeHash = await sha256Hex(`verify_phone:${user.id}:${normalized}:${code}`);
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
    p_opt_in: body.opt_in ?? true,
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
 * Se a migration 20261003180000 ainda não foi aplicada (coluna ausente),
 * cai para a busca antiga para não derrubar o login.
 */
async function findAccountByWhatsapp(admin: SupabaseClient, normalized: string) {
  const verified = await admin
    .from("profiles")
    .select("id")
    .eq("whatsapp_e164", normalized)
    .not("whatsapp_verified_at", "is", null)
    .maybeSingle();
  if (!verified.error) return (verified.data as { id: string } | null)?.id ?? null;
  if (verified.error.code === "42703" || /whatsapp_verified_at/.test(verified.error.message)) {
    const legacy = await admin
      .from("profiles")
      .select("id")
      .eq("whatsapp_e164", normalized)
      .maybeSingle();
    return (legacy.data as { id: string } | null)?.id ?? null;
  }
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

      const { data: channelRow } = await admin
        .from("whatsapp_channels")
        .select("status, enabled")
        .eq("barbershop_id", shop.id)
        .maybeSingle();

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

      // Limite por destino em todas as lojas: trocar de loja não libera mais códigos
      // (e, portanto, mais tentativas de verificação).
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const countDestination = () =>
        countChallenges(
          admin
            .from("auth_otp_challenges")
            .select("id", { count: "exact", head: true })
            .eq("destination", normalized)
            .eq("channel", "whatsapp")
            .not("barbershop_id", "is", null)
            .gte("created_at", since),
        );
      const count = await countDestination();

      if ((count ?? 0) >= MAX_SENDS_PER_DESTINATION) {
        return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
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
      const codeHash = await sha256Hex(`${shop.id}:${normalized}:${code}`);
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

      // O desafio é gravado mesmo sem conta (user_id nulo, código nunca enviado):
      // assim o limite de pedidos (429) vale igual para todo número e não vira
      // um jeito de descobrir quais WhatsApps têm conta.
      const { data: inserted, error: insertError } = await admin
        .from("auth_otp_challenges")
        .insert({
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
        console.error("auth-otp: falha ao gravar o desafio", insertError?.message);
        return fail("internal_error", "Não foi possível gerar o código. Tente de novo.", 500);
      }
      // Mesma resposta com ou sem conta: a recontagem também não revela nada.
      if (
        await voidIfOverLimit(admin, (inserted as { id: string }).id, [
          { count: countDestination(), max: MAX_SENDS_PER_DESTINATION },
        ])
      ) {
        return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
      }

      if (!userId) {
        return json(genericOk);
      }

      const bodyText =
        purpose === "login"
          ? `${shop.name}\nSeu código de acesso: ${code}\nVálido por 10 minutos.`
          : `${shop.name}\nCódigo para redefinir a senha: ${code}\nVálido por 10 minutos.`;

      // Envio direto pela instância da plataforma (sem passar pela outbox da loja).
      try {
        await sendWhatsapp(instance, normalized as string, bodyText);
      } catch (err) {
        console.error(
          "auth-otp: falha ao enviar o WhatsApp",
          err instanceof Error ? err.message : err,
        );
        return fail(
          "whatsapp_unavailable",
          "Não foi possível enviar o WhatsApp. Tente de novo ou use o e-mail.",
          502,
        );
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

    // generateLink exige o e-mail da conta.
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(
      match.user_id,
    );
    if (getUserError || !userData.user?.email) {
      return fail(
        "account_without_email",
        "Conta sem e-mail vinculado; complete o cadastro com e-mail.",
        409,
      );
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: purpose === "login" ? "magiclink" : "recovery",
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
    console.error("auth-otp: erro inesperado", err instanceof Error ? err.message : err);
    return fail("internal_error", "Não foi possível continuar. Tente de novo.", 500);
  }
});
