import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Maior palavra (em letras) que cabe inteira num cartão de 3 colunas: até 8 em qualquer
 * celular (320 px); até 10 a partir de 380 px; acima disso, 3 colunas só a partir de 640 px.
 */
const WORD_FITS_ANY = 8;
const WORD_FITS_380 = 10;

export type CompactChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** Miniatura ou ilustração do efeito da escolha. */
  media: ReactNode;
  /** Nota curta embaixo do rótulo (ex.: "Padrão"). */
  note?: string;
  /** Efeito da escolha, lido pelo leitor de tela (a miniatura já mostra). */
  description?: string;
  disabled?: boolean;
};

/**
 * Variação compacta dos cartões de escolha (`ChoiceCards` de `@/components/visual`) para
 * miniaturas: 2 ou 3 por linha também no celular. Mesmo jeito de mostrar a seleção — borda de
 * 2 px na cor principal, fundo suave e círculo com ✓ —, rádio nativo escondido (as setas do
 * teclado trocam a opção) e foco visível no cartão inteiro. Os cantos seguem o modo escolhido.
 */
export function CompactChoiceTiles<T extends string>({
  legend,
  showLegend,
  value,
  onChange,
  options,
  columns = 3,
  name,
  disabled,
  className,
}: {
  /** Pergunta do grupo; fica só para leitor de tela, a menos que `showLegend`. */
  legend: string;
  showLegend?: boolean;
  value: T | null;
  onChange: (value: T) => void;
  options: CompactChoiceOption<T>[];
  columns?: 2 | 3;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const autoName = useId();
  const group = name ?? autoName;
  // Palavra longa ("Arredondados", "formulário") não cabe inteira em 3 colunas no celular:
  // passa a 2 colunas nas telas estreitas em vez de partir a palavra.
  const longestWord = Math.max(
    0,
    ...options.flatMap((option) => option.label.split(/\s+/).map((word) => word.length)),
  );
  const grid =
    columns === 2
      ? "grid-cols-2"
      : longestWord > WORD_FITS_380
        ? "grid-cols-2 sm:grid-cols-3"
        : longestWord > WORD_FITS_ANY
          ? "grid-cols-2 min-[380px]:grid-cols-3"
          : "grid-cols-3";
  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className={showLegend ? "mb-2 text-sm font-bold" : "sr-only"}>{legend}</legend>
      {/* pt-2 e gap-x-3: espaço para o selo de seleção, que fica no canto, fora da miniatura. */}
      <div className={cn("grid gap-x-3 gap-y-4 pt-2", grid)}>
        {options.map((option) => {
          const selected = value === option.value;
          const id = `${group}-${option.value}`;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border-2 p-2 transition has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-gold",
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
                disabled={option.disabled}
                aria-describedby={option.description ? `${id}-text` : undefined}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* O selo com ✓ fica sobre a borda do cartão, fora da miniatura: não cobre o
                  detalhe que mostra o efeito, e o nome continua com a largura inteira. */}
              <span
                aria-hidden
                className={cn(
                  "absolute -right-2 -top-2 z-[1] grid size-5 place-items-center rounded-full border-2 shadow-sm",
                  selected
                    ? "border-card bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 bg-card",
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span aria-hidden className="block min-w-0">
                {option.media}
              </span>
              <span className="min-h-6 min-w-0 break-words text-[13px] font-bold leading-tight">
                {option.label}
                {option.note && (
                  <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
                    <span className="sr-only">, </span>
                    {option.note}
                  </span>
                )}
              </span>
              {option.description && (
                <span id={`${id}-text`} className="sr-only">
                  {option.description}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
