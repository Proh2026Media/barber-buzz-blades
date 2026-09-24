/** OTP e cadastro de barbearia via WhatsApp da plataforma (sem loja ainda). */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  corsHeaders,
  digitsOnlyPhone,
  evolutionFetch,
  json,
} from "../_shared/evolution.ts";

type Body = {
  action?: "request" | "verify" | "register";
  destination?: string;
  code?: string;
  verification_token?: string;
  shop_name?: string;
  full_name?: string;
  email?: string;
  password?: string;
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

function platformInstance() {
  const name = (Deno.env.get("PLATFORM_EVOLUTION_INSTANCE") ?? "").trim();
  if (!name) throw new Error("PLATFORM_EVOLUTION_INSTANCE não configurada");
  return name;
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
    const destinationRaw = body.destination?.trim() ?? "";

    if (action === "request") {
      const { data: normalized, error: normError } = await admin.rpc("normalize_br_whatsapp", {
        p_raw: destinationRaw,
      });
      if (normError || !normalized) {
        return json({ error: "Informe um WhatsApp válido com DDD" }, 400);
      }

      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("whatsapp_e164", normalized)
        .maybeSingle();
      if (existing?.id) {
        return json({
          error: "Este WhatsApp já está em uma conta. Entre ou use outro número.",
        }, 409);
      }

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("auth_otp_challenges")
        .select("id", { count: "exact", head: true })
        .eq("destination", normalized)
        .eq("purpose", "signup")
        .is("barbershop_id", null)
        .gte("created_at", since);

      if ((count ?? 0) >= 3) {
        return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
      }

      const code = randomOtp();
      const codeHash = await sha256Hex(`platform:${normalized}:${code}`);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await admin.from("auth_otp_challenges").insert({
        user_id: null,
        barbershop_id: null,
        channel: "whatsapp",
        destination: normalized,
        code_hash: codeHash,
        purpose: "signup",
        expires_at: expiresAt,
      });
      if (insertError) return json({ error: insertError.message }, 500);

      const text =
        `Barba & Cabelo\nSeu código para abrir a barbearia: ${code}\nVálido por 10 minutos.`;

      try {
        await evolutionFetch(`/message/sendText/${platformInstance()}`, {
          method: "POST",
          body: JSON.stringify({
            number: digitsOnlyPhone(normalized),
            text,
          }),
        });
      } catch (err) {
        return json({
          error:
            err instanceof Error
              ? `Não foi possível enviar o WhatsApp: ${err.message}`
              : "Falha ao enviar o WhatsApp",
        }, 502);
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
        return json({ error: "Código inválido" }, 400);
      }

      const { data: normalized } = await admin.rpc("normalize_br_whatsapp", {
        p_raw: destinationRaw,
      });
      if (!normalized) return json({ error: "WhatsApp inválido" }, 400);

      const { data: challenges } = await admin
        .from("auth_otp_challenges")
        .select("*")
        .is("barbershop_id", null)
        .eq("destination", normalized)
        .eq("channel", "whatsapp")
        .eq("purpose", "signup")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      const codeHash = await sha256Hex(`platform:${normalized}:${code}`);
      const match = (challenges ?? []).find((row) => row.code_hash === codeHash);
      if (!match) {
        return json({ error: "Código incorreto ou expirado" }, 400);
      }

      const verificationToken = randomToken();
      const { error: updateError } = await admin
        .from("auth_otp_challenges")
        .update({ verification_token: verificationToken })
        .eq("id", match.id);
      if (updateError) return json({ error: updateError.message }, 500);

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

      if (!token) return json({ error: "Confirme o WhatsApp antes de continuar." }, 400);
      if (!shopName) return json({ error: "Informe o nome da barbearia." }, 400);
      if (!fullName) return json({ error: "Informe o seu nome." }, 400);
      if (!email || !email.includes("@")) return json({ error: "Informe um e-mail válido." }, 400);
      if (password.length < 6) {
        return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
      }

      const { data: challenge } = await admin
        .from("auth_otp_challenges")
        .select("*")
        .eq("verification_token", token)
        .eq("purpose", "signup")
        .is("barbershop_id", null)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!challenge?.destination) {
        return json({ error: "Verificação expirada. Peça um novo código." }, 400);
      }

      const whatsapp = challenge.destination as string;

      const { data: waTaken } = await admin
        .from("profiles")
        .select("id")
        .eq("whatsapp_e164", whatsapp)
        .maybeSingle();
      if (waTaken?.id) {
        return json({ error: "Este WhatsApp já está em uma conta." }, 409);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !created.user) {
        const msg = createError?.message ?? "Não foi possível criar a conta";
        if (/already|exists|registered/i.test(msg)) {
          return json({ error: "Este e-mail já tem conta. Entre e use Abrir minha barbearia." }, 409);
        }
        return json({ error: msg }, 400);
      }

      const userId = created.user.id;

      await admin
        .from("profiles")
        .update({
          full_name: fullName,
          whatsapp_e164: whatsapp,
          whatsapp_opt_in_at: new Date().toISOString(),
        })
        .eq("id", userId);

      // Espelha create_own_barbershop com service role.
      const { data: shopRow, error: shopError } = await admin
        .from("barbershops")
        .insert({ name: shopName, status: "active" })
        .select("id, slug")
        .single();
      if (shopError || !shopRow) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: shopError?.message ?? "Falha ao criar a barbearia" }, 500);
      }

      await admin.from("barbershop_settings").upsert({
        barbershop_id: shopRow.id,
        display_name: shopName,
      });

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
        return json({ error: staffError?.message ?? "Falha ao criar o profissional" }, 500);
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

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Cadastro falhou" }, 500);
  }
});
