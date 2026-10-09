import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookUser,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Eye,
  Link2,
  Loader2,
  Lock,
  Mail,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  Unplug,
  UserPlus,
  Users,
  UserRound,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardedFetch } from "@/lib/demo-guard";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ActionResult,
  ChoiceCards,
  ConfirmDialog,
  IconList,
  IconTile,
  LoadingState,
  MoreActions,
  MoreDetails,
  Notice,
  SectionHeader,
  StatusBadge,
  Steps,
  Tag,
  type ActionState,
} from "@/components/visual";
import {
  friendlyChannelLastError,
  friendlyIntegrationError,
  integrationErrorKind,
} from "@/lib/integrations/friendly-error";
import { useTimeZoneName } from "@/features/register-owner/TimeZonePicker";
import { CONNECTION_STATE } from "./connection-state";

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

type Result = { state: ActionState; text?: string } | null;

const DEFAULT_SHOP_TIMEZONE = "America/Sao_Paulo";
const IMPORTED_EVENTS_LIMIT = 8;
/** Até este número de agendas, a escolha aparece em cartões; acima, numa lista. */
const CALENDAR_CARDS_MAX = 6;

type GoogleConnectionCardProps = {
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
  const response = await guardedFetch(`${base}/functions/v1/google-connect`, {
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
    // Traduz uma única vez aqui; quem chama não traduz de novo (friendlyIntegrationError
    // reconhece a frase já pronta).
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

/** Dia (cabeçalho do grupo) e faixa de horário no fuso da loja. Dia inteiro chega como meia-noite UTC. */
function eventParts(event: ImportedGoogleEvent, intlLocale: string, timeZone: string) {
  const dayOptions: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };
  if (event.all_day) {
    return { day: safeFormat(event.starts_at, intlLocale, dayOptions, "UTC"), time: null };
  }
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return {
    day: safeFormat(event.starts_at, intlLocale, dayOptions, timeZone),
    time: `${safeFormat(event.starts_at, intlLocale, timeOptions, timeZone)}–${safeFormat(
      event.ends_at,
      intlLocale,
      timeOptions,
      timeZone,
    )}`,
  };
}

function demoImportedEvents(
  calendarId: string,
  calendarName: string,
  titles: [string, string],
): ImportedGoogleEvent[] {
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
      title: titles[0],
      all_day: false,
      calendar_id: calendarId,
      calendar_name: calendarName,
      ...at(1, 10, 60),
    },
    {
      id: "demo-2",
      title: titles[1],
      all_day: false,
      calendar_id: calendarId,
      calendar_name: calendarName,
      ...at(2, 15, 45),
    },
  ];
}

/** Bloco de uma direção da sincronização: seta, título, frase e conteúdo. */
function DirectionBlock({
  icon,
  title,
  text,
  aside,
  children,
}: {
  icon: typeof ArrowDownToLine;
  title: string;
  text: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <IconTile icon={icon} size="sm" />
        <div className="min-w-0 flex-1 basis-40">
          <h4 className="text-sm font-bold">{title}</h4>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Google Agenda e Contatos: estado da conexão no topo (selo + conta), a agenda escolhida em
 * cartões e as duas direções da sincronização, cada uma com seu estado. Conexão vencida vira
 * "Ação necessária" com um único botão "Reconectar conta Google".
 */
export function GoogleConnectionCard({
  shopId,
  returnPath = "/shop",
  canCopyWholeShop = false,
}: GoogleConnectionCardProps) {
  const demo = useDemo();
  const isDemo = Boolean(demo);
  const { t, intlLocale } = useI18n();
  const nameOf = useTimeZoneName();
  const demoCalendars = useMemo<GoogleCalendarOption[]>(
    () => [
      { id: "primary", name: t("integr.google.demo.calendarMain"), primary: true },
      { id: "trabalho@demo.local", name: t("integr.google.demo.calendarWork") },
      { id: "pessoal@demo.local", name: t("integr.google.demo.calendarPersonal") },
    ],
    [t],
  );
  const [connection, setConnection] = useState<GoogleConnectionStatus>({ connected: false });
  const [checked, setChecked] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  /** Problema da conexão (status ou lista de agendas), já em linguagem simples. */
  const [problem, setProblem] = useState<string | null>(null);
  const [accountResult, setAccountResult] = useState<Result>(null);
  const [calendarResult, setCalendarResult] = useState<Result>(null);
  const [syncResult, setSyncResult] = useState<Result>(null);
  const [pushResult, setPushResult] = useState<Result>(null);
  const [contactResult, setContactResult] = useState<Result>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [importedEvents, setImportedEvents] = useState<ImportedEventsState>({
    status: "idle",
    events: [],
    timezone: DEFAULT_SHOP_TIMEZONE,
  });

  const loadImportedEvents = useCallback(async () => {
    if (isDemo) {
      const picked = demoCalendars.find((item) => item.id === connection.selected_calendar_id);
      setImportedEvents({
        status: "ready",
        events: demoImportedEvents(picked?.id ?? "primary", picked?.name ?? "", [
          t("integr.google.demo.event1"),
          t("integr.google.demo.event2"),
        ]),
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
  }, [connection.selected_calendar_id, demoCalendars, isDemo, shopId, t]);

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
      setCalendars(demoCalendars);
      applySelectedCalendar(null, null);
      return;
    }
    setLoadingCalendars(true);
    try {
      const payload = await callGoogle({ action: "list_calendars" });
      setCalendars(payload.calendars ?? []);
      // A lista veio do Google: o erro gravado antes (ex.: API desativada) já não vale.
      setConnection((current) => ({ ...current, last_error: null }));
      setProblem(null);
      applySelectedCalendar(
        payload.selected_calendar_id ?? null,
        payload.selected_calendar_name ?? null,
      );
    } catch (err) {
      setProblem(friendlyIntegrationError(err, tNow("integr.google.errListCalendars")));
    } finally {
      setLoadingCalendars(false);
    }
  }, [applySelectedCalendar, demoCalendars, isDemo]);

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
      setCalendars(demoCalendars);
      setChecked(true);
      return;
    }
    setBusy(true);
    try {
      const payload = await callGoogle({ action: "status" });
      const next = payload.connection ?? { connected: false };
      setConnection(next);
      setProblem(null);
      setChecked(true);
      if (next.connected) {
        setBusy(false);
        await loadCalendars();
        return;
      }
      setCalendars([]);
    } catch (err) {
      setProblem(friendlyIntegrationError(err, tNow("integr.google.errStatus")));
    } finally {
      setChecked(true);
      setBusy(false);
    }
  }, [demoCalendars, isDemo, loadCalendars]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      setAccountResult({ state: "saved", text: tNow("integr.google.connectedChoose") });
      void refresh();
      params.delete("google");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    } else if (google === "error") {
      setAccountResult({
        state: "error",
        text: friendlyIntegrationError(params.get("reason"), tNow("integr.google.errConnect")),
      });
      params.delete("google");
      params.delete("reason");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [refresh]);

  async function connect() {
    if (demo) {
      setAccountResult({ state: "saved", text: t("integr.google.demoConnected") });
      setConsentOpen(false);
      setProblem(null);
      setConnection({
        connected: true,
        google_email: "demo@gmail.com",
        selected_calendar_id: null,
        selected_calendar_name: null,
        last_calendar_sync_at: null,
        last_contacts_sync_at: null,
        last_error: null,
      });
      setCalendars(demoCalendars);
      return;
    }
    setBusy(true);
    setAccountResult(null);
    try {
      const payload = await callGoogle({
        action: "start",
        return_path: returnPath,
        return_origin: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (!payload.url) throw new Error(t("integr.google.errNoUrl"));
      window.location.assign(payload.url);
    } catch (err) {
      setAccountResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.google.errStart")),
      });
      setBusy(false);
      setConsentOpen(false);
    }
  }

  async function disconnect() {
    if (demo) {
      setConnection({ connected: false });
      setCalendars([]);
      setImportedEvents({ status: "idle", events: [], timezone: DEFAULT_SHOP_TIMEZONE });
      setAccountResult({ state: "saved", text: t("integr.google.disconnectedDemo") });
      return;
    }
    setBusy(true);
    try {
      const payload = await callGoogle({ action: "disconnect" });
      setConnection({ connected: false });
      setCalendars([]);
      setProblem(null);
      setImportedEvents({ status: "idle", events: [], timezone: DEFAULT_SHOP_TIMEZONE });
      setAccountResult({
        state: "saved",
        text: payload.revoked
          ? t("fix3.google.disconnectedRevoked")
          : payload.had_connection
            ? t("fix3.google.disconnectedNoRevoke")
            : t("integr.google.disconnected"),
      });
    } catch (err) {
      throw new Error(friendlyIntegrationError(err, t("integr.google.errDisconnect")));
    } finally {
      setBusy(false);
    }
  }

  async function chooseCalendar(calendarId: string) {
    // Não existe ação no servidor para "nenhuma agenda": escolher vazio é ignorado.
    if (!calendarId || calendarId === connection.selected_calendar_id) return;
    if (demo) {
      const picked = demoCalendars.find((item) => item.id === calendarId);
      applySelectedCalendar(calendarId, picked?.name ?? calendarId);
      setImportedEvents((current) => ({ ...current, status: "idle", events: [] }));
      setCalendarResult({
        state: "saved",
        text: t("integr.google.calendarSelected", { name: picked?.name ?? calendarId }),
      });
      return;
    }
    setBusy(true);
    setCalendarResult({ state: "saving" });
    try {
      const payload = await callGoogle({ action: "set_calendar", calendar_id: calendarId });
      applySelectedCalendar(payload.selected_calendar_id, payload.selected_calendar_name);
      // Recarrega a lista: até a próxima sincronização, só aparecem eventos da agenda escolhida.
      setImportedEvents((current) => ({ ...current, status: "idle", events: [] }));
      setCalendarResult({
        state: "saved",
        text: t("integr.google.calendarSelected", {
          name: payload.selected_calendar_name || payload.selected_calendar_id || calendarId,
        }),
      });
    } catch (err) {
      setCalendarResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.google.errChoose")),
      });
    } finally {
      setBusy(false);
    }
  }

  async function syncCalendar() {
    if (!connection.selected_calendar_id) {
      setSyncResult({ state: "error", text: t("integr.google.chooseFirst") });
      return;
    }
    if (demo) {
      setSyncResult({ state: "saved", text: t("integr.google.syncedDemo") });
      void loadImportedEvents();
      return;
    }
    setBusy(true);
    setSyncResult({ state: "saving" });
    try {
      const payload = await callGoogle({ action: "sync_calendar" });
      const label =
        payload.calendar_name ||
        connection.selected_calendar_name ||
        connection.selected_calendar_id ||
        t("integr.google.calendarFallback");
      const imported = payload.imported ?? 0;
      setSyncResult({
        state: "saved",
        text: t(imported === 1 ? "integr.google.importedOne" : "integr.google.importedMany", {
          count: imported,
          name: label,
        }),
      });
      await refresh();
      await loadImportedEvents();
    } catch (err) {
      setSyncResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.google.errSync")),
      });
    } finally {
      setBusy(false);
    }
  }

  async function changePush(scope: PushScope) {
    if (scope === (connection.push_scope ?? "off")) return;
    if (demo) {
      setConnection((current) => ({ ...current, push_scope: scope }));
      setPushResult({ state: "saved", text: t("integr.push.demo") });
      return;
    }
    setBusy(true);
    setPushResult({ state: "saving" });
    try {
      const { error: rpcError } = await supabase.rpc("set_google_calendar_push", {
        p_scope: scope,
      });
      if (rpcError) throw rpcError;
      setConnection((current) => ({ ...current, push_scope: scope }));
      setPushResult({
        state: "saved",
        text: scope === "off" ? t("integr.push.savedOff") : t("integr.push.savedOn"),
      });
    } catch (err) {
      setPushResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.push.errSave")),
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveContact() {
    if (demo) {
      setContactResult({ state: "saved", text: t("integr.google.contactSavedDemo") });
      return;
    }
    setBusy(true);
    setContactResult({ state: "saving" });
    try {
      await callGoogle({
        action: "save_contact",
        contact: {
          name: contactName,
          phone: contactPhone,
          email: contactEmail,
        },
      });
      setContactResult({ state: "saved", text: t("integr.google.contactSaved") });
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      await refresh();
    } catch (err) {
      setContactResult({
        state: "error",
        text: friendlyIntegrationError(err, t("integr.google.errContact")),
      });
    } finally {
      setBusy(false);
    }
  }

  const selectedCalendarId = connection.selected_calendar_id || "";
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

  // Estado da conexão: o problema (de agora ou gravado no servidor) decide entre "Conectado",
  // "Ação necessária" (reconectar a conta) e "Problema do nosso lado" (configuração do app).
  const lastErrorText = friendlyChannelLastError(connection.last_error);
  const issueText = problem ?? lastErrorText;
  const issueKind = integrationErrorKind(issueText);
  const needsReconnect =
    connection.connected &&
    (issueKind === "errors.integration.googleReconnect" ||
      issueKind === "errors.integration.googleScopeMissing");
  const platformIssue =
    issueKind === "errors.integration.googleApiDisabled" ||
    issueKind === "errors.integration.googleNotReady";
  const state: "checking" | "off" | "ok" | "action" | "issue" = !checked
    ? "checking"
    : needsReconnect
      ? "action"
      : !connection.connected
        ? problem
          ? "issue"
          : "off"
        : issueText
          ? "issue"
          : "ok";

  // Mesmo tom e ícone do WhatsApp para o mesmo estado (mapa comum de conexões).
  const badgeState = {
    checking: { ...CONNECTION_STATE.checking, label: t("integr.state.checking") },
    ok: { ...CONNECTION_STATE.ok, label: t("integr.google.connected") },
    action: { ...CONNECTION_STATE.action, label: t("integr.state.action") },
    issue: { ...CONNECTION_STATE.error, label: t("integr.state.problem") },
    off: { ...CONNECTION_STATE.off, label: t("integr.google.notConnected") },
  }[state];
  const badge = (
    <StatusBadge tone={badgeState.tone} icon={badgeState.icon} label={badgeState.label} live />
  );

  const pushOptions = [
    {
      value: "off" as const,
      title: t("integr.push.off"),
      description: t("integr.push.offHint"),
      icon: XCircle,
    },
    {
      value: "mine" as const,
      title: t("integr.push.mine"),
      description: t("integr.push.mineHint"),
      icon: UserRound,
    },
    ...(canCopyWholeShop || connection.push_scope === "shop"
      ? [
          {
            value: "shop" as const,
            title: t("integr.push.shop"),
            description: t("integr.push.shopHint"),
            icon: Users,
          },
        ]
      : []),
  ];

  // Eventos agrupados por dia, como uma mini agenda.
  const eventDays: { day: string; rows: { event: ImportedGoogleEvent; time: string | null }[] }[] =
    [];
  for (const event of visibleEvents) {
    const parts = eventParts(event, intlLocale, importedEvents.timezone);
    const group = eventDays.find((item) => item.day === parts.day);
    if (group) group.rows.push({ event, time: parts.time });
    else eventDays.push({ day: parts.day, rows: [{ event, time: parts.time }] });
  }

  const reconnectButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => setConsentOpen(true)}
      className="action-button action-confirm sm:px-5"
    >
      <RotateCcw className="size-4" aria-hidden />
      {t("integr.google.reconnect")}
    </button>
  );

  return (
    <section
      className="app-action-card space-y-4 p-5"
      aria-labelledby="google-integrations-title"
      aria-busy={state === "checking" || undefined}
    >
      <SectionHeader
        id="google-integrations-title"
        icon={CalendarDays}
        title={t("integr.google.title")}
        description={t("integr.google.introShort")}
        aside={badge}
      />

      {state === "checking" && (
        <LoadingState variant="lines" count={2} label={t("integr.state.checking")} />
      )}

      {/* Conta conectada: e-mail, alcance e as ações raras no "⋯". */}
      {checked && connection.connected && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
          <Mail className="size-5 shrink-0 text-gold" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {connection.google_email || t("integr.google.connected")}
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Tag icon={Lock}>{t("integr.google.scopeMine")}</Tag>
              <span>{t("integr.google.accountNote")}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            aria-label={t("integr.checkAgain")}
            title={t("integr.checkAgain")}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card transition hover:border-primary/40 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", busy && "motion-safe:animate-spin")} aria-hidden />
          </button>
          <MoreActions
            label={t("integr.google.moreActions")}
            title={t("integr.google.title")}
            actions={[
              {
                id: "reconnect",
                label: t("integr.google.reconnect"),
                icon: RotateCcw,
                onSelect: () => setConsentOpen(true),
              },
              {
                id: "disconnect",
                label: t("integr.google.disconnectAction"),
                icon: Unplug,
                tone: "danger",
                onSelect: () => setDisconnectOpen(true),
              },
            ]}
          />
        </div>
      )}

      {state === "action" && issueText && (
        <Notice tone="warning" title={t("integr.google.expiredTitle")} role="status">
          <p>{issueText}</p>
          <div className="mt-2">{reconnectButton}</div>
        </Notice>
      )}
      {state === "issue" && issueText && (
        <Notice
          tone="danger"
          title={platformIssue ? t("integr.google.ourSide") : issueText}
          action={
            platformIssue
              ? undefined
              : { label: t("integr.checkAgain"), icon: RefreshCw, onClick: () => void refresh() }
          }
        >
          {platformIssue && (
            <MoreDetails summary={t("integr.google.technicalDetail")}>
              <p>{issueText}</p>
            </MoreDetails>
          )}
        </Notice>
      )}

      <ActionResult
        state={accountResult?.state}
        text={accountResult?.text}
        onDismiss={() => setAccountResult(null)}
      />

      {/* Sem conexão: o que se ganha ao conectar e um único botão. */}
      {checked && !connection.connected && (
        <div className="space-y-4">
          <IconList
            size="md"
            items={[
              { icon: ArrowDownToLine, text: t("integr.google.benefitImport") },
              { icon: ArrowUpFromLine, text: t("integr.google.benefitPush") },
              { icon: BookUser, text: t("integr.google.benefitContacts") },
            ]}
          />
          <button
            type="button"
            className="action-button action-confirm w-full sm:w-auto sm:px-5"
            disabled={busy}
            onClick={() => setConsentOpen(true)}
          >
            <Link2 className="size-4" aria-hidden />
            {t("integr.google.connect")}
          </button>
        </div>
      )}

      {checked && connection.connected && (
        <div
          className={cn("space-y-4", needsReconnect && "pointer-events-none opacity-50")}
          aria-disabled={needsReconnect || undefined}
        >
          <div className="space-y-2">
            <p className="text-sm font-bold">{t("integr.google.whichCalendar")}</p>
            {loadingCalendars ? (
              <LoadingState variant="list" count={2} label={t("integr.google.loadingCalendars")} />
            ) : calendars.length === 0 ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={() => void loadCalendars()}
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("integr.google.reloadCalendars")}
              </button>
            ) : calendars.length <= CALENDAR_CARDS_MAX ? (
              <ChoiceCards
                legend={t("integr.google.selectAria")}
                name="google-calendar-choice"
                value={selectedCalendarId || null}
                disabled={busy || needsReconnect}
                onChange={(id) => void chooseCalendar(id)}
                options={calendars.map((calendar) => ({
                  value: calendar.id,
                  title: calendar.name,
                  icon: calendar.primary ? Star : CalendarDays,
                  // "Principal" só quando o nome não diz isso ("Agenda principal").
                  description:
                    calendar.primary &&
                    !calendar.name
                      .toLocaleLowerCase()
                      .includes(t("integr.google.primaryBadge").toLocaleLowerCase())
                      ? t("integr.google.primaryBadge")
                      : undefined,
                }))}
              />
            ) : (
              <select
                id="google-calendar-choice"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
                value={selectedCalendarId}
                disabled={busy || needsReconnect}
                onChange={(event) => void chooseCalendar(event.target.value)}
                aria-label={t("integr.google.selectAria")}
              >
                <option value="" disabled={Boolean(selectedCalendarId)}>
                  {t("integr.google.selectPlaceholder")}
                </option>
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                    {calendar.primary ? ` · ${t("integr.google.primaryBadge")}` : ""}
                  </option>
                ))}
              </select>
            )}
            {!hasChosenCalendar && calendars.length > 0 && (
              <Notice tone="info" title={t("integr.google.chooseNow")} role="none" />
            )}
            <ActionResult
              state={calendarResult?.state === "saving" ? null : calendarResult?.state}
              text={calendarResult?.text}
              autoHideMs={5000}
            />
          </div>

          <DirectionBlock
            icon={ArrowDownToLine}
            title={t("integr.google.importTitle")}
            text={t("integr.google.importText")}
            aside={
              <StatusBadge
                tone="neutral"
                icon={Eye}
                label={t("integr.google.readOnly")}
                size="sm"
              />
            }
          >
            <p className="text-xs text-muted-foreground">
              {t("integr.google.lastSync", {
                when: formatWhen(
                  connection.last_calendar_sync_at,
                  intlLocale,
                  t("integr.google.notYet"),
                ),
              })}
            </p>
            <button
              type="button"
              className="action-button action-confirm w-full sm:w-auto sm:px-5"
              disabled={busy || !hasChosenCalendar}
              onClick={() => void syncCalendar()}
            >
              {syncResult?.state === "saving" ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <ArrowDownToLine className="size-4" aria-hidden />
              )}
              {t("integr.google.sync")}
            </button>
            <ActionResult
              state={syncResult?.state === "saving" ? null : syncResult?.state}
              text={syncResult?.text}
              onRetry={() => void syncCalendar()}
            />

            {hasChosenCalendar && (
              <div className="space-y-2" aria-busy={importedEvents.status === "loading"}>
                {(importedEvents.status === "loading" || importedEvents.status === "idle") && (
                  <LoadingState variant="list" count={2} label={t("fix3.google.eventsLoading")} />
                )}
                {importedEvents.status === "error" && (
                  <Notice
                    tone="danger"
                    title={t("fix3.google.eventsError")}
                    action={{
                      label: t("fix3.google.eventsRetry"),
                      icon: RefreshCw,
                      onClick: () => void loadImportedEvents(),
                    }}
                  />
                )}
                {importedEvents.status === "ready" && visibleEvents.length === 0 && (
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                    <CalendarX2 className="size-4 shrink-0" aria-hidden />
                    {t("fix3.google.eventsEmpty")}
                  </p>
                )}
                {importedEvents.status === "ready" && eventDays.length > 0 && (
                  <>
                    <ul className="space-y-3" aria-label={t("fix3.google.eventsTitle")}>
                      {eventDays.map((group) => (
                        <li key={group.day} className="space-y-1.5">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {group.day}
                          </p>
                          <ul className="space-y-1.5">
                            {group.rows.map(({ event, time }) => (
                              <li
                                key={event.id}
                                className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2"
                              >
                                <span className="w-24 shrink-0 text-xs font-bold tabular-nums">
                                  {time ?? t("fix3.google.eventAllDay")}
                                </span>
                                <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                                  {event.title?.trim() || t("fix3.google.eventUntitled")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {t("fix3.google.eventsTimezone", { tz: nameOf(importedEvents.timezone) })}
                    </p>
                  </>
                )}
              </div>
            )}
          </DirectionBlock>

          <DirectionBlock
            icon={ArrowUpFromLine}
            title={t("integr.push.title")}
            text={t("integr.push.intro")}
            aside={
              <span className="flex flex-wrap gap-1.5">
                {connection.push_pending ? (
                  <StatusBadge
                    tone="pending"
                    size="sm"
                    label={t(
                      connection.push_pending === 1
                        ? "integr.push.pendingOne"
                        : "integr.push.pendingMany",
                      { count: connection.push_pending },
                    )}
                  />
                ) : null}
              </span>
            }
          >
            {/* Sem agenda escolhida: só uma dica cinza com cadeado (o aviso azul "Escolha uma
                agenda" já aparece logo acima; dois avisos azuis iguais eram ruído). */}
            {!hasChosenCalendar ? (
              <IconList
                items={[{ icon: Lock, tone: "muted", text: t("integr.push.chooseFirst") }]}
              />
            ) : (
              <ChoiceCards
                legend={t("integr.push.title")}
                name="google-calendar-push"
                columns={1}
                value={connection.push_scope ?? "off"}
                disabled={busy || needsReconnect}
                onChange={(scope) => void changePush(scope)}
                options={pushOptions}
              />
            )}
            {connection.push_failed ? (
              <Notice
                tone="danger"
                title={t(
                  connection.push_failed === 1 ? "integr.push.failedOne" : "integr.push.failedMany",
                  {
                    count: connection.push_failed,
                    reason:
                      friendlyChannelLastError(connection.push_last_error) ??
                      t("integr.google.errAction"),
                  },
                )}
              />
            ) : null}
            <ActionResult
              state={pushResult?.state === "saving" ? null : pushResult?.state}
              text={pushResult?.text}
            />
            <IconList items={[{ icon: ShieldCheck, tone: "muted", text: t("integr.push.note") }]} />
          </DirectionBlock>

          <details className="group rounded-2xl border border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <UserPlus className="size-4 text-gold" aria-hidden />
              <span className="flex-1">{t("integr.google.saveToContacts")}</span>
            </summary>
            <div className="space-y-3 border-t border-border/60 p-4">
              <p className="text-xs text-muted-foreground">
                {t("integr.google.lastContact", {
                  when: formatWhen(
                    connection.last_contacts_sync_at,
                    intlLocale,
                    t("integr.google.notYet"),
                  ),
                })}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block text-xs font-semibold">
                  <span className="mb-1 block">{t("integr.google.name")}</span>
                  <input
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
                    value={contactName}
                    autoComplete="off"
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("integr.google.namePlaceholder")}
                    disabled={busy}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  <span className="mb-1 block">{t("integr.google.phone")}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder={t("integr.google.phonePlaceholder")}
                    disabled={busy}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  <span className="mb-1 block">{t("integr.google.email")}</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={t("integr.google.emailPlaceholder")}
                    disabled={busy}
                  />
                </label>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold disabled:opacity-50"
                disabled={
                  busy || (!contactName.trim() && !contactPhone.trim() && !contactEmail.trim())
                }
                onClick={() => void saveContact()}
              >
                {contactResult?.state === "saving" ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="size-4" aria-hidden />
                )}
                {t("integr.google.saveContact")}
              </button>
              <ActionResult
                state={contactResult?.state === "saving" ? null : contactResult?.state}
                text={contactResult?.text}
              />
            </div>
          </details>
        </div>
      )}

      <a
        href="/privacidade#dados-google"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-foreground underline-offset-2 hover:underline"
      >
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        {t("fix3.google.privacyLink")}
      </a>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card p-5 sm:p-6">
          <DialogHeader className="space-y-3 text-left">
            <IconTile icon={ShieldCheck} tone="warning" />
            <DialogTitle className="text-base font-extrabold leading-snug">
              {t("integr.google.consentTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("integr.google.consentLead", { warning: t("integr.google.consentWarning") })}
            </DialogDescription>
          </DialogHeader>
          <Steps
            orientation="vertical"
            label={t("integr.google.consentStepsTitle")}
            steps={[
              {
                label: t("integr.google.consentStep1", {
                  advanced: t("integr.google.consentAdvanced"),
                }),
                icon: MousePointerClick,
                status: "current",
              },
              {
                label: t("integr.google.consentStep2", { app: "Barba & Cabelo" }),
                icon: Link2,
                status: "upcoming",
              },
              {
                label: t("integr.google.consentStep3"),
                icon: CheckCircle2,
                status: "upcoming",
              },
            ]}
          />
          <MoreDetails summary={t("integr.google.consentWhy")}>
            <div className="space-y-2">
              <p>{t("integr.google.consentP1", { warning: t("integr.google.consentWarning") })}</p>
              <p>{t("integr.google.consentP2", { strong: t("integr.google.consentStrong") })}</p>
              <p>{t("integr.google.consentConfirm")}</p>
            </div>
          </MoreDetails>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold"
              disabled={busy}
              onClick={() => setConsentOpen(false)}
            >
              {t("integr.google.notNow")}
            </button>
            <button
              type="button"
              className="action-button action-confirm sm:px-5"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy ? (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              {t("integr.google.acceptConnect")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        tone="danger"
        icon={Unplug}
        title={t("integr.google.disconnectTitle")}
        description={connection.google_email ?? undefined}
        consequences={[
          { icon: CalendarX2, tone: "danger", text: t("integr.google.disconnectImported") },
          { icon: ShieldCheck, tone: "muted", text: t("integr.google.disconnectCopies") },
          { icon: RotateCcw, tone: "muted", text: t("integr.google.disconnectBack") },
        ]}
        confirmLabel={t("integr.google.disconnectConfirm")}
        confirmIcon={Unplug}
        busyLabel={t("integr.google.disconnecting")}
        cancelLabel={t("integr.google.keepConnected")}
        onConfirm={disconnect}
      />
    </section>
  );
}
