import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/features/demo/context";
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
}: {
  shopId?: string | null;
  day?: string;
  revision?: number;
  timeZone?: string;
}) {
  const demo = useDemo();
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
      className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
      aria-label="Indicadores de acompanhamento"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="size-5 text-primary" />
          Acompanhamento {day ? "do dia" : "dos últimos 30 dias"}
        </h3>
        <button
          disabled={loading}
          onClick={() => setVersion((v) => v + 1)}
          className="text-xs underline"
        >
          Atualizar
        </button>
      </div>
      {loading ? (
        <p role="status" className="text-xs">
          Carregando indicadores…
        </p>
      ) : error ? (
        <p role="alert" className="text-xs text-destructive">
          Não foi possível carregar os indicadores.
        </p>
      ) : (
        summary && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Clientes atendidos ou agendados", summary.customers],
                ["Reservas", summary.bookings],
                ["Concluídos", summary.completed],
                ["Cancelados", summary.cancelled],
                ["Não compareceram", summary.no_shows],
                [
                  `Atraso do cliente · ${delays.customer_sample} registros`,
                  delays.customer_mean === null
                    ? "Sem registros"
                    : `${Math.round(delays.customer_mean)} min`,
                ],
                [
                  `Atraso da barbearia · ${delays.shop_sample} registros`,
                  delays.shop_mean === null
                    ? "Sem registros"
                    : `${Math.round(delays.shop_mean)} min`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-background/60 p-3">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Médias apenas dos atrasos informados. Ausência de registro não indica pontualidade.
            </p>
            <p className="text-sm">
              Valor reservado dos concluídos:{" "}
              <strong>
                {(summary.quoted_completed_cents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.missing_price} reservas sem preço histórico registrado. Espera calculada com{" "}
              {summary.wait_sample} registros da equipe. Valores reservados não confirmam pagamento.
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold">Uso opcional do app</summary>
              <div className="mt-2 space-y-1">
                <p>Tentativas de confirmar reserva: {summary.usage.booking_started ?? 0}</p>
                <p>Confirmações bem-sucedidas: {summary.usage.booking_succeeded ?? 0}</p>
                <p>Falhas de confirmação: {summary.usage.booking_failed ?? 0}</p>
                <p className="text-muted-foreground">
                  Somente clientes que permitiram a coleta. São eventos de uso, não a contagem
                  oficial de reservas.
                </p>
              </div>
            </details>
            <details className="text-xs" open={!day}>
              <summary className="cursor-pointer font-semibold">Experiência dos clientes</summary>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="font-semibold">Avaliação dos atendimentos</p>
                  {summary.rating_sample >= 5 && summary.rating_average !== null ? (
                    <>
                      <p className="mt-1 text-2xl font-bold text-primary">
                        {Number(summary.rating_average).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-sm text-muted-foreground">de 5</span>
                      </p>
                      <MetricRows
                        values={summary.rating_distribution}
                        labels={{
                          "1": "1 estrela",
                          "2": "2 estrelas",
                          "3": "3 estrelas",
                          "4": "4 estrelas",
                          "5": "5 estrelas",
                        }}
                      />
                    </>
                  ) : (
                    <InsufficientSample count={summary.rating_sample} />
                  )}
                </div>
                <div>
                  <p className="font-semibold">Pontos indicados para melhoria</p>
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
                  <p className="font-semibold">Motivos de cancelamento informados</p>
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
                  <p className="font-semibold">Interesse em novos serviços</p>
                  {serviceInterest.sample >= 5 ? (
                    <MetricRows
                      values={serviceInterest.counts}
                      labels={questions.service_interest.options}
                    />
                  ) : (
                    <InsufficientSample count={serviceInterest.sample} />
                  )}
                </div>
                <p className="text-muted-foreground">
                  Resultados agregados. “Prefiro não responder” não entra nas distribuições.
                </p>
              </div>
            </details>
          </>
        )
      )}
    </section>
  );
}

function InsufficientSample({ count }: { count: number }) {
  return (
    <p className="mt-1 text-muted-foreground">
      {count} {count === 1 ? "resposta" : "respostas"}. O resultado aparece a partir de 5.
    </p>
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
