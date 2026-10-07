import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus, Repeat } from "lucide-react";
import { EmptyState, LoadingState, StatusBadge } from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { t as tNow, useI18n } from "@/lib/i18n";
import { DEMO_CUSTOMER_ID } from "@/features/demo/model";
import { RhythmDashboard, type RhythmPayload } from "@/features/insights/RhythmDashboard";
import { DEFAULT_SHOP_TIMEZONE, shiftDateKey, shopDateKey } from "@/lib/shop/appointments";
import { cn } from "@/lib/utils";

/** Retornos (intervalos) que o cálculo do ritmo pede; em visitas, é um a mais. */
const MIN_RETURNS = 3;
const MIN_VISITS = MIN_RETURNS + 1;

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

/** "2026-10-13" → "seg., 13/10" no idioma escolhido (a chave já está no fuso da loja). */
function dayKeyLabel(key: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(keyToDate(key));
}

/** "2026-10-13" → "13/10". */
function dayMonth(key: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(keyToDate(key));
}

/**
 * Ritmo do cliente: frequência de retorno, dia e horário que costuma ir — ligado ao próximo
 * passo (agendar a próxima visita ideal ou ver a que já está marcada).
 */
export function CustomerRhythm({
  shopId,
  visits = [],
  upcoming = null,
  timeZone = DEFAULT_SHOP_TIMEZONE,
  now,
  onBook,
  onOpenBookings,
}: {
  shopId: string | null;
  /** Início das visitas concluídas nesta barbearia (qualquer ordem). */
  visits?: string[];
  /** Início da próxima reserva já marcada, se houver. */
  upcoming?: string | null;
  timeZone?: string;
  now?: Date;
  /** Abre Agendar; recebe o dia sugerido (chave AAAA-MM-DD) quando houver. */
  onBook?: (dayKey: string | null) => void;
  onOpenBookings?: () => void;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [rhythm, setRhythm] = useState<RhythmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

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
        const name =
          demo.services.find((s) => s.id === row.service_id)?.name ??
          tNow("booking.serviceFallback");
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
  }, [demo, shopId, version]);

  if (loading) return <LoadingState variant="stats" count={4} label={t("rhythm.loading")} />;
  if (error) {
    return (
      <EmptyState
        variant="plain"
        status="danger"
        title={t("rhythm.error")}
        action={
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="action-button action-confirm"
          >
            {t("visual.retry")}
          </button>
        }
      />
    );
  }

  const sorted = [...visits].sort((a, b) => a.localeCompare(b));
  const todayKey = shopDateKey(now ?? new Date(), timeZone);
  const upcomingKey = upcoming ? shopDateKey(new Date(upcoming), timeZone) : null;
  const upcomingBadge = upcomingKey ? (
    <button
      type="button"
      onClick={onOpenBookings}
      className="inline-flex min-h-11 items-center rounded-xl"
    >
      <StatusBadge
        tone="info"
        icon={CalendarCheck}
        label={t("conta.rhythm.booked", { date: dayKeyLabel(upcomingKey, intlLocale) })}
      />
    </button>
  ) : null;

  // Sem retornos suficientes: quantas visitas já contam e quantas faltam, em bolinhas.
  if (!rhythm || rhythm.sample < MIN_RETURNS) {
    const fromSample = rhythm && rhythm.sample > 0 ? rhythm.sample + 1 : 0;
    const done = Math.min(MIN_VISITS - 1, Math.max(sorted.length, fromSample));
    const missing = MIN_VISITS - done;
    return (
      <EmptyState
        variant="plain"
        tone="chart"
        title={t("conta.rhythm.emptyTitle", { count: MIN_VISITS })}
        description={t(missing === 1 ? "conta.rhythm.missingOne" : "conta.rhythm.missingMany", {
          count: missing,
        })}
        action={
          upcomingBadge ??
          (onBook ? (
            <button
              type="button"
              onClick={() => onBook(null)}
              className="action-button action-confirm"
            >
              <CalendarPlus aria-hidden />
              {t("conta.rhythm.book")}
            </button>
          ) : undefined)
        }
      >
        <span
          className="flex items-center gap-1.5"
          role="img"
          aria-label={t("conta.rhythm.progress", { done, total: MIN_VISITS })}
        >
          {Array.from({ length: MIN_VISITS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-3 rounded-full",
                index < done ? "bg-gold" : "border-2 border-muted-foreground/40",
              )}
            />
          ))}
          <span aria-hidden className="ms-1 text-xs font-semibold text-muted-foreground">
            {done}/{MIN_VISITS}
          </span>
        </span>
      </EmptyState>
    );
  }

  // Próxima visita ideal: última visita concluída + intervalo típico (nunca no passado).
  const interval = rhythm.avg_return_days != null ? Math.round(rhythm.avg_return_days) : null;
  const lastKey = sorted.length
    ? shopDateKey(new Date(sorted[sorted.length - 1]!), timeZone)
    : null;
  let idealKey = lastKey && interval ? shiftDateKey(lastKey, interval) : null;
  const overdue = Boolean(idealKey && idealKey < todayKey);
  if (idealKey && overdue) idealKey = todayKey;
  const recent = sorted.slice(-4).map((iso) => shopDateKey(new Date(iso), timeZone));

  return (
    <div className="space-y-4">
      {/* Frase visual: de quanto em quanto tempo, que dia e que hora. */}
      <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-4">
        <p className="flex items-center gap-2 text-lg font-bold leading-snug">
          <Repeat className="size-5 shrink-0 text-gold" aria-hidden />
          {interval ? t("conta.rhythm.every", { days: interval }) : t("rhythm.title")}
        </p>
        {idealKey && (
          <ol
            aria-label={t("conta.rhythm.timeline")}
            className="relative grid items-start gap-1 pt-1"
            style={{ gridTemplateColumns: `repeat(${recent.length + 1}, minmax(0, 1fr))` }}
          >
            <span aria-hidden className="absolute inset-x-[8%] top-[13px] h-0.5 bg-border" />
            {recent.map((key, index) => (
              <li
                key={`${key}-${index}`}
                className="relative flex flex-col items-center gap-1 text-center"
              >
                <span className="mt-1 size-3 rounded-full bg-gold" aria-hidden />
                <span className="text-xs text-muted-foreground">
                  <span className="sr-only">{t("conta.rhythm.visited")} </span>
                  {dayMonth(key, intlLocale)}
                </span>
              </li>
            ))}
            <li className="relative flex flex-col items-center gap-1 text-center">
              <span
                className="size-5 rounded-full border-2 border-dashed border-primary bg-card"
                aria-hidden
              />
              <span className="text-xs font-bold text-foreground">
                <span className="sr-only">{t("conta.rhythm.ideal")} </span>
                {dayMonth(idealKey, intlLocale)}
              </span>
            </li>
          </ol>
        )}
        {upcomingBadge ??
          (onBook && (
            <div className="space-y-1.5">
              {overdue && (
                <StatusBadge tone="warning" size="sm" label={t("conta.rhythm.overdue")} />
              )}
              <button
                type="button"
                onClick={() => onBook(idealKey)}
                className="action-button action-confirm w-full"
              >
                <CalendarPlus aria-hidden />
                {idealKey
                  ? t("conta.rhythm.bookOn", { date: dayKeyLabel(idealKey, intlLocale) })
                  : t("conta.rhythm.book")}
              </button>
            </div>
          ))}
      </div>
      <RhythmDashboard
        rhythm={rhythm}
        title={t("rhythm.title")}
        hideTitle
        hideInterval={interval != null}
      />
    </div>
  );
}
