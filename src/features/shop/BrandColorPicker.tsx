import { useId, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Pipette,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FieldMessage, MoreDetails, StatusBadge, type Tone } from "@/components/visual";
import { useI18n, type MessageKey } from "@/lib/i18n";
import {
  BRAND_PALETTE,
  HEX_COLOR_PATTERN,
  contrastRatio,
  contrastingForeground,
  normalizeBrandColor,
} from "@/lib/shop/branding";

/** Leitura do texto sobre a cor em 3 níveis: fácil, pode cansar, difícil. */
function readingLevel(ratio: number): { tone: Tone; icon: LucideIcon; label: MessageKey } {
  if (ratio >= 4.5) return { tone: "success", icon: CheckCircle2, label: "brand.color.easy" };
  if (ratio >= 3) return { tone: "warning", icon: AlertTriangle, label: "brand.color.tiring" };
  return { tone: "danger", icon: XCircle, label: "brand.color.hard" };
}

type BrandColorPickerProps = {
  label: string;
  /** Para que serve a cor, em poucas palavras (aparece no botão). */
  description?: string;
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
  sampleText,
  allowEmpty = false,
  onChange,
}: BrandColorPickerProps) {
  const { t, intlLocale } = useI18n();
  const sample = sampleText ?? t("brand.color.sample");
  const hexId = useId();
  const nativeId = useId();
  const [open, setOpen] = useState(false);
  const isEmpty = allowEmpty && value === "";
  const validValue = isEmpty ? "#ffffff" : normalizeBrandColor(value, defaultValue);
  const invalid = !isEmpty && !HEX_COLOR_PATTERN.test(value);
  const foreground = contrastingForeground(validValue);
  const reading = readingLevel(contrastRatio(foreground, validValue));
  const paletteEntry = BRAND_PALETTE.find((entry) => entry.value === validValue);
  const paletteName = paletteEntry ? t(paletteEntry.nameKey) : undefined;
  // Compara o valor bruto: um hex parcial (ex.: "#12") não conta como padrão,
  // para o botão de voltar ao padrão / "Sem fundo" continuar disponível.
  const isDefault = isEmpty || value.toUpperCase() === defaultValue.toUpperCase();

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("brand.color.triggerAria", { label, value: paletteName ?? validValue })}
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
                <span className="block truncate text-sm text-muted-foreground">
                  {isEmpty
                    ? t("brand.color.transparent")
                    : `${paletteName ?? t("brand.color.customName")}${
                        isDefault ? ` · ${t("brand.color.defaultTag")}` : ""
                      }`}
                </span>
                {description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {description}
                  </span>
                )}
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
              <p className="text-sm font-semibold opacity-80">
                {isEmpty ? t("brand.color.transparent") : (paletteName ?? label)}
              </p>
              <p className="text-base font-extrabold">{sample}</p>
            </div>
            {/* Leitura em 3 níveis, com ícone, cor e palavra (sem número). */}
            {!isEmpty && (
              <StatusBadge
                tone={reading.tone}
                icon={reading.icon}
                label={t(reading.label)}
                className="-mt-2"
              />
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted-foreground">
                {t("brand.color.palette")}
              </legend>
              {/* Amostras de pelo menos 44 px: a grade cria quantas colunas couberem. */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                {BRAND_PALETTE.map((entry) => {
                  const selected = validValue === entry.value;
                  const name = t(entry.nameKey);
                  return (
                    <button
                      key={entry.value}
                      type="button"
                      aria-label={`${name} ${entry.value}`}
                      aria-pressed={selected}
                      title={name}
                      onClick={() => onChange(entry.value)}
                      className={`flex aspect-square min-h-10 items-center justify-center rounded-xl border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "ring-2 ring-ring ring-offset-2" : ""}`}
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

            <MoreDetails
              summary={t("brand.color.more")}
              icon={Pipette}
              defaultOpen={invalid || (!isEmpty && !paletteEntry)}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <div className="space-y-1.5">
                  <label htmlFor={hexId} className="text-sm font-semibold text-muted-foreground">
                    {t("brand.color.hexLabel")}
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
                      // Com fundo opcional, apagar o campo volta ao estado "Sem fundo".
                      if (allowEmpty && (next === "" || next === "#")) {
                        onChange("");
                        return;
                      }
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
                  {t("brand.color.other")}
                  <input
                    id={nativeId}
                    type="color"
                    value={validValue}
                    aria-label={t("brand.color.nativeAria", {
                      label: label.toLocaleLowerCase(intlLocale),
                    })}
                    onChange={(event) => onChange(event.target.value.toUpperCase())}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
              {invalid && (
                <FieldMessage id={`${hexId}-error`} tone="error" className="mt-2">
                  {t("brand.color.invalid", { example: defaultValue || "#FFFFFF" })}
                </FieldMessage>
              )}
            </MoreDetails>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDefault}
                onClick={() => onChange(defaultValue)}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold transition hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {allowEmpty && defaultValue === ""
                  ? t("brand.color.noBackground")
                  : t("brand.color.default")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("brand.color.done")}
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
