import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Moon, RotateCcw } from "lucide-react";
import { DatePicker } from "@/components/ui/schedule-picker";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { dayOffset, weekKeys, weekdayOf } from "./model";

/** "Hoje", "Amanhã", "Ontem", "Em 3 dias", "Há 2 dias". */
export function relativeDayLabel(
  offset: number,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  if (offset === 0) return t("shop.agenda.today");
  if (offset === 1) return t("agenda.day.tomorrow");
  if (offset === -1) return t("agenda.day.yesterday");
  return offset > 0
    ? t("agenda.day.inDays", { count: offset })
    : t("agenda.day.daysAgo", { count: -offset });
}

/**
 * Troca de dia da Agenda: setas, calendário com o dia por extenso, o rótulo relativo
 * ("Amanhã") com o atalho de volta para hoje e a faixa da semana (hoje em anel, dia escolhido
 * preenchido, dias fechados com lua e contorno tracejado). Como no DatePicker, as 7 colunas
 * dividem a largura (44 px a 390, cerca de 35 px a 320, sempre com 48 px de altura): a semana
 * inteira cabe, sem rolagem escondida nem sábado cortado.
 */
export function AgendaDayNav({
  day,
  today,
  onChange,
  closedWeekdays,
}: {
  day: string;
  today: string;
  onChange: (day: string) => void;
  /** Dias da semana (0 = domingo) em que a barbearia não abre. */
  closedWeekdays: ReadonlySet<number>;
}) {
  const { t, intlLocale } = useI18n();
  const offset = dayOffset(day, today);
  const weekRef = useRef<HTMLOListElement>(null);
  // Quando a faixa rola (tela estreita), o dia escolhido fica à vista sem mexer na página.
  useEffect(() => {
    const list = weekRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const item = list.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!item) return;
    const left =
      item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    if (left < list.scrollLeft || left + item.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left - (list.clientWidth - item.offsetWidth) / 2;
    }
  }, [day]);
  const toDate = (key: string) => {
    const [year, month, date] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, date));
  };
  const format = (key: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: "UTC" }).format(toDate(key));
  const shift = (amount: number) => {
    const next = toDate(day);
    next.setUTCDate(next.getUTCDate() + amount);
    onChange(next.toISOString().slice(0, 10));
  };
  const dayLabel = format(day, {
    weekday: "long",
    day: "2-digit",
    // Mês abreviado: cabe entre as setas no celular e na coluna estreita do computador.
    month: "short",
  });

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <button
          type="button"
          aria-label={t("shop.agenda.prevDayAria")}
          title={t("shop.agenda.prevDay")}
          onClick={() => shift(-1)}
          className="app-icon-button agenda-date-arrow"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="agenda-date-current">
          {/* Linha sempre com 32 px (com ou sem a pílula "Hoje"): a data e as setas não pulam
              ao trocar de dia. */}
          <div className="flex min-h-8 items-center gap-2 px-2">
            <span
              className={cn(
                "text-[0.7rem] font-extrabold uppercase leading-none tracking-wider",
                offset === 0 ? "text-gold" : "text-muted-foreground",
              )}
            >
              {relativeDayLabel(offset, t)}
            </span>
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => onChange(today)}
                // Pílula de 32 px cuja área de toque cresce só para cima (o vão de 12 px da
                // barra) e para os lados, somando 44 px: para baixo fica o calendário, que não
                // pode perder o toque. O min-h-8! vence o 44 px geral dos botões do painel, que
                // empurraria a data para baixo só nos dias que não são hoje.
                className="relative inline-flex h-8 min-h-8! items-center gap-1 rounded-[var(--button-radius)] border border-gold/40 bg-gold/10 px-2.5 text-xs font-bold text-gold after:absolute after:-inset-x-2 after:-top-3 after:bottom-0 after:content-['']"
              >
                <RotateCcw className="size-3" aria-hidden />
                {t("agenda.day.backToday")}
              </button>
            )}
          </div>
          <DatePicker
            compact
            label={t("shop.agenda.pickDate")}
            value={day}
            onChange={onChange}
            displayValue={dayLabel}
            // Mesmo código da faixa da semana: hoje em anel dourado, fechado com lua.
            todayKey={today}
            todayLabel={t("shop.agenda.today")}
            closedDays={(date) => closedWeekdays.has(date.getDay())}
            closedLabel={t("agenda.day.closed")}
          />
        </div>
        <button
          type="button"
          aria-label={t("shop.agenda.nextDayAria")}
          title={t("shop.agenda.nextDay")}
          onClick={() => shift(1)}
          className="app-icon-button agenda-date-arrow"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <ol
        ref={weekRef}
        className="-m-1 grid grid-cols-7 gap-0.5 overflow-x-auto min-[360px]:gap-1 overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={t("agenda.day.weekAria")}
      >
        {weekKeys(day, 0).map((key) => {
          const selected = key === day;
          const isToday = key === today;
          const closed = closedWeekdays.has(weekdayOf(key));
          const full = format(key, { weekday: "long", day: "numeric", month: "long" });
          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={[
                  full,
                  isToday ? t("shop.agenda.today") : null,
                  closed ? t("agenda.day.closed") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                className={cn(
                  "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent hover:border-primary/30",
                  !selected && isToday && "border-gold ring-1 ring-gold",
                  !selected && closed && "text-muted-foreground",
                  !selected && closed && !isToday && "border-dashed border-border",
                )}
              >
                <span aria-hidden className="text-[10px] font-bold uppercase leading-none">
                  {format(key, { weekday: "narrow" })}
                </span>
                <span aria-hidden className="text-sm font-extrabold leading-none tabular-nums">
                  {format(key, { day: "numeric" })}
                </span>
                {closed ? (
                  <Moon aria-hidden className="size-2.5" />
                ) : (
                  <span aria-hidden className="size-2.5" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
