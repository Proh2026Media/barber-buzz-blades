import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolutionFetch, json } from "../_shared/evolution.ts";
import { runDistribution } from "../_shared/whatsapp-distribution.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error_code: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!key || req.headers.get("Authorization") !== `Bearer ${key}`)
    return json({ error_code: "unauthorized" }, 401);
  if (!url) return json({ error_code: "unavailable" }, 503);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const result = await runDistribution(
      { rpc: (name, args) => client.rpc(name, args).abortSignal(AbortSignal.timeout(5000)) },
      evolutionFetch,
    );
    return json(
      { ok: result.state === "checked", ...result },
      result.state === "checked" ? 200 : 503,
    );
  } catch {
    return json({ error_code: "unavailable" }, 503);
  }
});
