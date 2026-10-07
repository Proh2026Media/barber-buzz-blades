import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ChipValue = string | number;

export type ChoiceChipOption<T extends ChipValue> = {
  value: T;
  label: string;
  /** Nota pequena embaixo do rótulo (ex.: "Padrão"). */
  note?: string;
  icon?: LucideIcon;
  /** Foto ou iniciais (ex.: `<PersonAvatar size="xs" …/>`) antes do rótulo. */
  media?: ReactNode;
  /** Contagem ao lado do rótulo (filtros). */
  count?: number;
  disabled?: boolean;
  /** Nome acessível completo quando o rótulo visível é curto. */
  ariaLabel?: string;
};

/** Pílula "Outro" que abre um campo numérico preciso (só para valores numéricos). */
export type ChoiceChipsOther = {
  /** Texto da pílula; padrão "Outro". */
  label?: string;
  /** Nome do campo numérico; padrão "Outro valor". */
  inputLabel?: string;
  min: number;
  max: number;
  step?: number;
  /** Unidade depois do número (ex.: "min"). */
  unit?: string;
};

type BaseProps<T extends ChipValue> = {
  /** Pergunta do grupo, visível (ex.: "De quanto em quanto tempo"). */
  label: string;
  /** Ícone dourado antes da pergunta. */
  icon?: LucideIcon;
  /** Uma linha de apoio embaixo das opções. */
  hint?: ReactNode;
  /** Esconde a pergunta (fica só para leitor de tela). */
  hideLabel?: boolean;
  options: ChoiceChipOption<T>[];
  disabled?: boolean;
  /** Muitas opções: uma linha com rolagem lateral contida, sem empurrar a página. */
  scroll?: boolean;
  className?: string;
};

type SingleProps<T extends ChipValue> = BaseProps<T> & {
  multiple?: false;
  value: T | null | undefined;
  onChange: (value: T) => void;
  other?: ChoiceChipsOther;
};

type MultipleProps<T extends ChipValue> = BaseProps<T> & {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
};

const CHIP =
  "flex min-h-11 min-w-14 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const CHIP_ON = "border-primary bg-primary text-primary-foreground";
const CHIP_OFF = "border-border bg-background hover:border-primary/40";

/**
 * Escolha em botões (pílulas de 44 px): poucas opções à vista no lugar de uma lista suspensa.
 * Escolha única vira `radiogroup` (setas do teclado trocam a opção); `multiple` vira um grupo de
 * caixas de seleção. A escolhida fica preenchida na cor principal.
 */
export function ChoiceChips<T extends ChipValue>(props: SingleProps<T> | MultipleProps<T>) {
  const { t } = useI18n();
  const { label, icon: Icon, hint, hideLabel, options, disabled, scroll, className } = props;
  const labelId = useId();
  const hintId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const multiple = props.multiple === true;
  const selected: readonly T[] = props.multiple
    ? props.value
    : props.value === null || props.value === undefined
      ? []
      : [props.value];

  const other = props.multiple ? undefined : props.other;
  const singleValue = props.multiple ? undefined : props.value;
  const customValue =
    other && typeof singleValue === "number" && !options.some((o) => o.value === singleValue)
      ? singleValue
      : null;
  const [otherOpen, setOtherOpen] = useState(false);
  const otherActive = Boolean(other) && (otherOpen || customValue !== null);
  const [draft, setDraft] = useState(customValue === null ? "" : String(customValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customValue !== null) setDraft(String(customValue));
  }, [customValue]);

  // Itens navegáveis: as opções e, se houver, a pílula "Outro" no fim.
  const count = options.length + (other ? 1 : 0);
  const isEnabled = (index: number) =>
    !disabled && (index >= options.length || !options[index]?.disabled);
  const selectedIndex = otherActive
    ? options.length
    : options.findIndex((o) => selected.includes(o.value));
  const firstEnabled = Array.from({ length: count }, (_, i) => i).find(isEnabled) ?? 0;
  const tabStop = selectedIndex >= 0 && isEnabled(selectedIndex) ? selectedIndex : firstEnabled;

  function choose(index: number, fromKeyboard = false) {
    if (index >= options.length) {
      setOtherOpen(true);
      // No toque, já leva ao campo; pelas setas, o foco fica na pílula (Tab chega ao campo).
      if (!fromKeyboard) window.setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    const option = options[index];
    if (!option) return;
    if (props.multiple) {
      const next = selected.includes(option.value)
        ? selected.filter((v) => v !== option.value)
        : [...selected, option.value];
      props.onChange(next);
    } else {
      setOtherOpen(false);
      props.onChange(option.value);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (multiple) return;
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    let target = -1;
    if (step !== 0) {
      for (let i = 1; i <= count; i += 1) {
        const candidate = (index + step * i + count) % count;
        if (isEnabled(candidate)) {
          target = candidate;
          break;
        }
      }
    } else if (event.key === "Home") {
      target = firstEnabled;
    } else if (event.key === "End") {
      target = [...Array(count).keys()].reverse().find(isEnabled) ?? -1;
    }
    if (target < 0) return;
    event.preventDefault();
    refs.current[target]?.focus();
    choose(target, true);
  }

  function commitOther() {
    if (!other || props.multiple) return;
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || draft.trim() === "") {
      // Campo vazio: volta a mostrar a escolha que continua valendo.
      if (customValue === null) setOtherOpen(false);
      return;
    }
    const stepSize = other.step ?? 1;
    const rounded = Math.round(parsed / stepSize) * stepSize;
    const clamped = Math.min(other.max, Math.max(other.min, rounded));
    setDraft(String(clamped));
    // Valor que já tem pílula própria: marca a pílula em vez de "Outro".
    if (options.some((o) => o.value === clamped)) setOtherOpen(false);
    (props.onChange as (value: number) => void)(clamped);
  }

  const role = multiple ? "checkbox" : "radio";

  return (
    <div className={cn("space-y-2", className)}>
      <p
        id={labelId}
        className={cn("flex items-center gap-2 text-sm font-bold", hideLabel && "sr-only")}
      >
        {Icon && <Icon className="size-4 shrink-0 text-gold" aria-hidden />}
        {label}
      </p>
      <div
        role={multiple ? "group" : "radiogroup"}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex gap-2",
          scroll ? "-mx-1 flex-nowrap overflow-x-auto overscroll-x-contain px-1 pb-1" : "flex-wrap",
        )}
      >
        {options.map((option, index) => {
          const on = selected.includes(option.value) && !(otherActive && !multiple);
          const OptionIcon = option.icon;
          return (
            <button
              key={String(option.value)}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role={role}
              aria-checked={on}
              aria-label={option.ariaLabel}
              tabIndex={multiple ? undefined : index === tabStop ? 0 : -1}
              disabled={disabled || option.disabled}
              onClick={() => choose(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, option.disabled && "opacity-50")}
            >
              {option.media}
              {OptionIcon && <OptionIcon className="size-4 shrink-0" aria-hidden />}
              <span className="flex flex-col items-center">
                <span>{option.label}</span>
                {option.note && (
                  <span className="text-[10px] font-semibold leading-none opacity-80">
                    {/* Separa rótulo e nota no nome lido pelo leitor de tela ("15 min, Padrão"). */}
                    <span className="sr-only">, </span>
                    {option.note}
                  </span>
                )}
              </span>
              {option.count !== undefined && (
                <span
                  className={cn(
                    "rounded-[var(--control-radius)] px-1.5 py-0.5 text-xs",
                    on ? "bg-primary-foreground/20" : "bg-muted text-foreground",
                  )}
                >
                  <span className="sr-only">, </span>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
        {other && (
          <button
            ref={(el) => {
              refs.current[options.length] = el;
            }}
            type="button"
            role="radio"
            aria-checked={otherActive}
            tabIndex={options.length === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => choose(options.length)}
            onKeyDown={(event) => onKeyDown(event, options.length)}
            className={cn(CHIP, otherActive ? CHIP_ON : CHIP_OFF)}
          >
            <span className="flex flex-col items-center">
              <span>
                {customValue !== null
                  ? `${customValue}${other.unit ? ` ${other.unit}` : ""}`
                  : `${other.label ?? t("visual.choice.other")}…`}
              </span>
              {customValue !== null && (
                <span className="text-[10px] font-semibold leading-none opacity-80">
                  <span className="sr-only">, </span>
                  {other.label ?? t("visual.choice.other")}
                </span>
              )}
            </span>
          </button>
        )}
      </div>
      {other && otherActive && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <span>{other.inputLabel ?? t("visual.choice.otherValue")}</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={other.min}
            max={other.max}
            step={other.step ?? 1}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitOther}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitOther();
              }
            }}
            className="min-h-11 w-24 rounded-xl border border-border bg-background px-3 text-base tabular-nums"
          />
          {other.unit && <span className="text-muted-foreground">{other.unit}</span>}
        </label>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
