import { useEffect, useRef, useState } from "react";
import { X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";

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

const STATUS_KEY: Record<string, MessageKey> = {
  pending: "status.pending",
  reschedule_requested: "status.reschedule_requested",
  confirmed: "status.confirmed",
  completed: "status.completed",
  cancelled: "status.cancelled",
};

function formatBRL(cents: number, intlLocale: string) {
  return (cents / 100).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
}

function formatDate(iso: string | null, intlLocale: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
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
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [profile, setProfile] = useState<ClientProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
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
        const name =
          demo.services.find((s) => s.id === row.service_id)?.name ??
          tNow("team.partner.serviceFallback");
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
  }, [demo, shopId, customerId, customerName, retry]);

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
        aria-label={t("team.profile.aria", {
          name: profile?.customer_name ?? customerName ?? t("team.clients.clientLower"),
        })}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <User className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">
                {profile?.customer_name ?? customerName ?? t("team.partner.clientFallback")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("team.profile.subtitle")}</p>
            </div>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label={t("team.profile.close")}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="dialog-scroll-area flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("team.profile.loading")}
            </p>
          ) : error || !profile ? (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{t("team.profile.loadError")}</p>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="action-button"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="app-action-card p-3">
                  <p className="text-2xl font-bold tabular-nums">{profile.visits}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.visits === 1
                      ? t("team.profile.visitOne")
                      : t("team.profile.visitMany")}
                  </p>
                </div>
                <div className="app-action-card p-3">
                  <p className="text-2xl font-bold tabular-nums">
                    {formatBRL(profile.total_spent_cents, intlLocale)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("team.profile.totalSpent")}</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  {t("team.profile.firstVisit", {
                    date: formatDate(profile.first_visit, intlLocale),
                  })}
                </span>
                <span>
                  {t("team.profile.lastVisit", {
                    date: formatDate(profile.last_visit, intlLocale),
                  })}
                </span>
              </div>

              <RhythmDashboard
                rhythm={profile.rhythm}
                title={t("team.profile.rhythmTitle")}
                dayLabel={t("team.profile.rhythmDay")}
              />

              <section className="space-y-2">
                <h3 className="text-sm font-bold">{t("team.profile.history")}</h3>
                {profile.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("team.profile.historyEmpty")}</p>
                ) : (
                  profile.history.map((row) => (
                    <div
                      key={row.appointment_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.service_name ?? t("team.partner.serviceFallback")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(row.starts_at, intlLocale)}
                          {row.staff_name ? ` · ${row.staff_name}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`status-pill status-${row.status}`}>
                          {STATUS_KEY[row.status] ? t(STATUS_KEY[row.status]) : row.status}
                        </span>
                        <span className="text-xs font-bold tabular-nums">
                          {formatBRL(row.amount_cents, intlLocale)}
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
