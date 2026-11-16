import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  evolutionFetch,
  evolutionGroupTransport,
  groupCycleEnabled,
} from "../_shared/evolution.ts";
import { processCareCycle } from "../_shared/care-cycles.ts";
import { loadCareGroupLogo } from "../_shared/care-group-logo.ts";
import { handleEntryBackground, entryWorkerAuthorized } from "./handler.ts";

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!url || !key) return new Response(null, { status: 503 });
  const authorized =
    groupCycleEnabled() && (await entryWorkerAuthorized(req.headers.get("authorization"), key));
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return handleEntryBackground(req, authorized, [
    db,
    evolutionFetch,
    evolutionGroupTransport,
    (id) =>
      processCareCycle(
        db,
        evolutionGroupTransport,
        id,
        (shop, chosen) => loadCareGroupLogo(shop, chosen, url),
        true,
      ),
  ]);
});
