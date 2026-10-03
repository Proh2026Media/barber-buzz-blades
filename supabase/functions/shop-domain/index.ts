import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { dnsQuery } from "../_shared/dns.ts";
import { domainManagerAdd, domainManagerRemove } from "../_shared/domain-manager.ts";
import { corsHeaders, json } from "../_shared/evolution.ts";

type Body = {
  action?: "set" | "clear" | "verify";
  barbershop_id?: string;
  domain?: string;
};

/**
 * Códigos de erro estáveis devolvidos em `error_code` junto da mensagem em pt-BR.
 * O app traduz pelo código; a mensagem fica como reserva para clientes antigos.
 */
type ErrorCode =
  | "method_not_allowed"
  | "server_misconfigured"
  | "unauthorized"
  | "missing_shop"
  | "invalid_action"
  | "permission_denied"
  | "domain_rejected"
  | "domain_nothing_pending"
  | "domain_txt_missing"
  | "domain_dns_pending"
  | "internal_error";

function fail(
  errorCode: ErrorCode,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return json({ ...extra, ok: false, error: message, error_code: errorCode }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("method_not_allowed", "Method not allowed", 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const platformHost = (Deno.env.get("PLATFORM_BASE_HOST") ?? "beauty.contheiner.digital")
      .toLowerCase()
      .replace(/\.$/, "");
    const cnameTargets = (
      Deno.env.get("DOMAIN_CNAME_TARGETS") ?? `dominios.${platformHost},${platformHost}`
    )
      .split(",")
      .map((v) => v.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean);
    if (!supabaseUrl || !serviceKey || !anonKey)
      return fail("server_misconfigured", "Missing Supabase env", 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return fail("unauthorized", "Missing authorization", 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return fail("unauthorized", "Invalid session", 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const action = body.action ?? "verify";
    const shopId = body.barbershop_id?.trim();
    if (!shopId) return fail("missing_shop", "barbershop_id required", 400);

    if (action === "set") {
      const domain = body.domain?.trim() ?? "";
      const { data, error } = await userClient.rpc("set_shop_custom_domain", {
        p_shop_id: shopId,
        p_domain: domain,
      });
      if (error) return fail("domain_rejected", error.message, 400);
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
          : (provision.error ?? "Domínio salvo, mas o proxy ainda não foi provisionado."),
        warning_code: provision.ok ? null : "domain_proxy_pending",
      });
    }

    if (action === "clear") {
      const before = await userClient.rpc("get_shop_domain_settings", { p_shop_id: shopId });
      if (before.error) return fail("permission_denied", before.error.message, 403);
      const prev = before.data as { custom_domain?: string | null };
      const domainToRemove = prev.custom_domain?.toLowerCase() ?? null;

      const { data, error } = await userClient.rpc("clear_shop_custom_domain", {
        p_shop_id: shopId,
      });
      if (error) return fail("domain_rejected", error.message, 400);

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
        warning:
          provision.ok || provision.skipped
            ? null
            : (provision.error ?? "Domínio removido do app, mas o proxy pode ainda ter a rota."),
        warning_code: provision.ok || provision.skipped ? null : "domain_proxy_cleanup_pending",
      });
    }

    if (action !== "verify") return fail("invalid_action", "Unknown action", 400);

    // --- verify (DNS + mark active + ensure /add) ---
    const settingsRes = await userClient.rpc("get_shop_domain_settings", { p_shop_id: shopId });
    if (settingsRes.error) return fail("permission_denied", settingsRes.error.message, 403);

    const cfg = settingsRes.data as {
      shop_slug?: string;
      custom_domain?: string | null;
      domain_verify_token?: string | null;
      custom_domain_status?: string | null;
    };
    const domain = cfg.custom_domain?.toLowerCase();
    const token = cfg.domain_verify_token;
    if (!domain || !token) {
      return fail("domain_nothing_pending", "Nenhum domínio pendente de verificação.", 400);
    }

    const txtHost = `_barba-verify.${domain}`;
    const expectedTxt = `barba-verify=${token}`.toLowerCase();

    // Parallel DoH lookups — never sequential hangs that trip isolate wall-clock.
    const [txts, cnames, as] = await Promise.all([
      dnsQuery(txtHost, "TXT"),
      dnsQuery(domain, "CNAME"),
      dnsQuery(domain, "A"),
    ]);
    const txtOk = txts.some((v) => v.includes(expectedTxt));
    const cnameOk = cnames.some(
      (v) =>
        cnameTargets.includes(v) ||
        cnameTargets.some((t) => v === t || v.endsWith(`.${t}`)) ||
        v === platformHost ||
        v.endsWith(`.${platformHost}`),
    );
    let aOk = false;
    if (!cnameOk && as.length > 0) {
      const platformAs = await dnsQuery(platformHost, "A");
      const targetHosts = cnameTargets.length ? cnameTargets : [platformHost];
      const targetAs = (await Promise.all(targetHosts.map((h) => dnsQuery(h, "A")))).flat();
      const allowed = new Set([...platformAs, ...targetAs]);
      aOk = as.some((ip) => allowed.has(ip));
    }

    // Domínio já ativo: uma falha na nova verificação (DoH lento, TXT removido
    // depois da primeira verificação) só registra o erro e mantém o site no ar.
    const wasActive = cfg.custom_domain_status === "active";
    const registerFailure = async (message: string) => {
      if (wasActive) {
        await admin
          .from("barbershops")
          .update({ domain_last_error: message, updated_at: new Date().toISOString() })
          .eq("id", shopId);
        return;
      }
      await admin.rpc("mark_shop_domain_status", {
        p_shop_id: shopId,
        p_status: "error",
        p_error: message,
      });
    };

    if (!txtOk) {
      await registerFailure(
        `TXT não encontrado em ${txtHost}. Esperado ${expectedTxt}. Visto: ${txts.join(" | ") || "(vazio)"}.`,
      );
      return fail("domain_txt_missing", `Registre o TXT em ${txtHost} = ${expectedTxt}`, 422, {
        txt_ok: false,
        cname_ok: cnameOk || aOk,
        txt_host: txtHost,
        expected_txt: expectedTxt,
        found_txt: txts,
        kept_active: wasActive,
      });
    }

    if (!cnameOk && !aOk) {
      const targetHint = cnameTargets[0] ?? platformHost;
      await registerFailure(
        `Aponte ${domain} (CNAME) para ${targetHint}. Visto: ${cnames.join(", ") || as.join(", ") || "(vazio)"}.`,
      );
      return fail(
        "domain_dns_pending",
        `CNAME ${domain} → ${targetHint} ainda não propagou.`,
        422,
        {
          txt_ok: true,
          cname_ok: false,
          domain,
          cname_target: targetHint,
          found_cname: cnames,
          found_a: as,
          kept_active: wasActive,
        },
      );
    }

    const marked = await admin.rpc("mark_shop_domain_status", {
      p_shop_id: shopId,
      p_status: "active",
      p_error: null,
    });
    if (marked.error) return fail("internal_error", marked.error.message, 500);

    const provision = await domainManagerAdd(domain, cfg.shop_slug ?? "");
    return json({
      ok: true,
      txt_ok: true,
      cname_ok: cnameOk || aOk,
      settings: marked.data,
      provision,
      warning: provision.ok
        ? null
        : (provision.error ?? "DNS ok, mas o proxy ainda não foi provisionado."),
      warning_code: provision.ok ? null : "domain_proxy_pending",
    });
  } catch (err) {
    return fail("internal_error", err instanceof Error ? err.message : "shop-domain failed", 500);
  }
});
