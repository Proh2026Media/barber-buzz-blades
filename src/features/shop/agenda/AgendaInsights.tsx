import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Lock, RotateCcw, User, Users, XCircle } from "lucide-react";
import { Hint, LoadingState, Notice, SegmentBar, StatTile } from "@/components/visual";
import { useDemo } from "@/features/demo/context";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { shopDayRange } from "@/lib/shop/appointments";

type Metrics = {
  bookings: number;
  completed: number;
  cancelled: number;
  customers: number;
  quoted_cents: number | null;
  no_show_rate?: number | null;
};
type Result = {
  scope: "shop" | "own_with_global" | "own_score";
  own: Metrics;
  global: Metrics | null;
};

/**
 * Números do dia que a lista não mostra (clientes diferentes e a comparação anônima do
 * parceiro). Fica dentro de "Mais números do dia": contagens e valores vêm da própria lista da
 * Agenda, e nada aqui repete o número grande de "Seu dia". O recorte segue o fuso da barbearia.
 */
export function AgendaInsights({
  shopId,
  day,
  revision = 0,
  timeZone,
  staffId,
  role,
  listCustomers,
}: {
  shopId: string;
  day: string;
  revision?: number;
  timeZone: string;
  staffId?: string | null;
  role?: "owner" | "partner" | "associate" | "employee" | null;
  /**
   * Clientes diferentes contados da própria lista, no mesmo escopo do cartão ("Minha agenda",
   * "Equipe" ou o profissional escolhido). Usado quando o banco devolve a barbearia toda, para o
   * número não contradizer o resumo logo acima.
   */
  listCustomers: number;
}) {
  const demo = useDemo();
  const { t } = useI18n();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setData(null);
    const range = shopDayRange(day, timeZone);

    if (demo) {
      // Demonstração: mesmo escopo de cada papel, calculado dos atendimentos fictícios.
      const dayRows = demo.appointments.filter((row) => {
        const at = new Date(row.starts_at).getTime();
        return at >= range.start.getTime() && at <= range.end.getTime();
      });
      const fullAccess = role === "owner" || role === "partner";
      const showAnonymized = role === "associate";
      const mine = fullAccess ? dayRows : dayRows.filter((row) => row.staff_id === staffId);
      const metrics = (rows: typeof dayRows): Metrics => ({
        bookings: rows.length,
        completed: rows.filter((row) => row.status === "completed").length,
        cancelled: rows.filter((row) => row.status === "cancelled").length,
        customers: new Set(rows.map((row) => row.customer_id)).size,
        quoted_cents: null,
      });
      setData({
        scope: fullAccess ? "shop" : showAnonymized ? "own_with_global" : "own_score",
        own: metrics(mine),
        global: showAnonymized ? metrics(dayRows) : null,
      });
      return;
    }

    void supabase
      .rpc("get_professional_insights", {
        p_shop_id: shopId,
        p_from: range.start.toISOString(),
        p_to: new Date(range.end.getTime() + 1).toISOString(),
      })
      .then(
        (result) => {
          if (!active) return;
          setError(!!result.error);
          setData(result.error ? null : (result.data as unknown as Result));
        },
        () => {
          if (active) setError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [demo, day, revision, retry, shopId, staffId, role, timeZone]);

  if (error) {
    return (
      <Notice
        tone="danger"
        title={t("ins.biz.loadError")}
        action={{
          label: t("visual.retry"),
          onClick: () => setRetry((n) => n + 1),
          icon: RotateCcw,
        }}
      />
    );
  }
  if (!data) return <LoadingState variant="stats" count={2} label={t("ins.biz.loading")} />;

  const shopScope = data.scope === "shop";
  const global = data.global && Object.keys(data.global).length > 0 ? data.global : null;
  const base = Math.max(global?.bookings ?? 0, data.own.bookings, 1);
  const bar = (metrics: Metrics) => [
    {
      key: "completed",
      label: t("agenda.state.completed"),
      value: metrics.completed,
      tone: "success" as const,
      icon: CheckCircle2,
    },
    {
      key: "open",
      label: t("agenda.insights.open"),
      value: Math.max(0, metrics.bookings - metrics.completed - metrics.cancelled),
      tone: "info" as const,
      icon: CalendarCheck,
    },
    {
      key: "cancelled",
      label: t("agenda.state.cancelled"),
      value: metrics.cancelled,
      tone: "danger" as const,
      icon: XCircle,
    },
  ];

  // Dono e sócio recebem do banco a barbearia toda: dentro de "Seu dia" fica só o que a lista
  // não mostra (clientes diferentes), contado da própria lista; atendimentos, concluídos e
  // cancelados já estão no número grande e nas pílulas, no escopo certo.
  return (
    <div className="space-y-3 text-foreground">
      {!shopScope && <Hint icon={User}>{t("agenda.insights.scopeOwn")}</Hint>}
      <StatTile
        icon={Users}
        label={t("agenda.insights.customers")}
        value={shopScope ? listCustomers : data.own.customers}
      />
      {global && (
        <section className="space-y-3 rounded-2xl border border-border bg-background/60 p-3">
          <h4 className="text-sm font-bold">{t("agenda.insights.compareTitle")}</h4>
          {[
            { key: "you", label: t("agenda.insights.you"), metrics: data.own },
            { key: "shop", label: t("agenda.insights.shop"), metrics: global },
          ].map((item) => (
            <div key={item.key} className="space-y-1">
              <p className="flex justify-between text-xs font-semibold">
                <span>{item.label}</span>
                <span className="tabular-nums">
                  {t("agenda.insights.line", {
                    completed: item.metrics.completed,
                    total: item.metrics.bookings,
                  })}
                </span>
              </p>
              <SegmentBar
                segments={bar(item.metrics)}
                total={base}
                summary={`${item.label}: ${t("ins.pro.globalLine", {
                  bookings: item.metrics.bookings,
                  completed: item.metrics.completed,
                  cancelled: item.metrics.cancelled,
                })}`}
                legend={item.key === "shop"}
                size="sm"
              />
            </div>
          ))}
          <Hint icon={Lock} tone="muted">
            {t("ins.pro.globalNote")}
          </Hint>
        </section>
      )}
    </div>
  );
}
