import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Link2, RefreshCw, Unplug, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";

type GoogleConnectionStatus = {
  connected: boolean;
  google_email?: string | null;
  last_calendar_sync_at?: string | null;
  last_contacts_sync_at?: string | null;
  last_error?: string | null;
  selected_calendar_id?: string | null;
  selected_calendar_name?: string | null;
};

type GoogleCalendarOption = {
  id: string;
  name: string;
  primary?: boolean;
  access_role?: string | null;
};

type GoogleIntegrationsCardProps = {
  returnPath?: string;
};

async function callGoogle(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

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
  } = {};
  try {
    payload = raw ? (JSON.parse(raw) as typeof payload) : {};
  } catch {
    throw new Error(
      response.ok
        ? "Resposta inválida do Google Connect."
        : `Falha na integração Google (${response.status}). A função edge pode estar fora do ar.`,
    );
  }
  if (!response.ok) {
    const detail = payload.error || payload.msg || `HTTP ${response.status}`;
    if (/entrypoint|InvalidWorkerCreation|BOOT_ERROR/i.test(detail)) {
      throw new Error(
        "Função google-connect indisponível no servidor. Publique a Edge Function e tente de novo.",
      );
    }
    if (/Missing GOOGLE_OAUTH|Missing authorization|Invalid session/i.test(detail)) {
      throw new Error(detail);
    }
    throw new Error(detail);
  }
  return payload;
}

function formatWhen(value?: string | null) {
  if (!value) return "Ainda não";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

const DEMO_CALENDARS: GoogleCalendarOption[] = [
  { id: "primary", name: "Agenda principal", primary: true },
  { id: "trabalho@demo.local", name: "Trabalho (demo)" },
  { id: "pessoal@demo.local", name: "Pessoal (demo)" },
];

export function GoogleIntegrationsCard({ returnPath = "/shop" }: GoogleIntegrationsCardProps) {
  const demo = useDemo();
  const [connection, setConnection] = useState<GoogleConnectionStatus>({ connected: false });
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const applySelectedCalendar = useCallback(
    (calendarId?: string | null, calendarName?: string | null) => {
      setConnection((current) => ({
        ...current,
        selected_calendar_id: calendarId ?? current.selected_calendar_id ?? "primary",
        selected_calendar_name: calendarName ?? current.selected_calendar_name ?? null,
      }));
    },
    [],
  );

  const loadCalendars = useCallback(async () => {
    if (demo) {
      setCalendars(DEMO_CALENDARS);
      applySelectedCalendar("primary", "Agenda principal");
      return;
    }
    setLoadingCalendars(true);
    try {
      const payload = await callGoogle({ action: "list_calendars" });
      setCalendars(payload.calendars ?? []);
      applySelectedCalendar(payload.selected_calendar_id, payload.selected_calendar_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível listar as agendas.");
    } finally {
      setLoadingCalendars(false);
    }
  }, [applySelectedCalendar, demo]);

  const refresh = useCallback(async () => {
    if (demo) {
      setConnection({
        connected: true,
        google_email: "demo@gmail.com",
        last_calendar_sync_at: new Date().toISOString(),
        last_contacts_sync_at: null,
        last_error: null,
        selected_calendar_id: "primary",
        selected_calendar_name: "Agenda principal",
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
      setError(err instanceof Error ? err.message : "Não foi possível consultar o Google.");
    } finally {
      setBusy(false);
    }
  }, [demo, loadCalendars]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      setMessage("Google Agenda e Contatos conectados. Escolha a agenda abaixo.");
      void refresh();
      params.delete("google");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    } else if (google === "error") {
      setError(params.get("reason") || "Não foi possível conectar o Google.");
      params.delete("google");
      params.delete("reason");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, [refresh]);

  async function connect() {
    if (demo) {
      setMessage("Na demonstração o Google aparece conectado.");
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
      if (!payload.url) throw new Error("URL de autorização ausente.");
      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar OAuth Google");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (demo) {
      setConnection({ connected: false });
      setCalendars([]);
      setMessage("Google desconectado (demo).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callGoogle({ action: "disconnect" });
      setConnection({ connected: false });
      setCalendars([]);
      setMessage("Google desconectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  async function chooseCalendar(calendarId: string) {
    if (!calendarId) return;
    if (demo) {
      const picked = DEMO_CALENDARS.find((item) => item.id === calendarId);
      applySelectedCalendar(calendarId, picked?.name ?? calendarId);
      setMessage(`Agenda selecionada: ${picked?.name ?? calendarId}`);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callGoogle({ action: "set_calendar", calendar_id: calendarId });
      applySelectedCalendar(payload.selected_calendar_id, payload.selected_calendar_name);
      setMessage(
        `Agenda selecionada: ${payload.selected_calendar_name || payload.selected_calendar_id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao escolher a agenda");
    } finally {
      setBusy(false);
    }
  }

  async function syncCalendar() {
    if (demo) {
      setMessage("Agenda sincronizada (demo).");
      return;
    }
    if (!connection.selected_calendar_id) {
      setError("Escolha qual agenda Google usar antes de sincronizar.");
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
        "Agenda Google";
      setMessage(`${payload.imported ?? 0} eventos importados de “${label}”.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao sincronizar agenda");
    } finally {
      setBusy(false);
    }
  }

  async function saveContact() {
    if (demo) {
      setMessage("Contato salvo no Google Contatos (demo).");
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
      setMessage("Contato salvo no Google Contatos.");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar contato");
    } finally {
      setBusy(false);
    }
  }

  const selectedCalendarId = connection.selected_calendar_id || "";
  const selectedCalendarLabel =
    connection.selected_calendar_name ||
    calendars.find((item) => item.id === selectedCalendarId)?.name ||
    null;

  return (
    <section className="app-action-card space-y-4 p-5" aria-label="Google Agenda e Contatos">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-muted text-foreground">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Google Agenda e Contatos</p>
          <p className="text-xs text-muted-foreground">
            Conecte um Gmail, escolha qual agenda importar e salve clientes nos Contatos. Pode ser
            outra conta — não precisa ser o mesmo e-mail do login neste app.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            A marca Barba & Cabelo já está verificada e o app em produção. A verificação dos
            escopos sensíveis (Agenda e Contatos) já foi enviada e está em análise no Google —
            o aviso “app não verificado” só some quando essa análise for aprovada. Se ainda
            aparecer, use <span className="font-semibold">Avançado</span> → continuar para Barba
            & Cabelo; a conexão funciona normalmente.
          </p>
        </div>
      </div>

      <div className="rounded-[var(--control-radius)] border border-border/60 bg-background/80 px-3 py-3 text-sm">
        {connection.connected ? (
          <p>
            Conectado
            {connection.google_email ? (
              <>
                {" "}
                como <span className="font-semibold">{connection.google_email}</span>
                <span className="block text-xs text-muted-foreground">
                  Conta da Agenda/Contatos (independente do login do sistema).
                </span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">Ainda não conectado.</p>
        )}
        {connection.connected ? (
          <p className="mt-2 text-sm">
            Agenda em uso:{" "}
            <span className="font-semibold">
              {selectedCalendarLabel ||
                (loadingCalendars ? "Carregando…" : "Escolha uma agenda abaixo")}
            </span>
          </p>
        ) : null}
        {connection.last_error ? (
          <p className="mt-1 text-xs text-destructive">{connection.last_error}</p>
        ) : null}
        {connection.connected ? (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>Última sincronização da agenda: {formatWhen(connection.last_calendar_sync_at)}</li>
            <li>Último contato salvo: {formatWhen(connection.last_contacts_sync_at)}</li>
          </ul>
        ) : null}
      </div>

      {connection.connected ? (
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Qual agenda sincronizar?
          </label>
          <select
            className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
            value={selectedCalendarId}
            disabled={busy || loadingCalendars || calendars.length === 0}
            onChange={(event) => void chooseCalendar(event.target.value)}
            aria-label="Selecionar agenda Google"
          >
            {calendars.length === 0 ? (
              <option value="">
                {loadingCalendars ? "Carregando agendas…" : "Nenhuma agenda encontrada"}
              </option>
            ) : (
              calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}
                  {calendar.primary ? " (principal)" : ""}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-muted-foreground">
            A sincronização importa só a agenda escolhida. Você pode trocar depois sem reconectar.
          </p>
          {calendars.length === 0 && !loadingCalendars ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void loadCalendars()}
            >
              <RefreshCw className="size-4" aria-hidden />
              Recarregar agendas
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!connection.connected ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
            disabled={busy}
            onClick={() => void connect()}
          >
            <Link2 className="size-4" aria-hidden />
            Conectar Google
          </button>
        ) : (
          <>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
              disabled={busy || !selectedCalendarId}
              onClick={() => void syncCalendar()}
            >
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
              Sincronizar agenda
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] border border-border/70 bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              <Unplug className="size-4" aria-hidden />
              Desconectar
            </button>
          </>
        )}
      </div>

      {connection.connected ? (
        <div className="space-y-3 border-t border-border/50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Salvar no Google Contatos
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Nome</span>
              <input
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Cliente"
                disabled={busy}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Telefone</span>
              <input
                className="h-11 w-full rounded-[var(--control-radius)] border border-border/70 bg-background px-3 text-sm"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+55…"
                disabled={busy}
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">E-mail</span>
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
            Salvar contato
          </button>
        </div>
      ) : null}

      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
