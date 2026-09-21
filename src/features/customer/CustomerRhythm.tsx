import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { DEMO_CUSTOMER_ID } from "@/features/demo/model";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";

/** Ritmo do cliente: frequência de retorno, dia e horário que costuma ir. */
export function CustomerRhythm({ shopId }: { shopId: string | null }) {
  const demo = useDemo();
  const [rhythm, setRhythm] = useState<RhythmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (demo) {
      const mine = demo.appointments
        .filter((row) => row.customer_id === DEMO_CUSTOMER_ID && row.status === "completed")
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const intervals: number[] = [];
      for (let i = 1; i < mine.length; i += 1) {
        intervals.push(
          (new Date(mine[i]!.starts_at).getTime() - new Date(mine[i - 1]!.starts_at).getTime()) /
            86400000,
        );
      }
      const weekdays = new Map<number, number>();
      const hours = new Map<number, number>();
      const services = new Map<string, number>();
      for (const row of mine) {
        const date = new Date(row.starts_at);
        weekdays.set(date.getDay(), (weekdays.get(date.getDay()) ?? 0) + 1);
        hours.set(date.getHours(), (hours.get(date.getHours()) ?? 0) + 1);
        const name = demo.services.find((s) => s.id === row.service_id)?.name ?? "Serviço";
        services.set(name, (services.get(name) ?? 0) + 1);
      }
      const top = (map: Map<number, number>) =>
        [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topService = [...services.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const totalCents = mine.reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0);
      setRhythm({
        sample: intervals.length,
        avg_return_days: intervals.length
          ? intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)]
          : null,
        preferred_weekday: top(weekdays) ?? null,
        preferred_hour: top(hours) ?? null,
        top_service: topService ?? null,
        avg_spend_cents: mine.length ? Math.round(totalCents / mine.length) : null,
      });
      setLoading(false);
      return;
    }

    if (!shopId) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const result = await supabase.rpc("get_customer_rhythm", { p_shop_id: shopId });
        if (cancelled) return;
        if (result.error) setError(true);
        else setRhythm(result.data as unknown as RhythmPayload);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [demo, shopId]);

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Calculando seu ritmo…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível calcular seu ritmo.
      </p>
    );
  }
  return <RhythmDashboard rhythm={rhythm} title="Seu ritmo" />;
}
