import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { HourMinuteGrid } from "@/components/ui/schedule-picker";
import { FieldMessage } from "@/components/visual";
import { cn } from "@/lib/utils";

/**
 * Faixa de horário em uma tela só: dois botões grandes ("Abre 09:00" | "Fecha 19:00") e a grade
 * de horas do lado escolhido. A validação aparece na hora, junto da faixa.
 */
export function TimeRangeEditor({
  start,
  end,
  onChange,
  startLabel,
  endLabel,
  context,
  error,
}: {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  startLabel: string;
  endLabel: string;
  /** Contexto para leitor de tela ("Segunda"). */
  context: string;
  /** Erro já traduzido (ex.: fecha antes de abrir). */
  error?: string | null;
}) {
  const [side, setSide] = useState<"start" | "end">("start");
  const sides = [
    { id: "start" as const, label: startLabel, value: start, icon: LogIn },
    { id: "end" as const, label: endLabel, value: end, icon: LogOut },
  ];
  const current = sides.find((item) => item.id === side) ?? sides[0];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {sides.map((item) => {
          const Icon = item.icon;
          const selected = item.id === side;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              aria-invalid={item.id === "end" && error ? true : undefined}
              onClick={() => setSide(item.id)}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40",
                item.id === "end" && error && "border-[color:var(--tone-danger-line)]",
              )}
            >
              <Icon className="size-5 shrink-0 text-gold" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-muted-foreground">
                  {item.label}
                </span>
                <span className="block whitespace-nowrap text-lg font-extrabold tabular-nums leading-tight">
                  {item.value.slice(0, 5)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <FieldMessage tone="error">{error}</FieldMessage>}
      <HourMinuteGrid
        key={side}
        value={current.value}
        label={`${context}, ${current.label}`}
        onChange={(value) =>
          onChange(side === "start" ? { start: value, end } : { start, end: value })
        }
      />
    </div>
  );
}
