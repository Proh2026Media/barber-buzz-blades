import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SHOP_TIMEZONE, shopDayRange } from "@/lib/shop/appointments";
import { useDemo } from "@/features/demo/context";

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

export function ProfessionalInsights({
  shopId,
  day,
  revision = 0,
  staffId,
  role,
}: {
  shopId: string;
  day: string;
  revision?: number;
  staffId?: string | null;
  role?: "owner" | "partner" | "associate" | "employee" | null;
}) {
  const demo = useDemo();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    if (demo) {
      // Demonstração: deriva os indicadores do profissional a partir dos
      // atendimentos fictícios, espelhando o escopo de cada papel.
      const mine = demo.appointments.filter((row) => row.staff_id === staffId);
      const fullAccess = role === "owner" || role === "partner";
      const showMoney = role !== "employee";
      const showAnonymized = role === "associate";
      const shopCompleted = demo.appointments.filter((row) => row.status === "completed");
      setData({
        scope: fullAccess ? "shop" : showAnonymized ? "own_with_global" : "own_score",
        own: {
          bookings: mine.length,
          completed: mine.filter((row) => row.status === "completed").length,
          cancelled: mine.filter((row) => row.status === "cancelled").length,
          customers: new Set(mine.map((row) => row.customer_id)).size,
          quoted_cents: showMoney
            ? mine
                .filter((row) => row.status === "completed")
                .reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0)
            : null,
        },
        global: showAnonymized
          ? {
              bookings: shopCompleted.length,
              completed: shopCompleted.filter((row) => row.status === "completed").length,
              cancelled: shopCompleted.filter((row) => row.status === "cancelled").length,
              customers: new Set(shopCompleted.map((row) => row.customer_id)).size,
              quoted_cents: null,
            }
          : null,
      });
      return;
    }

    const range = shopDayRange(day, DEFAULT_SHOP_TIMEZONE);
    void supabase
      .rpc("get_professional_insights", {
        p_shop_id: shopId,
        p_from: range.start.toISOString(),
        p_to: new Date(range.end.getTime() + 1).toISOString(),
      })
      .then((result) => {
        if (!active) return;
        setError(!!result.error);
        setData(result.error ? null : (result.data as unknown as Result));
      });
    return () => {
      active = false;
    };
  }, [demo, day, revision, shopId, staffId, role]);
  return (
    <section
      className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
      aria-label="Meu desempenho"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <BarChart3 className="size-5 text-primary" />
        Meu desempenho
      </h3>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível carregar os indicadores.
        </p>
      ) : !data ? (
        <p role="status" className="text-xs text-muted-foreground">
          Carregando indicadores…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Atendimentos", data.own.bookings],
              ["Concluídos", data.own.completed],
              ["Cancelados", data.own.cancelled],
              ["Clientes", data.own.customers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {data.own.quoted_cents !== null && (
            <p className="text-sm">
              Valor dos serviços concluídos:{" "}
              <strong>
                {(data.own.quoted_cents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
            </p>
          )}
          {data.scope === "own_score" && (
            <p className="text-xs text-muted-foreground">
              Valores financeiros não fazem parte do acesso de contratado.
            </p>
          )}
          {data.global && Object.keys(data.global).length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-bold">Visão geral anonimizada da barbearia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.global.bookings} atendimentos · {data.global.completed} concluídos ·{" "}
                {data.global.cancelled} cancelados
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sem nomes ou divisão por profissional. Exibida somente com amostra mínima.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
