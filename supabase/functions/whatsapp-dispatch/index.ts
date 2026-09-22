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

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Lembretes antes do lote de envio.
    await admin.rpc("process_whatsapp_reminders");

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
    }>;

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const { data: channel } = await admin
        .from("whatsapp_channels")
        .select("instance_name, status, enabled")
        .eq("barbershop_id", row.barbershop_id)
        .maybeSingle();

      if (!channel?.enabled || channel.status !== "open" || !channel.instance_name) {
        await admin.rpc("complete_whatsapp_outbox", {
          p_id: row.id,
          p_ok: false,
          p_error: "Canal WhatsApp indisponível",
        });
        failed += 1;
        continue;
      }

      try {
        const result = (await evolutionFetch(`/message/sendText/${channel.instance_name}`, {
          method: "POST",
          body: JSON.stringify({
            number: digitsOnlyPhone(row.to_e164),
            text: row.body,
          }),
        })) as { key?: { id?: string }; message?: { key?: { id?: string } } };

        const providerId =
          result?.key?.id ?? result?.message?.key?.id ?? null;

        await admin.rpc("complete_whatsapp_outbox", {
          p_id: row.id,
          p_ok: true,
          p_provider_message_id: providerId,
        });
        sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha no envio";
        await admin.rpc("complete_whatsapp_outbox", {
          p_id: row.id,
          p_ok: false,
          p_error: message,
        });
        // Reagenda retry curto enquanto houver tentativas.
        if (row.attempts < 5) {
          await admin
            .from("whatsapp_outbox")
            .update({
              status: "pending",
              scheduled_at: new Date(Date.now() + 60_000).toISOString(),
            })
            .eq("id", row.id);
        }
        failed += 1;
      }
    }

    return json({ ok: true, claimed: rows.length, sent, failed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Dispatch failed" }, 500);
  }
});
