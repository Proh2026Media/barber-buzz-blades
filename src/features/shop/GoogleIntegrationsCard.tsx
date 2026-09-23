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
  const payload = (await response.json()) as {
    error?: string;
    connection?: GoogleConnectionStatus;
    url?: string;
    imported?: number;
    resourceName?: string | null;
  };
  if (!response.ok) throw new Error(payload.error || "Falha na integração Google");
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

export function GoogleIntegrationsCard({ returnPath = "/shop" }: GoogleIntegrationsCardProps) {
  const demo = useDemo();
  const [connection, setConnection] = useState<GoogleConnectionStatus>({ connected: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const refresh = useCallback(async () => {
    if (demo) {
      setConnection({
        connected: true,
        google_email: "demo@gmail.com",
        last_calendar_sync_at: new Date().toISOString(),
        last_contacts_sync_at: null,
        last_error: null,
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await callGoogle({ action: "status" });
      setConnection(payload.connection ?? { connected: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o Google.");
    } finally {
      setBusy(false);
    }
  }, [demo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "connected") {
      setMessage("Google Agenda e Contatos conectados.");
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
      const payload = await callGoogle({ action: "start", return_path: returnPath });
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
      setMessage("Google desconectado (demo).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callGoogle({ action: "disconnect" });
      setConnection({ connected: false });
      setMessage("Google desconectado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  async function syncCalendar() {
    if (demo) {
      setMessage("Agenda sincronizada (demo).");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const payload = await callGoogle({ action: "sync_calendar" });
      setMessage(`${payload.imported ?? 0} eventos importados da Agenda Google.`);
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

  return (
    <section className="app-action-card space-y-4 p-5" aria-label="Google Agenda e Contatos">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-muted text-foreground">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Google Agenda e Contatos</p>
          <p className="text-xs text-muted-foreground">
            Conecte sua conta Google para importar a agenda e salvar clientes nos Contatos.
            Isso é separado do botão “Entrar com Google” do login.
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
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">Ainda não conectado.</p>
        )}
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
              disabled={busy}
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
