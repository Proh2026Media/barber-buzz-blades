import { useEffect, useRef, useState } from "react";
import { X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";

export type ClientHistoryRow = {
  appointment_id: string;
  starts_at: string;
  service_name: string | null;
  staff_name: string | null;
  status: string;
  amount_cents: number;
};

export type ClientProfilePayload = {
  customer_id: string;
  customer_name: string | null;
  avatar_url: string | null;
  visits: number;
  total_spent_cents: number;
  first_visit: string | null;
  last_visit: string | null;
  rhythm: RhythmPayload;
  history: ClientHistoryRow[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Em revisão",
  reschedule_requested: "Remarcação solicitada",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Perfil do cliente com histórico completo e ritmo. Aberto a partir da lista de
 * clientes do parceiro/dono/sócio.
 */
export function ClientProfileModal({
  shopId,
  customerId,
  customerName,
  onClose,
}: {
  shopId: string;
  customerId: string;
  customerName: string | null;
  onClose: () => void;
}) {
  const demo = useDemo();
  const [profile, setProfile] = useState<ClientProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (demo) {
      const rows = demo.appointments.filter((row) => row.customer_id === customerId);
      const completed = rows.filter((row) => row.status === "completed");
      const sorted = [...completed].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) {
        intervals.push(
          (new Date(sorted[i]!.starts_at).getTime() -
            new Date(sorted[i - 1]!.starts_at).getTime()) /
            86400000,
        );
      }
      const weekdays = new Map<number, number>();
      const hours = new Map<number, number>();
      const services = new Map<string, number>();
      for (const row of sorted) {
        const date = new Date(row.starts_at);
        weekdays.set(date.getDay(), (weekdays.get(date.getDay()) ?? 0) + 1);
        hours.set(date.getHours(), (hours.get(date.getHours()) ?? 0) + 1);
        const name = demo.services.find((s) => s.id === row.service_id)?.name ?? "Serviço";
        services.set(name, (services.get(name) ?? 0) + 1);
      }
      const top = (map: Map<number, number>) =>
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topService = [...services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const totalCents = completed.reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0);
      setProfile({
        customer_id: customerId,
        customer_name: demo.customers.find((c) => c.id === customerId)?.name ?? customerName,
        avatar_url: null,
        visits: completed.length,
        total_spent_cents: totalCents,
        first_visit: sorted[0]?.starts_at ?? null,
        last_visit: sorted.at(-1)?.starts_at ?? null,
        rhythm: {
          sample: intervals.length,
          avg_return_days: intervals.length
            ? intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
            : null,
          preferred_weekday: top(weekdays) ?? null,
          preferred_hour: top(hours) ?? null,
          top_service: topService ?? null,
          avg_spend_cents: completed.length ? Math.round(totalCents / completed.length) : null,
        },
        history: rows
          .map((row) => ({
            appointment_id: row.id,
            starts_at: row.starts_at,
            service_name: demo.services.find((s) => s.id === row.service_id)?.name ?? null,
            staff_name: demo.staff.find((s) => s.id === row.staff_id)?.display_name ?? null,
            status: row.status,
            amount_cents: demo.prices[row.id] ?? 0,
          }))
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      });
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = await supabase.rpc("get_client_profile", {
          p_shop_id: shopId,
          p_customer_id: customerId,
        });
        if (cancelled) return;
        if (result.error) setError(true);
        else setProfile(result.data as unknown as ClientProfilePayload);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, shopId, customerId, customerName]);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Perfil de ${profile?.customer_name ?? customerName ?? "cliente"}`}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <User className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">
                {profile?.customer_name ?? customerName ?? "Cliente"}
              </h2>
              <p className="text-xs text-muted-foreground">Perfil e histórico</p>
            </div>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label="Fechar perfil"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="dialog-scroll-area flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando perfil…
            </p>
          ) : error || !profile ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar o perfil do cliente.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="app-action-card p-3">
                  <p className="text-2xl font-bold tabular-nums">{profile.visits}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.visits === 1 ? "visita" : "visitas"}
                  </p>
                </div>
                <div className="app-action-card p-3">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatBRL(profile.total_spent_cents)}
                  </p>
                  <p className="text-xs text-muted-foreground">total gasto</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                <span>Primeira visita: {formatDate(profile.first_visit)}</span>
                <span>Última: {formatDate(profile.last_visit)}</span>
              </div>

              <RhythmDashboard
                rhythm={profile.rhythm}
                title="Ritmo do cliente"
                dayLabel="Dia em que o cliente costuma ir"
              />

              <section className="space-y-2">
                <h3 className="text-sm font-bold">Histórico de agendamentos</h3>
                {profile.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento registrado.</p>
                ) : (
                  profile.history.map((row) => (
                    <div
                      key={row.appointment_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.service_name ?? "Serviço"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(row.starts_at)}
                          {row.staff_name ? ` · ${row.staff_name}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`status-pill status-${row.status}`}>
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                        <span className="text-xs font-bold tabular-nums">
                          {formatBRL(row.amount_cents)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
