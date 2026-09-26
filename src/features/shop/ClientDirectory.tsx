import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { ClientProfileModal } from "./ClientProfileModal";
import { ClientNoticeBell } from "./ClientNoticeBell";
import { useI18n } from "@/lib/i18n";

type ClientRow = {
  customer_id: string;
  customer_name: string | null;
  visits: number;
  total_spent_cents: number;
  last_visit: string;
};

const PAGE_SIZE = 25;

function formatBRL(cents: number, intlLocale: string) {
  return (cents / 100).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
}

/**
 * Diretório de clientes em seção expansível (fechada por padrão) com carregamento
 * progressivo de 25 em 25 clientes, por botão "Carregar mais" ou por rolagem.
 * Cada cartão é inteiramente clicável e abre o perfil/histórico do cliente.
 */
export function ClientDirectory({
  shopId,
  staffId,
  scope,
  title,
}: {
  shopId: string;
  staffId?: string | null;
  scope: "own" | "shop";
  title: string;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (demo) {
      const completed = demo.appointments.filter(
        (row) => row.status === "completed" && (scope === "shop" || row.staff_id === staffId),
      );
      const byCustomer = new Map<string, { visits: number; spent: number; last: string }>();
      for (const row of completed) {
        const prev = byCustomer.get(row.customer_id) ?? { visits: 0, spent: 0, last: "" };
        byCustomer.set(row.customer_id, {
          visits: prev.visits + 1,
          spent: prev.spent + (demo.prices[row.id] ?? 0),
          last: prev.last < row.starts_at ? row.starts_at : prev.last,
        });
      }
      setClients(
        [...byCustomer.entries()]
          .map(([customer_id, value]) => ({
            customer_id,
            customer_name: demo.customers.find((c) => c.id === customer_id)?.name ?? null,
            visits: value.visits,
            total_spent_cents: value.spent,
            last_visit: value.last,
          }))
          .sort((a, b) => b.last_visit.localeCompare(a.last_visit)),
      );
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = await supabase.rpc("get_partner_clients", { p_shop_id: shopId });
        if (cancelled) return;
        if (result.error) setError(true);
        else setClients(Array.isArray(result.data) ? (result.data as ClientRow[]) : []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, shopId, staffId, scope]);

  // Carregamento infinito por rolagem: quando o sentinela aparece, libera mais 25.
  useEffect(() => {
    if (!open || visible >= clients.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((count) => Math.min(count + PAGE_SIZE, clients.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, visible, clients.length]);

  const hasMore = visible < clients.length;
  const visibleClients = clients.slice(0, visible);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-sm font-bold"
      >
        <Users className="size-4 text-gold" />
        <span className="flex-1 text-left">{title}</span>
        {!loading && (
          <span className="text-xs font-semibold text-muted-foreground">{clients.length}</span>
        )}
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("team.clients.loading")}
            </p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {t("team.clients.loadError")}
            </p>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("team.clients.empty")}</p>
          ) : (
            <>
              <div className="space-y-2">
                {visibleClients.map((client) => (
                  <div
                    key={client.customer_id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(client)}
                      aria-label={t("team.clients.openProfile", {
                        name: client.customer_name ?? t("team.clients.clientLower"),
                      })}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {client.customer_name ?? t("team.partner.clientFallback")}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t(
                            client.visits === 1
                              ? "team.clients.visitOne"
                              : "team.clients.visitMany",
                            {
                              count: client.visits,
                            },
                          )}{" "}
                          · {formatBRL(client.total_spent_cents, intlLocale)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                    <ClientNoticeBell
                      shopId={shopId}
                      customerId={client.customer_id}
                      customerName={client.customer_name}
                    />
                  </div>
                ))}
              </div>

              {/* Sentinela para o carregamento por rolagem. */}
              {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisible((count) => Math.min(count + PAGE_SIZE, clients.length))}
                  className="w-full rounded-xl border border-border p-3 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  {t("team.clients.loadMore", { count: clients.length - visible })}
                </button>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <ClientProfileModal
          shopId={shopId}
          customerId={selected.customer_id}
          customerName={selected.customer_name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
