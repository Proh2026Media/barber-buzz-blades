import { useId, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserX,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChoiceChips,
  DataList,
  EmptyState,
  LoadingState,
  StatusBadge,
  type DataListColumn,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useDevice, useViewportAtLeast } from "@/lib/device";
import { useStickyWhenFits } from "@/lib/use-sticky-when-fits";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShopDetail, type ShopModule } from "./ShopDetail";
import { ShopLogo, type ShopLogoInfo } from "./ShopLogo";
import {
  SHOP_STATUS,
  activeShopsWithoutAdmin,
  countByShop,
  countsFor,
  type MembershipRow,
  type ShopOwnerRow,
} from "./shopStats";
import type { ShopFilter } from "./tabs";

/** Ficha ao lado da lista a partir de 1024 px; abaixo disso, numa janela. */
function useWideLayout() {
  return useViewportAtLeast(1024);
}

type ShopRow = {
  shop: Tables<"barbershops">;
  customers: number;
  admins: number;
  noAdmin: boolean;
};

type ShopsPanelProps = {
  shops: Tables<"barbershops">[];
  memberships: MembershipRow[];
  /** Donos e sócios ativos de cada loja; nulo = banco sem a lista (conta pelo papel antigo). */
  owners?: ShopOwnerRow[] | null;
  loading: boolean;
  /** A última leitura falhou: sem barbearias na tela, mostra o erro no lugar do vazio. */
  loadError?: string | null;
  onRetry?: () => void;
  sportsModules: Record<string, boolean>;
  loyaltyModules: Record<string, boolean>;
  /** Logo e fundo da marca de cada loja (sem logo: iniciais). */
  logos?: Record<string, ShopLogoInfo>;
  demoMode?: boolean;
  filter: ShopFilter;
  onFilterChange: (filter: ShopFilter) => void;
  selectedId: string | null;
  onSelect: (shopId: string | null) => void;
  /** Barbearia recém-criada: fica realçada por alguns segundos. */
  highlightId?: string | null;
  onNewShop: () => void;
  onSetModule: (shopId: string, module: ShopModule, enabled: boolean) => Promise<void>;
  onCustomize: (shop: Tables<"barbershops">) => void;
  onToggleStatus: (shop: Tables<"barbershops">) => Promise<void>;
  onAddPerson: (shopId: string) => void;
  onPermissions: (shopId: string) => void;
  onTestAs: (shopId: string) => void;
  /** Muda depois de adicionar alguém: a ficha recarrega a equipe. */
  teamRevision?: number;
};

/**
 * Aba Barbearias: lista compacta (situação + números com ícone) e a ficha de cada barbearia.
 * Filtros em pílulas com contagem; "Nova barbearia" no topo.
 */
export function ShopsPanel({
  shops,
  memberships,
  owners = null,
  loading,
  loadError = null,
  onRetry,
  sportsModules,
  loyaltyModules,
  logos = {},
  demoMode = false,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  highlightId,
  onNewShop,
  onSetModule,
  onCustomize,
  onToggleStatus,
  onAddPerson,
  onPermissions,
  onTestAs,
  teamRevision = 0,
}: ShopsPanelProps) {
  const { t, intlLocale } = useI18n();
  const wide = useWideLayout();
  // No computador (≥ 1280) a lista vira tabela (DataList); no tablet deitado continua a lista
  // de cartões ao lado da ficha; no tablet em pé e no celular, lista e ficha em janela.
  const device = useDevice();
  const table = device === "computador";
  const headingId = useId();
  // A ficha ao lado da lista só fica fixa quando cabe inteira na altura; se não cabe, rola com
  // a página (antes rolava por dentro, sem barra visível no Mac, e escondia o fim da ficha).
  const asideRef = useRef<HTMLElement>(null);
  const asideTop = useStickyWhenFits(asideRef);
  const [search, setSearch] = useState("");
  const counts = useMemo(() => countByShop(memberships, owners), [memberships, owners]);
  const withoutAdmin = useMemo(
    () => new Set(activeShopsWithoutAdmin(shops, counts).map((shop) => shop.id)),
    [shops, counts],
  );

  const totals = {
    all: shops.length,
    active: shops.filter((shop) => shop.status === "active").length,
    suspended: shops.filter((shop) => shop.status === "suspended").length,
    noAdmin: withoutAdmin.size,
  };

  const normalizedSearch = search.trim().toLocaleLowerCase(intlLocale);
  const filtered = shops.filter((shop) => {
    const byFilter =
      filter === "all" ||
      (filter === "noAdmin" ? withoutAdmin.has(shop.id) : shop.status === filter);
    return (
      byFilter &&
      `${shop.name} ${shop.slug}`.toLocaleLowerCase(intlLocale).includes(normalizedSearch)
    );
  });
  const selected = shops.find((shop) => shop.id === selectedId) ?? null;

  // "Sem administrador" é um alerta: vem logo depois de "Todas", sempre à vista.
  const filterOptions = [
    { value: "all" as const, label: t("plat.shops.all"), count: totals.all, icon: Store },
    ...(totals.noAdmin > 0 || filter === "noAdmin"
      ? [
          {
            value: "noAdmin" as const,
            label: t("plat.shops.filterNoAdmin"),
            count: totals.noAdmin,
            icon: UserX,
          },
        ]
      : []),
    {
      value: "active" as const,
      label: t("plat.shops.filterActive"),
      count: totals.active,
      icon: SHOP_STATUS.active.icon,
    },
    {
      value: "suspended" as const,
      label: t("plat.shops.filterSuspended"),
      count: totals.suspended,
      icon: SHOP_STATUS.suspended.icon,
    },
  ];

  const detail = selected ? (
    <ShopDetail
      key={selected.id}
      shop={selected}
      shops={shops}
      counts={countsFor(counts, selected.id)}
      sports={sportsModules[selected.id] ?? false}
      loyalty={loyaltyModules[selected.id] ?? false}
      logo={logos[selected.id] ?? null}
      demoMode={demoMode}
      headingId={headingId}
      onSetModule={(module, enabled) => onSetModule(selected.id, module, enabled)}
      onCustomize={() => onCustomize(selected)}
      onToggleStatus={() => onToggleStatus(selected)}
      onAddPerson={() => onAddPerson(selected.id)}
      onPermissions={() => onPermissions(selected.id)}
      onTestAs={() => onTestAs(selected.id)}
      teamRevision={teamRevision}
    />
  ) : null;

  // No título, abaixo de 359 px, fica só o "+" (o nome segue para o leitor de tela): com o
  // nome, o botão encostava no título. No estado vazio, sempre com o nome.
  const newShopButton = (compact = false) => (
    <button
      type="button"
      onClick={onNewShop}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground",
        compact && "max-[359px]:w-11 max-[359px]:justify-center max-[359px]:px-0",
      )}
    >
      <Plus className="size-4" aria-hidden />
      <span className={compact ? "max-[359px]:sr-only" : undefined}>{t("plat.newShop.title")}</span>
    </button>
  );

  const tools = shops.length > 0 && !loading && !(shops.length === 0 && loadError) && (
    <div className="plat-shops-tools grid gap-3">
      <label className="plat-shops-search relative block">
        <span className="sr-only">{t("plat.shops.search")}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("plat.shops.search")}
          className="min-h-11 w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm"
        />
      </label>
      <ChoiceChips
        label={t("plat.shops.filterAria")}
        hideLabel
        value={filter}
        onChange={onFilterChange}
        options={filterOptions}
      />
    </div>
  );

  const tableRows: ShopRow[] = filtered.map((shop) => {
    const shopCounts = countsFor(counts, shop.id);
    return {
      shop,
      customers: shopCounts.customers,
      admins: shopCounts.admins,
      noAdmin: withoutAdmin.has(shop.id),
    };
  });
  const dateOf = (value: string) =>
    new Date(value).toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const tableColumns: DataListColumn<ShopRow>[] = [
    {
      key: "name",
      sortValue: (row) => row.shop.name,
      header: t("plat.common.shop"),
      cell: (row) => (
        <span
          className="flex min-w-0 items-center gap-3"
          data-selected={selectedId === row.shop.id ? "true" : undefined}
        >
          <ShopLogo name={row.shop.name} seed={row.shop.id} logo={logos[row.shop.id]} />
          <span className="min-w-0">
            <span className="block font-bold leading-snug [overflow-wrap:anywhere]">
              {row.shop.name}
            </span>
            <span className="block truncate text-xs font-medium text-muted-foreground">
              {row.shop.slug}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: "status",
      sortValue: (row) =>
        t(row.shop.status === "active" ? "plat.shops.active" : "plat.shops.suspended"),
      header: t("plat.shops.colStatus"),
      width: "7rem",
      cell: (row) => {
        const status = SHOP_STATUS[row.shop.status];
        return (
          <StatusBadge
            tone={status.tone}
            icon={status.icon}
            label={
              row.shop.status === "active" ? t("plat.shops.active") : t("plat.shops.suspended")
            }
            size="sm"
          />
        );
      },
    },
    {
      key: "customers",
      sortValue: (row) => row.customers,
      header: t("plat.dash.customers"),
      width: "5.5rem",
      align: "end",
      cell: (row) => (
        <span className="tabular-nums">{row.customers.toLocaleString(intlLocale)}</span>
      ),
    },
    {
      key: "admins",
      sortValue: (row) => row.admins,
      header: t("plat.dash.admins"),
      width: "7.25rem",
      cell: (row) =>
        // Sem administrador: número em alerta (o nome completo vai para o leitor de tela; a
        // ficha e o filtro "Sem administrador" mostram o aviso por extenso).
        row.noAdmin ? (
          <span
            className="inline-flex items-center gap-1 font-semibold tabular-nums text-[color:var(--tone-warning-ink)]"
            title={t("plat.shops.noAdmin")}
          >
            <UserX className="size-3.5" aria-hidden />
            <span aria-hidden>0</span>
            <span className="sr-only">{t("plat.shops.noAdmin")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ShieldCheck className="size-3.5 text-gold" aria-hidden />
            {row.admins}
          </span>
        ),
    },
    {
      key: "created",
      sortValue: (row) => Date.parse(row.shop.created_at),
      header: t("plat.shops.colCreated"),
      width: "6.5rem",
      cell: (row) => <span className="tabular-nums">{dateOf(row.shop.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Título de página no padrão do app (ícone dourado solto + h2), com a ação ao lado. A
          partir de 768 px a busca e os filtros entram na mesma linha (CSS em plataforma.css). */}
      <div className="plat-shops-head grid gap-4">
        <div className="plat-shops-title app-section-title flex-wrap">
          <Store aria-hidden />
          {/* Sem min-w-0: com fonte grande, o botão desce para a linha de baixo em vez de cobrir. */}
          <h2 className="flex-1">{t("plat.shops.title")}</h2>
          {shops.length > 0 && newShopButton(true)}
        </div>
        {tools}
      </div>

      {loading ? (
        <LoadingState variant="list" count={4} label={t("plat.shops.loading")} />
      ) : shops.length === 0 && loadError ? (
        <EmptyState
          status="danger"
          title={t("plat.dash.loadErrorTitle")}
          description={loadError}
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("visual.retry")}
              </button>
            ) : undefined
          }
        />
      ) : shops.length === 0 ? (
        <EmptyState
          tone="store"
          title={t("plat.dash.emptyTitle")}
          description={t("plat.dash.emptyBody")}
          action={newShopButton()}
        />
      ) : (
        <>
          <div
            className={cn(
              "grid gap-4 lg:items-start",
              table
                ? "plat-shops-split pc:grid-cols-[minmax(0,1fr)_minmax(20rem,0.6fr)]"
                : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
            )}
          >
            {filtered.length === 0 ? (
              <EmptyState
                tone="search"
                variant="plain"
                title={t("plat.shops.noMatch")}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      onFilterChange("all");
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
                  >
                    <LayoutList className="size-4 text-gold" aria-hidden />
                    {t("plat.shops.showAll")}
                  </button>
                }
              />
            ) : table ? (
              <DataList
                className="plat-shops-table"
                rows={tableRows}
                rowKey={(row) => row.shop.id}
                columns={tableColumns}
                onRowClick={(row) => onSelect(row.shop.id)}
                rowLabel={(row) => row.shop.name}
              />
            ) : (
              <ul className="space-y-2" aria-label={t("plat.shops.title")}>
                {filtered.map((shop) => {
                  const shopCounts = countsFor(counts, shop.id);
                  const status = SHOP_STATUS[shop.status];
                  const isSelected = wide && selectedId === shop.id;
                  const noAdmin = withoutAdmin.has(shop.id);
                  return (
                    <li key={shop.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(shop.id)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-3 py-3 text-left transition hover:border-primary/40",
                          isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
                          highlightId === shop.id && "ring-4 ring-[color:var(--tone-success-line)]",
                        )}
                      >
                        <ShopLogo name={shop.name} seed={shop.id} logo={logos[shop.id]} />
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block break-words text-sm font-bold leading-snug">
                            {shop.name}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                            <StatusBadge
                              tone={status.tone}
                              icon={status.icon}
                              label={
                                shop.status === "active"
                                  ? t("plat.shops.active")
                                  : t("plat.shops.suspended")
                              }
                              size="sm"
                            />
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Users className="size-3.5 text-gold" aria-hidden />
                              {t(
                                shopCounts.customers === 1
                                  ? "plat.shops.customerOne"
                                  : "plat.shops.customerMany",
                                { count: shopCounts.customers.toLocaleString(intlLocale) },
                              )}
                            </span>
                            {noAdmin ? (
                              <StatusBadge
                                tone="warning"
                                icon={UserX}
                                label={t("plat.shops.noAdmin")}
                                size="sm"
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <ShieldCheck className="size-3.5 text-gold" aria-hidden />
                                {t(
                                  shopCounts.admins === 1
                                    ? "plat.shops.adminOne"
                                    : "plat.shops.adminMany",
                                  { count: shopCounts.admins },
                                )}
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {wide && (
              <aside
                ref={asideRef}
                aria-labelledby={selected ? headingId : undefined}
                className="plat-shop-aside rounded-3xl border border-border bg-card p-5"
                style={asideTop !== null ? { position: "sticky", top: asideTop } : undefined}
              >
                {detail ?? (
                  <EmptyState
                    tone="store"
                    variant="plain"
                    // No computador se clica, não se toca.
                    title={t(table ? "plat.shops.pickOnePointer" : "plat.shops.pickOne")}
                  />
                )}
              </aside>
            )}
          </div>
        </>
      )}

      {!wide && (
        <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && onSelect(null)}>
          {device === "celular" ? (
            <DialogContent
              aria-describedby={undefined}
              className="bottom-0 top-auto max-h-[92dvh] w-full max-w-lg translate-y-0 gap-0 overflow-hidden rounded-t-3xl rounded-b-none border-border bg-card p-0 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-3xl"
            >
              <DialogTitle className="flex min-h-14 items-center gap-2 border-b border-border px-5 pr-14 text-base font-bold">
                <Store className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="truncate">{t("plat.shops.sheetTitle")}</span>
              </DialogTitle>
              <div className="max-h-[calc(92dvh-3.5rem)] overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {detail}
              </div>
            </DialogContent>
          ) : (
            // Tablet em pé (768–1023): janela centrada, larga, com a ficha em blocos.
            <DialogContent size="lg" aria-describedby={undefined} className="bg-card">
              <DialogHeader>
                <DialogTitle className="flex min-h-11 items-center gap-2 pr-12 text-lg font-bold">
                  <Store className="size-5 shrink-0 text-gold" aria-hidden />
                  <span className="truncate">{t("plat.shops.sheetTitle")}</span>
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="plat-shop-aside pb-2">{detail}</DialogBody>
            </DialogContent>
          )}
        </Dialog>
      )}
    </div>
  );
}
