import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";
import {
  allowedPushOrigin,
  validSubscription,
  validPushEndpoint,
  deliverWebPush,
  pushMessage,
} from "../_shared/web-push.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error_code: "method" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 8000) return reply({ error_code: "invalid" }, 400);
    const body = JSON.parse(raw),
      action = body?.action;
    const service =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    if (!service || !url) return reply({ error_code: "unavailable" }, 503);
    const db = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = req.headers.get("Authorization") ?? "";
    const rpc = async (name: string, args: Record<string, unknown> = {}) => {
      const r = await db.rpc(name, args);
      if (r.error) throw new Error("PUSH_DATABASE");
      return r.data;
    };
    const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY"),
      privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY"),
      subject = Deno.env.get("WEB_PUSH_SUBJECT");
    const setting = await db
      .from("web_push_settings")
      .select("enabled")
      .eq("singleton", true)
      .single();
    const enabled =
      !setting.error &&
      setting.data?.enabled === true &&
      Deno.env.get("WEB_PUSH_ENABLED") === "true" &&
      Boolean(publicKey && privateKey && subject);
    if (action === "dispatch") {
      if (auth !== `Bearer ${service}`) return reply({ error_code: "unauthorized" }, 401);
      if (!enabled) return reply({ ok: true, enabled: false, processed: 0 });
      const jobs = await rpc("web_push_claim");
      let processed = 0;
      for (const job of jobs ?? []) {
        const context = await rpc("web_push_authorize", { p_id: job.id, p_lease: job.lease });
        if (!context) continue;
        const outcome = await deliverWebPush(context, () =>
          webpush.generateRequestDetails(
            context,
            JSON.stringify(
              pushMessage(
                context.locale,
                context.kind,
                context.target,
                context.id,
                context.shop_name,
              ),
            ),
            {
              TTL: 300,
              contentEncoding: "aes128gcm",
              urgency: "normal",
              vapidDetails: { subject, publicKey, privateKey },
            },
          ),
        );
        await rpc("web_push_finish", { p_id: job.id, p_lease: job.lease, p_result: outcome });
        processed++;
      }
      return reply({ ok: true, enabled: true, processed });
    }
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const { data: user, error } = await db.auth.getUser(token);
    if (error || !user.user) return reply({ error_code: "unauthorized" }, 401);
    const origin = req.headers.get("Origin") ?? "";
    const allowed = (Deno.env.get("WEB_PUSH_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!allowedPushOrigin(origin, allowed)) return reply({ error_code: "origin" }, 403);
    // session_id só é lido depois da validação criptográfica do JWT pelo Auth.
    const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const session = claims.session_id;
    if (typeof session !== "string" || !/^[0-9a-f-]{36}$/i.test(session))
      return reply({ error_code: "unauthorized" }, 401);
    const owner = { p_user: user.user.id, p_session: session };
    if (action === "config") {
      const active =
        enabled && validPushEndpoint(body.endpoint)
          ? await rpc("web_push_status", { ...owner, p_endpoint: body.endpoint })
          : false;
      return reply({
        ok: true,
        available: enabled,
        public_key: enabled ? publicKey : null,
        active,
      });
    }
    if (action === "revoke") {
      if (!validPushEndpoint(body.endpoint)) return reply({ error_code: "invalid" }, 400);
      await rpc("web_push_revoke", { p_user: user.user.id, p_endpoint: body.endpoint });
      return reply({ ok: true });
    }
    if (!enabled) return reply({ error_code: "unavailable" }, 503);
    if (action === "register") {
      if (!validSubscription(body.subscription)) return reply({ error_code: "invalid" }, 400);
      const s = body.subscription,
        locale = ["pt-BR", "pt-PT", "en-US", "en-GB", "es"].includes(body.locale)
          ? body.locale
          : "pt-BR";
      await rpc("web_push_register", {
        ...owner,
        p_endpoint: s.endpoint,
        p_key: s.keys.p256dh,
        p_auth: s.keys.auth,
        p_origin: origin,
        p_locale: locale,
      });
      return reply({ ok: true });
    }
    if (action === "test" && validPushEndpoint(body.endpoint)) {
      await rpc("web_push_test", { ...owner, p_endpoint: body.endpoint });
      return reply({ ok: true, queued: true });
    }
    return reply({ error_code: "invalid" }, 400);
  } catch {
    return reply({ error_code: "unavailable" }, 503);
  }
});
