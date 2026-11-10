import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, digitsOnlyPhone, evolutionFetch, json } from "../_shared/evolution.ts";

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
      p_limit: 20,
    });
    if (claimError) {
      return json({ error: claimError.message }, 500);
    }

    const rows = (batch ?? []) as Array<{
      id: string;
      barbershop_id: string;
      to_e164: string;
      body: string;
      attempts: number;
      payload?: { staff_id?: string };
    }>;

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const { data: delivery, error: prepareError } = await admin.rpc("prepare_whatsapp_delivery", {
        p_id: row.id,
      });
      if (prepareError) return json({ error: "Não foi possível conferir a fila de avisos" }, 503);
      if (!delivery) {
        failed += 1;
        continue;
      }
      const target = delivery as { instance_name: string; to_e164: string; body: string };
      // Uma consulta sem efeito precede o envio. Nunca troca de número por erro/banimento.
      let connected = false;
      try {
        const state = (await evolutionFetch(
          `/instance/connectionState/${encodeURIComponent(target.instance_name)}`,
          {
            signal: AbortSignal.timeout(10_000),
          },
        )) as { instance?: { state?: string } };
        connected = state?.instance?.state === "open";
      } catch {
        /* Nenhum sendText foi chamado; pode adiar com segurança. */
      }
      if (!connected) {
        const { error } = await admin.rpc("defer_whatsapp_delivery", { p_id: row.id });
        if (error) return json({ error: "Não foi possível adiar o aviso" }, 503);
        failed += 1;
        continue;
      }
      try {
        const result = (await evolutionFetch(
          `/message/sendText/${encodeURIComponent(target.instance_name)}`,
          {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({ number: digitsOnlyPhone(target.to_e164), text: target.body }),
          },
        )) as { key?: { id?: string }; message?: { key?: { id?: string } } };
        const providerId = result?.key?.id ?? result?.message?.key?.id;
        if (!providerId) throw new Error("Envio sem confirmação do provedor");
        const { error } = await admin.rpc("complete_whatsapp_outbox", {
          p_id: row.id,
          p_ok: true,
          p_provider_message_id: providerId,
        });
        // O provedor aceitou, mas o banco pode estar indisponível. Não repetir.
        if (error) return json({ error: "Envio aceito; registro pendente de conferência" }, 503);
        sent += 1;
      } catch {
        const { error } = await admin.rpc("complete_whatsapp_outbox", {
          p_id: row.id,
          p_ok: false,
          p_error: "Resultado incerto; conferir no provedor antes de reenviar",
        });
        if (error) return json({ error: "Resultado pendente de conferência" }, 503);
        failed += 1;
      }
    }

    return json({ ok: true, claimed: rows.length, sent, failed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Dispatch failed" }, 500);
  }
});
