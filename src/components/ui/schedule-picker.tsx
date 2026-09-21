import { useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3, ChevronDown } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { dateFromLocalKey, localDateKey } from "@/lib/shop/appointments";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  displayValue?: string;
};

export function DatePicker({
  value,
  onChange,
  label,
  disabled,
  min,
  max,
  compact = false,
  displayValue,
}: Props & { min?: Date; max?: Date }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className="schedule-field" aria-label={label}>
          <CalendarDays className="size-5 text-gold" />
          <span className="flex-1 text-left">
            {!compact && <span className="block text-xs text-muted-foreground">{label}</span>}
            <span className="font-semibold">
              {displayValue ?? dateFromLocalKey(value).toLocaleDateString("pt-BR")}
            </span>
          </span>
          <ChevronDown className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="schedule-popover w-auto max-w-[calc(100vw-24px)] rounded-lg border-border p-1"
        align="start"
      >
        <Calendar
          locale={ptBR}
          disabled={[...(min ? [{ before: min }] : []), ...(max ? [{ after: max }] : [])]}
          mode="single"
          selected={dateFromLocalKey(value)}
          defaultMonth={dateFromLocalKey(value)}
          onSelect={(date) => {
            if (date) {
              onChange(localDateKey(date));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TimePicker({ value, onChange, label, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value.slice(0, 5));
  const [hour, minute] = draft.split(":");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value.slice(0, 5));
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="schedule-field"
          aria-label={`${label}: ${value.slice(0, 5)}`}
        >
          <Clock3 className="size-5 shrink-0 text-gold" />
          <span className="flex-1 text-left">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value.slice(0, 5)}</span>
          </span>
          <ChevronDown className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="schedule-popover w-64 rounded-lg border-border" align="start">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <Clock3 className="size-4 text-gold" />
          {label}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: "Hora", count: 24, selected: hour },
            { title: "Minuto", count: 60, selected: minute },
          ].map((column, index) => (
            <div key={column.title}>
              <p className="mb-2 text-xs text-muted-foreground">{column.title}</p>
              <div
                className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl bg-muted/50 p-1"
                role="group"
                aria-label={column.title}
              >
                {Array.from({ length: column.count }, (_, n) => String(n).padStart(2, "0")).map(
                  (part) => (
                    <button
                      key={part}
                      type="button"
                      aria-pressed={column.selected === part}
                      className="rounded-lg py-2 text-sm tabular-nums hover:bg-accent/30 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                      onClick={() =>
                        setDraft(index === 0 ? `${part}:${minute}` : `${hour}:${part}`)
                      }
                    >
                      {part}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            onChange(draft);
            setOpen(false);
          }}
        >
          Confirmar horário
        </button>
      </PopoverContent>
    </Popover>
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
          aria-label={`Escolher antecedência: ${value} minutos`}
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
          <Clock3 className="size-4 text-gold" /> Antecedência mínima
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Role as colunas ou use as setas do teclado.
        </p>
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <WheelColumn
            label="Horas"
            values={hourValues}
            value={hours}
            onChange={(nextHours) => setDraft(nextHours === 24 ? 1440 : nextHours * 60 + minutes)}
          />
          <WheelColumn
            label="Minutos"
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
          Confirmar antecedência
        </button>
      </PopoverContent>
    </Popover>
  );
}
