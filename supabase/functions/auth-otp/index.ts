import { corsHeaders, json } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error_code: "method_not_allowed", error: "Método indisponível." }, 405);
  }
  const body = await req.json().catch(() => null);
  if (body?.channel === "email" && (body.action ?? "request") === "request" &&
      (body.purpose ?? "recovery") === "recovery") {
    return json({ ok: true, channel: "email", message: "Use a recuperação por e-mail na tela de acesso." });
  }
  return json({ error_code: "whatsapp_unavailable", error: "Acesse sua conta por e-mail ou Google." }, 410);
});
