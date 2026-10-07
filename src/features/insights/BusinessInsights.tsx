import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
  Smile,
  Star,
  Store,
  User,
  Users,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  IconList,
  IconTile,
  LoadingState,
  MoreDetails,
  Notice,
  SectionHeader,
  SegmentBar,
  StatTile,
} from "@/components/visual";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
import { useI18n } from "@/lib/i18n";
import { cancellationReasonLabel, type CancellationReason } from "./cancellation";
import { questions } from "./model";
import { DEFAULT_SHOP_TIMEZONE, shopDayRange } from "@/lib/shop/appointments";

type Summary = {
  bookings: number;
  customers: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  quoted_completed_cents: number;
  missing_price: number;
  wait_sample: number;
  mean_wait_minutes: number | null;
  usage: Record<string, number>;
  rating_sample: number;
  rating_average: number | null;
  rating_distribution: Record<string, number>;
  improvement_sample: number;
  improvement_counts: Record<string, number>;
  cancellation_reason_sample: number;
  cancellation_reason_counts: Record<string, number>;
};
type ServiceInterest = { sample: number; counts: Record<string, number> };
type DelaySummary = {
  customer_sample: number;
  customer_mean: number | null;
  shop_sample: number;
  shop_mean: number | null;
};
export function BusinessInsights({
  shopId = null,
  day,
  revision = 0,
  timeZone = DEFAULT_SHOP_TIMEZONE,
  embedded = false,
}: {
  shopId?: string | null;
  day?: string;
  revision?: number;
  timeZone?: string;
  /** Dentro de outro cartão (ex.: "Indicadores do dia"): sem borda própria nem ícone repetido. */
  embedded?: boolean;
}) {
  const demo = useDemo();
  const { t, intlLocale } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [delays, setDelays] = useState<DelaySummary>({
    customer_sample: 0,
    customer_mean: null,
    shop_sample: 0,
    shop_mean: null,
  });
  const [loading, setLoading] = useState(true);
  const [serviceInterest, setServiceInterest] = useState<ServiceInterest>({
    sample: 0,
    counts: {},
  });
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const from = day ? shopDayRange(day, timeZone).start : new Date();
    if (!day) {
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
    }
    const to = day ? new Date(shopDayRange(day, timeZone).end.getTime() + 1) : new Date();
    if (demo) {
      const rows = demo.appointments.filter(
        (row) => new Date(row.starts_at) >= from && new Date(row.starts_at) < to,
      );
      setSummary({
        bookings: rows.length,
        customers: new Set(rows.map((row) => row.customer_id)).size,
        completed: rows.filter((row) => row.status === "completed").length,
        cancelled: rows.filter(
          (row) => row.status === "cancelled" && !demo.attendance[row.id]?.no_show_at,
        ).length,
        no_shows: rows.filter((row) => demo.attendance[row.id]?.no_show_at).length,
        quoted_completed_cents: rows
          .filter((row) => row.status === "completed")
          .reduce((sum, row) => sum + (demo.prices[row.id] ?? 0), 0),
        missing_price: rows.filter((row) => demo.prices[row.id] === undefined).length,
        wait_sample: 0,
        mean_wait_minutes: null,
        usage: {},
        rating_sample: 0,
        rating_average: null,
        rating_distribution: {},
        improvement_sample: 0,
        improvement_counts: {},
        cancellation_reason_sample: Object.values(demo.cancellationReasons).filter(
          (row) => row.reason,
        ).length,
        cancellation_reason_counts: {},
      });
      const customerDelays = rows
        .map((row) => demo.attendance[row.id]?.customer_delay_minutes)
        .filter((v): v is number => v != null);
      const shopDelays = rows
        .map((row) => demo.attendance[row.id]?.shop_delay_minutes)
        .filter((v): v is number => v != null);
      setDelays({
        customer_sample: customerDelays.length,
        customer_mean: customerDelays.length
          ? customerDelays.reduce((a, b) => a + b, 0) / customerDelays.length
          : null,
        shop_sample: shopDelays.length,
        shop_mean: shopDelays.length
          ? shopDelays.reduce((a, b) => a + b, 0) / shopDelays.length
          : null,
      });
      const answers = demo.surveys.filter(
        (row) =>
          row.question === "service_interest" &&
          row.state === "answered" &&
          row.answer &&
          // "undefined" é o valor gravado por respostas antigas de frequência
          // ("Sem frequência definida") e não deve contar como interesse.
          !["skip", "none", "undefined"].includes(row.answer),
      );
      setServiceInterest({
        sample: answers.length,
        counts: Object.fromEntries(
          answers
            .map((row) => row.answer!)
            .reduce(
              (entries, answer) => entries.set(answer, (entries.get(answer) ?? 0) + 1),
              new Map<string, number>(),
            ),
        ),
      });
      setLoading(false);
      return;
    }
    void Promise.all([
      supabase.rpc("get_business_insights", {
        p_shop_id: shopId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
      supabase.rpc("get_service_interest_insights", {
        p_shop_id: shopId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
      supabase.rpc("get_occurrence_insights", {
        p_shop_id: shopId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
    ])
      .then(([summaryResult, interestResult, delayResult]) => {
        if (cancelled) return;
        const failure = summaryResult.error || interestResult.error || delayResult.error;
        setError(!!failure);
        if (failure) {
          setSummary(null);
        } else {
          // A RPC pode responder vazio sem erro. Nesse caso mantemos os padrões
          // seguros em vez de gravar null, que quebraria a renderização.
          const summary = summaryResult.data;
          setSummary(
            summary && typeof summary === "object" ? (summary as unknown as Summary) : null,
          );
          const interest = interestResult.data;
          if (interest && typeof interest === "object") {
            setServiceInterest(interest as unknown as ServiceInterest);
          }
          const delay = delayResult.data;
          if (delay && typeof delay === "object") {
            setDelays(delay as unknown as DelaySummary);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        // Sem este tratamento um erro de rede deixaria o painel carregando para sempre.
        if (cancelled) return;
        setError(true);
        setSummary(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, shopId, day, revision, version, timeZone]);
  return (
    <section
      className={
        embedded ? "space-y-3" : "space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
      }
      aria-label={t("ins.biz.aria")}
    >
      {embedded ? (
        <h3 className="text-sm font-bold">{day ? t("ins.biz.titleDay") : t("ins.biz.title30")}</h3>
      ) : (
        <SectionHeader
          as="h3"
          icon={BarChart3}
          title={day ? t("ins.biz.titleDay") : t("ins.biz.title30")}
          aside={
            // Dentro da Agenda, o "Atualizar" da própria Agenda já recarrega estes números.
            <button
              type="button"
              disabled={loading}
              onClick={() => setVersion((v) => v + 1)}
              aria-label={t("ins.biz.refresh")}
              title={t("ins.biz.refresh")}
              className="app-icon-button"
            >
              <RefreshCw
                className={cn("size-4", loading && "motion-safe:animate-spin")}
                aria-hidden
              />
            </button>
          }
        />
      )}
      {loading ? (
        <LoadingState variant="stats" count={4} label={t("ins.biz.loading")} />
      ) : error ? (
        <Notice
          tone="danger"
          title={t("ins.biz.loadError")}
          action={{
            label: t("visual.retry"),
            onClick: () => setVersion((v) => v + 1),
            icon: RotateCcw,
          }}
        />
      ) : (
        summary && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {/* Na Agenda, reservas, concluídos, cancelados e valor já estão em "Seu dia". */}
              {!embedded && (
                <>
                  <StatTile
                    icon={Wallet}
                    tone="highlight"
                    label={t("ins.biz.completedValueShort")}
                    className="col-span-2 sm:col-span-1"
                    value={(summary.quoted_completed_cents / 100).toLocaleString(intlLocale, {
                      style: "currency",
                      currency: "BRL",
                      currencyDisplay: "narrowSymbol",
                    })}
                  />
                  <StatTile
                    icon={CalendarCheck}
                    tone="highlight"
                    label={t("ins.biz.bookings")}
                    value={summary.bookings}
                  />
                </>
              )}
              <StatTile
                icon={Users}
                tone="highlight"
                label={t("ins.biz.customersShort")}
                value={summary.customers}
              />
              {!embedded && (
                <>
                  <StatTile
                    icon={CheckCircle2}
                    tone="success"
                    label={t("ins.biz.completed")}
                    value={summary.completed}
                  />
                  <StatTile
                    icon={XCircle}
                    tone="danger"
                    label={t("ins.biz.cancelled")}
                    value={summary.cancelled}
                  />
                </>
              )}
              <StatTile
                icon={UserX}
                tone="danger"
                label={t("ins.biz.noShows")}
                value={summary.no_shows}
              />
              {/* Fora da Agenda, o atraso ocupa a linha inteira (cliente | barbearia lado a
                  lado) em vez de ficar sozinho na última linha. */}
              <DelayTile
                delays={delays}
                wide={!embedded}
                className={embedded ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-3"}
              />
            </div>
            <MoreDetails summary={t("ins.biz.howCalculated")}>
              <IconList
                size="sm"
                items={[
                  { key: "delay", icon: Clock3, text: t("ins.biz.delayNote") },
                  {
                    key: "price",
                    icon: Wallet,
                    text: t("ins.biz.priceNoteShort", { missing: summary.missing_price }),
                  },
                ]}
              />
            </MoreDetails>
            <MoreDetails summary={t("ins.biz.usage")} icon={MousePointerClick}>
              <IconList
                size="md"
                items={[
                  {
                    key: "started",
                    icon: MousePointerClick,
                    text: t("ins.biz.usageStarted", {
                      count: summary.usage.booking_started ?? 0,
                    }),
                  },
                  {
                    key: "succeeded",
                    tone: "success",
                    text: t("ins.biz.usageSucceeded", {
                      count: summary.usage.booking_succeeded ?? 0,
                    }),
                  },
                  {
                    key: "failed",
                    tone: "danger",
                    text: t("ins.biz.usageFailed", { count: summary.usage.booking_failed ?? 0 }),
                  },
                ]}
              />
              <p className="text-xs">{t("ins.biz.usageNote")}</p>
            </MoreDetails>
            <MoreDetails summary={t("ins.biz.experience")} icon={Smile} defaultOpen={!day}>
              <div className="space-y-4 text-xs text-foreground">
                <div>
                  <p className="font-semibold">{t("ins.biz.rating")}</p>
                  {summary.rating_sample >= 5 && summary.rating_average !== null ? (
                    <>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-primary">
                        <Stars value={Number(summary.rating_average)} />
                        {Number(summary.rating_average).toLocaleString(intlLocale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-sm text-muted-foreground">{t("ins.biz.outOf5")}</span>
                      </p>
                      <MetricRows
                        values={summary.rating_distribution}
                        labels={{
                          "1": t("ins.biz.star1"),
                          "2": t("ins.biz.stars", { count: 2 }),
                          "3": t("ins.biz.stars", { count: 3 }),
                          "4": t("ins.biz.stars", { count: 4 }),
                          "5": t("ins.biz.stars", { count: 5 }),
                        }}
                      />
                    </>
                  ) : (
                    <InsufficientSample count={summary.rating_sample} />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t("ins.biz.improvement")}</p>
                  {summary.improvement_sample >= 5 ? (
                    <MetricRows
                      values={summary.improvement_counts}
                      labels={questions.improvement.options}
                    />
                  ) : (
                    <InsufficientSample count={summary.improvement_sample} />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t("ins.biz.cancelReasons")}</p>
                  {summary.cancellation_reason_sample >= 5 ? (
                    <MetricRows
                      values={summary.cancellation_reason_counts}
                      labels={Object.fromEntries(
                        Object.keys(summary.cancellation_reason_counts).map((key) => [
                          key,
                          cancellationReasonLabel(key as CancellationReason),
                        ]),
                      )}
                    />
                  ) : (
                    <InsufficientSample count={summary.cancellation_reason_sample} />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{t("ins.catalog.name.service_interest")}</p>
                  {serviceInterest.sample >= 5 ? (
                    <MetricRows
                      values={serviceInterest.counts}
                      labels={questions.service_interest.options}
                    />
                  ) : (
                    <InsufficientSample count={serviceInterest.sample} />
                  )}
                </div>
                <p className="text-muted-foreground">{t("ins.biz.aggregateNote")}</p>
              </div>
            </MoreDetails>
          </>
        )
      )}
    </section>
  );
}

/** Amostra pequena: barrinha "3 de 5 respostas para mostrar o resultado". */
function InsufficientSample({ count }: { count: number }) {
  const { t } = useI18n();
  const text = t("ins.biz.sampleProgress", { count, total: 5 });
  return (
    <SegmentBar
      className="mt-1"
      size="sm"
      segments={[{ key: "answers", label: text, value: Math.min(count, 5), tone: "pending" }]}
      total={5}
      summary={text}
      showSummary
      legend={false}
    />
  );
}

/** Nota média em estrelas (meia estrela arredonda para cima a partir de ,5). */
function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex text-gold" aria-hidden>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star key={index} className={cn("size-5", index <= full ? "fill-current" : "opacity-35")} />
      ))}
    </span>
  );
}

/** Atraso médio: cliente × barbearia em barrinhas, com "—" quando não há registro. */
function DelayTile({
  delays,
  wide = false,
  className,
}: {
  delays: DelaySummary;
  /** Linha inteira: cliente e barbearia lado a lado a partir de 640 px. */
  wide?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const max = Math.max(delays.customer_mean ?? 0, delays.shop_mean ?? 0, 1);
  const rows = [
    {
      key: "customer",
      icon: User,
      label: t("ins.biz.delayCustomer"),
      mean: delays.customer_mean,
      sample: delays.customer_sample,
    },
    {
      key: "shop",
      icon: Store,
      label: t("ins.biz.delayShop"),
      mean: delays.shop_mean,
      sample: delays.shop_sample,
    },
  ];
  return (
    <div className={cn("app-action-card min-w-0 space-y-2 p-4", className)}>
      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <IconTile icon={Clock3} tone="highlight" size="sm" />
        {t("ins.biz.avgDelay")}
      </p>
      <div className={cn("space-y-2", wide && "sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0")}>
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 font-semibold">{row.label}</span>
                <span className="font-bold tabular-nums">
                  {row.mean === null ? (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">{t("ins.biz.noRecords")}</span>
                    </>
                  ) : (
                    t("agenda.minutes", { minutes: Math.round(row.mean) })
                  )}
                </span>
              </p>
              <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{ width: `${row.mean === null ? 0 : (row.mean / max) * 100}%` }}
                />
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t(row.sample === 1 ? "ins.biz.delayRecordsOne" : "ins.biz.delayRecords", {
                  count: row.sample,
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function MetricRows({
  values,
  labels,
}: {
  values: Record<string, number>;
  labels: Record<string, string>;
}) {
  const total = Object.values(values).reduce((sum, value) => sum + Number(value), 0);
  return (
    <div className="mt-2 space-y-2">
      {Object.entries(values)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between gap-3">
              <span>{labels[key] ?? key}</span>
              <span>
                {value} · {total ? Math.round((Number(value) / total) * 100) : 0}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${total ? (Number(value) / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}
