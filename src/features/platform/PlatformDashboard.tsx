import { useMemo } from "react";
import {
  CalendarClock,
  ChevronRight,
  Gauge,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Trophy,
  Users,
} from "lucide-react";
import {
  EmptyState,
  Hint,
  LoadingState,
  SectionHeader,
  SegmentBar,
  StatTile,
  StatusBadge,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import {
  SHOP_STATUS,
  activeShopsWithoutAdmin,
  countByShop,
  countsFor,
  historyMonths,
  shopsCreatedByMonth,
  uniquePeople,
  type MembershipRow,
} from "./shopStats";
import type { ShopFilter } from "./tabs";

type PlatformDashboardProps = {
  shops: Tables<"barbershops">[];
  memberships: MembershipRow[];
  loading?: boolean;
  /** A última leitura falhou (texto amigável). Sem barbearias na tela, vira o erro no lugar do vazio. */
  loadError?: string | null;
  onRetry?: () => void;
  /** Hora da última leitura dos dados (para "Atualizado às 14:32"). */
  updatedAt?: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Abre a aba Barbearias já filtrada. */
  onOpenShops?: (filter: ShopFilter) => void;
  /** Abre a ficha de uma barbearia. */
  onOpenShop?: (shopId: string) => void;
  onCreateShop?: () => void;
};

/**
 * Visão geral da plataforma: números com ícone (cada um leva à lista filtrada), a divisão
 * ativas × suspensas, o ranking com o nome inteiro e o crescimento real por mês.
 * Nada de série inventada: sem dado, aparece esqueleto (carregando) ou um vazio honesto.
 */
export function PlatformDashboard({
  shops,
  memberships,
  loading = false,
  loadError = null,
  onRetry,
  updatedAt,
  refreshing = false,
  onRefresh,
  onOpenShops,
  onOpenShop,
  onCreateShop,
}: PlatformDashboardProps) {
  const { t, intlLocale } = useI18n();

  const stats = useMemo(() => {
    const counts = countByShop(memberships);
    const active = shops.filter((shop) => shop.status === "active").length;
    const suspended = shops.length - active;
    const customerLinks = memberships.filter((row) => row.role === "customer").length;
    const ranking = shops
      .map((shop) => ({ shop, ...countsFor(counts, shop.id) }))
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 6);
    return {
      active,
      suspended,
      customers: uniquePeople(memberships, "customer"),
      admins: uniquePeople(memberships, "shop_admin"),
      withoutAdmin: activeShopsWithoutAdmin(shops, counts).length,
      avgCustomers: shops.length ? Math.round(customerLinks / shops.length) : 0,
      ranking,
      topCustomers: Math.max(1, ...ranking.map((row) => row.customers)),
      months: shopsCreatedByMonth(shops),
      history: historyMonths(shops),
    };
  }, [shops, memberships]);

  // Depois de uma falha, nunca fica "Carregando…" parado: diz que não está atualizado.
  const updatedLabel = loading
    ? t("plat.dash.loading")
    : updatedAt
      ? t("plat.dash.updatedAt", {
          time: updatedAt.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" }),
        })
      : loadError
        ? t("plat.dash.notUpdated")
        : undefined;
  const header = (
    <SectionHeader
      as="h3"
      icon={Gauge}
      title={t("plat.dash.heading")}
      description={updatedLabel}
      aside={
        onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || loading}
            aria-label={t("plat.dash.refresh")}
            title={t("plat.dash.refresh")}
            className="app-icon-button disabled:opacity-60"
          >
            <RefreshCw
              className={`size-5 ${refreshing ? "motion-safe:animate-spin" : ""}`}
              aria-hidden
            />
          </button>
        ) : null
      }
    />
  );

  // Falhou e não há nada na tela: é erro, não "nenhuma barbearia" (evita criar uma duplicada).
  if (!loading && shops.length === 0 && loadError) {
    return (
      <section className="space-y-4" aria-label={t("plat.dash.aria")}>
        {header}
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
      </section>
    );
  }

  if (!loading && shops.length === 0) {
    return (
      <section className="space-y-4" aria-label={t("plat.dash.aria")}>
        {header}
        <EmptyState
          tone="store"
          title={t("plat.dash.emptyTitle")}
          description={t("plat.dash.emptyBody")}
          action={
            onCreateShop ? (
              <button
                type="button"
                onClick={onCreateShop}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="size-4" aria-hidden />
                {t("plat.newShop.submit")}
              </button>
            ) : undefined
          }
        />
      </section>
    );
  }

  const suspendedMeta = SHOP_STATUS.suspended;
  const activeMeta = SHOP_STATUS.active;
  // Sem crescimento para mostrar, o cartão do mês é só uma linha: o ranking ocupa a largura
  // toda (em duas colunas no computador) e o mês desce, sem deixar um vazio ao lado.
  const growthEmpty = stats.history < 1 || stats.months.every((item) => item.count === 0);
  const wideRanking = !loading && growthEmpty;

  return (
    <section className="space-y-4" aria-label={t("plat.dash.aria")}>
      {header}

      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        role="group"
        aria-label={t("plat.dash.metricsAria")}
      >
        <StatTile
          icon={Store}
          label={t("plat.dash.active")}
          value={loading ? undefined : stats.active}
          hint={t("plat.dash.ofTotal", { count: stats.active, total: shops.length })}
          loading={loading}
          onClick={onOpenShops ? () => onOpenShops("active") : undefined}
        />
        <StatTile
          icon={suspendedMeta.icon}
          tone={stats.suspended > 0 ? suspendedMeta.tone : undefined}
          label={t("plat.dash.suspended")}
          value={loading ? undefined : stats.suspended}
          hint={stats.suspended === 0 ? t("plat.dash.noneOffline") : t("plat.dash.offline")}
          loading={loading}
          onClick={onOpenShops ? () => onOpenShops("suspended") : undefined}
        />
        <StatTile
          icon={Users}
          label={t("plat.dash.customers")}
          value={loading ? undefined : stats.customers.toLocaleString(intlLocale)}
          hint={t("plat.dash.avg", { avg: stats.avgCustomers.toLocaleString(intlLocale) })}
          loading={loading}
          onClick={onOpenShops ? () => onOpenShops("all") : undefined}
        />
        <StatTile
          icon={ShieldCheck}
          tone={stats.withoutAdmin > 0 ? "warning" : undefined}
          label={t("plat.dash.admins")}
          value={loading ? undefined : stats.admins}
          hint={
            stats.withoutAdmin > 0
              ? t("plat.dash.noAdmin", { count: stats.withoutAdmin })
              : t("plat.dash.allAdmins")
          }
          loading={loading}
          onClick={
            onOpenShops ? () => onOpenShops(stats.withoutAdmin > 0 ? "noAdmin" : "all") : undefined
          }
        />
      </div>

      {!loading && (
        <div className="app-action-card p-4">
          <SegmentBar
            summary={t("plat.dash.split", { active: stats.active, suspended: stats.suspended })}
            showSummary
            legend
            segments={[
              {
                key: "active",
                label: t("plat.dash.active"),
                value: stats.active,
                tone: activeMeta.tone,
                icon: activeMeta.icon,
              },
              {
                key: "suspended",
                label: t("plat.dash.suspended"),
                value: stats.suspended,
                tone: suspendedMeta.tone,
                icon: suspendedMeta.icon,
              },
            ]}
          />
        </div>
      )}

      <div className={`grid gap-4 ${wideRanking ? "" : "lg:grid-cols-2 lg:items-start"}`}>
        <article className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
          <SectionHeader
            icon={Trophy}
            title={t("plat.dash.topTitle")}
            description={t("plat.dash.topTap")}
          />
          {loading ? (
            <LoadingState variant="list" count={3} hideLabel />
          ) : (
            <ol className={`space-y-1 ${wideRanking ? "lg:columns-2 lg:gap-x-6" : ""}`}>
              {stats.ranking.map((row, index) => {
                const width = Math.round((row.customers / stats.topCustomers) * 100);
                const suspended = row.shop.status === "suspended";
                return (
                  <li key={row.shop.id} className="break-inside-avoid">
                    <button
                      type="button"
                      onClick={() => onOpenShop?.(row.shop.id)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-muted/50"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold tabular-nums">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 break-words text-sm font-semibold">
                            {row.shop.name}
                          </span>
                          {suspended && (
                            <StatusBadge
                              tone={suspendedMeta.tone}
                              icon={suspendedMeta.icon}
                              label={t("plat.shops.suspended")}
                              size="sm"
                            />
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(width, row.customers > 0 ? 4 : 0)}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {t(
                              row.customers === 1
                                ? "plat.shops.customerOne"
                                : "plat.shops.customerMany",
                              { count: row.customers.toLocaleString(intlLocale) },
                            )}
                          </span>
                        </span>
                        <span
                          className={`block text-xs font-semibold ${
                            row.admins === 0
                              ? "text-[color:var(--tone-warning-ink)]"
                              : "text-muted-foreground"
                          }`}
                        >
                          {row.admins === 0
                            ? t("plat.shops.noAdmin")
                            : t(row.admins === 1 ? "plat.shops.adminOne" : "plat.shops.adminMany", {
                                count: row.admins,
                              })}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
          <SectionHeader icon={CalendarClock} title={t("plat.dash.growthTitle")} />
          {loading ? (
            <LoadingState variant="stats" count={1} hideLabel />
          ) : stats.history < 1 ? (
            <Hint icon={CalendarClock} tone="muted">
              {t("plat.dash.growthEmpty")}
            </Hint>
          ) : stats.months.every((item) => item.count === 0) ? (
            <Hint icon={CalendarClock} tone="muted">
              {t("plat.dash.growthNone")}
            </Hint>
          ) : (
            <GrowthColumns months={stats.months} locale={intlLocale} />
          )}
        </article>
      </div>
    </section>
  );
}

/** Colunas simples: o número em cima, o mês embaixo. Também é a alternativa em texto. */
function GrowthColumns({
  months,
  locale,
}: {
  months: ReturnType<typeof shopsCreatedByMonth>;
  locale: string;
}) {
  const { t } = useI18n();
  const max = Math.max(1, ...months.map((item) => item.count));
  return (
    <ul className="grid h-40 grid-cols-6 items-end gap-2" aria-label={t("plat.dash.growthTitle")}>
      {months.map((item) => {
        const month = item.date.toLocaleDateString(locale, { month: "short" }).replace(".", "");
        const height = Math.round((item.count / max) * 100);
        return (
          <li
            key={`${item.year}-${item.month}`}
            className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
            aria-label={t("plat.dash.growthItem", { month, count: item.count })}
          >
            <span aria-hidden className="text-xs font-bold tabular-nums">
              {item.count}
            </span>
            <span
              aria-hidden
              className={`w-full max-w-10 rounded-t-xl ${item.count > 0 ? "bg-primary" : "bg-muted"}`}
              style={{ height: item.count > 0 ? `${Math.max(height, 8)}%` : "4px" }}
            />
            <span aria-hidden className="text-xs font-semibold capitalize text-muted-foreground">
              {month}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
