import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  evolutionFetch,
  evolutionGroupTransport,
  groupCycleEnabled,
} from "../_shared/evolution.ts";
import { processCareCycle } from "../_shared/care-cycles.ts";
import { loadCareGroupLogo } from "../_shared/care-group-logo.ts";
import { handleCareAccess } from "./handler.ts";

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL"),
    publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!url || !publicKey || !serviceKey) return new Response(null, { status: 503 });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleCareAccess(req, {
    enabled: groupCycleEnabled(),
    service,
    authenticate: async (request) => {
      const authorization = request.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return null;
      const db = createClient(url, publicKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const user = await db.auth.getUser();
      return user.error || !user.data.user ? null : { id: user.data.user.id, db };
    },
    observe: evolutionFetch,
    process: (id) =>
      processCareCycle(
        service,
        evolutionGroupTransport,
        id,
        (shop, chosen) => loadCareGroupLogo(shop, chosen, url),
        true,
      ),
  });
});
