import { useId, useState } from "react";
import { Check, ChevronDown, Pipette, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BRAND_PALETTE,
  HEX_COLOR_PATTERN,
  contrastRatio,
  contrastingForeground,
  normalizeBrandColor,
} from "@/lib/shop/branding";

type BrandColorPickerProps = {
  label: string;
  description: string;
  value: string;
  defaultValue: string;
  /** Texto de exemplo mostrado sobre a cor para avaliar a leitura. */
  sampleText?: string;
  /** Permite valor vazio (transparente), exibindo um estado "Sem fundo". */
  allowEmpty?: boolean;
  onChange: (value: string) => void;
};

/**
 * Seletor de cor da marca: amostra grande, paleta curada, cor livre e código hexadecimal.
 * A leitura sobre a cor é avaliada na hora para evitar combinações ilegíveis.
 */
export function BrandColorPicker({
  label,
  description,
  value,
  defaultValue,
  sampleText = "Agendar horário",
  allowEmpty = false,
  onChange,
}: BrandColorPickerProps) {
  const hexId = useId();
  const nativeId = useId();
  const [open, setOpen] = useState(false);
  const isEmpty = allowEmpty && value === "";
  const validValue = isEmpty ? "#ffffff" : normalizeBrandColor(value, defaultValue);
  const invalid = !isEmpty && !HEX_COLOR_PATTERN.test(value);
  const foreground = contrastingForeground(validValue);
  const ratio = contrastRatio(foreground, validValue);
  const paletteName = BRAND_PALETTE.find((entry) => entry.value === validValue)?.name;
  const isDefault = isEmpty || validValue === defaultValue.toUpperCase();

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${paletteName ?? validValue}. Abrir seletor de cor`}
            aria-expanded={open}
            className="brand-color-trigger group flex min-h-[4.5rem] w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span
              className={`flex w-20 shrink-0 items-center justify-center text-xs font-bold ${isEmpty ? "checkerboard" : ""}`}
              style={isEmpty ? undefined : { backgroundColor: validValue, color: foreground }}
              aria-hidden="true"
            >
              {isEmpty ? "—" : "Aa"}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {isEmpty ? (
                    "Sem fundo (transparente)"
                  ) : (
                    <>
                      {paletteName ? `${paletteName} · ` : ""}
                      <span className="font-mono">{validValue}</span>
                      {isDefault ? " · padrão" : ""}
                    </>
                  )}
                </span>
              </span>
              <ChevronDown
                className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="brand-color-popover z-[70] w-[min(24rem,calc(100vw-1.5rem))] max-h-none overflow-visible rounded-3xl border-border bg-card p-0 text-card-foreground shadow-2xl"
        >
          <div className="space-y-4 p-4">
            <div
              className="flex min-h-24 flex-col justify-between rounded-2xl p-4 shadow-inner"
              style={{ backgroundColor: validValue, color: foreground }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold opacity-80">{label}</p>
                <span className="rounded-full bg-black/10 px-2 py-0.5 font-mono text-[11px] font-bold">
                  {validValue}
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-base font-extrabold">{sampleText}</p>
                <p className="text-[11px] font-semibold opacity-80">
                  Leitura {ratio >= 4.5 ? "ótima" : ratio >= 3 ? "boa" : "fraca"} ·{" "}
                  {ratio.toFixed(1)}:1
                </p>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                Paleta sugerida
              </legend>
              <div className="grid grid-cols-8 gap-1.5">
                {BRAND_PALETTE.map((entry) => {
                  const selected = validValue === entry.value;
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      aria-label={`${entry.name} ${entry.value}`}
                      aria-pressed={selected}
                      title={entry.name}
                      onClick={() => onChange(entry.value)}
                      className={`flex aspect-square min-h-10 items-center justify-center rounded-xl border border-black/10 shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "ring-2 ring-ring ring-offset-2" : ""}`}
                      style={{ backgroundColor: entry.value }}
                    >
                      {selected && (
                        <Check
                          className="size-4"
                          style={{ color: contrastingForeground(entry.value) }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <div className="space-y-1.5">
                <label htmlFor={hexId} className="text-xs font-semibold text-muted-foreground">
                  Código da cor
                </label>
                <input
                  id={hexId}
                  value={value}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="text"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${hexId}-error` : undefined}
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    onChange((next.startsWith("#") ? next : `#${next}`).toUpperCase());
                  }}
                  className="min-h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm font-semibold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={defaultValue}
                />
              </div>
              <label
                htmlFor={nativeId}
                className="relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold transition hover:bg-muted focus-within:ring-2 focus-within:ring-ring"
              >
                <Pipette className="size-4" aria-hidden="true" />
                Outra cor
                <input
                  id={nativeId}
                  type="color"
                  value={validValue}
                  aria-label={`Escolher ${label.toLocaleLowerCase("pt-BR")} livremente`}
                  onChange={(event) => onChange(event.target.value.toUpperCase())}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
              </label>
            </div>
            {invalid && (
              <p id={`${hexId}-error`} className="-mt-2 text-xs font-medium text-destructive">
                Use o formato #RRGGBB, por exemplo {defaultValue}.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDefault}
                onClick={() => onChange(defaultValue)}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold transition hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {allowEmpty && defaultValue === "" ? "Sem fundo" : "Padrão"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Pronto
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
