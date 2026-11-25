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
      Deno.env.get("SMTP_ADMIN_EMAIL") ?? Deno.env.get("GOTRUE_SMTP_ADMIN_EMAIL") ?? user;
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

    const { data: batch, error: claimError } = await admin.rpc("claim_email_dispatch", {
      p_limit: 20,
    });
    if (claimError) {
      return json({ error: claimError.message }, 500);
    }

    const rows = (batch ?? []) as Array<{
      id: string;
      attempts: number;
      barbershop_id: string;
      to_email: string;
      subject: string;
      body: string;
    }>;

    if (rows.length === 0) {
      return json({ ok: true, sent: 0, failed: 0 });
    }

    const shopIds = [...new Set(rows.map((row) => row.barbershop_id))];
    const { data: shops, error: shopError } = await admin
      .from("barbershops")
      .select("id, name")
      .in("id", shopIds);
    const senderNames = new Map<string, string>();
    for (const shop of shops ?? []) {
      // O nome é texto de exibição. Os delimitadores do endereço pertencem ao SMTP.
      const name = shop.name.replace(/[<>\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/gu, " ").trim();
      if (name) senderNames.set(shop.id, name);
    }

    let sent = 0;
    let failed = 0;
    let interromperLote = false;
    let pendentesDeConferencia = 0;

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: user, password: pass },
      },
    });

    for (const row of rows) {
      const tentativa = { p_id: row.id, p_attempt: row.attempts };
      async function concluir(resultado: string) {
        const { data, error } = await admin.rpc("finish_email_dispatch", {
          ...tentativa, p_result: resultado,
        });
        if (error || data !== true) throw new Error("Conclusão da tentativa pendente.");
      }
      let iniciouSmtp = false;
      let aceito = false;
      try {
        const fromName = senderNames.get(row.barbershop_id);
        if (interromperLote || shopError || !fromName) {
          await concluir("antes_smtp");
          failed++;
          continue;
        }
        const { data: receipt } = await admin.rpc("email_open_token", { p_id: row.id });
        const safeBody = row.body
          .split(/(https?:\/\/[^\s<>"']+)/g)
          .map((part, index) => {
            const escaped = part
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;");
            return index % 2 === 1
              ? '<a href="' + escaped + '">' + escaped + "</a>"
              : escaped.replaceAll("\n", "<br>");
          })
          .join("");
        const publicOrigin = new URL(
          Deno.env.get("NOTICE_PUBLIC_ORIGIN") || "https://aurset.app",
        ).origin;
        const inicio = await admin.rpc("start_email_smtp", tentativa);
        if (inicio.error || inicio.data !== true) throw new Error("Tentativa indisponível.");
        iniciouSmtp = true;
        await client.send({
          ...(receipt
            ? {
                html:
                  safeBody +
                  '<p><small>Ao carregar imagens, seu aplicativo de e-mail pode registrar um sinal de abertura para a barbearia.</small></p><img width="1" height="1" alt="" src="' +
                  publicOrigin +
                  "/avisos/abertura/email?t=" +
                  encodeURIComponent(receipt) +
                  '">',
              }
            : {}),
          from: `${fromName} <${from}>`,
          to: row.to_email,
          subject: row.subject,
          content: row.body,
        });
        aceito = true;
        await concluir("aceito");
        sent++;
      } catch {
        interromperLote = true;
        try {
          await concluir(aceito ? "aceito" : iniciouSmtp ? "incerto" : "antes_smtp");
          if (aceito) sent++;
          else if (iniciouSmtp) pendentesDeConferencia++;
          else failed++;
        } catch {
          pendentesDeConferencia++;
        }
        console.warn("Conferir tentativa de e-mail", row.id, row.attempts, { iniciouSmtp, aceito });
      }
    }

    try {
      await client.close();
    } catch {
      /* ignore */
    }

    return json({ ok: pendentesDeConferencia === 0, sent, failed, pendentesDeConferencia }, pendentesDeConferencia ? 503 : 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});
