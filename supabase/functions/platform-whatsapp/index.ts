import { connectWithPairingCode, evolutionQr, pairingPhone } from "../_shared/whatsapp-pairing.ts";
/** Status/QR do WhatsApp da plataforma (OTP de /cadastrar). Só platform_admin. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, evolutionFetch, json } from "../_shared/evolution.ts";

type Body = {
  channel_id?: string;
  method?: "qr" | "code";
  phone?: string;
  action?: "status" | "connect" | "restart-pairing" | "pairing-status" | "logout";
};

function mapEvolutionState(
  state: string | undefined,
): "disconnected" | "qr" | "connecting" | "open" {
  const value = (state ?? "").toLowerCase();
  if (value === "open") return "open";
  if (value === "connecting") return "connecting";
  if (value.includes("qr")) return "qr";
  if (value === "close") return "disconnected";
  return "disconnected";
}

function platformInstance() {
  const name = (Deno.env.get("PLATFORM_EVOLUTION_INSTANCE") ?? "").trim();
  if (!name) throw new Error("PLATFORM_EVOLUTION_INSTANCE não configurada no Coolify");
  return name;
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

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_platform_admin");
    if (adminError) return json({ error: adminError.message }, 500);
    if (!isAdmin) return json({ error: "Somente admin da plataforma" }, 403);

    const body = (await req.json()) as Body;
    const action = body.action ?? "status";
    if (!["status", "connect", "restart-pairing", "pairing-status", "logout"].includes(action))
      return json({ error: "ACTION_INVALID" }, 400);
    const wantsPairing =
      action === "restart-pairing" ||
      action === "pairing-status" ||
      (action === "connect" && body.method === "code");
    if (body.method && body.method !== "qr" && body.method !== "code")
      return json({ error: "PAIRING_METHOD_INVALID" }, 400);
    if (wantsPairing && !pairingPhone(body.phone))
      return json({ error: "PAIRING_PHONE_INVALID" }, 400);

    let instanceName: string;
    let managedChannel: { id: string; instance_name: string } | null = null;
    if (body.channel_id !== undefined) {
      if (
        typeof body.channel_id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.channel_id)
      )
        return json({ error: "CHANNEL_INVALID" }, 400);
      const { data, error } = await userClient
        .from("whatsapp_channels")
        .select("id,instance_name")
        .eq("id", body.channel_id)
        .single();
      if (error || !data) return json({ error: "CHANNEL_NOT_FOUND" }, 404);
      managedChannel = data;
      instanceName = data.instance_name;
      if (instanceName === (Deno.env.get("PLATFORM_EVOLUTION_INSTANCE") ?? "").trim())
        return json({ error: "CHANNEL_RESERVED" }, 409);
    } else instanceName = platformInstance();
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    async function saveState(status: string, display_phone: string | null = null) {
      if (!managedChannel) return;
      const { error } = await admin
        .from("whatsapp_channels")
        .update({ status, display_phone })
        .eq("id", managedChannel.id);
      if (error) throw new Error("CHANNEL_STATE_UNSAVED");
    }

    const channelJson = (payload: Record<string, unknown>, status = 200) =>
      json({ ...payload, managed_channel_id: managedChannel?.id ?? null }, status);

    if (wantsPairing) {
      try {
        const result = await connectWithPairingCode(
          evolutionFetch,
          instanceName,
          body.phone!,
          action === "pairing-status" || action === "restart-pairing" ? action : "connect",
        );
        await saveState(result.status ?? "disconnected");
        return channelJson({
          ok: true,
          pairing_supported: true,
          instance_name: instanceName,
          ...result,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "PAIRING_UNAVAILABLE";
        return channelJson({ error: code }, code === "PAIRING_IN_PROGRESS" ? 409 : 502);
      }
    }

    let qrcode: string | null = null;
    let displayPhone: string | null = null;
    let status: "disconnected" | "qr" | "connecting" | "open" = "disconnected";
    let lastError: string | null = null;

    async function ensureInstance(): Promise<string | null> {
      try {
        const created = (await evolutionFetch("/instance/create", {
          method: "POST",
          body: JSON.stringify({
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        })) as { qrcode?: { base64?: string }; base64?: string };
        return normalizeQr(created?.qrcode?.base64 ?? created?.base64 ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/already|exist|in use/i.test(message)) return null;
        throw err;
      }
    }

    if (action === "logout") {
      try {
        await evolutionFetch(`/instance/logout/${instanceName}`, { method: "DELETE" });
      } catch (err) {
        if (!isMissingInstance(err)) throw err;
      }
      await saveState("disconnected");
      return channelJson({
        ok: true,
        instance_name: instanceName,
        status: "disconnected",
        display_phone: null,
        qrcode: null,
      });
    }

    try {
      if (action === "connect") {
        qrcode = await ensureInstance();
      }

      let state: ReturnType<typeof mapEvolutionState> = "disconnected";
      try {
        const stateData = (await evolutionFetch(`/instance/connectionState/${instanceName}`, {
          method: "GET",
        })) as { instance?: { state?: string }; state?: string };
        state = mapEvolutionState(stateData?.instance?.state ?? stateData?.state);
      } catch (err) {
        if (!isMissingInstance(err)) throw err;
        if (action === "connect") qrcode = (await ensureInstance()) ?? qrcode;
        state = "disconnected";
      }

      if (
        action === "status" &&
        body.method === "qr" &&
        (state === "connecting" || state === "qr")
      ) {
        qrcode = evolutionQr(
          await evolutionFetch(`/instance/connect/${instanceName}`, { method: "GET" }),
        );
      }

      if (state !== "open" && action === "connect") {
        try {
          const connectData = (await evolutionFetch(`/instance/connect/${instanceName}`, {
            method: "GET",
          })) as { base64?: string; qrcode?: { base64?: string }; code?: string };
          qrcode = evolutionQr(connectData) ?? qrcode;
        } catch (err) {
          if (!isMissingInstance(err)) throw err;
          qrcode = (await ensureInstance()) ?? qrcode;
          const connectData = (await evolutionFetch(`/instance/connect/${instanceName}`, {
            method: "GET",
          })) as { base64?: string; qrcode?: { base64?: string }; code?: string };
          qrcode = evolutionQr(connectData) ?? qrcode;
        }
      }

      if (state === "open") {
        try {
          const info = (await evolutionFetch(
            `/instance/fetchInstances?instanceName=${instanceName}`,
            { method: "GET" },
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

      status =
        state === "open"
          ? "open"
          : qrcode
            ? "qr"
            : state === "connecting"
              ? "connecting"
              : "disconnected";
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Falha Evolution";
      return channelJson(
        {
          error: lastError,
          instance_name: instanceName,
          status: "disconnected",
          display_phone: null,
          qrcode: null,
          last_error: lastError.slice(0, 400),
        },
        502,
      );
    }

    await saveState(status, displayPhone);
    return channelJson({
      ok: true,
      instance_name: instanceName,
      status,
      display_phone: displayPhone,
      qrcode,
      last_error: lastError,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Platform WhatsApp failed" }, 500);
  }
});
