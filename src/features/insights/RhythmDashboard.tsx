import { CalendarDays, Clock3, Crown, Repeat, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";

export type RhythmPayload = {
  sample: number;
  avg_return_days?: number | null;
  preferred_weekday?: number | null;
  preferred_hour?: number | null;
  top_service?: string | null;
  avg_spend_cents?: number | null;
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

const MIN_SAMPLE = 3;

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  title = "Seu ritmo",
  dayLabel = "Dia em que você costuma ir",
}: {
  rhythm: RhythmPayload | null;
  title?: string;
  /** Rótulo da faixa de dia preferido: muda conforme o sujeito (você, seus clientes, o cliente). */
  dayLabel?: string;
}) {
  if (!rhythm || rhythm.sample < MIN_SAMPLE) {
    return (
      <section aria-label={title} className="space-y-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold">Ainda não há dados suficientes</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conclua ao menos {MIN_SAMPLE} atendimentos para ver seu ritmo.
          </p>
        </div>
      </section>
    );
  }

  const weekday = WEEKDAYS[rhythm.preferred_weekday ?? -1];
  const weekdayIndex = rhythm.preferred_weekday;

  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-sm font-bold">{title}</h3>

      {/* Faixa do dia preferido */}
      <div className="app-action-card p-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">{dayLabel}</p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS_SHORT.map((label, index) => {
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
          <p className="mt-2 text-xs font-semibold text-primary">Preferência: {weekday}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Repeat className="size-5" />}
          label="Frequência de retorno"
          value={
            rhythm.avg_return_days != null ? `~${Math.round(rhythm.avg_return_days)} dias` : "—"
          }
          hint="Mediana entre uma visita e a seguinte"
        />
        <Stat
          icon={<Clock3 className="size-5" />}
          label="Horário preferido"
          value={rhythm.preferred_hour != null ? `${rhythm.preferred_hour}h` : "—"}
        />
        <Stat
          icon={<Crown className="size-5" />}
          label="Serviço mais frequente"
          value={rhythm.top_service ?? "—"}
        />
        <Stat
          icon={<Wallet className="size-5" />}
          label="Gasto médio"
          value={rhythm.avg_spend_cents != null ? formatBRL(rhythm.avg_spend_cents) : "—"}
        />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <TrendingUp className="size-3.5" />
        Calculado a partir de {rhythm.sample} {rhythm.sample === 1 ? "retorno" : "retornos"}{" "}
        registrados.
      </p>
    </section>
  );
}

export { CalendarDays };
