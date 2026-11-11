import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolutionFetch } from "../_shared/evolution.ts";
import { handleCareGroups } from "./handler.ts";
import type { GroupProvider } from "../_shared/whatsapp-groups.ts";

// Não habilitar por variável de ambiente. Faltam controles obrigatórios na API 2.3.7.
const provider: GroupProvider = {
  canProvision: false,
  create: async () => {
    throw new Error("GROUP_CAPABILITIES_UNAVAILABLE");
  },
  configure: async () => {
    throw new Error("GROUP_CAPABILITIES_UNAVAILABLE");
  },
  inspect: (instance, groupId) =>
    evolutionFetch(
      `/group/findGroupInfos/${encodeURIComponent(instance)}?groupJid=${encodeURIComponent(groupId)}`,
      { signal: AbortSignal.timeout(5000) },
    ),
};
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
