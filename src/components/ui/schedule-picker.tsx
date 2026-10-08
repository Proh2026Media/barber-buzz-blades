import { useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3, ChevronDown, Moon } from "lucide-react";
import { enGB, enUS, es, pt, ptBR } from "date-fns/locale";
import { labelDayButton, type DayButtonProps } from "react-day-picker";
import { Calendar, CalendarDayButton } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { dateFromLocalKey, localDateKey } from "@/lib/shop/appointments";
import { useI18n, type Locale } from "@/lib/i18n";

const CALENDAR_LOCALE = {
  "pt-BR": ptBR,
  "pt-PT": pt,
  "en-US": enUS,
  "en-GB": enGB,
  es,
} satisfies Record<Locale, typeof ptBR>;

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  displayValue?: string;
};

/** Dia do calendário com a lua dos dias fechados (mesmo sinal da faixa da semana da Agenda). */
function MarkedDayButton({ children, modifiers, ...props }: DayButtonProps) {
  return (
    <CalendarDayButton modifiers={modifiers} {...props}>
      {children}
      {modifiers.closed && <Moon aria-hidden className="size-2.5 shrink-0" />}
    </CalendarDayButton>
  );
}

const MARKED_DAY_COMPONENTS = { DayButton: MarkedDayButton };

export function DatePicker({
  value,
  onChange,
  label,
  disabled,
  min,
  max,
  compact = false,
  displayValue,
  dayMarks,
  closedDays,
  closedLabel,
  todayLabel,
  todayKey,
}: Props & {
  min?: Date;
  max?: Date;
  /**
   * Dias em que a loja não abre: número esmaecido (contraste AA) com uma lua embaixo e, com
   * `closedLabel`, legenda e nome do dia para leitor de tela. O dia continua tocável.
   */
  closedDays?: (date: Date) => boolean;
  closedLabel?: string;
  /**
   * Com um texto ("Hoje"), hoje ganha anel dourado — diferente do dia escolhido, que é
   * preenchido — e entra na legenda. Sem ele, o calendário fica como sempre foi.
   */
  todayLabel?: string;
  /** Hoje no fuso da loja (AAAA-MM-DD). Padrão: a data do aparelho. */
  todayKey?: string;
  /**
   * Marcas nos dias: `muted` = traço tracejado embaixo do número (ex.: loja fechada; o dia
   * continua tocável e legível) e `dotted` = pontinho vermelho no canto (ex.: já tem bloqueio).
   * Com `mutedLabel`/`dottedLabel`, o nome do dia ganha o estado e aparece uma legenda.
   */
  dayMarks?: {
    muted?: (date: Date) => boolean;
    dotted?: (date: Date) => boolean;
    mutedLabel?: string;
    dottedLabel?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const { locale, intlLocale, t } = useI18n();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="schedule-field"
          aria-label={`${label}: ${displayValue ?? dateFromLocalKey(value).toLocaleDateString(intlLocale)}`}
        >
          <CalendarDays className="size-5 shrink-0 text-gold" />
          <span className="min-w-0 flex-1 overflow-hidden text-left">
            {!compact && <span className="block text-xs text-muted-foreground">{label}</span>}
            <span className="font-semibold">
              {displayValue ?? dateFromLocalKey(value).toLocaleDateString(intlLocale)}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        // Abaixo de 360 px, 7 colunas de 44 px não cabem com a margem de 16 px: o mês ocupa a
        // largura da tela, sem respiro extra, e os dias ficam um pouco mais estreitos (cerca de
        // 40 px a 320 px; 44 px de altura mantidos), sem cortar sábado nem a seta. Exceção
        // registrada em docs/mb-interface.md.
        className="schedule-popover w-auto max-w-[calc(100vw-32px)] rounded-lg border-border p-1 max-[359px]:p-0 max-[359px]:[&_[data-slot=calendar]]:w-[calc(100vw-34px)] max-[359px]:[&_[data-slot=calendar]]:p-0.5 max-[359px]:[&_td]:aspect-auto max-[359px]:[&_td_button]:aspect-auto max-[359px]:[&_td_button]:min-w-0"
        align="start"
        // Mantém o calendário dentro da margem de 16 px do celular (antes encostava na borda).
        collisionPadding={16}
      >
        <Calendar
          locale={CALENDAR_LOCALE[locale]}
          disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
          mode="single"
          selected={dateFromLocalKey(value)}
          defaultMonth={dateFromLocalKey(value)}
          {...(todayKey ? { today: dateFromLocalKey(todayKey) } : {})}
          {...(closedDays ? { components: MARKED_DAY_COMPONENTS } : {})}
          modifiers={{
            ...(dayMarks?.muted ? { muted: dayMarks.muted } : {}),
            ...(dayMarks?.dotted ? { dotted: dayMarks.dotted } : {}),
            ...(closedDays ? { closed: closedDays } : {}),
            ...(todayLabel
              ? { markedToday: todayKey ? dateFromLocalKey(todayKey) : new Date() }
              : {}),
          }}
          modifiersClassNames={{
            // Fechado: texto apagado (sem opacidade, que derrubaria o contraste) e a lua do botão.
            closed: "[&>button:not([data-selected-single=true])]:text-muted-foreground",
            // Hoje: anel dourado por dentro; o escolhido segue preenchido. Hoje escolhido: o anel
            // dourado fica na borda, separado do preenchimento por uma faixa na cor do fundo de
            // hoje (accent), para o dourado encostar só nele (contraste >= 3:1 no claro e no
            // escuro; sobre o preenchimento ficava abaixo disso).
            markedToday:
              "[&>button:not([data-selected-single=true])]:ring-2 [&>button:not([data-selected-single=true])]:ring-inset [&>button:not([data-selected-single=true])]:ring-gold [&>button[data-selected-single=true]]:shadow-[inset_0_0_0_2px_var(--gold),inset_0_0_0_4px_var(--accent)]",
            muted:
              "relative before:pointer-events-none before:absolute before:bottom-0.5 before:left-1/2 before:w-3.5 before:-translate-x-1/2 before:border-t-2 before:border-dashed before:border-[color:var(--tone-neutral-line)]",
            dotted:
              "relative after:pointer-events-none after:absolute after:right-0.5 after:top-0.5 after:size-1.5 after:rounded-full after:bg-[color:var(--tone-danger-line)]",
          }}
          labels={{
            labelDayButton: (date, modifiers, options, dateLib) =>
              [
                // "Selecionado" e, com `todayLabel`, "hoje" saem no idioma do app (não no
                // "selected"/"Today" em inglês da biblioteca).
                labelDayButton(
                  date,
                  todayLabel
                    ? { ...modifiers, today: false, selected: false }
                    : { ...modifiers, selected: false },
                  options,
                  dateLib,
                ),
                modifiers.selected ? t("visual.calendar.selected") : null,
                modifiers.markedToday ? todayLabel : null,
                modifiers.closed ? closedLabel : null,
                modifiers.muted ? dayMarks?.mutedLabel : null,
                modifiers.dotted ? dayMarks?.dottedLabel : null,
              ]
                .filter(Boolean)
                .join(", "),
          }}
          onSelect={(date) => {
            if (date) {
              onChange(localDateKey(date));
              setOpen(false);
            }
          }}
        />
        {(dayMarks?.mutedLabel ||
          dayMarks?.dottedLabel ||
          todayLabel ||
          (closedDays && closedLabel)) && (
          <p
            className="flex flex-wrap gap-x-3 gap-y-1 px-3 pb-2 text-xs text-muted-foreground"
            aria-hidden
          >
            {todayLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3.5 rounded-[min(var(--control-radius),0.3rem)] ring-2 ring-inset ring-gold" />
                {todayLabel}
              </span>
            )}
            {closedDays && closedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Moon className="size-3" />
                {closedLabel}
              </span>
            )}
            {dayMarks?.mutedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 border-t-2 border-dashed border-[color:var(--tone-neutral-line)]" />
                {dayMarks.mutedLabel}
              </span>
            )}
            {dayMarks?.dottedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[color:var(--tone-danger-line)]" />
                {dayMarks.dottedLabel}
              </span>
            )}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

const QUICK_MINUTES = ["00", "15", "30", "45"];
const FIVE_MINUTES = Array.from({ length: 12 }, (_, n) => String(n * 5).padStart(2, "0"));

/**
 * Escolha de hora sem rolagem interna: as 24 horas à vista (6 por linha) e os minutos mais
 * usados em botões grandes (00 · 15 · 30 · 45). "Outro minuto" abre a grade de 5 em 5; um minuto
 * fora dela que já estava gravado continua aparecendo e escolhido. (Não confundir com o TimeGrid
 * da reserva do cliente, que mostra os horários livres.)
 */
export function HourMinuteGrid({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Nome do grupo para leitor de tela ("Segunda, abertura"). */
  label: string;
}) {
  const { t } = useI18n();
  const [hour = "09", minute = "00"] = value.slice(0, 5).split(":");
  const [otherOpen, setOtherOpen] = useState(!QUICK_MINUTES.includes(minute));
  const minutes = otherOpen
    ? FIVE_MINUTES.includes(minute)
      ? FIVE_MINUTES
      : [...FIVE_MINUTES, minute].sort()
    : QUICK_MINUTES;
  const cell =
    "min-h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors hover:bg-accent/30 aria-pressed:bg-primary aria-pressed:text-primary-foreground";
  return (
    <div className="space-y-3">
      <div role="group" aria-label={`${label} · ${t("ui.time.hour")}`}>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("ui.time.hour")}</p>
        <div className="grid grid-cols-6 gap-1 rounded-xl bg-muted/50 p-1">
          {Array.from({ length: 24 }, (_, n) => String(n).padStart(2, "0")).map((part) => (
            <button
              key={part}
              type="button"
              aria-pressed={hour === part}
              className={cell}
              onClick={() => onChange(`${part}:${minute}`)}
            >
              {part}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={`${label} · ${t("ui.time.minute")}`}>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("ui.time.minute")}</p>
        <div
          className={`grid gap-1 rounded-xl bg-muted/50 p-1 ${otherOpen ? "grid-cols-6" : "grid-cols-5"}`}
        >
          {minutes.map((part) => (
            <button
              key={part}
              type="button"
              aria-pressed={minute === part}
              className={cell}
              onClick={() => onChange(`${hour}:${part}`)}
            >
              :{part}
            </button>
          ))}
          {!otherOpen && (
            <button
              type="button"
              className={`${cell} px-1 text-xs`}
              aria-expanded={false}
              onClick={() => setOtherOpen(true)}
            >
              {t("ui.time.otherMinute")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WheelColumn({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<number | null>(null);

  useEffect(() => {
    const index = Math.max(0, values.indexOf(value));
    viewportRef.current?.scrollTo({ top: index * 44 });
  }, [value, values]);

  useEffect(
    () => () => {
      if (scrollingRef.current !== null) window.clearTimeout(scrollingRef.current);
    },
    [],
  );

  return (
    <div className="min-w-0">
      <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="duration-wheel-shell">
        <div className="duration-wheel-selection" aria-hidden />
        <div
          ref={viewportRef}
          className="duration-wheel"
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={(event) => {
            if (scrollingRef.current !== null) window.clearTimeout(scrollingRef.current);
            const target = event.currentTarget;
            scrollingRef.current = window.setTimeout(() => {
              const index = clampWheelIndex(Math.round(target.scrollTop / 44), values.length);
              const next = values[index];
              if (next !== undefined && next !== value) onChange(next);
            }, 80);
          }}
          onKeyDown={(event) => {
            const index = Math.max(0, values.indexOf(value));
            const nextIndex =
              event.key === "ArrowDown"
                ? clampWheelIndex(index + 1, values.length)
                : event.key === "ArrowUp"
                  ? clampWheelIndex(index - 1, values.length)
                  : null;
            if (nextIndex !== null) {
              event.preventDefault();
              onChange(values[nextIndex] ?? value);
            }
          }}
        >
          {values.map((part) => (
            <button
              key={part}
              type="button"
              role="option"
              aria-selected={part === value}
              className="duration-wheel-option"
              onClick={() => onChange(part)}
            >
              {String(part).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function clampWheelIndex(index: number, length: number) {
  return Math.max(0, Math.min(Math.max(0, length - 1), index));
}

export function DurationPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const hours = Math.floor(draft / 60);
  const minutes = draft % 60;
  const hourValues = Array.from({ length: 25 }, (_, index) => index);
  const minuteValues = hours === 24 ? [0] : Array.from({ length: 60 }, (_, index) => index);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(Math.max(0, Math.min(1440, value)));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="waiting-cutoff-pill"
          aria-label={t("ui.duration.choose", { minutes: value })}
          aria-haspopup="dialog"
        >
          {value < 60
            ? `${value} min`
            : value % 60 === 0
              ? `${value / 60}h`
              : `${Math.floor(value / 60)}h ${value % 60}min`}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="schedule-popover w-72 max-w-[calc(100vw-24px)] rounded-2xl border-border p-4"
        align="end"
      >
        <p className="flex items-center gap-2 font-semibold">
          <Clock3 className="size-4 text-gold" /> {t("ui.duration.title")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t("ui.duration.hint")}</p>
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <WheelColumn
            label={t("ui.duration.hours")}
            values={hourValues}
            value={hours}
            onChange={(nextHours) => setDraft(nextHours === 24 ? 1440 : nextHours * 60 + minutes)}
          />
          <WheelColumn
            label={t("ui.duration.minutes")}
            values={minuteValues}
            value={minutes}
            onChange={(nextMinutes) => setDraft(hours * 60 + nextMinutes)}
          />
        </div>
        <p className="mt-3 text-center text-sm font-bold tabular-nums" aria-live="polite">
          {hours}h {String(minutes).padStart(2, "0")}min
        </p>
        <button
          type="button"
          className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            onChange(draft);
            setOpen(false);
          }}
        >
          {t("ui.duration.confirm")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
