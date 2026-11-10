import { connectWithPairingCode, evolutionQr, pairingPhone } from "../_shared/whatsapp-pairing.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, evolutionFetch, instanceNameForShop, json } from "../_shared/evolution.ts";

type Body = {
  method?: "qr" | "code";
  phone?: string;
  action?:
    | "status"
    | "connect"
    | "restart-pairing"
    | "pairing-status"
    | "create"
    | "logout"
    | "settings";
  barbershop_id?: string;
  notify_booking?: boolean;
  notify_reminder?: boolean;
  reminder_hours_before?: number;
  enabled?: boolean;
  number_link_id?: string;
  link_version?: number;
};

function mapEvolutionState(
  state: string | undefined,
): "disconnected" | "qr" | "connecting" | "open" {
  const value = (state ?? "").toLowerCase();
  if (value === "open") return "open";
  if (value === "connecting") return "connecting";
  if (value.includes("qr") || value === "close")
    return value.includes("qr") ? "qr" : "disconnected";
  return "disconnected";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: "Missing Supabase env" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as Body;
    const action = body.action ?? "status";
    if (
      ![
        "status",
        "connect",
        "restart-pairing",
        "pairing-status",
        "logout",
        "create",
        "settings",
      ].includes(action)
    )
      return json({ error: "ACTION_INVALID" }, 400);
    const wantsPairing =
      action === "restart-pairing" ||
      action === "pairing-status" ||
      (action === "connect" && body.method === "code");
    if (body.method && body.method !== "qr" && body.method !== "code")
      return json({ error: "PAIRING_METHOD_INVALID" }, 400);
    if (wantsPairing && !pairingPhone(body.phone))
      return json({ error: "PAIRING_PHONE_INVALID" }, 400);

    const shopId = body.barbershop_id?.trim();
    if (!shopId) return json({ error: "barbershop_id required" }, 400);

    const { data: allowed, error: allowError } = await admin.rpc("shop_can_manage_whatsapp", {
      p_shop_id: shopId,
    });
    // rpc with user JWT via userClient for auth.uid()
    const { data: allowedAsUser, error: allowUserError } = await userClient.rpc(
      "shop_can_manage_whatsapp",
      { p_shop_id: shopId },
    );
    if (allowUserError) return json({ error: allowUserError.message }, 500);
    if (!allowedAsUser) return json({ error: "Forbidden" }, 403);
    void allowed;
    void allowError;

    if (action !== "settings" && (action !== "status" || body.method === "qr")) {
      const { data: canConnect, error: roleError } = await userClient.rpc("is_platform_admin");
      if (roleError || !canConnect)
        return json({ error: "A administração do B&C gerencia a conexão deste número." }, 403);
    }

    const { data: shop } = await admin
      .from("barbershops")
      .select("id, slug, name")
      .eq("id", shopId)
      .single();
    if (!shop) return json({ error: "Shop not found" }, 404);

    // Nº 104: preferências por vínculo; conexão única gerenciada na central.
    const linked = await userClient.rpc("shop_whatsapp_channel", { p_shop: shopId });
    if (linked.error && !["PGRST202", "42883"].includes(linked.error.code))
      return json({ error: linked.error.message }, 500);
    if (!linked.error) {
      const row = linked.data;
      if (action === "settings") {
        if (!row)
          return json({ error: "A administração precisa vincular um número à barbearia." }, 409);
        if (body.number_link_id !== row.number_link_id || body.link_version !== row.link_version)
          return json({ error: "WA_STALE" }, 409);
        const updated = await userClient.rpc("shop_update_whatsapp_preferences", {
          p_shop: shopId,
          p_link: row.number_link_id,
          p_version: row.link_version,
          p_enabled: body.enabled ?? row.enabled,
          p_booking: body.notify_booking ?? row.notify_booking,
          p_reminder: body.notify_reminder ?? row.notify_reminder,
          p_hours: body.reminder_hours_before ?? row.reminder_hours_before,
        });
        if (updated.error) return json({ error: updated.error.message }, 409);
        let effective = updated.data;
        if (effective?.delivery_mode === "backup") {
          let status: ReturnType<typeof mapEvolutionState> = "disconnected";
          try {
            const state = (await evolutionFetch(
              `/instance/connectionState/${encodeURIComponent(effective.backup_instance_name)}`,
              { method: "GET", signal: AbortSignal.timeout(10_000) },
            )) as { instance?: { state?: string } };
            status = mapEvolutionState(state.instance?.state);
          } catch {
            /* Consulta sem alterar a reserva. */
          }
          effective = { ...effective, status, display_phone: null };
        }
        return json({ ok: true, channel: effective, centrally_managed: true });
      }
      if (action !== "status" || body.method === "qr")
        return json({ error: "Gerencie a conexão deste número na Central de WhatsApp." }, 409);
      if (!row) return json({ ok: true, channel: null, qrcode: null, centrally_managed: true });
      const instance =
        row.delivery_mode === "backup" ? row.backup_instance_name : row.instance_name;
      let status: ReturnType<typeof mapEvolutionState> = "disconnected";
      if (instance) {
        try {
          const state = (await evolutionFetch(
            `/instance/connectionState/${encodeURIComponent(instance)}`,
            { method: "GET", signal: AbortSignal.timeout(10_000) },
          )) as { instance?: { state?: string } };
          status = mapEvolutionState(state.instance?.state);
        } catch {
          /* Consulta não inicia nem troca a conexão. */
        }
      }
      if (row.delivery_mode === "primary")
        await admin.from("whatsapp_channels").update({ status }).eq("id", row.id);
      return json({
        ok: true,
        channel: {
          ...row,
          status,
          display_phone: row.delivery_mode === "backup" ? null : row.display_phone,
        },
        qrcode: null,
        centrally_managed: true,
      });
    }

    let { data: channel } = await admin
      .from("whatsapp_channels")
      .select("*")
      .eq("barbershop_id", shopId)
      .is("staff_id", null)
      .maybeSingle();

    // Consulta da reserva sem criar, parear ou mudar a instância principal.
    async function activeChannel(row: typeof channel) {
      if (!row || row.delivery_mode !== "backup" || !row.backup_instance_name) return row;
      let status: ReturnType<typeof mapEvolutionState> = "disconnected";
      try {
        const state = (await evolutionFetch(
          `/instance/connectionState/${encodeURIComponent(row.backup_instance_name)}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(10_000),
          },
        )) as { instance?: { state?: string } };
        status = mapEvolutionState(state.instance?.state);
      } catch {
        /* A tela mostra indisponibilidade, sem tentar outro número. */
      }
      return { ...row, status, display_phone: null };
    }
    if (channel?.delivery_mode && channel.delivery_mode !== "primary") {
      if (action === "status")
        return json({ ok: true, channel: await activeChannel(channel), qrcode: null });
      if (action !== "settings")
        return json(
          { error: "Canal gerenciado pela administração; confira a rota antes de conectar." },
          409,
        );
    }

    if (action === "settings") {
      if (!channel) return json({ error: "Conecte o WhatsApp antes de salvar ajustes." }, 400);
      const { data: updated, error } = await admin
        .from("whatsapp_channels")
        .update({
          notify_booking: body.notify_booking ?? channel.notify_booking,
          notify_reminder: body.notify_reminder ?? channel.notify_reminder,
          reminder_hours_before: body.reminder_hours_before ?? channel.reminder_hours_before,
          enabled: body.enabled ?? channel.enabled,
        })
        .eq("barbershop_id", shopId)
        .eq("id", channel.id)
        .is("staff_id", null)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, channel: await activeChannel(updated) });
    }

    if (!channel && (action === "status" || action === "pairing-status")) {
      return json({
        ok: true,
        channel: null,
        qrcode: null,
        pairing_code: null,
        pairing_supported: true,
      });
    }

    const instanceName = channel?.instance_name ?? instanceNameForShop(shopId, shop.slug);
    if (!channel) {
      const { data: created, error: createError } = await admin
        .from("whatsapp_channels")
        .insert({
          barbershop_id: shopId,
          instance_name: instanceName,
          status: "disconnected",
        })
        .select("*")
        .single();
      if (createError) return json({ error: createError.message }, 500);
      channel = created;
    }

    if (!channel) return json({ error: "Canal não encontrado" }, 404);

    if (action === "logout") {
      try {
        await evolutionFetch(`/instance/logout/${channel.instance_name}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
      try {
        await evolutionFetch(`/instance/delete/${channel.instance_name}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
      const { data: updated } = await admin
        .from("whatsapp_channels")
        .update({ status: "disconnected", display_phone: null, last_error: null })
        .eq("barbershop_id", shopId)
        .eq("id", channel.id)
        .is("staff_id", null)
        .select("*")
        .single();
      return json({ ok: true, channel: updated, qrcode: null });
    }

    if (wantsPairing) {
      try {
        const result = await connectWithPairingCode(
          evolutionFetch,
          channel.instance_name,
          body.phone!,
          action === "pairing-status" || action === "restart-pairing" ? action : "connect",
        );
        const { data: updated, error } = await admin
          .from("whatsapp_channels")
          .update({ status: result.status, last_error: null })
          .eq("barbershop_id", shopId)
          .eq("id", channel.id)
          .is("staff_id", null)
          .select("*")
          .single();
        if (error) return json({ error: "PAIRING_UNAVAILABLE" }, 502);
        return json({
          ok: true,
          pairing_supported: true,
          channel: updated,
          pairing_code: result.pairing_code,
          restart_required: result.restart_required,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "PAIRING_UNAVAILABLE";
        return json({ error: code }, code === "PAIRING_IN_PROGRESS" ? 409 : 502);
      }
    }

    let qrcode: string | null = null;
    let displayPhone: string | null = channel.display_phone;

    async function ensureInstance(): Promise<string | null> {
      try {
        const created = (await evolutionFetch("/instance/create", {
          method: "POST",
          body: JSON.stringify({
            instanceName: channel!.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        })) as { qrcode?: { base64?: string }; base64?: string };
        const fromCreate = created?.qrcode?.base64 ?? created?.base64 ?? null;
        return typeof fromCreate === "string" ? fromCreate : null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        // Já existe na Evolution: ok.
        if (/already|exist|in use/i.test(message)) return null;
        throw err;
      }
    }

    function normalizeQr(raw: string | null | undefined): string | null {
      if (!raw) return null;
      if (raw.startsWith("data:")) return raw;
      return `data:image/png;base64,${raw.replace(/^data:image\/png;base64,/, "")}`;
    }

    function isMissingInstance(err: unknown): boolean {
      const message = err instanceof Error ? err.message : String(err ?? "");
      return /does not exist|not found|404/i.test(message);
    }

    if (action === "connect" || action === "create" || action === "status") {
      try {
        // Garante a instância na Evolution (DB pode ter canal sem o recurso remoto).
        if (action === "connect" || action === "create") {
          qrcode = normalizeQr(await ensureInstance());
        }

        let state: ReturnType<typeof mapEvolutionState> = "disconnected";
        try {
          const stateData = (await evolutionFetch(
            `/instance/connectionState/${channel.instance_name}`,
            { method: "GET" },
          )) as { instance?: { state?: string }; state?: string };
          state = mapEvolutionState(stateData?.instance?.state ?? stateData?.state);
        } catch (err) {
          if (!isMissingInstance(err)) throw err;
          if (action === "connect" || action === "create")
            qrcode = normalizeQr(await ensureInstance()) ?? qrcode;
          state = "disconnected";
        }

        if (
          action === "status" &&
          body.method === "qr" &&
          (state === "connecting" || state === "qr")
        ) {
          qrcode = evolutionQr(
            await evolutionFetch(`/instance/connect/${channel.instance_name}`, { method: "GET" }),
          );
        }

        if (state !== "open" && (action === "connect" || action === "create")) {
          try {
            const connectData = (await evolutionFetch(
              `/instance/connect/${channel.instance_name}`,
              {
                method: "GET",
              },
            )) as { base64?: string; qrcode?: { base64?: string }; code?: string };

            qrcode = evolutionQr(connectData) ?? qrcode;
          } catch (err) {
            if (!isMissingInstance(err)) throw err;
            qrcode = normalizeQr(await ensureInstance()) ?? qrcode;
            const connectData = (await evolutionFetch(
              `/instance/connect/${channel.instance_name}`,
              {
                method: "GET",
              },
            )) as { base64?: string; qrcode?: { base64?: string }; code?: string };
            qrcode = evolutionQr(connectData) ?? qrcode;
          }
        }

        if (state === "open") {
          try {
            const info = (await evolutionFetch(
              `/instance/fetchInstances?instanceName=${channel.instance_name}`,
              {
                method: "GET",
              },
            )) as
              | Array<{ ownerJid?: string; instance?: { ownerJid?: string } }>
              | {
                  ownerJid?: string;
                  instance?: { ownerJid?: string };
                };
            const row = Array.isArray(info) ? info[0] : info;
            const jid = row?.ownerJid ?? row?.instance?.ownerJid;
            if (typeof jid === "string" && jid.includes("@")) {
              displayPhone = `+${jid.split("@")[0]}`;
            }
          } catch {
            /* optional */
          }
        }

        const nextStatus =
          state === "open"
            ? "open"
            : qrcode
              ? "qr"
              : state === "connecting"
                ? "connecting"
                : "disconnected";

        const { data: updated } = await admin
          .from("whatsapp_channels")
          .update({
            status: nextStatus,
            display_phone: displayPhone,
            last_error: null,
          })
          .eq("barbershop_id", shopId)
          .eq("id", channel.id)
          .is("staff_id", null)
          .select("*")
          .single();
        channel = updated ?? channel;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha Evolution";
        await admin
          .from("whatsapp_channels")
          .update({ last_error: message.slice(0, 400), status: "disconnected" })
          .eq("barbershop_id", shopId)
          .eq("id", channel.id);
        return json({ error: message, channel }, 502);
      }
    }

    return json({ ok: true, channel, qrcode });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Channel failed" }, 500);
  }
});
