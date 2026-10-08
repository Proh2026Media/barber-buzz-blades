import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarClock,
  Clock3,
  Eye,
  EyeOff,
  Globe2,
  ImagePlus,
  Info,
  LayoutTemplate,
  MapPin,
  PencilLine,
  Phone,
  RefreshCw,
  Scissors,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  CopyField,
  EmptyState,
  Field,
  Hint,
  LoadingState,
  MoreDetails,
  Notice,
  SectionHeader,
  StatusBadge,
  TimeChips,
  UnsavedBar,
  focusFirstInvalid,
  type ActionState,
} from "@/components/visual";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { useDemo } from "@/features/demo/context";
import { ShopLandingView } from "@/features/marketing/ShopLanding";
import { findShopTimeZone } from "@/features/register-owner/timezones";
import { DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { CepAddressHelper } from "./CepAddressHelper";
import { CompactChoiceTiles } from "./CompactChoiceTiles";
import type { EditorGuard } from "./GuardedEditorDialog";
import { PageSketch } from "./brand-bits";
import {
  LANDING_LIMITS,
  cleanLandingConfig,
  parseLandingConfig,
  parseLandingData,
  validateLandingConfig,
  type LandingConfig,
  type LandingData,
  type LandingProblem,
} from "@/features/marketing/shop-landing";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal";

const PROBLEM_KEY: Record<LandingProblem, MessageKey> = {
  length: "landingEditor.problem.length",
  instagram: "landingEditor.problem.instagram",
  whatsapp: "landingEditor.problem.whatsapp",
};

/** Onde cada campo aparece na prévia (os demais ficam no topo: título, contato, endereço). */
const PREVIEW_ANCHOR: Partial<Record<keyof LandingConfig, string>> = {
  show_staff: "#landing-staff",
  show_today: "#landing-staff",
  show_services: "#landing-services",
  show_hours: "[data-landing-hours]",
  about: "#landing-about",
};

/** Blocos da página na ordem real; "horários de hoje" fica dentro do bloco da equipe. */
const TOGGLES = [
  { key: "show_staff", icon: Users, label: "landingEditor.showStaff", hint: "landingBlocks.staff" },
  {
    key: "show_today",
    icon: CalendarClock,
    label: "landingEditor.showToday",
    hint: "landingBlocks.today",
  },
  {
    key: "show_services",
    icon: Scissors,
    label: "landingEditor.showServices",
    hint: "landingBlocks.services",
  },
  {
    key: "show_hours",
    icon: Clock3,
    label: "landingEditor.showHours",
    hint: "landingBlocks.hours",
  },
] as const satisfies ReadonlyArray<{
  key: keyof LandingConfig;
  icon: LucideIcon;
  label: MessageKey;
  hint: MessageKey;
}>;

/** Contador de letras só perto do limite (a partir de 80%). */
function nearLimit(value: string, max: number) {
  return value.length >= Math.floor(max * 0.8);
}

export function LandingEditor({
  shopId,
  shopSlug,
  publicUrl,
  settings,
  timeZone,
  onSaved,
  guard,
  onChangePhoto,
  onOpenDomain,
}: {
  shopId: string;
  shopSlug: string;
  publicUrl: string;
  settings: Tables<"barbershop_settings">;
  /** Fuso da loja: decide se o "Preencher pelo CEP" aparece (só fora de Portugal). */
  timeZone?: string | null;
  onSaved: (settings: Tables<"barbershop_settings">) => void;
  /** Proteção da janela contra fechar com mudanças não salvas. */
  guard?: EditorGuard;
  /** Abre a identidade visual na etapa "Tela de entrada" (a foto da capa vem de lá). */
  onChangePhoto?: () => void;
  /** Leva à seção do domínio próprio. */
  onOpenDomain?: () => void;
}) {
  const { t } = useI18n();
  const demo = useDemo();
  const formRef = useRef<HTMLFormElement>(null);
  const saved = useMemo(() => parseLandingConfig(settings.landing), [settings.landing]);
  const [draft, setDraft] = useState<LandingConfig>(saved);
  const [base, setBase] = useState<LandingData | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [view, setView] = useState<"editar" | "previa">("editar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionState | null>(null);
  const tabsId = useId();
  // Último campo mexido e a caixa da prévia: "Prévia" abre já no bloco alterado.
  const [lastChanged, setLastChanged] = useState<keyof LandingConfig | null>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  // Último texto que o "Preencher pelo CEP" escreveu no endereço.
  const [cepAddress, setCepAddress] = useState<string | null>(null);
  // Depois que a pessoa abre e mexe no texto, o campo fica onde está (sem trocar de lugar e
  // perder o foco a cada letra).
  const [addressTouched, setAddressTouched] = useState(false);
  // A busca por CEP usa o ViaCEP (Brasil); lojas com fuso de Portugal não veem o bloco.
  const timeZoneCountry = findShopTimeZone(timeZone ?? demo?.shop.timezone)?.country;
  const showCepHelper = timeZoneCountry !== "pt";

  useEffect(() => {
    if (demo) {
      setBase({
        shop: {
          id: demo.shop.id,
          name: demo.shop.name,
          slug: demo.shop.slug,
          timezone: demo.shop.timezone,
          display_name: settings.display_name,
          tagline: settings.tagline,
          logo_url: settings.logo_url,
          logo_background_color: settings.logo_background_color,
          font_family: settings.font_family,
          custom_font_url: settings.custom_font_url,
          header_font_weight: settings.header_font_weight,
          header_font_style: settings.header_font_style,
          corner_style: settings.corner_style,
          primary_color: settings.primary_color,
          accent_color: settings.accent_color,
          hero_image_url: settings.login_image_url,
        },
        landing: saved,
        hours: demo.businessHours.map((row) => ({
          weekday: row.weekday,
          is_open: row.is_open,
          opens_at: row.opens_at.slice(0, 5),
          closes_at: row.closes_at.slice(0, 5),
        })),
        today: {
          date: "",
          weekday: demo.now.getDay(),
          is_open: true,
          opens_at: "09:00",
          closes_at: "19:00",
        },
        staff: demo.staff
          .filter((row) => row.active)
          .map((row) => ({
            name: row.display_name,
            bio: row.bio ?? "",
            avatar_url: row.avatar_url ?? null,
            booking_slug: row.booking_slug,
            free_today: ["10:00", "11:30", "15:00"],
            offers_services: true,
            min_duration_minutes: demo.services
              .filter((item) => item.active)
              .reduce<
                number | null
              >((shortest, item) => (shortest === null ? item.duration_minutes : Math.min(shortest, item.duration_minutes)), null),
          })),
        services: demo.services
          .filter((row) => row.active)
          .map((row) => ({
            name: row.name,
            description: row.description ?? "",
            duration_minutes: row.duration_minutes,
            price_cents: row.price_cents,
            icon: row.icon ?? null,
          })),
      });
      return;
    }
    let active = true;
    setPreviewFailed(false);
    void supabase.rpc("get_public_shop_landing", { p_shop_ref: shopId }).then(
      ({ data, error: rpcError }) => {
        if (!active) return;
        const parsed = rpcError ? null : parseLandingData(data);
        setBase(parsed);
        // Sem dados (rede ou loja suspensa), mostra aviso com "Tentar de novo"
        // em vez de deixar a prévia carregando para sempre.
        setPreviewFailed(parsed === null);
      },
      () => {
        if (active) setPreviewFailed(true);
      },
    );
    return () => {
      active = false;
    };
    // A prévia usa a marca salva; só recarrega quando a loja muda ou ao tentar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo ? null : shopId, previewAttempt]);

  const problem = validateLandingConfig(draft);
  const dirty = JSON.stringify(cleanLandingConfig(draft)) !== JSON.stringify(saved);
  const previewData = useMemo(() => {
    if (!base) return null;
    const showToday = draft.enabled && draft.show_today;
    return {
      ...base,
      landing: draft,
      staff: base.staff.map((member) => ({
        ...member,
        free_today: showToday ? member.free_today : [],
      })),
    };
  }, [base, draft]);

  function update<K extends keyof LandingConfig>(key: K, value: LandingConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setLastChanged(key);
    setError(null);
    setResult(null);
  }

  // Celular: ao abrir "Prévia", a página já rola até o bloco mexido por último.
  useEffect(() => {
    if (view !== "previa" || !lastChanged) return;
    const frame = window.requestAnimationFrame(() => {
      const box = previewBoxRef.current;
      if (!box) return;
      const selector = PREVIEW_ANCHOR[lastChanged];
      const target = selector ? box.querySelector<HTMLElement>(selector) : null;
      const block = target?.closest("section") ?? target;
      box.scrollTop = block
        ? box.scrollTop + block.getBoundingClientRect().top - box.getBoundingClientRect().top - 8
        : 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, lastChanged, previewData]);

  /** Grava a página; devolve `true` quando salvou (usado também por "Salvar e sair"). */
  async function persist(): Promise<boolean> {
    if (busy) return false;
    if (problem) {
      // Leva ao campo com problema; a frase de como corrigir já está logo abaixo dele.
      window.requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return false;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const landing = cleanLandingConfig(draft);
    if (demo) {
      const next = { ...settings, landing, updated_at: new Date().toISOString() };
      demo.dispatch({ type: "settings.save", settings: next });
      onSaved(next);
    } else {
      const { data, error: updateError } = await supabase
        .from("barbershop_settings")
        .update({ landing })
        .eq("barbershop_id", shopId)
        .select("*")
        .single();
      if (updateError || !data) {
        setError(friendlyAuthError(updateError, t("landingEditor.saveError")));
        setResult("error");
        setBusy(false);
        return false;
      }
      onSaved(data);
    }
    setDraft(landing);
    setBusy(false);
    setResult("saved");
    return true;
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    await persist();
  }

  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    guard?.setDirty(dirty);
  }, [guard, dirty]);
  useEffect(() => {
    if (!guard) return;
    guard.registerSave(() => persistRef.current());
    return () => guard.registerSave(null);
  }, [guard]);

  const counter = (value: string, max: number) =>
    nearLimit(value, max) ? `${value.length}/${max}` : undefined;
  const whatsappPlaceholder = t(
    timeZoneCountry === "pt"
      ? "landingEditor.whatsappPlaceholderPt"
      : "landingEditor.whatsappPlaceholderBr",
  );
  const photo = settings.login_image_url || DEFAULT_LOGIN_IMAGE;
  const blocks = {
    staff: draft.show_staff,
    today: draft.show_staff && draft.show_today,
    services: draft.show_services,
    hours: draft.show_hours,
  };

  // Na página só com a marca, blocos, textos e contato ficam recolhidos (só valem na completa);
  // com um campo a corrigir, continuam à vista para a pessoa achar o erro.
  const showFullOnly = draft.enabled || problem !== null;
  // Endereço montado pelo CEP e não mexido: o cartão verde já mostra; o texto fica recolhido.
  const addressFromCep =
    cepAddress !== null && (draft.address === cepAddress || addressTouched) && problem !== "length";
  // Selo "Preenchido pelo CEP" enquanto o texto é exatamente o que o CEP montou; some ao editar.
  const filledByCep = cepAddress !== null && draft.address === cepAddress;
  const cepBadge = filledByCep ? (
    <StatusBadge
      tone="success"
      icon={MapPin}
      size="sm"
      label={t("landingEditor.address.fromCep")}
    />
  ) : null;

  const addressField = (
    <Field
      label={
        // Recolhido, o selo já aparece no resumo acima de "Editar texto do endereço".
        cepBadge && !addressFromCep ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {t("landingEditor.streetAddress")}
            {cepBadge}
          </span>
        ) : (
          t("landingEditor.streetAddress")
        )
      }
      hint={counter(draft.address, LANDING_LIMITS.address)}
      error={problem === "length" ? t(PROBLEM_KEY.length) : undefined}
    >
      {(props) => (
        <input
          {...props}
          value={draft.address}
          maxLength={LANDING_LIMITS.address}
          placeholder={t("landingEditor.addressPlaceholder")}
          autoComplete="street-address"
          onFocus={() => setAddressTouched(true)}
          onChange={(e) => update("address", e.target.value)}
          className={fieldClass}
        />
      )}
    </Field>
  );

  /** Link da página, compacto: copiar, abrir e o atalho para o domínio próprio. */
  const linkStrip = (className: string) =>
    demo ? (
      <p className={`text-sm text-muted-foreground ${className}`}>{t("landingEditor.demoOpen")}</p>
    ) : (
      <div className={`space-y-2 ${className}`}>
        <CopyField
          label={t("shopLink.forSharing")}
          value={publicUrl}
          href={`/b/${shopSlug}`}
          shareTitle={t("shopLink.title")}
        />
        {onOpenDomain && (
          <button
            type="button"
            onClick={onOpenDomain}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <Globe2 className="size-4 shrink-0" aria-hidden />
            {t("shopLink.ownDomain")}
          </button>
        )}
      </div>
    );

  const views = ["editar", "previa"] as const;

  return (
    <div className="space-y-4">
      <div
        // Celular: as abas ficam presas no topo da janela, então "Prévia" está sempre a um toque
        // (com espaço à direita para o X de fechar).
        className="sticky -top-5 z-10 -mx-1 grid grid-cols-2 gap-2 bg-card/95 pe-11 ps-1 pb-2 pt-3 backdrop-blur sm:-top-6 lg:hidden"
        role="tablist"
        aria-label={t("landingEditor.viewLabel")}
      >
        {views.map((option) => (
          <button
            key={option}
            id={`${tabsId}-tab-${option}`}
            type="button"
            role="tab"
            aria-selected={view === option}
            aria-controls={`${tabsId}-panel-${option}`}
            tabIndex={view === option ? 0 : -1}
            onClick={() => setView(option)}
            onKeyDown={(event) => {
              // Duas abas: setas, Home e End alternam; Tab sai da faixa.
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? views[0]
                  : event.key === "End"
                    ? views[1]
                    : views[(views.indexOf(option) + 1) % views.length]!;
              setView(next);
              document.getElementById(`${tabsId}-tab-${next}`)?.focus();
            }}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
              view === option
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card"
            }`}
          >
            {option === "editar" ? (
              <PencilLine className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            {t(option === "editar" ? "landingEditor.tabEdit" : "landingEditor.tabPreview")}
            {/* Mudança ainda não salva: ponto na aba "Prévia" convida a ver como ficou. */}
            {option === "previa" && dirty && view === "editar" && (
              <span
                className="tone-pending size-2.5 shrink-0 rounded-full bg-[color:var(--tone-line)]"
                role="img"
                aria-label={t("visual.unsaved.badge")}
              />
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          ref={formRef}
          id={`${tabsId}-panel-editar`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-editar`}
          onSubmit={save}
          noValidate
          className={`min-w-0 space-y-4 ${view === "editar" ? "" : "hidden lg:block"}`}
        >
          {/* Como a página aparece: escolha com o desenho do resultado. */}
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <SectionHeader icon={LayoutTemplate} title={t("landingEditor.modeTitle")} />
            <CompactChoiceTiles
              legend={t("landingEditor.modeTitle")}
              columns={2}
              value={draft.enabled ? "full" : "brand"}
              onChange={(value) => update("enabled", value === "full")}
              options={[
                {
                  value: "full",
                  label: t("landingEditor.modeFull"),
                  description: t("landingEditor.enabledHint"),
                  media: (
                    <PageSketch
                      full
                      blocks={blocks}
                      photo={photo}
                      logoUrl={settings.logo_url}
                      logoBackground={settings.logo_background_color}
                    />
                  ),
                },
                {
                  value: "brand",
                  label: t("landingEditor.modeBrand"),
                  media: (
                    <PageSketch
                      full={false}
                      photo={photo}
                      logoUrl={settings.logo_url}
                      logoBackground={settings.logo_background_color}
                      primary={settings.primary_color ?? undefined}
                    />
                  ),
                },
              ]}
            />
            {/* Foto da capa: vale nos dois modos; mostra a atual e leva até a tela de entrada. */}
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-2">
              <img
                src={photo}
                alt=""
                className="h-14 w-20 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {t("landingEditor.coverPhoto")}
              </span>
              {onChangePhoto && (
                <button
                  type="button"
                  onClick={onChangePhoto}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold transition hover:border-primary/40"
                >
                  <ImagePlus className="size-4" aria-hidden />
                  {t("brand.login.changePhoto")}
                </button>
              )}
            </div>
          </section>

          {/* Só a marca: blocos, textos e contato recolhidos numa linha com o caminho de volta. */}
          {!showFullOnly && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-3">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
              >
                <EyeOff className="size-4" />
              </span>
              <p className="min-w-0 flex-1 basis-40 text-sm font-semibold">
                {t("landingEditor.brandOnly.hidden")}
              </p>
              <button
                type="button"
                onClick={() => update("enabled", true)}
                className="action-button action-edit w-full sm:w-auto"
              >
                <LayoutTemplate aria-hidden />
                {t("landingEditor.brandOnly.useFull")}
              </button>
            </div>
          )}

          {/* O que aparece: mapa dos blocos na ordem real da página. */}
          <fieldset
            disabled={!draft.enabled}
            hidden={!showFullOnly}
            className="min-w-0 space-y-1 rounded-2xl border border-border bg-card p-4"
          >
            <legend className="sr-only">{t("landingEditor.blocksTitle")}</legend>
            <SectionHeader
              as="p"
              icon={Eye}
              title={t("landingEditor.blocksTitle")}
              className="pb-2"
            />
            {!draft.enabled && <Hint icon={Info}>{t("landingEditor.onlyFull")}</Hint>}
            {TOGGLES.map((toggle) => {
              // Os horários de hoje aparecem dentro do cartão de cada profissional.
              const nested = toggle.key === "show_today";
              const disabled = !draft.enabled || (nested && !draft.show_staff);
              const on = draft[toggle.key] && !(nested && !draft.show_staff);
              const Icon = toggle.icon;
              const switchId = `landing-${toggle.key}`;
              return (
                <div
                  key={toggle.key}
                  className={`flex items-start gap-3 py-2 ${
                    nested ? "ms-5 border-s-2 border-border ps-3" : ""
                  } ${disabled || !on ? "opacity-70" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                      on && draft.enabled
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-sm font-semibold">{t(toggle.label)}</span>
                    {/* Nos horários de hoje, o exemplo em pílulas substitui a explicação. */}
                    {!(nested && on && draft.enabled) && (
                      <span className="block text-sm text-muted-foreground">
                        {nested && !draft.show_staff
                          ? t("landingEditor.showTodayNeedsStaff")
                          : t(toggle.hint)}
                      </span>
                    )}
                    {nested && on && draft.enabled && (
                      <TimeChips
                        times={["10:00", "11:30", "15:00"]}
                        label={t("landingBlocks.todayExample")}
                        className="mt-1.5"
                      />
                    )}
                  </label>
                  <Switch
                    id={switchId}
                    checked={on}
                    disabled={disabled}
                    onCheckedChange={(value) => update(toggle.key, value)}
                  />
                </div>
              );
            })}
          </fieldset>

          <fieldset
            hidden={!showFullOnly}
            className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4"
          >
            <legend className="sr-only">{t("landingEditor.textsOnly")}</legend>
            <SectionHeader as="p" icon={PencilLine} title={t("landingEditor.textsOnly")} />
            <Field
              label={t("landingEditor.headline")}
              optional
              hint={counter(draft.headline, LANDING_LIMITS.headline)}
            >
              {(props) => (
                <input
                  {...props}
                  value={draft.headline}
                  maxLength={LANDING_LIMITS.headline}
                  placeholder={settings.tagline || t("shopLanding.defaultHeadline")}
                  onChange={(e) => update("headline", e.target.value)}
                  className={fieldClass}
                />
              )}
            </Field>
            <Field
              label={t("landingEditor.aboutLabel")}
              optional
              hint={counter(draft.about, LANDING_LIMITS.about)}
            >
              {(props) => (
                <textarea
                  {...props}
                  value={draft.about}
                  maxLength={LANDING_LIMITS.about}
                  rows={4}
                  placeholder={t("landingEditor.aboutPlaceholder")}
                  onChange={(e) => update("about", e.target.value)}
                  className={`${fieldClass} resize-y`}
                />
              )}
            </Field>
          </fieldset>

          <fieldset
            hidden={!showFullOnly}
            className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4"
          >
            <legend className="sr-only">{t("landingEditor.contactTitle")}</legend>
            <SectionHeader as="p" icon={Phone} title={t("landingEditor.contactTitle")} />
            {showCepHelper && (
              <CepAddressHelper
                address={draft.address}
                maxLength={LANDING_LIMITS.address}
                onAddressChange={(value) => update("address", value)}
                onWritten={(text) => {
                  setCepAddress(text);
                  setAddressTouched(false);
                }}
              />
            )}
            {addressFromCep ? (
              <div className="space-y-1">
                {/* Recolhido: o texto que vai para a página fica à vista, com o selo do CEP. */}
                {filledByCep && (
                  <div className="space-y-1.5 rounded-xl border border-border bg-background/60 p-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {t("landingEditor.streetAddress")}
                      {cepBadge}
                    </p>
                    <p className="break-words text-sm">{draft.address}</p>
                  </div>
                )}
                <MoreDetails summary={t("landingEditor.address.editText")} icon={PencilLine}>
                  {addressField}
                </MoreDetails>
              </div>
            ) : (
              addressField
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("landingEditor.whatsappLabel")}
                error={problem === "whatsapp" ? t(PROBLEM_KEY.whatsapp) : undefined}
              >
                {(props) => (
                  <input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    value={draft.whatsapp}
                    maxLength={20}
                    placeholder={whatsappPlaceholder}
                    onChange={(e) => update("whatsapp", e.target.value)}
                    className={fieldClass}
                  />
                )}
              </Field>
              <Field
                label={t("landingEditor.instagramLabel")}
                error={problem === "instagram" ? t(PROBLEM_KEY.instagram) : undefined}
              >
                {(props) => (
                  <input
                    {...props}
                    value={draft.instagram}
                    maxLength={31}
                    placeholder={t("landingEditor.instagramPlaceholder")}
                    autoCapitalize="none"
                    onChange={(e) => update("instagram", e.target.value)}
                    className={fieldClass}
                  />
                )}
              </Field>
            </div>
          </fieldset>

          {/* O link fica sobre a prévia; no celular, também no fim da aba Editar. */}
          {linkStrip("rounded-2xl border border-border bg-card p-4 lg:hidden")}

          {/* Com mudanças pendentes, o erro aparece só na barra de salvar (com "Tentar de novo"). */}
          {error && !dirty && <Notice tone="danger" title={error} />}
          <UnsavedBar
            dirty={dirty}
            saving={busy}
            state={result}
            stateText={
              result === "saved"
                ? t("landingEditor.savedLive")
                : result === "error"
                  ? (error ?? undefined)
                  : undefined
            }
            onSave={() => void persist()}
            onDiscard={() => {
              setDraft(saved);
              setError(null);
              setResult(null);
            }}
            saveLabel={problem ? t("landingEditor.fixToSave") : t("landingEditor.save")}
          />
        </form>

        <section
          id={`${tabsId}-panel-previa`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-previa`}
          className={`${view === "previa" ? "" : "hidden lg:block"} space-y-3 lg:sticky lg:top-0 lg:self-start`}
        >
          {linkStrip("")}
          <p className="text-xs font-semibold text-muted-foreground">
            {t(demo ? "landingEditor.previewHintDemo" : "landingEditor.previewHint")}
          </p>
          <div
            ref={previewBoxRef}
            className="relative max-h-[70dvh] overflow-y-auto rounded-2xl border border-border shadow-sm"
          >
            {previewData ? (
              <ShopLandingView data={previewData} preview />
            ) : previewFailed ? (
              <EmptyState
                variant="plain"
                status="danger"
                title={t("fix.ajustes-marca.landingPreviewError")}
                action={
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => setPreviewAttempt((current) => current + 1)}
                  >
                    <RefreshCw aria-hidden />
                    {t("visual.retry")}
                  </button>
                }
              />
            ) : (
              <LoadingState
                variant="cards"
                count={2}
                label={t("landingEditor.previewLoading")}
                className="p-4"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
