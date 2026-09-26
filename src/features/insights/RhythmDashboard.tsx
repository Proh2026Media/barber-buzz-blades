import { CalendarDays, Clock3, Crown, Repeat, TrendingUp, Wallet } from "lucide-react";
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
function weekdayNames(locale: string, weekday: "long" | "narrow") {
  const format = new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => {
    const name = format.format(new Date(Date.UTC(2024, 0, 7 + index)));
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
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="app-action-card p-4">
      <div className="mb-2 flex items-center gap-2 text-gold">{icon}</div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
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
}: {
  rhythm: RhythmPayload | null;
  title?: string;
  /** Rótulo da faixa de dia preferido: muda conforme o sujeito (você, seus clientes, o cliente). */
  dayLabel?: string;
}) {
  const { t, intlLocale } = useI18n();
  const heading = title ?? t("rhythm.title");
  const dayHeading = dayLabel ?? t("rhythm.dayLabel");
  if (!rhythm || rhythm.sample < MIN_SAMPLE) {
    return (
      <section aria-label={heading} className="space-y-3">
        <h3 className="text-sm font-bold">{heading}</h3>
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">{t("rhythm.notEnough")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("rhythm.notEnoughHint", { count: MIN_SAMPLE })}
          </p>
        </div>
      </section>
    );
  }

  const weekday = weekdayNames(intlLocale, "long")[rhythm.preferred_weekday ?? -1];
  const weekdayIndex = rhythm.preferred_weekday;

  return (
    <section aria-label={heading} className="space-y-3">
      <h3 className="text-sm font-bold">{heading}</h3>

      {/* Faixa do dia preferido */}
      <div className="app-action-card p-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">{dayHeading}</p>
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayNames(intlLocale, "narrow").map((label, index) => {
            const preferred = index === weekdayIndex;
            return (
              <div
                key={index}
                aria-hidden
                className={`flex h-10 flex-col items-center justify-center rounded-xl border text-xs font-bold ${
                  preferred
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/20 text-muted-foreground"
                }`}
              >
                <span>{label}</span>
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

      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Repeat className="size-5" />}
          label={t("rhythm.returnFrequency")}
          value={
            rhythm.avg_return_days != null
              ? t("rhythm.days", { days: Math.round(rhythm.avg_return_days) })
              : "—"
          }
          hint={t("rhythm.returnHint")}
        />
        <Stat
          icon={<Clock3 className="size-5" />}
          label={t("rhythm.preferredHour")}
          value={
            rhythm.preferred_hour != null ? t("rhythm.hour", { hour: rhythm.preferred_hour }) : "—"
          }
        />
        <Stat
          icon={<Crown className="size-5" />}
          label={t("rhythm.topService")}
          value={rhythm.top_service ?? "—"}
        />
        <Stat
          icon={<Wallet className="size-5" />}
          label={t("rhythm.avgSpend")}
          value={
            rhythm.avg_spend_cents != null ? formatBRL(rhythm.avg_spend_cents, intlLocale) : "—"
          }
        />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <TrendingUp className="size-3.5" aria-hidden="true" />
        {t(rhythm.sample === 1 ? "rhythm.basedOnOne" : "rhythm.basedOnMany", {
          count: rhythm.sample,
        })}
      </p>
    </section>
  );
}

export { CalendarDays };
