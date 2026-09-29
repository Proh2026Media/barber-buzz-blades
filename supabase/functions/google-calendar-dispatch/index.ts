import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, ensureFreshAccessToken, googleOAuthConfig, json } from "../_shared/google.ts";

/** Marca gravada nos eventos criados pelo app; a importação da agenda ignora esses eventos. */
export const APP_EVENT_MARK = "barbaCabeloAppointmentId";

type Push = {
  id: string;
  appointment_id: string;
  user_id: string;
  calendar_id: string | null;
  op: "upsert" | "delete";
};

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_id: string;
  service: { name: string | null } | null;
  staff: { display_name: string | null } | null;
  barbershop: { name: string | null; timezone: string | null } | null;
};

const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";

/** Id estável por agendamento + pessoa: repetir o envio nunca duplica o evento. */
async function eventIdFor(appointmentId: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${appointmentId}:${userId}`),
  );
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `bc${hex}`;
}

async function googleError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return data.error?.message || `${fallback} (HTTP ${res.status})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing Supabase env" }, 500);
  }
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ error: "Not allowed" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let oauth: ReturnType<typeof googleOAuthConfig>;
  try {
    oauth = googleOAuthConfig();
  } catch {
    return json({ ok: true, skipped: "google_not_configured" });
  }

  const { data: batch, error: claimError } = await admin.rpc("claim_google_calendar_pushes", {
    p_limit: 20,
  });
  if (claimError) return json({ error: claimError.message }, 500);

  const pushes = (batch ?? []) as Push[];
  const tokens = new Map<string, { token: string; calendarId: string } | { error: string }>();
  let done = 0;
  let failed = 0;

  for (const push of pushes) {
    const finish = async (ok: boolean, extra: Record<string, unknown> = {}) => {
      await admin.rpc("complete_google_calendar_push", { p_id: push.id, p_ok: ok, ...extra });
      if (ok) done += 1;
      else failed += 1;
    };

    try {
      if (!tokens.has(push.user_id)) {
        const { data: connection } = await admin
          .from("google_connections")
          .select("*")
          .eq("user_id", push.user_id)
          .maybeSingle();
        const calendarId = connection?.selected_calendar_id?.trim();
        if (!connection || !calendarId) {
          tokens.set(push.user_id, {
            error: "Agenda Google desconectada ou sem agenda escolhida.",
          });
        } else {
          try {
            const token = await ensureFreshAccessToken(
              admin,
              connection,
              oauth.clientId,
              oauth.clientSecret,
            );
            tokens.set(push.user_id, { token, calendarId });
          } catch (err) {
            tokens.set(push.user_id, {
              error: err instanceof Error ? err.message : "Conexão Google expirada.",
            });
          }
        }
      }
      const auth = tokens.get(push.user_id)!;
      if ("error" in auth) {
        await finish(false, { p_error: auth.error });
        continue;
      }

      const eventId = await eventIdFor(push.appointment_id, push.user_id);
      const headers = {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      };

      if (push.op === "delete") {
        const calendarId = push.calendar_id || auth.calendarId;
        const res = await fetch(
          `${CALENDAR_API}/${encodeURIComponent(calendarId)}/events/${eventId}`,
          { method: "DELETE", headers },
        );
        if (res.ok || res.status === 404 || res.status === 410) await finish(true);
        else
          await finish(false, {
            p_error: await googleError(res, "Falha ao retirar da Agenda Google"),
          });
        continue;
      }

      const { data: appt, error: apptError } = await admin
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, customer_id, service:services(name), staff:staff(display_name), barbershop:barbershops(name, timezone)",
        )
        .eq("id", push.appointment_id)
        .maybeSingle();
      if (apptError || !appt) {
        await finish(false, { p_error: apptError?.message ?? "Agendamento não encontrado." });
        continue;
      }
      const row = appt as unknown as Appointment;
      const { data: customer } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", row.customer_id)
        .maybeSingle();

      const serviceName = row.service?.name?.trim() || "Atendimento";
      const customerName = (customer?.full_name as string | null)?.trim() || "Cliente";
      const staffName = row.staff?.display_name?.trim() || "";
      const shopName = row.barbershop?.name?.trim() || "Barba & Cabelo";
      const timeZone = row.barbershop?.timezone || "America/Sao_Paulo";
      const pending = row.status === "pending" || row.status === "reschedule_requested";

      const event = {
        id: eventId,
        status: "confirmed",
        summary: `${serviceName} · ${customerName}${pending ? " (a confirmar)" : ""}`,
        description: [
          `Cliente: ${customerName}`,
          staffName ? `Profissional: ${staffName}` : null,
          `Barbearia: ${shopName}`,
          "",
          "Copiado automaticamente pelo Barba & Cabelo. Alterações feitas aqui não mudam a reserva no app.",
        ]
          .filter((line) => line !== null)
          .join("\n"),
        start: { dateTime: row.starts_at, timeZone },
        end: { dateTime: row.ends_at, timeZone },
        extendedProperties: { private: { [APP_EVENT_MARK]: row.id } },
      };

      if (push.calendar_id && push.calendar_id !== auth.calendarId) {
        await fetch(`${CALENDAR_API}/${encodeURIComponent(push.calendar_id)}/events/${eventId}`, {
          method: "DELETE",
          headers,
        }).catch(() => undefined);
      }

      const base = `${CALENDAR_API}/${encodeURIComponent(auth.calendarId)}/events`;
      let res = await fetch(`${base}/${eventId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(event),
      });
      if (res.status === 404) {
        res = await fetch(base, { method: "POST", headers, body: JSON.stringify(event) });
      }
      if (res.ok) {
        await finish(true, { p_calendar_id: auth.calendarId, p_event_id: eventId });
      } else {
        await finish(false, {
          p_error: await googleError(res, "Falha ao copiar para a Agenda Google"),
        });
      }
    } catch (err) {
      await finish(false, {
        p_error: err instanceof Error ? err.message : "Falha ao copiar para a Agenda Google",
      });
    }
  }

  return json({ ok: true, claimed: pushes.length, done, failed });
});
