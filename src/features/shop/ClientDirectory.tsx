import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  ContactRound,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import {
  ChoiceChips,
  DataList,
  EmptyState,
  IconTile,
  LoadingState,
  Notice,
  PersonAvatar,
  Tag,
  type DataListColumn,
} from "@/components/visual";
import { ClientProfileModal } from "./ClientProfileModal";
import { ClientNoticeBell } from "./ClientNoticeBell";
import { clientDisplay } from "./clients/model";
import { useViewportAtLeast } from "@/lib/device";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ClientRow = {
  /** Nulo: cliente do balcão (sem conta) ou conta excluída. */
  customer_id: string | null;
  customer_name: string | null;
  visits: number;
  total_spent_cents: number;
  last_visit: string;
  /** Migration 20261016130000 (ausentes antes dela): ficha do balcão, apelido e se tem conta. */
  shop_client_id?: string | null;
  nickname?: string | null;
  has_account?: boolean;
};

/** Chave estável da linha: a conta ou a ficha do balcão. */
const rowKey = (row: ClientRow) =>
  row.customer_id ?? (row.shop_client_id ? `sc:${row.shop_client_id}` : "sem-conta");

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
 * Abre recolhido; o atalho do topo da Agenda (`openOnHash`) abre direto. Com `embedded` (janela
 * que já tem título e X), é só a lista, sempre aberta.
 */
export function ClientDirectory({
  shopId,
  staffId,
  scope,
  title,
  openOnHash,
  defaultOpen = false,
  embedded = false,
  publicOrigin = null,
  shopName = "",
}: {
  shopId: string;
  staffId?: string | null;
  scope: "own" | "shop";
  title: string;
  /** Endereço público e nome da barbearia (convite de cadastro do cliente do balcão). */
  publicOrigin?: string | null;
  shopName?: string;
  /** Abre sozinho quando a página vai para esta âncora (ex.: "agenda-extra-clients"). */
  openOnHash?: string;
  defaultOpen?: boolean;
  /**
   * Dentro de uma janela com título próprio (atalho da Agenda no celular): sem o cabeçalho de
   * recolher (título repetido) e sempre aberta; a contagem fica logo acima da lista.
   */
  embedded?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const demo = useDemo();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  // A partir de 1024 px (computador compacto e computador) a lista da barbearia é uma tabela
  // sempre aberta, com busca e ordem na mesma linha; abaixo disso, o cartão recolhido com a
  // lista de cartões. A carteira do parceiro (scope "own") fica numa coluna de meia largura, onde
  // a tabela não cabe: continua com os cartões e o cartão recolhido.
  const wide = useViewportAtLeast(1024);
  const table = wide && scope === "shop";
  const expanded = embedded || open || table;
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
        // Sem conta (cliente do balcão) fica fora da lista de contas da demonstração.
        if (!row.customer_id) continue;
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
          nickname: demo.shopClients.find((c) => c.profile_id === customer_id)?.nickname ?? null,
          has_account: true,
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
      ? clients.filter((row) =>
          normalize(`${row.customer_name ?? ""} ${row.nickname ?? ""}`).includes(term),
        )
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
    if (!expanded || visible >= shown.length) return;
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
  }, [expanded, visible, shown.length]);

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

  const nameOf = (client: ClientRow) =>
    clientDisplay(client.customer_name, client.nickname).primary ??
    t("team.partner.clientFallback");
  const columns: DataListColumn<ClientRow>[] = [
    {
      key: "client",
      header: t("bk.client"),
      cell: (client) => {
        const shownName = clientDisplay(client.customer_name, client.nickname);
        const name = nameOf(client);
        return (
          <span className="flex min-w-0 items-center gap-3">
            <PersonAvatar
              name={name.replace(/\([^)]*\)/g, "").trim() || name}
              seed={rowKey(client)}
              size="sm"
            />
            <span className="min-w-0">
              <span className="block break-words font-semibold">
                {name}
                {shownName.secondary && (
                  <span className="ms-1.5 text-xs font-medium text-muted-foreground">
                    {shownName.secondary}
                  </span>
                )}
              </span>
              {!client.customer_id && !!client.shop_client_id && (
                <Tag icon={ContactRound}>{t("agenda.client.walkIn")}</Tag>
              )}
            </span>
          </span>
        );
      },
    },
    {
      key: "visits",
      header: t("team.clients.colVisits"),
      width: "7rem",
      align: "end",
      cell: (client) => <span className="tabular-nums">{client.visits}</span>,
    },
    {
      key: "total",
      header: t("booking.total"),
      width: "8rem",
      align: "end",
      cell: (client) => (
        <span className="tabular-nums">{formatBRL(client.total_spent_cents, intlLocale)}</span>
      ),
    },
    {
      key: "last",
      header: t("team.clients.colLast"),
      width: "10rem",
      // "há 9 dias" não quebra em duas linhas quando a tabela fica numa coluna estreita
      // (carteira do parceiro, ao lado do link de agendamento).
      cell: (client) => (
        <span className="whitespace-nowrap">{since(client.last_visit) ?? "—"}</span>
      ),
    },
    {
      key: "bell",
      header: "",
      width: "3.5rem",
      align: "end",
      cell: (client) =>
        client.customer_id ? (
          // O sino tem a própria ação: o toque nele não abre a ficha.
          <span
            className="inline-flex"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <ClientNoticeBell
              shopId={shopId}
              customerId={client.customer_id}
              customerName={client.customer_name}
            />
          </span>
        ) : null,
    },
    {
      key: "open",
      header: <span className="sr-only">{t("visual.open")}</span>,
      width: "2.5rem",
      align: "end",
      cell: () => <ChevronRight className="inline size-4 text-muted-foreground" aria-hidden />,
    },
  ];

  return (
    <div className="space-y-3">
      {!embedded && table && (
        <div className="flex min-h-12 items-center gap-3">
          <IconTile icon={Users} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{title}</span>
            {countLabel && (
              <span className="block text-xs text-muted-foreground">{countLabel}</span>
            )}
          </span>
        </div>
      )}
      {!embedded && !table && (
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            if (!open)
              window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 50);
          }}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl text-left"
        >
          <IconTile icon={Users} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{title}</span>
            {countLabel && (
              <span className="block text-xs text-muted-foreground">{countLabel}</span>
            )}
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
      )}

      {expanded && (
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
              <div className="agenda-clients-tools space-y-3">
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
                    // Curto para caber inteiro a 320 px; o leitor de tela lê o rótulo completo.
                    placeholder={t("team.clients.searchShort")}
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
              </div>
              {query.trim() ? (
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
              ) : (
                // Sem o cabeçalho, a contagem ("200 clientes") fica no lugar do resultado da busca.
                embedded &&
                countLabel && (
                  <p className="text-xs font-semibold text-muted-foreground">{countLabel}</p>
                )
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
              ) : table ? (
                <DataList
                  columns={columns}
                  rows={visibleClients}
                  rowKey={rowKey}
                  rowLabel={(client) =>
                    t("team.clients.openProfile", {
                      name: client.customer_name ?? t("team.clients.clientLower"),
                    })
                  }
                  onRowClick={setSelected}
                />
              ) : (
                <ul className="space-y-2">
                  {visibleClients.map((client) => {
                    const shownName = clientDisplay(client.customer_name, client.nickname);
                    const name = shownName.primary ?? t("team.partner.clientFallback");
                    const ago = since(client.last_visit);
                    const walkIn = !client.customer_id && !!client.shop_client_id;
                    return (
                      <li
                        key={rowKey(client)}
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
                            seed={rowKey(client)}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="line-clamp-2 block break-words text-sm font-semibold">
                              {name}
                              {shownName.secondary && (
                                <span className="ms-1.5 text-xs font-medium text-muted-foreground">
                                  {shownName.secondary}
                                </span>
                              )}
                            </span>
                            {walkIn && <Tag icon={ContactRound}>{t("agenda.client.walkIn")}</Tag>}
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
                        {client.customer_id && (
                          <ClientNoticeBell
                            shopId={shopId}
                            customerId={client.customer_id}
                            customerName={client.customer_name}
                          />
                        )}
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

      {selected && (selected.customer_id || selected.shop_client_id) && (
        <ClientProfileModal
          shopId={shopId}
          customerId={selected.customer_id}
          shopClientId={selected.customer_id ? null : (selected.shop_client_id ?? null)}
          customerName={selected.customer_name}
          ownVisits={scope === "own" ? selected.visits : undefined}
          publicOrigin={publicOrigin}
          shopName={shopName}
          onClose={() => setSelected(null)}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      )}
    </div>
  );
}
