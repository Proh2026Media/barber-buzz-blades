import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SHOP_TIMEZONE, shopDayRange } from "@/lib/shop/appointments";
import { useDemo } from "@/features/demo/context";
import { useI18n } from "@/lib/i18n";

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
  const { t, intlLocale } = useI18n();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setData(null);

    if (demo) {
      // Demonstração: deriva os indicadores do profissional a partir dos
      // atendimentos fictícios, espelhando o escopo de cada papel.
      // Mesmo recorte do dia usado no modo real (shopDayRange).
      const range = shopDayRange(day, DEFAULT_SHOP_TIMEZONE);
      const dayRows = demo.appointments.filter((row) => {
        const at = new Date(row.starts_at).getTime();
        return at >= range.start.getTime() && at <= range.end.getTime();
      });
      const mine = dayRows.filter((row) => row.staff_id === staffId);
      const fullAccess = role === "owner" || role === "partner";
      const showMoney = role !== "employee";
      const showAnonymized = role === "associate";
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
              bookings: dayRows.length,
              completed: dayRows.filter((row) => row.status === "completed").length,
              cancelled: dayRows.filter((row) => row.status === "cancelled").length,
              customers: new Set(dayRows.map((row) => row.customer_id)).size,
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
  }, [demo, day, revision, retry, shopId, staffId, role]);
  return (
    <section className="space-y-3" aria-label={t("ins.pro.title")}>
      <h3 className="text-sm font-bold">{t("ins.pro.title")}</h3>
      {error ? (
        <div role="alert" className="space-y-2 text-xs text-destructive">
          <p>{t("ins.biz.loadError")}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="action-button">
            {t("common.retry")}
          </button>
        </div>
      ) : !data ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t("ins.biz.loading")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t("ins.pro.appointments"), data.own.bookings],
              [t("ins.biz.completed"), data.own.completed],
              [t("ins.biz.cancelled"), data.own.cancelled],
              [t("ins.pro.customers"), data.own.customers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {data.own.quoted_cents !== null && (
            <p className="text-sm">
              {t("ins.pro.completedValue")}{" "}
              <strong>
                {(data.own.quoted_cents / 100).toLocaleString(intlLocale, {
                  style: "currency",
                  currency: "BRL",
                  currencyDisplay: "narrowSymbol",
                })}
              </strong>
            </p>
          )}
          {data.scope === "own_score" && (
            <p className="text-xs text-muted-foreground">{t("ins.pro.noMoney")}</p>
          )}
          {data.global && Object.keys(data.global).length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-bold">{t("ins.pro.globalTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("ins.pro.globalLine", {
                  bookings: data.global.bookings,
                  completed: data.global.completed,
                  cancelled: data.global.cancelled,
                })}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("ins.pro.globalNote")}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
