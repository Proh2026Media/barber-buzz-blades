import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CalendarDays,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { SettingsCardHeader } from "@/features/shop/settings/SettingsCardHeader";
import { t as tNow, useI18n } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  friendlyChannelLastError,
  friendlyIntegrationError,
} from "@/lib/integrations/friendly-error";

type GoogleConnectionStatus = {
  connected: boolean;
  google_email?: string | null;
  last_calendar_sync_at?: string | null;
  last_contacts_sync_at?: string | null;
  last_error?: string | null;
  selected_calendar_id?: string | null;
  selected_calendar_name?: string | null;
  push_scope?: PushScope;
  push_failed?: number;
  push_pending?: number;
  push_last_error?: string | null;
};

type PushScope = "off" | "mine" | "shop";

type GoogleCalendarOption = {
  id: string;
  name: string;
  primary?: boolean;
  access_role?: string | null;
};

type ImportedGoogleEvent = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  calendar_id: string;
  calendar_name: string | null;
};

type ImportedEventsState = {
  status: "idle" | "loading" | "ready" | "error";
  events: ImportedGoogleEvent[];
  timezone: string;
};

const DEFAULT_SHOP_TIMEZONE = "America/Sao_Paulo";
const IMPORTED_EVENTS_LIMIT = 8;

type GoogleIntegrationsCardProps = {
  /** Barbearia aberta no painel: define o fuso usado nos horários dos eventos importados. */
  shopId?: string;
  returnPath?: string;
  /** Dono/sócio podem copiar todos os atendimentos da barbearia. */
  canCopyWholeShop?: boolean;
};

async function callGoogle(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error(tNow("integr.err.session"));

  const base = import.meta.env.VITE_SUPABASE_URL || "";
  const response = await fetch(`${base}/functions/v1/google-connect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let payload: {
    error?: string;
    msg?: string;
    connection?: GoogleConnectionStatus;
    url?: string;
    imported?: number;
    resourceName?: string | null;
    calendars?: GoogleCalendarOption[];
    selected_calendar_id?: string | null;
    selected_calendar_name?: string | null;
    calendar_id?: string | null;
    calendar_name?: string | null;
    revoked?: boolean;
    had_connection?: boolean;
  } = {};
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {};
  } catch {
    throw new Error(
      response.ok
        ? tNow("integr.google.errInvalidResponse")
        : tNow("integr.google.errUnavailable", { status: response.status }),
    );
  }
  if (!response.ok) {
    const detail = payload.error || payload.msg || `HTTP ${response.status}`;
    throw new Error(friendlyIntegrationError(detail, tNow("integr.google.errAction")));
  }
  return payload;
}

function formatWhen(value: string | null | undefined, intlLocale: string, notYet: string) {
  if (!value) return notYet;
  try {
    return new Date(value).toLocaleString(intlLocale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/** RPC nova ainda fora de `types.ts` gerado. */
async function listImportedEvents(shopId: string | undefined, limit: number) {
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("list_my_google_calendar_events", {
    p_shop_id: shopId ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as { timezone?: string; events?: ImportedGoogleEvent[] };
  return {
    timezone: payload.timezone || DEFAULT_SHOP_TIMEZONE,
    events: Array.isArray(payload.events) ? payload.events : [],
  };
}

function safeFormat(
  value: string,
  intlLocale: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(intlLocale, options).format(date);
  }
}

/** Dia e hora no fuso da loja. Dia inteiro chega como meia-noite UTC: formatar em UTC. */
function formatImportedEvent(
  event: ImportedGoogleEvent,
  intlLocale: string,
  timeZone: string,
  allDayLabel: string,
) {
  const dayOptions: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };
  if (event.all_day) {
    return `${safeFormat(event.starts_at, intlLocale, dayOptions, "UTC")} · ${allDayLabel}`;
  }
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const day = safeFormat(event.starts_at, intlLocale, dayOptions, timeZone);
  const start = safeFormat(event.starts_at, intlLocale, timeOptions, timeZone);
  const end = safeFormat(event.ends_at, intlLocale, timeOptions, timeZone);
  return `${day} · ${start}–${end}`;
}

function demoImportedEvents(calendarId: string, calendarName: string): ImportedGoogleEvent[] {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  const at = (days: number, hour: number, durationMin: number) => {
    const start = new Date(base);
    start.setDate(start.getDate() + days);
    start.setHours(hour);
    return {
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + durationMin * 60000).toISOString(),
    };
  };
  return [
    {
      id: "demo-1",
      title: "Reunião com fornecedor",
      all_day: false,
      calendar_id: calendarId,
      calendar_name: calendarName,
      ...at(1, 10, 60),
    },
    {
      id: "demo-2",
      title: "Consulta médica",
      all_day: false,
      calendar_id: calendarId,
      calendar_name: calendarName,
      ...at(2, 15, 45),
    },
  ];
}

function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

const DEMO_CALENDARS: GoogleCalendarOption[] = [
  { id: "primary", name: "Agenda principal", primary: true },
  { id: "trabalho@demo.local", name: "Trabalho (demo)" },
  { id: "pessoal@demo.local", name: "Pessoal (demo)" },
];

export function GoogleIntegrationsCard({
  shopId,
  returnPath = "/shop",
  canCopyWholeShop = false,
}: GoogleIntegrationsCardProps) {
  const demo = useDemo();
  const isDemo = Boolean(demo);
  const { t, intlLocale } = useI18n();
  const [connection, setConnection] = useState<GoogleConnectionStatus>({ connected: false });
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [importedEvents, setImportedEvents] = useState<ImportedEventsState>({
    status: "idle",
    events: [],
    timezone: DEFAULT_SHOP_TIMEZONE,
  });

  const loadImportedEvents = useCallback(async () => {
    if (isDemo) {
      const picked = DEMO_CALENDARS.find((item) => item.id === connection.selected_calendar_id);
      setImportedEvents({
        status: "ready",
        events: demoImportedEvents(picked?.id ?? "primary", picked?.name ?? "Agenda principal"),
        timezone: DEFAULT_SHOP_TIMEZONE,
      });
      return;
    }
    setImportedEvents((current) => ({ ...current, status: "loading" }));
    try {
      const result = await listImportedEvents(shopId, IMPORTED_EVENTS_LIMIT);
      setImportedEvents({ status: "ready", events: result.events, timezone: result.timezone });
    } catch {
      setImportedEvents((current) => ({ ...current, status: "error" }));
    }
  }, [connection.selected_calendar_id, isDemo, shopId]);

  const applySelectedCalendar = useCallback(
    (calendarId?: string | null, calendarName?: string | null) => {
      setConnection((current) => ({
        ...current,
        selected_calendar_id: calendarId ?? null,
        selected_calendar_name: calendarName ?? null,
      }));
    },
    [],
  );

  const loadCalendars = useCallback(async () => {
    if (isDemo) {
      setCalendars(DEMO_CALENDARS);
      applySelectedCalendar(null, null);
      return;
    }
    setLoadingCalendars(true);
    try {
      const payload = await callGoogle({ action: "list_calendars" });
      setCalendars(payload.calendars ?? []);
      // A lista veio do Google: o erro gravado antes (ex.: API desativada) já não vale.
      setConnection((current) => ({ ...current, last_error: null }));
      setError(null);
      applySelectedCalendar(
        payload.selected_calendar_id ?? null,
        payload.selected_calendar_name ?? null,
      );
    } catch (err) {
      setError(friendlyIntegrationError(err, tNow("integr.google.errListCalendars")));
    } finally {
      setLoadingCalendars(false);
    }
  }, [applySelectedCalendar, isDemo]);

  const refresh = useCallback(async () => {
    if (isDemo) {
      setConnection({
        connected: true,
        google_email: "demo@gmail.com",
        last_calendar_sync_at: new Date().toISOString(),
        last_contacts_sync_at: null,
        last_error: null,
        selected_calendar_id: null,
        selected_calendar_name: null,
      });
      setCalendars(DEMO_CALENDARS);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callGoogle({ action: "status" });
      const next = payload.connection ?? { connected: false };
      setConnection(next);
      if (next.connected) {
        setBusy(false);
        await loadCalendars();
        return;
      }
      setCalendars([]);
    } catch (err) {
      setError(friendlyIntegrationError(err, tNow("integr.google.errStatus")));
    } finally {
      setBusy(false);
    }
  }, [isDemo, loadCalendars]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      setMessage(tNow("integr.google.connectedChoose"));
      void refresh();
      params.delete("google");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    } else if (google === "error") {
      setError(friendlyIntegrationError(params.get("reason"), tNow("integr.google.errConnect")));
      params.delete("google");
      params.delete("reason");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [refresh]);

  async function connect() {
    if (demo) {
      setMessage(t("integr.google.demoConnected"));
      setConsentOpen(false);
      setConnection({
        connected: true,
        google_email: "demo@gmail.com",
        selected_calendar_id: null,
        selected_calendar_name: null,
        last_calendar_sync_at: null,
        last_contacts_sync_at: null,
        last_error: null,
      });
      setCalendars(DEMO_CALENDARS);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callGoogle({
        action: "start",
        return_path: returnPath,
        return_origin: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (!payload.url) throw new Error(t("integr.google.errNoUrl"));
      window.location.assign(payload.url);
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.google.errStart")));
      setBusy(false);
      setConsentOpen(false);
    }
  }

  async function disconnect() {
    if (demo) {
      setConnection({ connected: false });
      setCalendars([]);
      setImportedEvents({ status: "idle", events: [], timezone: DEFAULT_SHOP_TIMEZONE });
      setMessage(t("integr.google.disconnectedDemo"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callGoogle({ action: "disconnect" });
      setConnection({ connected: false });
      setCalendars([]);
      setImportedEvents({ status: "idle", events: [], timezone: DEFAULT_SHOP_TIMEZONE });
      if (payload.revoked) {
        setMessage(t("fix3.google.disconnectedRevoked"));
      } else if (payload.had_connection) {
        setMessage(t("fix3.google.disconnectedNoRevoke"));
      } else {
        setMessage(t("integr.google.disconnected"));
      }
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.google.errDisconnect")));
    } finally {
      setBusy(false);
    }
  }

  async function chooseCalendar(calendarId: string) {
    // A opção vazia é só o texto de "Selecione…": não existe ação no servidor
    // para limpar a agenda, então ignorar evita a tela divergir do que está gravado.
    if (!calendarId) return;
    if (demo) {
      const picked = DEMO_CALENDARS.find((item) => item.id === calendarId);
      applySelectedCalendar(calendarId, picked?.name ?? calendarId);
      setImportedEvents((current) => ({ ...current, status: "idle", events: [] }));
      setMessage(t("integr.google.calendarSelected", { name: picked?.name ?? calendarId }));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callGoogle({ action: "set_calendar", calendar_id: calendarId });
      applySelectedCalendar(payload.selected_calendar_id, payload.selected_calendar_name);
      // Recarrega a lista: até a próxima sincronização, só aparecem eventos da agenda escolhida.
      setImportedEvents((current) => ({ ...current, status: "idle", events: [] }));
      setMessage(
        t("integr.google.calendarSelected", {
          name: payload.selected_calendar_name || payload.selected_calendar_id || calendarId,
        }),
      );
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.google.errChoose")));
    } finally {
      setBusy(false);
    }
  }

  async function syncCalendar() {
    if (demo) {
      if (!connection.selected_calendar_id) {
        setError(t("integr.google.chooseFirst"));
        return;
      }
      setMessage(t("integr.google.syncedDemo"));
      void loadImportedEvents();
      return;
    }
    if (!connection.selected_calendar_id) {
      setError(t("integr.google.chooseFirst"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callGoogle({ action: "sync_calendar" });
      const label =
        payload.calendar_name ||
        connection.selected_calendar_name ||
        connection.selected_calendar_id ||
        t("integr.google.calendarFallback");
      const imported = payload.imported ?? 0;
      setMessage(
        t(imported === 1 ? "integr.google.importedOne" : "integr.google.importedMany", {
          count: imported,
          name: label,
        }),
      );
      await refresh();
      await loadImportedEvents();
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.google.errSync")));
    } finally {
      setBusy(false);
    }
  }

  async function changePush(scope: PushScope) {
    if (scope === (connection.push_scope ?? "off")) return;
    if (demo) {
      setConnection((current) => ({ ...current, push_scope: scope }));
      setMessage(t("integr.push.demo"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("set_google_calendar_push", {
        p_scope: scope,
      });
      if (rpcError) throw rpcError;
      setConnection((current) => ({ ...current, push_scope: scope }));
      setMessage(scope === "off" ? t("integr.push.savedOff") : t("integr.push.savedOn"));
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.push.errSave")));
    } finally {
      setBusy(false);
    }
  }

  async function saveContact() {
    if (demo) {
      setMessage(t("integr.google.contactSavedDemo"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await callGoogle({
        action: "save_contact",
        contact: {
          name: contactName,
          phone: contactPhone,
          email: contactEmail,
        },
      });
      setMessage(t("integr.google.contactSaved"));
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      await refresh();
    } catch (err) {
      setError(friendlyIntegrationError(err, t("integr.google.errContact")));
    } finally {
      setBusy(false);
    }
  }

  const selectedCalendarId = connection.selected_calendar_id || "";
  const selectedCalendarLabel =
    connection.selected_calendar_name ||
    calendars.find((item) => item.id === selectedCalendarId)?.name ||
    null;
  const hasChosenCalendar = Boolean(selectedCalendarId);
  // Eventos de uma agenda anterior saem do banco na próxima sincronização; até lá, não aparecem.
  const visibleEvents = importedEvents.events.filter(
    (event) => event.calendar_id === selectedCalendarId,
  );

  // Mostra os eventos importados sempre que há conexão e agenda escolhida.
  useEffect(() => {
    if (!connection.connected || !connection.selected_calendar_id) return;
    if (importedEvents.status !== "idle") return;
    void loadImportedEvents();
  }, [
    connection.connected,
    connection.selected_calendar_id,
    importedEvents.status,
    loadImportedEvents,
  ]);

  return (
    <section className="app-action-card space-y-4 p-5" aria-labelledby="google-integrations-title">
      <div>
        <SettingsCardHeader
          id="google-integrations-title"
          icon={CalendarDays}
          title={t("integr.google.title")}
          intro={t("integr.google.intro")}
        />
        <a
          href="/privacidade#dados-google"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          {t("fix3.google.privacyLink")}
        </a>
      </div>

      <div className="rounded-[var(--control-radius)] border border-border/60 bg-background/80 px-3 py-3 text-sm">
        {connection.connected ? (
          <p>
            {connection.google_email ? (
              <>
                {richText(t("integr.google.connectedAs"), {
                  email: <span className="font-semibold">{connection.google_email}</span>,
                })}
                <span className="block text-xs text-muted-foreground">
                  {t("integr.google.accountNote")}
                </span>
              </>
            ) : (
              t("integr.google.connected")
            )}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("integr.google.notConnected")}</p>
        )}
        {connection.connected ? (
          <p className="mt-2 text-sm">
            {t("integr.google.inUse")}{" "}
            <span className="font-semibold">
              {selectedCalendarLabel ||
                (loadingCalendars ? t("integr.google.loading") : t("integr.google.noneChosen"))}
            </span>
          </p>
        ) : null}
        {connection.last_error ? (
          <p className="mt-1 text-xs text-destructive">
            {friendlyChannelLastError(connection.last_error)}
          </p>
        ) : null}
        {connection.connected ? (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              {t("integr.google.lastSync", {
                when: formatWhen(
                  connection.last_calendar_sync_at,
                  intlLocale,
                  t("integr.google.notYet"),
                ),
              })}
            </li>
            <li>
              {t("integr.google.lastContact", {
                when: formatWhen(
                  connection.last_contacts_sync_at,
                  intlLocale,
                  t("integr.google.notYet"),
                ),
              })}
            </li>
          </ul>
        ) : null}
      </div>

      {connection.connected ? (
        <div className="space-y-2">
          <label
            htmlFor="google-calendar-choice"
            className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("integr.google.whichCalendar")}
          </label>
          <select
            id="google-calendar-choice"
            className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
            value={selectedCalendarId}
            disabled={busy || loadingCalendars || calendars.length === 0}
            onChange={(event) => void chooseCalendar(event.target.value)}
            aria-label={t("integr.google.selectAria")}
          >
            <option value="" disabled={Boolean(selectedCalendarId)}>
              {loadingCalendars
                ? t("integr.google.loadingCalendars")
                : t("integr.google.selectPlaceholder")}
            </option>
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
                {calendar.primary ? ` (${t("integr.google.primary")})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("integr.google.selectHint")}</p>
          {calendars.length === 0 && !loadingCalendars ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void loadCalendars()}
            >
              <RefreshCw className="size-4" aria-hidden />
              {t("integr.google.reloadCalendars")}
            </button>
          ) : null}
        </div>
      ) : null}

      {connection.connected ? (
        <fieldset className="space-y-2" disabled={busy || !hasChosenCalendar}>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("integr.push.title")}
          </legend>
          <p className="text-xs text-muted-foreground">{t("integr.push.intro")}</p>
          {!hasChosenCalendar ? (
            <p className="text-xs font-semibold text-foreground">{t("integr.push.chooseFirst")}</p>
          ) : null}
          <div className="grid gap-2">
            {(
              [
                { id: "off", label: t("integr.push.off"), hint: t("integr.push.offHint") },
                { id: "mine", label: t("integr.push.mine"), hint: t("integr.push.mineHint") },
                ...(canCopyWholeShop || connection.push_scope === "shop"
                  ? [{ id: "shop", label: t("integr.push.shop"), hint: t("integr.push.shopHint") }]
                  : []),
              ] as { id: PushScope; label: string; hint: string }[]
            ).map((option) => {
              const checked = (connection.push_scope ?? "off") === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--control-radius)] border px-3 py-3 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                    checked
                      ? "border-foreground bg-background"
                      : "border-border/70 bg-background/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="google-calendar-push"
                    value={option.id}
                    checked={checked}
                    onChange={() => void changePush(option.id)}
                    className="mt-0.5 size-4 shrink-0 accent-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {connection.push_pending ? (
            <p role="status" className="text-xs text-muted-foreground">
              {t(
                connection.push_pending === 1
                  ? "integr.push.pendingOne"
                  : "integr.push.pendingMany",
                { count: connection.push_pending },
              )}
            </p>
          ) : null}
          {connection.push_failed ? (
            <p role="alert" className="text-xs text-destructive">
              {t(
                connection.push_failed === 1 ? "integr.push.failedOne" : "integr.push.failedMany",
                {
                  count: connection.push_failed,
                  reason:
                    friendlyChannelLastError(connection.push_last_error) ??
                    t("integr.google.errAction"),
                },
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("integr.push.note")}</p>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!connection.connected ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            disabled={busy}
            onClick={() => setConsentOpen(true)}
          >
            <Link2 className="size-4" aria-hidden />
            {t("integr.google.connect")}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              disabled={busy || !hasChosenCalendar}
              onClick={() => void syncCalendar()}
            >
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
              {t("integr.google.sync")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              <Unplug className="size-4" aria-hidden />
              {t("integr.disconnect")}
            </button>
          </>
        )}
      </div>

      {connection.connected && hasChosenCalendar ? (
        <section
          className="space-y-3 border-t border-border/50 pt-4"
          aria-labelledby="google-imported-events-title"
          aria-busy={importedEvents.status === "loading"}
        >
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p
                id="google-imported-events-title"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("fix3.google.eventsTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("fix3.google.eventsIntro")}</p>
            </div>
          </div>

          {importedEvents.status === "loading" || importedEvents.status === "idle" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("fix3.google.eventsLoading")}
            </p>
          ) : null}

          {importedEvents.status === "error" ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-destructive">{t("fix3.google.eventsError")}</p>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => void loadImportedEvents()}
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("fix3.google.eventsRetry")}
              </button>
            </div>
          ) : null}

          {importedEvents.status === "ready" && visibleEvents.length === 0 ? (
            <p className="rounded-[var(--control-radius)] border border-dashed border-border/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
              {t("fix3.google.eventsEmpty")}
            </p>
          ) : null}

          {importedEvents.status === "ready" && visibleEvents.length > 0 ? (
            <>
              <ul className="space-y-2">
                {visibleEvents.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-[var(--control-radius)] border border-border/60 bg-background/80 px-3 py-2.5"
                  >
                    <p className="break-words text-sm font-semibold">
                      {event.title?.trim() || t("fix3.google.eventUntitled")}
                    </p>
                    <p className="text-xs text-foreground">
                      {formatImportedEvent(
                        event,
                        intlLocale,
                        importedEvents.timezone,
                        t("fix3.google.eventAllDay"),
                      )}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {t("fix3.google.eventFrom", {
                        name: event.calendar_name || event.calendar_id,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t("fix3.google.eventsTimezone", { tz: importedEvents.timezone })}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {connection.connected ? (
        <div className="space-y-3 border-t border-border/50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("integr.google.saveToContacts")}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("integr.google.name")}</span>
              <input
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t("integr.google.namePlaceholder")}
                disabled={busy}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("integr.google.phone")}</span>
              <input
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+55…"
                disabled={busy}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">{t("integr.google.email")}</span>
              <input
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@…"
                disabled={busy}
              />
            </label>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
            disabled={busy || (!contactName.trim() && !contactPhone.trim() && !contactEmail.trim())}
            onClick={() => void saveContact()}
          >
            <UserPlus className="size-4" aria-hidden />
            {t("integr.google.saveContact")}
          </button>
        </div>
      ) : null}

      {message ? (
        <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="max-w-lg rounded-[var(--control-radius)] border-border bg-card p-5 sm:p-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex size-11 items-center justify-center rounded-[var(--control-radius)] bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <ShieldCheck className="size-5" aria-hidden />
            </div>
            <DialogTitle className="text-base font-extrabold leading-snug">
              {t("integr.google.consentTitle")}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  {richText(t("integr.google.consentP1"), {
                    warning: (
                      <span className="font-semibold text-foreground">
                        {t("integr.google.consentWarning")}
                      </span>
                    ),
                  })}
                </p>
                <p>
                  {richText(t("integr.google.consentP2"), {
                    strong: (
                      <span className="font-semibold text-foreground">
                        {t("integr.google.consentStrong")}
                      </span>
                    ),
                  })}
                </p>
                <div className="rounded-[var(--control-radius)] border border-border/70 bg-muted/40 px-3 py-3 text-xs text-foreground">
                  <p className="font-semibold">{t("integr.google.consentStepsTitle")}</p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
                    <li>
                      {richText(t("integr.google.consentStep1"), {
                        advanced: (
                          <span className="font-semibold text-foreground">
                            {t("integr.google.consentAdvanced")}
                          </span>
                        ),
                      })}
                    </li>
                    <li>
                      {richText(t("integr.google.consentStep2"), {
                        app: (
                          <span className="font-semibold text-foreground">Barba &amp; Cabelo</span>
                        ),
                      })}
                    </li>
                    <li>{t("integr.google.consentStep3")}</li>
                  </ol>
                </div>
                <p className="text-xs">{t("integr.google.consentConfirm")}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--button-radius)] border border-border/70 px-4 text-sm font-semibold"
              disabled={busy}
              onClick={() => setConsentOpen(false)}
            >
              {t("integr.google.notNow")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              disabled={busy}
              onClick={() => void connect()}
            >
              <Link2 className="size-4" aria-hidden />
              {t("integr.google.acceptConnect")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
