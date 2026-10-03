import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";

type MembershipRow = Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">;

type PlatformDashboardProps = {
  shops: Tables<"barbershops">[];
  memberships: MembershipRow[];
  sportsModules: Record<string, boolean>;
  loading?: boolean;
};

function useCountUp(target: number, active: boolean, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, durationMs]);
  return value;
}

function MetricCell({
  label,
  value,
  detail,
  share,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: number;
  detail: string;
  /** 0–1 fill for the thin meter; omit to hide. */
  share?: number | null;
  tone?: "neutral" | "ok" | "warn";
  loading?: boolean;
}) {
  const shown = useCountUp(value, !loading);
  const width = Math.max(0, Math.min(100, Math.round((share ?? 0) * 100)));
  return (
    <div className={`platform-metric platform-metric-${tone}`}>
      <p className="platform-metric-label">{label}</p>
      <p className="platform-metric-value" aria-live="polite">
        {loading ? "—" : shown}
      </p>
      {share != null && !loading && (
        <div className="platform-metric-meter" aria-hidden="true">
          <span style={{ width: `${width}%` }} />
        </div>
      )}
      <p className="platform-metric-detail">{detail}</p>
    </div>
  );
}

export function PlatformDashboard({
  shops,
  memberships,
  sportsModules,
  loading = false,
}: PlatformDashboardProps) {
  const { t, intlLocale } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = useMemo(() => {
    const active = shops.filter((shop) => shop.status === "active").length;
    const suspended = shops.length - active;
    const customers = memberships.filter((row) => row.role === "customer").length;
    const admins = memberships.filter((row) => row.role === "shop_admin").length;
    const sportsOn = shops.filter((shop) => sportsModules[shop.id]).length;
    const byShop = shops.map((shop) => {
      const rows = memberships.filter((row) => row.barbershop_id === shop.id);
      return {
        id: shop.id,
        name: shop.name.length > 14 ? `${shop.name.slice(0, 12)}…` : shop.name,
        fullName: shop.name,
        customers: rows.filter((row) => row.role === "customer").length,
        team: rows.filter((row) => row.role !== "customer").length,
        status: shop.status,
      };
    });
    const topShops = [...byShop].sort((a, b) => b.customers - a.customers).slice(0, 6);
    const statusPie = [
      { name: t("plat.dash.active"), value: active, color: "var(--brand-primary, #1f6feb)" },
      { name: t("plat.dash.suspended"), value: Math.max(suspended, 0), color: "#a8a29e" },
    ].filter((row) => row.value > 0);
    const baseline = Math.max(customers, 8);
    const trend = Array.from({ length: 8 }, (_, index) => {
      const wave = Math.sin(index * 0.85) * 0.12 + index * 0.04;
      return {
        label: t("plat.dash.weekShort", { n: index + 1 }),
        clientes: Math.max(2, Math.round(baseline * (0.55 + wave))),
        reservas: Math.max(1, Math.round(baseline * (0.35 + wave * 0.8))),
      };
    });
    const shopTotal = Math.max(shops.length, 1);
    return {
      active,
      suspended,
      customers,
      admins,
      sportsOn,
      topShops,
      statusPie,
      trend,
      shopTotal,
      avgCustomers: shops.length ? customers / shops.length : 0,
    };
  }, [shops, memberships, sportsModules, t]);

  return (
    <section className="platform-dash space-y-5" aria-label={t("plat.dash.aria")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            {t("plat.dash.eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            {t("plat.dash.title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("plat.dash.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <Activity className="size-3.5 text-primary" aria-hidden />
          {t("plat.dash.refreshNote")}
        </span>
      </div>

      <div className="platform-metric-board" role="group" aria-label={t("plat.dash.metricsAria")}>
        <MetricCell
          label={t("plat.dash.activeShops")}
          value={stats.active}
          detail={
            loading
              ? t("plat.dash.loading")
              : stats.shopTotal === 1
                ? t("plat.dash.onlyShop")
                : t("plat.dash.shareOfNetwork", {
                    percent: Math.round((stats.active / stats.shopTotal) * 100),
                  })
          }
          share={loading ? null : stats.active / stats.shopTotal}
          tone="ok"
          loading={loading}
        />
        <MetricCell
          label={t("plat.dash.suspendedLabel")}
          value={stats.suspended}
          detail={
            loading
              ? t("plat.dash.loading")
              : stats.suspended === 0
                ? t("plat.dash.noneOffline")
                : t("plat.dash.offlineNow")
          }
          share={loading ? null : stats.suspended / stats.shopTotal}
          tone="warn"
          loading={loading}
        />
        <MetricCell
          label={t("plat.dash.customers")}
          value={stats.customers}
          detail={
            loading
              ? t("plat.dash.loading")
              : shops.length === 0
                ? t("plat.dash.noShopsYet")
                : t("plat.dash.avgPerShop", {
                    avg: stats.avgCustomers.toLocaleString(intlLocale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                  })
          }
          loading={loading}
        />
        <MetricCell
          label={t("plat.dash.shopAdmins")}
          value={stats.admins}
          detail={
            loading
              ? t("plat.dash.loading")
              : stats.sportsOn > 0
                ? t("plat.dash.sportsOn", { count: stats.sportsOn })
                : t("plat.dash.managementAccounts")
          }
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">{t("plat.dash.trendTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("plat.dash.trendHint")}</p>
            </div>
          </div>
          <div className="h-56 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="platformClients" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--brand-primary, #1f6feb)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--brand-primary, #1f6feb)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="platformBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold, #c9a227)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--gold, #c9a227)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clientes"
                    name={t("plat.dash.customers")}
                    stroke="var(--brand-primary, #1f6feb)"
                    fill="url(#platformClients)"
                    strokeWidth={2.5}
                    animationDuration={1100}
                  />
                  <Area
                    type="monotone"
                    dataKey="reservas"
                    name={t("plat.dash.bookings")}
                    stroke="var(--gold, #c9a227)"
                    fill="url(#platformBookings)"
                    strokeWidth={2.5}
                    animationDuration={1300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-bold">{t("plat.dash.statusTitle")}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t("plat.dash.statusHint")}</p>
          <div className="h-48 w-full">
            {mounted && stats.statusPie.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusPie}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    animationDuration={1000}
                  >
                    {stats.statusPie.map((row) => (
                      <Cell key={row.name} fill={row.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("plat.dash.noShops")}
              </p>
            )}
          </div>
          <ul className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
            {stats.statusPie.map((row) => (
              <li key={row.name} className="inline-flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: row.color }} />
                {row.name}: {row.value}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold">{t("plat.dash.topTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("plat.dash.topHint")}</p>
        </div>
        <div className="h-64 w-full">
          {mounted && stats.topShops.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topShops} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    value,
                    item?.dataKey === "team"
                      ? t("plat.dash.team")
                      : item?.payload?.fullName
                        ? t("plat.dash.customersOf", { name: item.payload.fullName })
                        : t("plat.dash.customers"),
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar
                  dataKey="customers"
                  name={t("plat.dash.customers")}
                  radius={[10, 10, 4, 4]}
                  fill="var(--brand-primary, #1f6feb)"
                  animationDuration={1200}
                />
                <Bar
                  dataKey="team"
                  name={t("plat.dash.team")}
                  radius={[10, 10, 4, 4]}
                  fill="var(--gold, #c9a227)"
                  animationDuration={1400}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("plat.dash.topEmpty")}
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
