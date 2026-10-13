import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Link de convite da equipe (P-15). Sem login: quem tem o link vê a loja e o papel ("info") e
 * entra ("accept"). Entrar só funciona enquanto a conta ainda usa a senha temporária: aí o
 * servidor gera um acesso de uso único e o app pede a senha nova (PasswordChangeGate). Depois
 * disso o link só leva ao login normal, com a senha da própria pessoa.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { action?: "info" | "accept"; token?: string };

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
      return json({ error: "Missing Supabase env on edge runtime" }, 500);
    }
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json().catch(() => ({}))) as Body;
    const token = body.token?.trim() ?? "";
    const action = body.action === "accept" ? "accept" : "info";
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
      return json({ status: "invalid" });
    }

    const { data: link, error: linkError } = await admin
      .from("shop_invite_links")
      .select("id, barbershop_id, user_id, role, expires_at, use_count")
      .eq("token_hash", await sha256Hex(token))
      .maybeSingle();
    if (linkError) return json({ error: linkError.message }, 500);
    if (!link) return json({ status: "invalid" });

    const { data: shop } = await admin
      .from("barbershops")
      .select("name, slug")
      .eq("id", link.barbershop_id)
      .maybeSingle();
    const { data: settings } = await admin
      .from("barbershop_settings")
      .select("display_name, logo_url")
      .eq("barbershop_id", link.barbershop_id)
      .maybeSingle();
    const shopInfo = {
      name: settings?.display_name || shop?.name || "",
      slug: shop?.slug ?? "",
      logo_url: settings?.logo_url ?? null,
    };

    const { data: found, error: userError } = await admin.auth.admin.getUserById(link.user_id);
    if (userError || !found?.user?.email) return json({ status: "invalid" });
    const email = found.user.email;
    const base = { shop: shopInfo, role: link.role, email_hint: maskEmail(email) };

    if (new Date(link.expires_at).getTime() < Date.now()) {
      return json({ status: "expired", ...base });
    }
    if (found.user.user_metadata?.must_change_password !== true) {
      return json({ status: "has_password", ...base });
    }
    if (action === "info") {
      return json({ status: "ready", ...base });
    }

    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = generated?.properties?.hashed_token;
    if (generateError || !tokenHash) {
      console.error("shop-invite: acesso não gerado", generateError?.message);
      return json({ error: "Não foi possível abrir o convite agora. Tente de novo." }, 500);
    }
    await admin
      .from("shop_invite_links")
      .update({ last_used_at: new Date().toISOString(), use_count: (link.use_count ?? 0) + 1 })
      .eq("id", link.id);

    return json({ status: "ready", ...base, email, token_hash: tokenHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"•".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
