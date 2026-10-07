import {
  Camera,
  Check,
  Clock3,
  Eye,
  ImageOff,
  Loader2,
  Plus,
  Save,
  Search,
  Shapes,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionResult,
  Field,
  FieldMessage,
  ChoiceChips,
  PreviewPanel,
  StatusBadge,
  Timeline,
  Tag,
  focusFirstInvalid,
  type ActionState,
  type TimelineRow,
} from "@/components/visual";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ServiceIcon,
  SERVICE_ICON_GROUPS,
  searchServiceIcons,
  serviceIconGroupLabel,
  serviceIconLabel,
} from "@/components/ui/service-icon";
import {
  isServiceImageSource,
  SERVICE_IMAGE_ACCEPT,
  validateServiceImage,
} from "@/lib/shop/service-image";
import { PREP_OPTIONS } from "@/lib/shop/appointments";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ServiceImageCropDialog } from "../ServiceImageCropDialog";
import {
  DURATION_CHOICES,
  DURATION_MAX,
  DURATION_MIN,
  parsePriceInput,
  priceInputFromCents,
  showCounter,
  validDuration,
} from "./format";
import { DangerZone } from "./DangerZone";
import { useCatalogLabels } from "./labels";
import type { ServiceDraft, ServiceRow, ServiceSaveResult } from "./types";

const DESCRIPTION_MAX = 500;
/** Valor da pílula "Padrão da loja" na escolha da folga (ChoiceChips só aceita número/texto). */
const PREP_SHOP = -1;

const STARTERS = [
  { key: "catalog.starter.cut", minutes: 30, icon: "Scissors" },
  { key: "catalog.starter.beard", minutes: 20, icon: "glyph:beard" },
  { key: "catalog.starter.combo", minutes: 45, icon: "lab:scissors-hair-comb" },
] as const;

type Errors = Partial<Record<"name" | "price" | "duration", string>>;

/**
 * Janela de criar/editar serviço. Começa pela prévia "Assim o cliente vê" (tocar no ícone troca
 * a imagem), depois o essencial (nome, preço, duração em pílulas) e, recolhido, descrição e folga.
 * O botão principal fica sempre à vista no pé da janela; erros aparecem junto do campo.
 */
export function ServiceForm({
  open,
  onOpenChange,
  editing,
  canChangeGlobal,
  isAssociate,
  shopTerms,
  prepSupported,
  shopPrep,
  starters,
  onSave,
  onUploadImage,
  onSaved,
  onDelete,
  onPause,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ServiceRow | null;
  /** Gerencia o catálogo da loja (folga e exclusão aparecem). */
  canChangeGlobal: boolean;
  /** Parceiro: a mudança vale só no catálogo dele. */
  isAssociate: boolean;
  /** Preço/duração da loja, para o parceiro comparar com o dele. */
  shopTerms?: { price_cents: number; duration_minutes: number } | null;
  prepSupported: boolean;
  shopPrep: number;
  /** Primeiro serviço: mostra pílulas de partida. */
  starters?: boolean;
  onSave: (draft: ServiceDraft) => Promise<ServiceSaveResult>;
  onUploadImage: (file: File) => Promise<string>;
  onSaved: (result: ServiceSaveResult, draft: ServiceDraft) => void;
  onDelete?: () => void;
  /** "Pausar" na zona de perigo (só para serviço visível). Lança erro se não gravar. */
  onPause?: () => Promise<unknown>;
}) {
  const { t } = useI18n();
  const { duration: durationLabel, money, currency, priceExample } = useCatalogLabels();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [price, setPrice] = useState("");
  const [prep, setPrep] = useState<number>(PREP_SHOP);
  const [icon, setIcon] = useState("Scissors");
  const [iconQuery, setIconQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<ActionState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const saving = state === "saving";

  // Cada abertura começa do item escolhido (ou em branco), sem restos da vez anterior.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setDuration(editing?.duration_minutes ?? 30);
    setPrice(editing ? priceInputFromCents(editing.price_cents) : "");
    setPrep(editing?.prep_minutes == null ? PREP_SHOP : editing.prep_minutes);
    setIcon(editing?.icon || "Scissors");
    setIconQuery("");
    setPickerOpen(false);
    setImageError(null);
    setSuggest(false);
    setErrors({});
    setState(null);
    setSubmitError(null);
  }, [open, editing]);

  const priceCents = parsePriceInput(price);
  const hasImage = isServiceImageSource(icon);
  const prepMinutes = prep === PREP_SHOP ? shopPrep : prep;

  const iconGroups = useMemo(() => {
    const allowed = new Set(searchServiceIcons(iconQuery).map((entry) => entry.id));
    return SERVICE_ICON_GROUPS.map((group) => ({
      ...group,
      icons: group.icons.filter((entry) => allowed.has(entry.id)),
    })).filter((group) => group.icons.length > 0);
  }, [iconQuery]);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = t("catalog.service.error.name");
    if (priceCents === null) next.price = t("catalog.service.error.price");
    if (!validDuration(duration)) next.duration = t("catalog.service.error.duration");
    return next;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      setSubmitError(null);
      setState(null);
      window.setTimeout(() => focusFirstInvalid(formRef.current), 0);
      return;
    }
    const draft: ServiceDraft = {
      name: name.trim(),
      description: description.trim() || null,
      duration_minutes: duration,
      price_cents: priceCents ?? 0,
      prep_minutes: prep === PREP_SHOP ? null : prep,
      icon,
      suggestToPartners: isAssociate && suggest,
    };
    setState("saving");
    setSubmitError(null);
    try {
      const result = await onSave(draft);
      setState(null);
      onSaved(result, draft);
    } catch (cause) {
      setSubmitError(cause instanceof Error && cause.message ? cause.message : null);
      setState("error");
    }
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateServiceImage(file);
    if (problem) {
      setImageError(problem);
      return;
    }
    setImageError(null);
    setImageToCrop(file);
  }

  async function applyCropped(file: File) {
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setIcon(url);
      setImageToCrop(null);
      setPickerOpen(false);
    } finally {
      setUploading(false);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const shownName = name.trim() || t("catalog.service.previewName");
  const startTime = "09:00";
  const addMinutes = (base: string, minutes: number) => {
    const [h, m] = base.split(":").map(Number);
    const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const safeDuration = validDuration(duration) ? duration : 30;
  const endTime = addMinutes(startTime, safeDuration);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving || uploading) return;
          onOpenChange(next);
        }}
      >
        <DialogContent
          className="flex max-h-[88dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl p-0 sm:max-w-lg sm:rounded-3xl"
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          {/* Título fixo: o "×" da janela não cobre o conteúdo que rola. */}
          <div className="space-y-2 border-b border-border px-5 pb-3 pr-14 pt-5 sm:px-6">
            <DialogTitle>
              {editing ? t("shop.serviceForm.editTitle") : t("shop.serviceForm.newTitle")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("catalog.service.formAria")}
            </DialogDescription>
            {isAssociate && (
              <StatusBadge
                tone="highlight"
                icon={Sparkles}
                label={t("catalog.service.ownCatalog")}
              />
            )}
          </div>
          <DialogScrollArea className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <form
              id="service-form"
              ref={formRef}
              noValidate
              onSubmit={submit}
              className="space-y-5"
            >
              {starters && !editing && (
                <div className="space-y-2">
                  <p className="text-sm font-bold">{t("catalog.starter.title")}</p>
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter.key}
                        type="button"
                        onClick={() => {
                          setName(t(starter.key));
                          setDuration(starter.minutes);
                          setIcon(starter.icon);
                          setErrors((current) => ({ ...current, name: undefined }));
                        }}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition hover:border-primary/40"
                      >
                        <ServiceIcon icon={starter.icon} className="size-4 text-gold" />
                        {t(starter.key)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prévia: como a linha do serviço aparece no app do cliente. */}
              <PreviewPanel
                title={t("catalog.preview.title")}
                icon={Eye}
                badge={t("catalog.preview.badge")}
              >
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                  <button
                    type="button"
                    onClick={() => setPickerOpen((value) => !value)}
                    aria-label={t("catalog.service.changeImage")}
                    aria-expanded={pickerOpen}
                    className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold ring-offset-2 transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <ServiceIcon
                      icon={icon}
                      className="size-6"
                      imageClassName="size-14 object-cover !rounded-none !p-0"
                    />
                  </button>
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span
                      className={cn(
                        "brand-content-title block break-words text-sm font-bold hyphens-auto",
                        !name.trim() && "text-muted-foreground",
                      )}
                    >
                      {shownName}
                    </span>
                    {description.trim() ? (
                      <span className="line-clamp-2 block text-xs text-muted-foreground">
                        {description.trim()}
                      </span>
                    ) : null}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Tag icon={Clock3}>{durationLabel(safeDuration)}</Tag>
                      <span className="text-sm font-bold tabular-nums">
                        {priceCents === null ? `${currency} —` : money(priceCents)}
                      </span>
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40 disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                    ) : (
                      <Camera className="size-4 text-gold" aria-hidden />
                    )}
                    {hasImage ? t("catalog.image.changePhoto") : t("catalog.image.usePhoto")}
                  </button>
                  {hasImage ? (
                    <button
                      type="button"
                      onClick={() => setIcon("Scissors")}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
                    >
                      <ImageOff className="size-4 text-gold" aria-hidden />
                      {t("catalog.image.removePhoto")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerOpen((value) => !value)}
                      aria-expanded={pickerOpen}
                      className={cn(
                        "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                        pickerOpen
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <Shapes className={cn("size-4", !pickerOpen && "text-gold")} aria-hidden />
                      {t("catalog.image.chooseIcon")}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept={SERVICE_IMAGE_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={pickFile}
                  />
                </div>
                {imageError ? (
                  <FieldMessage tone="error">{imageError}</FieldMessage>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {hasImage
                      ? t("catalog.image.photoChosen")
                      : t("catalog.image.current", { name: serviceIconLabel(icon) })}
                    {" · "}
                    {t("catalog.image.photoHint")}
                  </p>
                )}
                {pickerOpen && (
                  <div className="space-y-3 rounded-xl border border-border bg-card p-3">
                    <label className="relative block">
                      <span className="sr-only">{t("shop.serviceForm.iconSearch")}</span>
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={iconQuery}
                        onChange={(event) => setIconQuery(event.target.value)}
                        placeholder={t("shop.serviceForm.iconSearch")}
                        className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
                      />
                    </label>
                    <div className="max-h-72 space-y-3 overflow-y-auto overscroll-contain pr-1">
                      {iconGroups.length === 0 && (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          {t("shop.serviceForm.noIcons")}
                        </p>
                      )}
                      {iconGroups.map((group) => (
                        <div key={group.id} className="space-y-2">
                          <p className="text-xs font-bold text-muted-foreground">
                            {serviceIconGroupLabel(group.id)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {group.icons.map((preset) => {
                              const selected = icon === preset.id;
                              return (
                                <button
                                  key={`${group.id}-${preset.id}`}
                                  type="button"
                                  onClick={() => {
                                    setIcon(preset.id);
                                    setPickerOpen(false);
                                  }}
                                  title={preset.label}
                                  aria-label={preset.label}
                                  aria-pressed={selected}
                                  className={cn(
                                    "relative flex size-11 items-center justify-center rounded-xl border transition-colors",
                                    selected
                                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary"
                                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  <ServiceIcon icon={preset.id} className="size-5" />
                                  {selected && (
                                    <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground">
                                      <Check className="size-3" aria-hidden />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </PreviewPanel>

              <Field label={t("shop.serviceForm.name")} required error={errors.name}>
                {(props) => (
                  <input
                    {...props}
                    value={name}
                    maxLength={80}
                    onChange={(event) => {
                      setName(event.target.value);
                      if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
                    }}
                    placeholder={t("catalog.service.namePlaceholder")}
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </Field>

              <Field
                label={t("catalog.service.price")}
                required
                error={errors.price}
                hint={
                  isAssociate && shopTerms
                    ? t("catalog.service.shopPrice", {
                        price: money(shopTerms.price_cents),
                        duration: durationLabel(shopTerms.duration_minutes),
                      })
                    : undefined
                }
              >
                {(props) => (
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground"
                      aria-hidden
                    >
                      {currency}
                    </span>
                    <input
                      {...props}
                      value={price}
                      inputMode="decimal"
                      autoComplete="off"
                      onChange={(event) => {
                        setPrice(event.target.value);
                        if (errors.price)
                          setErrors((current) => ({ ...current, price: undefined }));
                      }}
                      placeholder={priceExample}
                      className="min-h-11 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm font-semibold tabular-nums"
                    />
                  </div>
                )}
              </Field>

              <div className="space-y-1.5">
                <ChoiceChips
                  label={t("shop.serviceForm.duration")}
                  icon={Clock3}
                  value={duration}
                  onChange={(value) => {
                    setDuration(value);
                    if (errors.duration)
                      setErrors((current) => ({ ...current, duration: undefined }));
                  }}
                  options={DURATION_CHOICES.map((minutes) => ({
                    value: minutes,
                    label: durationLabel(minutes),
                  }))}
                  other={{
                    min: DURATION_MIN,
                    max: DURATION_MAX,
                    step: 5,
                    unit: t("catalog.duration.unit"),
                    label: t("catalog.service.otherDuration"),
                    inputLabel: t("shop.serviceForm.customDuration"),
                  }}
                />
                {errors.duration && <FieldMessage tone="error">{errors.duration}</FieldMessage>}
              </div>

              {isAssociate && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={suggest}
                    onChange={(event) => setSuggest(event.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-[color:var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{t("catalog.service.suggest")}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("catalog.service.suggestHint")}
                    </span>
                  </span>
                </label>
              )}

              <details
                className="group rounded-2xl border border-border bg-background/60 px-3"
                open={Boolean(editing?.description) || (editing?.prep_minutes ?? null) !== null}
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <Plus
                    className="size-4 shrink-0 text-gold transition-transform group-open:rotate-45"
                    aria-hidden
                  />
                  <span className="flex-1">{t("catalog.service.moreDetails")}</span>
                  {prepMinutes > 0 && canChangeGlobal && prepSupported ? (
                    <Tag icon={Sparkles}>
                      {t("catalog.service.prepTag", { minutes: prepMinutes })}
                    </Tag>
                  ) : null}
                </summary>
                <div className="space-y-5 pb-4 pt-1">
                  <Field label={t("shop.serviceForm.details")} optional>
                    {(props) => (
                      <>
                        <textarea
                          {...props}
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value.slice(0, DESCRIPTION_MAX))
                          }
                          placeholder={t("catalog.service.descriptionPlaceholder")}
                          rows={3}
                          maxLength={DESCRIPTION_MAX}
                          className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        />
                        {showCounter(description.length, DESCRIPTION_MAX) && (
                          <span className="block text-right text-xs text-muted-foreground tabular-nums">
                            {description.length}/{DESCRIPTION_MAX}
                          </span>
                        )}
                      </>
                    )}
                  </Field>

                  {canChangeGlobal && prepSupported && (
                    <div className="space-y-3">
                      <ChoiceChips
                        label={t("shop.serviceForm.prep")}
                        icon={Sparkles}
                        value={prep}
                        onChange={setPrep}
                        options={[
                          {
                            value: PREP_SHOP,
                            label: t("catalog.prep.shop"),
                            note: t("catalog.duration.min", { minutes: shopPrep }),
                          },
                          ...PREP_OPTIONS.map((minutes) => ({
                            value: minutes as number,
                            label:
                              minutes === 0
                                ? t("slots.prep.none")
                                : t("catalog.duration.min", { minutes }),
                          })),
                        ]}
                      />
                      <Timeline
                        label={t("catalog.prep.exampleAria")}
                        rows={
                          [
                            {
                              kind: "booked",
                              time: startTime,
                              label: `${shownName} · ${durationLabel(safeDuration)}`,
                              minutes: Math.min(safeDuration, 45),
                            },
                            ...(prepMinutes > 0
                              ? [
                                  {
                                    kind: "prep" as const,
                                    time: endTime,
                                    label: t("catalog.prep.block", { minutes: prepMinutes }),
                                    minutes: prepMinutes,
                                  },
                                ]
                              : []),
                            {
                              kind: "free",
                              time: addMinutes(endTime, prepMinutes),
                              label: t("catalog.prep.next"),
                            },
                          ] satisfies TimelineRow[]
                        }
                      />
                    </div>
                  )}
                </div>
              </details>

              {editing && onDelete && canChangeGlobal && (
                <DangerZone
                  hint={t("catalog.service.deleteHint")}
                  pauseLabel={t("catalog.service.pause")}
                  onPause={editing.active ? onPause : undefined}
                  deleteLabel={t("shop.deleteService.confirm")}
                  onDelete={onDelete}
                  disabled={saving}
                />
              )}
            </form>
          </DialogScrollArea>

          {/* Pé fixo: o botão principal fica sempre à vista. */}
          <div className="space-y-2 border-t border-border bg-card p-4">
            {errorCount > 0 && (
              <FieldMessage tone="error">
                {errorCount === 1
                  ? t("catalog.form.fixOne")
                  : t("catalog.form.fixMany", { count: errorCount })}
              </FieldMessage>
            )}
            <ActionResult
              state={state === "error" ? "error" : null}
              text={submitError ?? t("catalog.service.saveError")}
              onRetry={() => formRef.current?.requestSubmit()}
              reveal={false}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => onOpenChange(false)}
                className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold"
              >
                {t("common.back")}
              </button>
              <button
                type="submit"
                form="service-form"
                disabled={saving || uploading}
                className="action-button action-confirm flex-1"
              >
                {saving ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
                ) : editing ? (
                  <Save className="size-4" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                {saving
                  ? t("common.saving")
                  : editing
                    ? t("shop.serviceForm.save")
                    : t("shop.serviceForm.create")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ServiceImageCropDialog
        file={imageToCrop}
        onCancel={() => setImageToCrop(null)}
        onConfirm={applyCropped}
        preview="square"
      />
    </>
  );
}
