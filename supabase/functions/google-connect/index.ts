import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  authUrl,
  buildOAuthState,
  ensureFreshAccessToken,
  exchangeCode,
  fetchGoogleEmail,
  googleOAuthConfig,
  json,
  parseOAuthState,
  GOOGLE_SCOPES,
  isSafeAppsReturnOrigin,
  corsHeaders,
} from "../_shared/google.ts";

type Body = {
  action?: "status" | "start" | "complete" | "disconnect" | "sync_calendar" | "save_contact";
  return_path?: string;
  /** Origin da aba onde o usuário estava logado (ex.: domínio da loja). */
  return_origin?: string;
  code?: string;
  state?: string;
  time_min?: string;
  time_max?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
};

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
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action ?? "status";

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // complete: pode rodar sem sessão no apex (cookie ficou no domínio da loja).
    // O state HMAC amarra user_id + return_origin e expira em 10 min.
    if (action === "complete") {
      const { clientId, clientSecret, redirectUri, stateSecret, appUrl } = googleOAuthConfig();
      const code = body.code?.trim();
      const state = body.state?.trim();
      if (!code || !state) return json({ error: "code and state required" }, 400);

      const parsed = await parseOAuthState(state, stateSecret);
      if (!parsed) {
        return json({ error: "Estado OAuth inválido ou expirado." }, 400);
      }

      // Se houver sessão, ela deve bater com o state (evita trocar conta no meio).
      if (authHeader?.startsWith("Bearer ")) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
          data: { user },
        } = await userClient.auth.getUser();
        if (user && user.id !== parsed.userId) {
          return json({ error: "Sessão diferente da que iniciou a conexão Google." }, 403);
        }
      }

      const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);
      const email = await fetchGoogleEmail(tokens.access_token);
      const scopes = (tokens.scope ?? GOOGLE_SCOPES.join(" ")).split(/\s+/).filter(Boolean);
      const tokenExpiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

      const { data: existing } = await admin
        .from("google_connections")
        .select("id, refresh_token")
        .eq("user_id", parsed.userId)
        .maybeSingle();

      const row = {
        user_id: parsed.userId,
        google_email: email,
        scopes,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
        token_expires_at: tokenExpiresAt,
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await admin.from("google_connections").update(row).eq("id", existing.id);
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin.from("google_connections").insert(row);
        if (error) return json({ error: error.message }, 500);
      }

      let returnOrigin = parsed.returnOrigin;
      if (returnOrigin && !isSafeAppsReturnOrigin(returnOrigin, appUrl)) {
        returnOrigin = null;
      }

      return json({
        ok: true,
        connected: true,
        google_email: email,
        return_path: parsed.returnPath,
        return_origin: returnOrigin || appUrl,
      });
    }

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

    if (action === "status") {
      const { data } = await userClient.rpc("get_my_google_connection");
      return json({ ok: true, connection: data ?? { connected: false } });
    }

    if (action === "start") {
      const { clientId, redirectUri, stateSecret, appUrl } = googleOAuthConfig();
      const returnPath = (body.return_path ?? "/shop").startsWith("/")
        ? (body.return_path ?? "/shop")
        : "/shop";
      const rawOrigin = (body.return_origin ?? "").trim().replace(/\/$/, "");
      const returnOrigin =
        rawOrigin && isSafeAppsReturnOrigin(rawOrigin, appUrl) ? rawOrigin : appUrl;
      const state = await buildOAuthState(user.id, returnPath, stateSecret, returnOrigin);
      return json({
        ok: true,
        url: authUrl(clientId, redirectUri, state),
        redirect_uri: redirectUri,
        scopes: GOOGLE_SCOPES,
      });
    }

    if (action === "disconnect") {
      const { error } = await admin.from("google_connections").delete().eq("user_id", user.id);
      if (error) return json({ error: error.message }, 500);
      await admin.from("google_calendar_events").delete().eq("user_id", user.id);
      return json({ ok: true, connected: false });
    }

    const { data: connection, error: connError } = await admin
      .from("google_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connError) return json({ error: connError.message }, 500);
    if (!connection) {
      return json({ error: "Conecte o Google primeiro.", connected: false }, 400);
    }

    const { clientId, clientSecret } = googleOAuthConfig();
    const accessToken = await ensureFreshAccessToken(admin, connection, clientId, clientSecret);

    if (action === "sync_calendar") {
      const timeMin = body.time_min ?? new Date(Date.now() - 7 * 86400000).toISOString();
      const timeMax = body.time_max ?? new Date(Date.now() + 60 * 86400000).toISOString();
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin,
        timeMax,
        maxResults: "250",
      });
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const calData = (await calRes.json()) as {
        error?: { message?: string };
        items?: Array<{
          id?: string;
          summary?: string;
          description?: string;
          htmlLink?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };
      if (!calRes.ok) {
        const msg = calData.error?.message || "Falha ao ler Agenda Google";
        await admin
          .from("google_connections")
          .update({ last_error: msg, updated_at: new Date().toISOString() })
          .eq("id", connection.id);
        return json({ error: msg }, 502);
      }

      const items = calData.items ?? [];
      let upserted = 0;
      for (const item of items) {
        if (!item.id) continue;
        const startsAt = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00Z` : null);
        const endsAt = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00Z` : null);
        if (!startsAt || !endsAt) continue;
        const allDay = Boolean(item.start?.date && !item.start?.dateTime);
        const { error } = await admin.from("google_calendar_events").upsert(
          {
            user_id: user.id,
            google_event_id: item.id,
            calendar_id: "primary",
            title: item.summary ?? null,
            description: item.description ?? null,
            starts_at: startsAt,
            ends_at: endsAt,
            all_day: allDay,
            html_link: item.htmlLink ?? null,
            raw: item,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,google_event_id" },
        );
        if (!error) upserted += 1;
      }

      await admin
        .from("google_connections")
        .update({
          last_calendar_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return json({ ok: true, imported: upserted, from: timeMin, to: timeMax });
    }

    if (action === "save_contact") {
      const name = body.contact?.name?.trim();
      const email = body.contact?.email?.trim();
      const phone = body.contact?.phone?.trim();
      const notes = body.contact?.notes?.trim();
      if (!name && !email && !phone) {
        return json({ error: "Informe nome, e-mail ou telefone do contato." }, 400);
      }

      const person: Record<string, unknown> = {};
      if (name) person.names = [{ givenName: name }];
      if (email) person.emailAddresses = [{ value: email }];
      if (phone) person.phoneNumbers = [{ value: phone }];
      if (notes) person.biographies = [{ value: notes, contentType: "TEXT_PLAIN" }];

      const peopleRes = await fetch("https://people.googleapis.com/v1/people:createContact", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(person),
      });
      const peopleData = (await peopleRes.json()) as {
        error?: { message?: string };
        resourceName?: string;
      };
      if (!peopleRes.ok) {
        const msg = peopleData.error?.message || "Falha ao salvar no Google Contatos";
        await admin
          .from("google_connections")
          .update({ last_error: msg, updated_at: new Date().toISOString() })
          .eq("id", connection.id);
        return json({ error: msg }, 502);
      }

      await admin
        .from("google_connections")
        .update({
          last_contacts_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return json({ ok: true, resourceName: peopleData.resourceName ?? null });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
