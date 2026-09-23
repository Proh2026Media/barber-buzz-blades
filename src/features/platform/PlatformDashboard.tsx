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
import {
  Activity,
  Building2,
  CirclePause,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type MembershipRow = Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">;

type PlatformDashboardProps = {
  shops: Tables<"barbershops">[];
  memberships: MembershipRow[];
  sportsModules: Record<string, boolean>;
  loading?: boolean;
};

function useCountUp(target: number, active: boolean, durationMs = 900) {
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

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof Building2;
  accent: string;
  loading?: boolean;
}) {
  const shown = useCountUp(value, !loading);
  return (
    <article className="platform-dash-kpi relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm">
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex size-10 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in oklch, ${accent} 16%, transparent)`, color: accent }}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <TrendingUp className="size-4 text-muted-foreground/70" aria-hidden />
      </div>
      <p className="mt-4 text-3xl font-black tabular-nums tracking-tight">
        {loading ? "—" : shown}
      </p>
      <p className="mt-1 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

export function PlatformDashboard({
  shops,
  memberships,
  sportsModules,
  loading = false,
}: PlatformDashboardProps) {
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
      { name: "Ativas", value: active, color: "var(--brand-primary, #1f6feb)" },
      { name: "Suspensas", value: Math.max(suspended, 0), color: "#a8a29e" },
    ].filter((row) => row.value > 0);
    // Série sintética estável a partir dos totais (sem inventar API): tendência visual da operação.
    const baseline = Math.max(customers, 8);
    const trend = Array.from({ length: 8 }, (_, index) => {
      const wave = Math.sin(index * 0.85) * 0.12 + index * 0.04;
      return {
        label: `S${index + 1}`,
        clientes: Math.max(2, Math.round(baseline * (0.55 + wave))),
        reservas: Math.max(1, Math.round(baseline * (0.35 + wave * 0.8))),
      };
    });
    return { active, suspended, customers, admins, sportsOn, topShops, statusPie, trend };
  }, [shops, memberships, sportsModules]);

  return (
    <section className="platform-dash space-y-5" aria-label="Painel da plataforma">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            Operação ao vivo
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            Dashboard da plataforma
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Visão consolidada das barbearias, clientes e equipe — no estilo de um painel executivo.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <Activity className="size-3.5 text-primary" aria-hidden />
          Atualiza ao carregar a página
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Barbearias ativas"
          value={stats.active}
          hint={`${shops.length} no total`}
          icon={Building2}
          accent="var(--brand-primary, #1f6feb)"
          loading={loading}
        />
        <KpiCard
          label="Suspensas"
          value={stats.suspended}
          hint="Fora de operação"
          icon={CirclePause}
          accent="#b45309"
          loading={loading}
        />
        <KpiCard
          label="Clientes"
          value={stats.customers}
          hint="Contas vinculadas"
          icon={UsersRound}
          accent="#0f766e"
          loading={loading}
        />
        <KpiCard
          label="Admins de loja"
          value={stats.admins}
          hint={`Esportes ligado em ${stats.sportsOn}`}
          icon={ShieldCheck}
          accent="#7c3aed"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Tendência da base</h3>
              <p className="text-xs text-muted-foreground">
                Ritmo relativo de clientes e reservas (ilustrativo)
              </p>
            </div>
          </div>
          <div className="h-56 w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="platformClients" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-primary, #1f6feb)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand-primary, #1f6feb)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="platformBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold, #c9a227)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--gold, #c9a227)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
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
                    stroke="var(--brand-primary, #1f6feb)"
                    fill="url(#platformClients)"
                    strokeWidth={2.5}
                    animationDuration={1100}
                  />
                  <Area
                    type="monotone"
                    dataKey="reservas"
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
          <h3 className="text-sm font-bold">Situação das lojas</h3>
          <p className="mb-3 text-xs text-muted-foreground">Ativas × suspensas</p>
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
                Sem barbearias ainda
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
          <h3 className="text-sm font-bold">Barbearias com mais clientes</h3>
          <p className="text-xs text-muted-foreground">Comparativo por unidade</p>
        </div>
        <div className="h-64 w-full">
          {mounted && stats.topShops.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topShops} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip
                  formatter={(value: number, _name, item) => [
                    value,
                    item?.payload?.fullName ? `Clientes · ${item.payload.fullName}` : "Clientes",
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                />
                <Bar
                  dataKey="customers"
                  name="Clientes"
                  radius={[10, 10, 4, 4]}
                  fill="var(--brand-primary, #1f6feb)"
                  animationDuration={1200}
                />
                <Bar
                  dataKey="team"
                  name="Equipe"
                  radius={[10, 10, 4, 4]}
                  fill="var(--gold, #c9a227)"
                  animationDuration={1400}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cadastre a primeira barbearia para ver o comparativo.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
