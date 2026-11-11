import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, sendAuthorizedWhatsapp, json } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing Supabase env" }, 500);
    }

    if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
      return json({ error: "Sem autorização para despachar avisos" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Lembretes e extensão de séries recorrentes antes do lote de envio.
    await admin.rpc("process_whatsapp_reminders");
    try {
      await admin.rpc("extend_booking_series");
    } catch {
      /* ignore if migration not applied yet */
    }
    try {
      await admin.rpc("process_pending_client_notices");
    } catch {
      /* ignore if migration not applied yet */
    }
    try {
      await admin.rpc("expire_shop_change_requests");
    } catch {
      /* ignore if migration not applied yet */
    }
    // Limpeza dos códigos de verificação antigos: uma vez por hora (o cron roda a
    // cada minuto). Sem a migration aplicada, o erro é só ignorado.
    if (new Date().getUTCMinutes() === 17) {
      try {
        await admin.rpc("purge_auth_otp_challenges");
        await admin.rpc("purge_whatsapp_send_audit");
      } catch {
        /* ignore if migration not applied yet */
      }
    }
    // Pausas fixas semanais: mantém os próximos 120 dias de bloqueios gerados.
    if (new Date().getUTCMinutes() === 23) {
      try {
        await admin.rpc("extend_availability_block_rules");
      } catch {
        /* ignore if migration not applied yet */
      }
    }

    // Melhor esforço: despacha e-mails no mesmo cron.
    try {
      await fetch(`${supabaseUrl}/functions/v1/email-dispatch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });
    } catch {
      /* cron separado cobrirá */
    }

    // Melhor esforço: cópias para a Agenda Google no mesmo cron.
    try {
      await fetch(`${supabaseUrl}/functions/v1/google-calendar-dispatch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      /* próxima rodada tenta de novo */
    }

    // Convites de retorno são opcionais, consentidos e limitados no banco.
    const { error: returnError } = await admin.rpc("process_whatsapp_return_notices");
    if (returnError) return json({ error: "Regras de comunicação indisponíveis" }, 503);

    const { data: batch, error: claimError } = await admin.rpc("claim_whatsapp_outbox", {
      p_limit: 5,
    });
    if (claimError) {
      return json({ error: claimError.message }, 500);
    }

    const rows = (batch ?? []) as Array<{
      id: string;
      lease_token: string;
      barbershop_id: string;
      to_e164: string;
      body: string;
      attempts: number;
      payload?: { staff_id?: string };
    }>;

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const result = await sendAuthorizedWhatsapp(admin, {
        outboxId: row.id,
        leaseToken: row.lease_token,
      });
      if (!result.recorded)
        return json({ error: "Resultado pendente de conferência; sem reenvio automático" }, 503);
      if (result.state === "accepted") sent += 1;
      else failed += 1;
    }

    return json({ ok: true, claimed: rows.length, sent, failed });
  } catch (err) {
    return json({ error: "Não foi possível conferir os envios" }, 503);
  }
});
