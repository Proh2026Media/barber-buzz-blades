import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolutionGroupTransport } from "../_shared/evolution.ts";
import { evolutionGroupProvider } from "../_shared/evolution-groups.ts";
import { handleCareGroups } from "./handler.ts";

// Trava de publicação: integração testável por injeção, nunca liberada por variável de ambiente.
// Somente uma entrega explicitamente autorizada poderá habilitar o piloto real.
const provider = evolutionGroupProvider(evolutionGroupTransport, false);
Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!url || !key) return new Response(null, { status: 503 });
  return handleCareGroups(
    req,
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    provider,
    { service: key, webhook: Deno.env.get("WHATSAPP_GROUP_WEBHOOK_SECRET") ?? "" },
  );
});
