import { Check, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconTile } from "./SectionHeader";

export type ChoiceCardOption<T extends string> = {
  value: T;
  title: string;
  /** Uma linha com o efeito da escolha. */
  description?: ReactNode;
  icon?: LucideIcon;
  /** Miniatura, foto ou avatar no lugar do ícone. */
  media?: ReactNode;
  /** Exemplo do resultado (ex.: pílulas de horário), mostrado dentro do cartão. */
  content?: ReactNode;
  disabled?: boolean;
};

/**
 * Cartões de escolha única (rádios acessíveis): ícone em quadrado, título, uma linha de efeito,
 * um exemplo opcional e o círculo com ✓ sempre à direita. A escolhida ganha borda de 2 px e fundo
 * suave na cor principal. Setas do teclado trocam a opção; o foco aparece no cartão inteiro.
 * `value` pode ser `null` para não deixar nada pré-marcado (escolhas destrutivas).
 */
export function ChoiceCards<T extends string>({
  legend,
  showLegend,
  value,
  onChange,
  options,
  disabled,
  columns = 2,
  name,
  className,
}: {
  /** Pergunta do grupo; fica só para leitor de tela, a menos que `showLegend`. */
  legend: string;
  showLegend?: boolean;
  value: T | null;
  onChange: (value: T) => void;
  options: ChoiceCardOption<T>[];
  disabled?: boolean;
  /** Colunas a partir de 640 px. No celular é sempre uma coluna. */
  columns?: 1 | 2 | 3;
  name?: string;
  className?: string;
}) {
  const autoName = useId();
  const group = name ?? autoName;
  return (
    <fieldset
      className={cn(
        "grid gap-2",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        className,
      )}
    >
      <legend
        className={cn(showLegend ? "mb-2 flex items-center gap-2 text-sm font-bold" : "sr-only")}
      >
        {legend}
      </legend>
      {options.map((option) => {
        const selected = value === option.value;
        const off = disabled || option.disabled;
        const titleId = `${group}-${option.value}-title`;
        const describedBy = [
          option.description ? `${group}-${option.value}-text` : null,
          option.content ? `${group}-${option.value}-example` : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <label
            key={option.value}
            className={cn(
              "relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-4 transition has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold",
              selected
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
              option.disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={group}
              value={option.value}
              checked={selected}
              disabled={off}
              aria-labelledby={titleId}
              aria-describedby={describedBy || undefined}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex items-center gap-2">
              {option.media ??
                (option.icon && (
                  <IconTile icon={option.icon} size="sm" tone={selected ? "selected" : "muted"} />
                ))}
              <span id={titleId} className="min-w-0 flex-1 text-sm font-bold">
                {option.title}
              </span>
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border-2",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {selected && <Check className="size-3.5" />}
              </span>
            </span>
            {option.description && (
              <span id={`${group}-${option.value}-text`} className="text-xs text-muted-foreground">
                {option.description}
              </span>
            )}
            {option.content && (
              <span id={`${group}-${option.value}-example`}>{option.content}</span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
