import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolutionFetch, corsHeaders, json } from "../_shared/evolution.ts";
import { connectionStates, healthSummary, type HealthNumber } from "../_shared/whatsapp-health.ts";
type Probe = { at: number; states: ReturnType<typeof connectionStates> };
let cached: Probe | null = null;
let inflight: Promise<Probe> | null = null;
async function probe() {
  if (cached && Date.now() - cached.at < 15000) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const raw = await evolutionFetch("/instance/fetchInstances", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!Array.isArray(raw)) throw new Error("HEALTH_UNKNOWN");
    cached = { at: Date.now(), states: connectionStates(raw) };
    return cached;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error_code: "method" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !key || !authorization?.startsWith("Bearer "))
      return json({ error_code: "unauthorized" }, 401);
    const client = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const user = await client.auth.getUser();
    if (user.error || !user.data.user) return json({ error_code: "unauthorized" }, 401);
    const admin = await client.rpc("is_platform_admin");
    if (admin.error || admin.data !== true) return json({ error_code: "forbidden" }, 403);
    const read = await client.rpc("platform_whatsapp_health_data");
    if (read.error) return json({ error_code: "unavailable" }, 503);
    let current: Awaited<ReturnType<typeof probe>> | null = null;
    try {
      current = await probe();
    } catch {
      /* Não transformar falha da API em número desconectado. */
    }
    const numbers = (read.data.numbers as HealthNumber[]).map((n) =>
      healthSummary(n, current?.states.get(n.instance_name) ?? "unknown"),
    );
    return new Response(
      JSON.stringify({
        ok: true,
        checked_at: current ? new Date(current.at).toISOString() : null,
        provider_available: Boolean(current),
        global_paused: read.data.global_paused,
        numbers,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return json({ error_code: "unavailable" }, 503);
  }
});
