import { useEffect, useId, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ChoiceChips,
  EmptyState,
  LoadingState,
  PersonAvatar,
  StatusBadge,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ShopDetail, type ShopModule } from "./ShopDetail";
import {
  SHOP_STATUS,
  activeShopsWithoutAdmin,
  countByShop,
  countsFor,
  type MembershipRow,
} from "./shopStats";
import type { ShopFilter } from "./tabs";

/** Ficha ao lado da lista a partir de 1024 px; abaixo disso, numa folha. */
function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

type ShopsPanelProps = {
  shops: Tables<"barbershops">[];
  memberships: MembershipRow[];
  loading: boolean;
  /** A última leitura falhou: sem barbearias na tela, mostra o erro no lugar do vazio. */
  loadError?: string | null;
  onRetry?: () => void;
  sportsModules: Record<string, boolean>;
  loyaltyModules: Record<string, boolean>;
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
  loading,
  loadError = null,
  onRetry,
  sportsModules,
  loyaltyModules,
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
  const headingId = useId();
  const [search, setSearch] = useState("");
  const counts = useMemo(() => countByShop(memberships), [memberships]);
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

  const newShopButton = (
    <button
      type="button"
      onClick={onNewShop}
      className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
    >
      <Plus className="size-4" aria-hidden />
      {t("plat.newShop.title")}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Título de página no padrão do app (ícone dourado solto + h2), com a ação ao lado. */}
      <div className="app-section-title flex-wrap">
        <Store aria-hidden />
        <h2 className="min-w-0 flex-1">{t("plat.shops.title")}</h2>
        {shops.length > 0 && newShopButton}
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
          action={newShopButton}
        />
      ) : (
        <>
          <div className="space-y-3">
            <label className="relative block">
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
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
                        <PersonAvatar name={shop.name} size="sm" seed={shop.id} />
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
                aria-labelledby={selected ? headingId : undefined}
                className="rounded-3xl border border-border bg-card p-5 lg:sticky lg:top-0"
              >
                {detail ?? (
                  <EmptyState tone="store" variant="plain" title={t("plat.shops.pickOne")} />
                )}
              </aside>
            )}
          </div>
        </>
      )}

      {!wide && (
        <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && onSelect(null)}>
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
        </Dialog>
      )}
    </div>
  );
}
