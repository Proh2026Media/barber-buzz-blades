import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing Supabase env" }, 500);
    }

    const host = Deno.env.get("SMTP_HOST") ?? Deno.env.get("GOTRUE_SMTP_HOST");
    const port = Number(Deno.env.get("SMTP_PORT") ?? Deno.env.get("GOTRUE_SMTP_PORT") ?? "587");
    const user = Deno.env.get("SMTP_USER") ?? Deno.env.get("GOTRUE_SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS") ?? Deno.env.get("GOTRUE_SMTP_PASS");
    const from =
      Deno.env.get("SMTP_ADMIN_EMAIL") ??
      Deno.env.get("GOTRUE_SMTP_ADMIN_EMAIL") ??
      user;
    const fromName =
      Deno.env.get("SMTP_SENDER_NAME") ?? Deno.env.get("GOTRUE_SMTP_SENDER_NAME") ?? "Barba & Cabelo";

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Estende séries recorrentes junto com o despacho.
    try {
      await admin.rpc("extend_booking_series");
    } catch {
      /* migration pode ainda não estar aplicada */
    }

    if (!host || !user || !pass || !from) {
      return json({ ok: true, skipped: true, reason: "SMTP not configured" });
    }

    const { data: batch, error: claimError } = await admin.rpc("claim_email_outbox", {
      p_limit: 20,
    });
    if (claimError) {
      return json({ error: claimError.message }, 500);
    }

    const rows = (batch ?? []) as Array<{
      id: string;
      to_email: string;
      subject: string;
      body: string;
    }>;

    let sent = 0;
    let failed = 0;

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: user, password: pass },
      },
    });

    for (const row of rows) {
      try {
        await client.send({
          from: `${fromName} <${from}>`,
          to: row.to_email,
          subject: row.subject,
          content: row.body,
        });
        await admin.rpc("complete_email_outbox", { p_id: row.id, p_ok: true });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha no SMTP";
        await admin.rpc("complete_email_outbox", {
          p_id: row.id,
          p_ok: false,
          p_error: message,
        });
        failed += 1;
      }
    }

    try {
      await client.close();
    } catch {
      /* ignore */
    }

    return json({ ok: true, sent, failed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});
