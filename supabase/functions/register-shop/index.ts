/** OTP e cadastro de barbearia via WhatsApp da plataforma (sem loja ainda). */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, digitsOnlyPhone, evolutionFetch, json } from "../_shared/evolution.ts";

type Body = {
  action?: "request" | "verify" | "register";
  destination?: string;
  code?: string;
  verification_token?: string;
  shop_name?: string;
  full_name?: string;
  email?: string;
  password?: string;
  /** single | majority | equal | minority — intenção de sociedade no cadastro */
  society_intent?: string;
  /** Aceite dos Termos, Política e Acordo de Dados (passo "register"). */
  terms_accepted?: boolean;
  terms_version?: string;
  privacy_version?: string;
  dpa_version?: string;
  /** Usar o WhatsApp confirmado do dono como contato público da barbearia. */
  shop_whatsapp_same?: boolean;
};

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomOtp() {
  const n = crypto.getRandomValues(new Uint8Array(3));
  const num = ((n[0] << 16) | (n[1] << 8) | n[2]) % 1_000_000;
  return String(num).padStart(6, "0");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Limite de erros por código, igual ao auth-otp; ao chegar nele o desafio é invalidado. */
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Códigos de erro estáveis devolvidos em `error_code` junto da mensagem em pt-BR.
 * O app traduz pelo código; a mensagem fica como reserva para clientes antigos.
 */
type ErrorCode =
  | "method_not_allowed"
  | "server_misconfigured"
  | "invalid_action"
  | "invalid_whatsapp"
  | "phone_in_use"
  | "rate_limited"
  | "whatsapp_unavailable"
  | "otp_invalid"
  | "otp_expired"
  | "otp_too_many_attempts"
  | "verification_expired"
  | "missing_fields"
  | "email_invalid"
  | "password_too_short"
  | "email_in_use"
  | "terms_required"
  | "internal_error";

function fail(
  errorCode: ErrorCode,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return json({ ...extra, error: message, error_code: errorCode }, status);
}

function platformInstance() {
  const name = (Deno.env.get("PLATFORM_EVOLUTION_INSTANCE") ?? "").trim();
  if (!name) throw new Error("PLATFORM_EVOLUTION_INSTANCE não configurada");
  return name;
}

/** Envios de código por número em 15 minutos. */
const MAX_SENDS_PER_DESTINATION = 3;

/**
 * O número já pertence a uma conta? Vale só número CONFIRMADO
 * (whatsapp_verified_at, migration 20261003180000): um número gravado sem código
 * por outra pessoa não impede o dono de abrir a barbearia. Sem a coluna
 * (migration ainda não aplicada), cai para a regra antiga: qualquer conta.
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function phoneTaken(admin: any, whatsapp: string): Promise<boolean> {
  const verified = await admin
    .from("profiles")
    .select("id")
    .eq("whatsapp_e164", whatsapp)
    .not("whatsapp_verified_at", "is", null)
    .limit(1);
  if (!verified.error) return (verified.data ?? []).length > 0;
  const legacy = await admin.from("profiles").select("id").eq("whatsapp_e164", whatsapp).limit(1);
  if (legacy.error) throw new Error(legacy.error.message);
  return (legacy.data ?? []).length > 0;
}

/**
 * Grava o WhatsApp confirmado no perfil novo. apply_verified_whatsapp marca o
 * número como verificado e tira cópias não confirmadas de outras contas. Sem a
 * função (migration 20261003180000 pendente), grava como antes.
 * Devolve "taken" se outra conta confirmou o número nesse meio-tempo.
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveOwnerWhatsapp(admin: any, userId: string, whatsapp: string) {
  const applied = await admin.rpc("apply_verified_whatsapp", {
    p_user_id: userId,
    p_whatsapp: whatsapp,
    p_opt_in: true,
  });
  if (!applied.error) return "ok" as const;
  if (applied.error.code === "23505") return "taken" as const;
  if (applied.error.code !== "PGRST202" && applied.error.code !== "42883") {
    console.error("register-shop: falha ao gravar o WhatsApp", applied.error.message);
    return "failed" as const;
  }
  const legacy = await admin
    .from("profiles")
    .update({ whatsapp_e164: whatsapp, whatsapp_opt_in_at: new Date().toISOString() })
    .eq("id", userId);
  if (legacy.error?.code === "23505") return "taken" as const;
  if (legacy.error) {
    console.error("register-shop: falha ao gravar o WhatsApp", legacy.error.message);
    return "failed" as const;
  }
  return "ok" as const;
}

/** Versão de documento legal: texto curto sem espaço (mesma regra de legal_version_clean). */
function cleanVersion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return /^[0-9A-Za-z._-]{1,32}$/.test(value) ? value : null;
}

/** Erro de coluna/tabela ausente: banco ainda sem a migration correspondente. */
function isMissingSchema(code: string | undefined) {
  return code === "42703" || code === "PGRST204" || code === "PGRST202" || code === "42883";
}

/**
 * Grava o aceite dos documentos no perfil do dono (colunas de
 * 20261003200000_cadastro_aceite.sql). Banco antigo sem as colunas: ignora.
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveOwnerAcceptance(admin: any, userId: string, body: Body) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({
      terms_version: cleanVersion(body.terms_version),
      privacy_version: cleanVersion(body.privacy_version),
      dpa_version: cleanVersion(body.dpa_version),
      terms_accepted_at: now,
      // A caixa do dono inclui "Tenho 18 anos ou mais".
      age_confirmed_at: now,
    })
    .eq("id", userId);
  if (error && !isMissingSchema(error.code)) {
    console.error("register-shop: falha ao gravar o aceite", error.message);
  }
}

/**
 * Coloca o WhatsApp do dono como contato público da página da loja
 * (barbershop_settings.landing.whatsapp), preservando o resto da configuração.
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveShopPublicWhatsapp(admin: any, shopId: string, whatsapp: string) {
  const { data, error: readError } = await admin
    .from("barbershop_settings")
    .select("landing")
    .eq("barbershop_id", shopId)
    .maybeSingle();
  if (readError) {
    if (!isMissingSchema(readError.code)) {
      console.error("register-shop: falha ao ler a página da loja", readError.message);
    }
    return;
  }
  const current =
    data?.landing && typeof data.landing === "object" && !Array.isArray(data.landing)
      ? (data.landing as Record<string, unknown>)
      : {};
  const { error } = await admin
    .from("barbershop_settings")
    .update({ landing: { ...current, whatsapp } })
    .eq("barbershop_id", shopId);
  if (error && !isMissingSchema(error.code)) {
    console.error("register-shop: falha ao gravar o WhatsApp da loja", error.message);
  }
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
    const destinationRaw = body.destination?.trim() ?? "";

    if (action === "request") {
      const { data: normalized, error: normError } = await admin.rpc("normalize_br_whatsapp", {
        p_raw: destinationRaw,
      });
      if (normError || !normalized) {
        return fail("invalid_whatsapp", "Informe um WhatsApp válido com DDD", 400);
      }

      // Não diz aqui se o número já tem conta: sem login, isso viraria um jeito de
      // descobrir quais WhatsApps estão cadastrados. Quem tem o aparelho recebe o
      // código e fica sabendo no passo "verify" (phone_in_use).
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const countDestination = async () => {
        const { count } = await admin
          .from("auth_otp_challenges")
          .select("id", { count: "exact", head: true })
          .eq("destination", normalized)
          .eq("purpose", "signup")
          .is("barbershop_id", null)
          .gte("created_at", since);
        return count ?? 0;
      };

      if ((await countDestination()) >= MAX_SENDS_PER_DESTINATION) {
        return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
      }

      const code = randomOtp();
      const codeHash = await sha256Hex(`platform:${normalized}:${code}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data: inserted, error: insertError } = await admin
        .from("auth_otp_challenges")
        .insert({
          user_id: null,
          barbershop_id: null,
          channel: "whatsapp",
          destination: normalized,
          code_hash: codeHash,
          purpose: "signup",
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        console.error("register-shop: falha ao gravar o desafio", insertError?.message);
        return fail("internal_error", "Não foi possível gerar o código. Tente de novo.", 500);
      }
      // Pedidos em paralelo passam juntos pela contagem acima: recontar depois de
      // gravar e anular o desafio que passou do limite (sem enviar código).
      if ((await countDestination()) > MAX_SENDS_PER_DESTINATION) {
        await admin
          .from("auth_otp_challenges")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", (inserted as { id: string }).id);
        return fail("rate_limited", "Muitas tentativas. Aguarde alguns minutos.", 429);
      }

      const text = `Barba & Cabelo\nSeu código para abrir a barbearia: ${code}\nVálido por 10 minutos.`;

      try {
        await evolutionFetch(`/message/sendText/${platformInstance()}`, {
          method: "POST",
          body: JSON.stringify({
            number: digitsOnlyPhone(normalized),
            text,
          }),
        });
      } catch (err) {
        console.error(
          "register-shop: falha ao enviar o WhatsApp",
          err instanceof Error ? err.message : err,
        );
        return fail(
          "whatsapp_unavailable",
          "Não foi possível enviar o WhatsApp agora. Tente de novo em alguns minutos.",
          502,
        );
      }

      return json({
        ok: true,
        message: "Enviamos um código para o WhatsApp informado.",
        expires_in_seconds: 600,
        destination: normalized,
      });
    }

    if (action === "verify") {
      const code = body.code?.trim() ?? "";
      if (!/^\d{6}$/.test(code)) {
        return fail("otp_invalid", "Código inválido", 400);
      }

      const { data: normalized } = await admin.rpc("normalize_br_whatsapp", {
        p_raw: destinationRaw,
      });
      if (!normalized) return fail("invalid_whatsapp", "WhatsApp inválido", 400);

      // Checagem atômica no banco (mesma do auth-otp): no acerto consome o desafio;
      // no erro soma a tentativa e invalida os desafios abertos após o limite.
      const codeHash = await sha256Hex(`platform:${normalized}:${code}`);
      const { data: checked, error: checkError } = await admin.rpc("auth_otp_check_code", {
        p_barbershop_id: null,
        p_destination: normalized,
        p_channel: "whatsapp",
        p_purpose: "signup",
        p_code_hash: codeHash,
        p_max_attempts: MAX_VERIFY_ATTEMPTS,
      });
      if (checkError) {
        console.error("register-shop: falha ao validar o código", checkError.message);
        return fail("internal_error", "Não foi possível validar o código. Tente de novo.", 500);
      }
      const match = (Array.isArray(checked) ? checked[0] : checked) as
        | { challenge_id: string | null }
        | null
        | undefined;

      if (!match?.challenge_id) {
        return await verifyFailure(admin, normalized as string);
      }

      // Só agora (quem digitou o código tem o aparelho) diz se o número já é de uma conta.
      if (await phoneTaken(admin, normalized as string)) {
        return fail(
          "phone_in_use",
          "Este WhatsApp já está em uma conta. Entre ou use outro número.",
          409,
        );
      }

      // O desafio já foi consumido pela checagem; o token de verificação é de uso
      // único (o cadastro o apaga) e é o que libera o passo "register".
      const verificationToken = randomToken();
      const { error: updateError } = await admin
        .from("auth_otp_challenges")
        .update({ verification_token: verificationToken })
        .eq("id", match.challenge_id);
      if (updateError) {
        console.error("register-shop: falha ao gravar o token", updateError.message);
        return fail("internal_error", "Não foi possível confirmar o código. Tente de novo.", 500);
      }

      return json({
        ok: true,
        verification_token: verificationToken,
        destination: normalized,
      });
    }

    if (action === "register") {
      const token = body.verification_token?.trim() ?? "";
      const shopName = body.shop_name?.trim() ?? "";
      const fullName = body.full_name?.trim() ?? "";
      const email = body.email?.trim().toLowerCase() ?? "";
      const password = body.password ?? "";

      if (!token) {
        return fail("verification_expired", "Confirme o WhatsApp antes de continuar.", 400);
      }
      if (!shopName) return fail("missing_fields", "Informe o nome da barbearia.", 400);
      if (!fullName) return fail("missing_fields", "Informe o seu nome.", 400);
      if (!email || !email.includes("@")) {
        return fail("email_invalid", "Informe um e-mail válido.", 400);
      }
      if (password.length < 6) {
        return fail("password_too_short", "A senha precisa ter pelo menos 6 caracteres.", 400);
      }
      // O aceite é obrigatório quando o app novo envia o campo. Corpo antigo, sem o
      // campo, continua aceito enquanto o app publicado ainda não mostra a caixa.
      // Com o campo, as três versões precisam vir em formato válido: não se grava
      // aceite sem saber de qual versão dos documentos.
      const termsInformed = Object.prototype.hasOwnProperty.call(body, "terms_accepted");
      if (
        termsInformed &&
        (body.terms_accepted !== true ||
          !cleanVersion(body.terms_version) ||
          !cleanVersion(body.privacy_version) ||
          !cleanVersion(body.dpa_version))
      ) {
        return fail(
          "terms_required",
          "Para continuar, aceite os Termos de Uso, a Política de Privacidade e o Acordo de Dados.",
          400,
        );
      }

      // Desde a checagem atômica o "verify" já consome o desafio: aqui vale o token
      // e o desafio ainda sem usuário. Não filtra por consumed_at para aceitar
      // tokens emitidos antes da mudança.
      // O token é RESERVADO numa única atualização (troca por uma marca temporária):
      // dois envios em paralelo com o mesmo token não criam duas contas/lojas com
      // o mesmo WhatsApp. Se o cadastro falhar, o token volta a valer (o app o
      // reaproveita depois que a pessoa corrige os dados).
      const claimMark = `claim:${randomToken()}`;
      const { data: challenge, error: claimError } = await admin
        .from("auth_otp_challenges")
        .update({ verification_token: claimMark })
        .eq("verification_token", token)
        .eq("purpose", "signup")
        .is("barbershop_id", null)
        .is("user_id", null)
        .gt("expires_at", new Date().toISOString())
        .select("id, destination")
        .maybeSingle();
      if (claimError) {
        console.error("register-shop: falha ao reservar o token", claimError.message);
      }

      if (!challenge?.destination) {
        return fail("verification_expired", "Verificação expirada. Peça um novo código.", 400);
      }

      const releaseToken = async () => {
        await admin
          .from("auth_otp_challenges")
          .update({ verification_token: token })
          .eq("id", challenge.id)
          .eq("verification_token", claimMark);
      };

      const whatsapp = challenge.destination as string;

      if (await phoneTaken(admin, whatsapp)) {
        await releaseToken();
        return fail("phone_in_use", "Este WhatsApp já está em uma conta.", 409);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) {
        await releaseToken();
        const msg = createError?.message ?? "Não foi possível criar a conta";
        if (/already|exists|registered/i.test(msg)) {
          return fail(
            "email_in_use",
            "Este e-mail já tem conta. Entre e use Abrir minha barbearia.",
            409,
          );
        }
        console.error("register-shop: falha ao criar a conta", msg);
        return fail("internal_error", msg, 400);
      }

      const userId = created.user.id;

      await admin.from("profiles").update({ full_name: fullName }).eq("id", userId);

      if (termsInformed) await saveOwnerAcceptance(admin, userId, body);

      // WhatsApp confirmado pelo código: entra como verificado. Se outra conta o
      // confirmou nesse meio-tempo, desfaz a conta nova.
      const savedWhatsapp = await saveOwnerWhatsapp(admin, userId, whatsapp);
      if (savedWhatsapp === "taken") {
        await admin.auth.admin.deleteUser(userId);
        return fail("phone_in_use", "Este WhatsApp já está em uma conta.", 409);
      }

      const societyIntentRaw = (body.society_intent ?? "single").trim();
      const societyIntent = ["single", "majority", "equal", "minority"].includes(societyIntentRaw)
        ? societyIntentRaw
        : "single";

      // Espelha create_own_barbershop com service role.
      const { data: shopRow, error: shopError } = await admin
        .from("barbershops")
        .insert({
          name: shopName,
          status: "active",
          society_intent: societyIntent,
          founded_by_user_id: userId,
        })
        .select("id, slug")
        .single();
      if (shopError || !shopRow) {
        await admin.auth.admin.deleteUser(userId);
        await releaseToken();
        console.error("register-shop: falha ao criar a barbearia", shopError?.message);
        return fail("internal_error", "Falha ao criar a barbearia", 500);
      }

      await admin.from("barbershop_settings").upsert({
        barbershop_id: shopRow.id,
        display_name: shopName,
      });

      // Mesmo WhatsApp para os clientes: o número já foi confirmado por código.
      if (body.shop_whatsapp_same === true && savedWhatsapp === "ok") {
        await saveShopPublicWhatsapp(admin, shopRow.id, whatsapp);
      }

      const { data: staffRow, error: staffError } = await admin
        .from("staff")
        .insert({
          barbershop_id: shopRow.id,
          user_id: userId,
          display_name: fullName,
          active: true,
        })
        .select("id")
        .single();
      if (staffError || !staffRow) {
        await admin.from("barbershops").delete().eq("id", shopRow.id);
        await admin.auth.admin.deleteUser(userId);
        await releaseToken();
        console.error("register-shop: falha ao criar o profissional", staffError?.message);
        return fail("internal_error", "Falha ao criar o profissional", 500);
      }

      await admin.from("shop_members").insert({
        barbershop_id: shopRow.id,
        user_id: userId,
        staff_id: staffRow.id,
        role: "owner",
        ownership_percent: 100,
        active: true,
      });

      await admin.from("memberships").insert({
        user_id: userId,
        barbershop_id: shopRow.id,
        role: "shop_admin",
      });

      await admin
        .from("auth_otp_challenges")
        .update({
          consumed_at: new Date().toISOString(),
          user_id: userId,
          verification_token: null,
        })
        .eq("id", challenge.id);

      return json({
        ok: true,
        email,
        shop_id: shopRow.id,
        shop_slug: shopRow.slug,
        message: "Barbearia criada. Entre com o e-mail e a senha.",
      });
    }

    return fail("invalid_action", "Ação inválida", 400);
  } catch (err) {
    console.error("register-shop: erro inesperado", err instanceof Error ? err.message : err);
    return fail("internal_error", "Cadastro falhou. Tente de novo.", 500);
  }
});

/**
 * Código não conferiu: descobre o motivo para o app explicar com clareza —
 * ainda há desafio aberto (código errado), o último foi invalidado por erros
 * demais, ou o código venceu.
 */
async function verifyFailure(
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  destination: string,
) {
  const nowIso = new Date().toISOString();
  const { data: open } = await admin
    .from("auth_otp_challenges")
    .select("attempts")
    .is("barbershop_id", null)
    .eq("destination", destination)
    .eq("channel", "whatsapp")
    .eq("purpose", "signup")
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);

  const openRow = (open ?? [])[0] as { attempts?: number } | undefined;
  if (openRow) {
    const attemptsLeft = Math.max(0, MAX_VERIFY_ATTEMPTS - Number(openRow.attempts ?? 0));
    return fail("otp_invalid", "Código incorreto ou expirado", 400, {
      attempts_left: attemptsLeft,
    });
  }

  const { data: latest } = await admin
    .from("auth_otp_challenges")
    .select("attempts, expires_at")
    .is("barbershop_id", null)
    .eq("destination", destination)
    .eq("channel", "whatsapp")
    .eq("purpose", "signup")
    .order("created_at", { ascending: false })
    .limit(1);
  const last = (latest ?? [])[0] as { attempts?: number; expires_at?: string } | undefined;

  if (last && Number(last.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return fail(
      "otp_too_many_attempts",
      "Muitas tentativas com código errado. Peça um código novo.",
      429,
      { attempts_left: 0 },
    );
  }
  if (last?.expires_at && Date.parse(last.expires_at) <= Date.parse(nowIso)) {
    return fail("otp_expired", "Código expirado. Peça um código novo.", 400);
  }
  return fail("otp_invalid", "Código incorreto ou expirado", 400);
}
