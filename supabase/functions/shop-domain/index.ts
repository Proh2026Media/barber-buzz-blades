import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { domainManagerAdd, domainManagerRemove } from "../_shared/domain-manager.ts";
import { corsHeaders, json } from "../_shared/evolution.ts";

type Body = {
  action?: "set" | "clear" | "verify";
  barbershop_id?: string;
  domain?: string;
};

type DnsAnswer = { data?: string; type?: number };

async function dnsQuery(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const response = await fetch(url, { headers: { Accept: "application/dns-json" } });
  if (!response.ok) return [];
  const payload = (await response.json()) as { Answer?: DnsAnswer[] };
  return (payload.Answer ?? [])
    .map((a) => (a.data ?? "").replace(/^"|"$/g, "").replace(/\.$/, "").toLowerCase())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const platformHost = (Deno.env.get("PLATFORM_BASE_HOST") ?? "beauty.contheiner.digital")
      .toLowerCase()
      .replace(/\.$/, "");
    if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Missing Supabase env" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const action = body.action ?? "verify";
    const shopId = body.barbershop_id?.trim();
    if (!shopId) return json({ error: "barbershop_id required" }, 400);

    if (action === "set") {
      const domain = body.domain?.trim() ?? "";
      const { data, error } = await userClient.rpc("set_shop_custom_domain", {
        p_shop_id: shopId,
        p_domain: domain,
      });
      if (error) return json({ error: error.message }, 400);
      const settings = data as {
        shop_slug?: string;
        custom_domain?: string | null;
      };
      const provision = await domainManagerAdd(
        settings.custom_domain ?? domain,
        settings.shop_slug ?? "",
      );
      return json({
        ok: true,
        settings: data,
        provision,
        warning: provision.ok
          ? null
          : provision.error ?? "Domínio salvo, mas o proxy ainda não foi provisionado.",
      });
    }

    if (action === "clear") {
      const before = await userClient.rpc("get_shop_domain_settings", { p_shop_id: shopId });
      if (before.error) return json({ error: before.error.message }, 403);
      const prev = before.data as { custom_domain?: string | null };
      const domainToRemove = prev.custom_domain?.toLowerCase() ?? null;

      const { data, error } = await userClient.rpc("clear_shop_custom_domain", {
        p_shop_id: shopId,
      });
      if (error) return json({ error: error.message }, 400);

      let provision: Awaited<ReturnType<typeof domainManagerRemove>> = {
        ok: true,
        skipped: true,
      };
      if (domainToRemove) {
        provision = await domainManagerRemove(domainToRemove);
      }
      return json({
        ok: true,
        settings: data,
        provision,
        warning: provision.ok || provision.skipped
          ? null
          : provision.error ?? "Domínio removido do app, mas o proxy pode ainda ter a rota.",
      });
    }

    if (action !== "verify") return json({ error: "Unknown action" }, 400);

    // --- verify (DNS + mark active + ensure /add) ---
    const settingsRes = await userClient.rpc("get_shop_domain_settings", { p_shop_id: shopId });
    if (settingsRes.error) return json({ error: settingsRes.error.message }, 403);

    const cfg = settingsRes.data as {
      shop_slug?: string;
      custom_domain?: string | null;
      domain_verify_token?: string | null;
    };
    const domain = cfg.custom_domain?.toLowerCase();
    const token = cfg.domain_verify_token;
    if (!domain || !token) {
      return json({ error: "Nenhum domínio pendente de verificação." }, 400);
    }

    const txtHost = `_barba-verify.${domain}`;
    const expectedTxt = `barba-verify=${token}`.toLowerCase();
    const txts = await dnsQuery(txtHost, "TXT");
    const txtOk = txts.some((v) => v.includes(expectedTxt));

    const cnames = await dnsQuery(domain, "CNAME");
    const as = await dnsQuery(domain, "A");
    const cnameOk = cnames.some((v) => v === platformHost || v.endsWith(`.${platformHost}`));
    const platformAs = await dnsQuery(platformHost, "A");
    const aOk = as.length > 0 && platformAs.some((ip) => as.includes(ip));

    if (!txtOk) {
      await admin.rpc("mark_shop_domain_status", {
        p_shop_id: shopId,
        p_status: "error",
        p_error: `TXT não encontrado em ${txtHost}. Espere a propagação DNS e tente de novo.`,
      });
      return json(
        {
          ok: false,
          txt_ok: false,
          cname_ok: cnameOk || aOk,
          error: `Registre o TXT em ${txtHost} = ${expectedTxt}`,
        },
        422,
      );
    }

    if (!cnameOk && !aOk) {
      await admin.rpc("mark_shop_domain_status", {
        p_shop_id: shopId,
        p_status: "error",
        p_error: `Aponte ${domain} (CNAME) para ${platformHost} ou o mesmo IP do app.`,
      });
      return json(
        {
          ok: false,
          txt_ok: true,
          cname_ok: false,
          error: `CNAME ${domain} → ${platformHost} ainda não propagou.`,
        },
        422,
      );
    }

    const marked = await admin.rpc("mark_shop_domain_status", {
      p_shop_id: shopId,
      p_status: "active",
      p_error: null,
    });
    if (marked.error) return json({ error: marked.error.message }, 500);

    const provision = await domainManagerAdd(domain, cfg.shop_slug ?? "");
    return json({
      ok: true,
      txt_ok: true,
      cname_ok: cnameOk || aOk,
      settings: marked.data,
      provision,
      warning: provision.ok
        ? null
        : provision.error ?? "DNS ok, mas o proxy ainda não foi provisionado.",
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "shop-domain failed" }, 500);
  }
});
