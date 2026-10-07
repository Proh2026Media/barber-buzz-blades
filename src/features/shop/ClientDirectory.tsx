import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock3, RefreshCw, Search, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import {
  ChoiceChips,
  EmptyState,
  IconTile,
  LoadingState,
  Notice,
  PersonAvatar,
  Tag,
} from "@/components/visual";
import { ClientProfileModal } from "./ClientProfileModal";
import { ClientNoticeBell } from "./ClientNoticeBell";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ClientRow = {
  customer_id: string;
  customer_name: string | null;
  visits: number;
  total_spent_cents: number;
  last_visit: string;
};

type SortMode = "recent" | "visits" | "away";

const PAGE_SIZE = 25;

function formatBRL(cents: number, intlLocale: string) {
  return (cents / 100).toLocaleString(intlLocale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

/**
 * Clientes da barbearia (ou só os do parceiro): busca por nome, ordem em pílulas (recentes, mais
 * visitas, há mais tempo sem vir) e, em cada linha, avatar, visitas, total e "há N dias".
 * Abre recolhido; o atalho do topo da Agenda (`openOnHash`) abre direto.
 */
export function ClientDirectory({
  shopId,
  staffId,
  scope,
  title,
  openOnHash,
  defaultOpen = false,
}: {
  shopId: string;
  staffId?: string | null;
  scope: "own" | "shop";
  title: string;
  /** Abre sozinho quando a página vai para esta âncora (ex.: "agenda-extra-clients"). */
  openOnHash?: string;
  defaultOpen?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reference = demo?.now.getTime() ?? Date.now();

  useEffect(() => {
    if (!openOnHash || typeof window === "undefined") return;
    const check = () => {
      if (window.location.hash === `#${openOnHash}`) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [openOnHash]);

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
        [...byCustomer.entries()].map(([customer_id, value]) => ({
          customer_id,
          customer_name: demo.customers.find((c) => c.id === customer_id)?.name ?? null,
          visits: value.visits,
          total_spent_cents: value.spent,
          last_visit: value.last,
        })),
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
  }, [demo, shopId, staffId, scope, reloadKey]);

  const shown = useMemo(() => {
    const term = normalize(query);
    const filtered = term
      ? clients.filter((row) => normalize(row.customer_name ?? "").includes(term))
      : clients;
    const sorted = [...filtered];
    if (sort === "recent") sorted.sort((a, b) => b.last_visit.localeCompare(a.last_visit));
    if (sort === "away") sorted.sort((a, b) => a.last_visit.localeCompare(b.last_visit));
    if (sort === "visits")
      sorted.sort((a, b) => b.visits - a.visits || b.last_visit.localeCompare(a.last_visit));
    return sorted;
  }, [clients, query, sort]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, sort]);

  // Carregamento por rolagem: quando o sentinela aparece, libera mais 25.
  useEffect(() => {
    if (!open || visible >= shown.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((count) => Math.min(count + PAGE_SIZE, shown.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, visible, shown.length]);

  const relative = useMemo(
    () => new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" }),
    [intlLocale],
  );
  function since(iso: string) {
    if (!iso) return null;
    const days = Math.round((reference - new Date(iso).getTime()) / 86_400_000);
    if (days < 0) return null;
    if (days < 60) return relative.format(-days, "day");
    if (days < 365) return relative.format(-Math.round(days / 30), "month");
    return relative.format(-Math.round(days / 365), "year");
  }

  const hasMore = visible < shown.length;
  const visibleClients = shown.slice(0, visible);
  const countLabel = loading
    ? null
    : error
      ? "—"
      : clients.length === 1
        ? t("team.clients.countOne")
        : t("team.clients.countMany", { count: clients.length });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 50);
        }}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl text-left"
      >
        <IconTile icon={Users} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{title}</span>
          {countLabel && <span className="block text-xs text-muted-foreground">{countLabel}</span>}
        </span>
        {!open && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Search className="size-3.5" aria-hidden />
            {t("team.clients.search")}
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {loading ? (
            <LoadingState label={t("team.clients.loading")} variant="list" count={4} />
          ) : error ? (
            <Notice
              tone="danger"
              title={t("team.clients.loadError")}
              action={{
                label: t("common.retry"),
                onClick: () => setReloadKey((key) => key + 1),
                icon: RefreshCw,
              }}
            />
          ) : clients.length === 0 ? (
            <EmptyState
              tone="people"
              variant="plain"
              title={t("team.clients.empty")}
              description={t("team.clients.emptyHint")}
            />
          ) : (
            <>
              <label className="relative block">
                <span className="sr-only">{t("team.clients.searchLabel")}</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("team.clients.searchLabel")}
                  className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm"
                />
              </label>
              <ChoiceChips
                label={t("team.clients.sortLabel")}
                hideLabel
                value={sort}
                onChange={setSort}
                options={[
                  { value: "recent", label: t("team.clients.sortRecent") },
                  { value: "visits", label: t("team.clients.sortVisits") },
                  { value: "away", label: t("team.clients.sortAway") },
                ]}
              />
              {query.trim() && (
                <p role="status" className="flex items-center gap-2 text-sm font-semibold">
                  {t("brand.catalog.results", { visible: shown.length, total: clients.length })}
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-muted-foreground"
                  >
                    <X className="size-4" aria-hidden /> {t("brand.catalog.clear")}
                  </button>
                </p>
              )}
              {shown.length === 0 ? (
                <EmptyState
                  tone="search"
                  variant="plain"
                  title={t("team.clients.noMatch")}
                  action={
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
                    >
                      <X className="size-4" aria-hidden />
                      {t("catalog.clearSearch")}
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {visibleClients.map((client) => {
                    const name = client.customer_name ?? t("team.partner.clientFallback");
                    const ago = since(client.last_visit);
                    return (
                      <li
                        key={client.customer_id}
                        className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2"
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(client)}
                          aria-label={t("team.clients.openProfile", {
                            name: client.customer_name ?? t("team.clients.clientLower"),
                          })}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-muted/40"
                        >
                          <PersonAvatar
                            name={name.replace(/\([^)]*\)/g, "").trim() || name}
                            seed={client.customer_id}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="line-clamp-2 block break-words text-sm font-semibold">
                              {name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {scope === "own"
                                  ? t(
                                      client.visits === 1
                                        ? "team.clients.withYouOne"
                                        : "team.clients.withYouMany",
                                      { count: client.visits },
                                    )
                                  : t(
                                      client.visits === 1
                                        ? "team.clients.visitOne"
                                        : "team.clients.visitMany",
                                      { count: client.visits },
                                    )}{" "}
                                · {formatBRL(client.total_spent_cents, intlLocale)}
                              </span>
                              {ago && <Tag icon={Clock3}>{ago}</Tag>}
                            </span>
                          </span>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                        <ClientNoticeBell
                          shopId={shopId}
                          customerId={client.customer_id}
                          customerName={client.customer_name}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden />}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisible((count) => Math.min(count + PAGE_SIZE, shown.length))}
                  className="min-h-11 w-full rounded-xl border border-border p-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  {t("team.clients.loadMore", { count: shown.length - visible })}
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
          ownVisits={scope === "own" ? selected.visits : undefined}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
