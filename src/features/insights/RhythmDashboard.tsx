import { Clock3, Crown, Repeat, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

export type RhythmPayload = {
  sample: number;
  avg_return_days?: number | null;
  preferred_weekday?: number | null;
  preferred_hour?: number | null;
  top_service?: string | null;
  avg_spend_cents?: number | null;
};

/** Nomes dos dias no idioma escolhido, de domingo (0) a sábado (6). */
function weekdayNames(locale: string, weekday: "long" | "short") {
  const format = new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => {
    const name = format.format(new Date(Date.UTC(2024, 0, 7 + index))).replace(/\.$/, "");
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  });
}

const MIN_SAMPLE = 3;

function formatBRL(cents: number, locale: string) {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "BRL",
    currencyDisplay: "narrowSymbol",
  });
}

function Stat({
  icon,
  label,
  value,
  hint,
  text = false,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  /** Valor em palavras (ex.: nome do serviço): tamanho menor, até 2 linhas. */
  text?: boolean;
  className?: string;
}) {
  return (
    <div className={`app-action-card min-w-0 p-4 ${className ?? ""}`}>
      <div className="mb-2 flex items-center gap-2 text-gold">{icon}</div>
      <p
        className={
          text
            ? "line-clamp-2 text-lg font-bold leading-snug tracking-tight break-words"
            : "text-xl font-bold tabular-nums tracking-tight break-words hyphens-auto sm:text-2xl"
        }
        title={text ? value : undefined}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Dashboard visual de ritmo: frequência média de retorno, dia e horário que o
 * cliente normalmente vai. Reutilizado pelo cliente (próprio ritmo) e pelo
 * parceiro (ritmo da própria carteira). Nenhuma métrica é inventada: tudo vem
 * dos agendamentos concluídos já existentes.
 */
export function RhythmDashboard({
  rhythm,
  title,
  dayLabel,
  subject = "self",
  hideTitle = false,
  hideInterval = false,
  hideAvgSpend = false,
}: {
  /** O gasto médio já aparece ao lado (carteira do parceiro): não repete o cartão. */
  hideAvgSpend?: boolean;
  /** O título já aparece no cabeçalho do cartão que envolve o painel (Conta do cliente). */
  hideTitle?: boolean;
  /** O intervalo já está dito numa frase acima (Conta do cliente): não repete o cartão. */
  hideInterval?: boolean;
  rhythm: RhythmPayload | null;
  title?: string;
  /** Rótulo da faixa de dia preferido: muda conforme o sujeito (você, seus clientes, o cliente). */
  dayLabel?: string;
  /** De quem é o ritmo: muda a frase de "ainda faltam retornos". */
  subject?: "self" | "client" | "clients";
}) {
  const { t, intlLocale } = useI18n();
  const heading = title ?? t("rhythm.title");
  const dayHeading = dayLabel ?? t("rhythm.dayLabel");
  if (!rhythm || rhythm.sample < MIN_SAMPLE) {
    // MIN_SAMPLE conta intervalos (retornos), não visitas: mostra quantos faltam, em bolinhas.
    const done = Math.max(0, Math.min(MIN_SAMPLE, rhythm?.sample ?? 0));
    const missing = MIN_SAMPLE - done;
    return (
      <section aria-label={heading} className="space-y-3">
        {!hideTitle && <h3 className="text-sm font-bold">{heading}</h3>}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center">
          <span className="flex gap-1.5" aria-hidden>
            {Array.from({ length: MIN_SAMPLE }, (_, index) => (
              <span
                key={index}
                className={`size-2.5 rounded-full ${index < done ? "bg-gold" : "bg-muted-foreground/25"}`}
              />
            ))}
          </span>
          <p className="text-sm font-semibold">{t("rhythm.notEnough")}</p>
          <p className="text-xs text-muted-foreground">
            {t(
              subject === "client"
                ? "rhythm.missing.client"
                : subject === "clients"
                  ? "rhythm.missing.clients"
                  : "rhythm.missing.self",
              { count: missing },
            )}
          </p>
        </div>
      </section>
    );
  }

  const weekday = weekdayNames(intlLocale, "long")[rhythm.preferred_weekday ?? -1];
  const weekdayIndex = rhythm.preferred_weekday;

  return (
    <section aria-label={heading} className="space-y-3">
      {!hideTitle && <h3 className="text-sm font-bold">{heading}</h3>}

      {/* Faixa do dia preferido */}
      <div className="app-action-card p-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">{dayHeading}</p>
        {/* Informação, não escolha: os dias são pontos numa linha (o preferido, maior e cheio). */}
        <div className="relative grid grid-cols-7" aria-hidden>
          <span className="absolute inset-x-[7%] top-[7px] h-px bg-border" />
          {weekdayNames(intlLocale, "short").map((label, index) => {
            const preferred = index === weekdayIndex;
            return (
              <div key={index} className="relative flex flex-col items-center gap-1.5">
                <span
                  className={`rounded-full ${
                    preferred
                      ? "size-4 bg-gold ring-4 ring-gold/20"
                      : "mt-1 size-2 bg-muted-foreground/40"
                  }`}
                />
                <span
                  className={`text-xs font-bold ${preferred ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {weekday && (
          <p className="mt-2 text-xs font-semibold text-primary">
            {t("rhythm.preference", { day: weekday })}
          </p>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-3 ${hideInterval ? "sm:grid-cols-3" : ""}`}>
        {!hideInterval && (
          <Stat
            icon={<Repeat className="size-5" />}
            label={t("rhythm.returnFrequency")}
            value={
              rhythm.avg_return_days != null
                ? t("rhythm.days", { days: Math.round(rhythm.avg_return_days) })
                : "—"
            }
          />
        )}
        <Stat
          icon={<Clock3 className="size-5" />}
          label={t("rhythm.preferredHour")}
          value={
            rhythm.preferred_hour != null ? t("rhythm.hour", { hour: rhythm.preferred_hour }) : "—"
          }
        />
        <Stat
          className={hideAvgSpend && !hideInterval ? "col-span-2" : undefined}
          icon={<Crown className="size-5" />}
          label={t("rhythm.topService")}
          value={rhythm.top_service ?? "—"}
          text={rhythm.top_service != null}
        />
        {!hideAvgSpend && (
          <Stat
            className={hideInterval ? "col-span-2 sm:col-span-1" : undefined}
            icon={<Wallet className="size-5" />}
            label={t("rhythm.avgSpend")}
            value={
              rhythm.avg_spend_cents != null ? formatBRL(rhythm.avg_spend_cents, intlLocale) : "—"
            }
          />
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="size-3.5" aria-hidden="true" />
        {subject === "self"
          ? // Para o cliente, em visitas (n intervalos = n + 1 visitas), sem o termo "retornos".
            t("rhythm.basedOnVisits", { count: rhythm.sample + 1 })
          : t(rhythm.sample === 1 ? "rhythm.basedOnOne" : "rhythm.basedOnMany", {
              count: rhythm.sample,
            })}
      </p>
    </section>
  );
}
