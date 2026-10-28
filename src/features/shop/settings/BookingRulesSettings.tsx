import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  AlarmClock,
  CalendarCheck,
  CalendarRange,
  ChevronRight,
  Clock3,
  Globe2,
  Hourglass,
  Info,
  MessageSquareText,
  Shuffle,
  Star,
  Store,
  UserCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  ChoiceCards,
  ChoiceChips,
  IconList,
  PreviewPanel,
  SectionHeader,
  SplitLayout,
  StatusBadge,
  Tag,
  UnsavedBar,
  type ActionState,
} from "@/components/visual";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useI18n } from "@/lib/i18n";
import {
  SLOT_STEP_MINUTES,
  buildBookingDateKeys,
  formatShopDate,
  slotRuleFromSettings,
  validMinLeadMinutes,
} from "@/lib/shop/appointments";
import { cn } from "@/lib/utils";
import { useDemo } from "@/features/demo/context";
import { clockInTimeZone } from "@/features/register-owner/timezones";
import { useMinLeadLabel } from "./min-lead-label";
import { useTimeZoneName } from "@/features/register-owner/timezone-name";
import { BOOKING_CARD_IDS } from "./booking-cards";

export type StaffAssignmentMode = "client_pick" | "favorite_then_pick" | "random_available";

/** Campos gravados juntos pelo formulário de regras do agendamento. */
export type BookingRulesDraft = {
  booking_instructions: string;
  booking_horizon_days: number;
  staff_assignment_mode: StaffAssignmentMode;
  survey_program_enabled: boolean;
};

const HORIZON_OPTIONS = [7, 14, 21, 30] as const;
const STAFF_MODES: readonly StaffAssignmentMode[] = [
  "client_pick",
  "favorite_then_pick",
  "random_available",
];
const INSTRUCTIONS_MAX = 240;

function staffModeOf(settings: Tables<"barbershop_settings">): StaffAssignmentMode {
  const raw = (settings as { staff_assignment_mode?: string }).staff_assignment_mode;
  return raw === "favorite_then_pick" || raw === "random_available" ? raw : "client_pick";
}

function horizonLabelKey(days: number) {
  return days === 7
    ? "bookingRules.horizon.week1"
    : days === 14
      ? "bookingRules.horizon.week2"
      : days === 21
        ? "bookingRules.horizon.week3"
        : "bookingRules.horizon.month";
}

/** Último dia que o cliente consegue marcar, no fuso da barbearia ("ter., 19 de out."). */
function useLastBookableDay(days: number, timeZone: string) {
  const { intlLocale } = useI18n();
  // Na demonstração, conta a partir do dia do relógio dela (o mesmo da Agenda).
  const demoNow = useDemo()?.now;
  return useMemo(() => {
    const keys = buildBookingDateKeys(demoNow ?? new Date(), days, timeZone);
    const last = keys.at(-1);
    if (!last) return "";
    return formatShopDate(
      `${last}T12:00:00Z`,
      "UTC",
      { weekday: "short", day: "numeric", month: "short" },
      intlLocale,
    );
  }, [days, timeZone, intlLocale, demoNow]);
}

function scrollToCard(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

type BookingOverviewRow = {
  id: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
};

/**
 * As linhas de "Como seu cliente agenda hoje" (rótulo, ícone e o valor que vale agora). Sem
 * `timeZone` (o trilho do computador, que não recebe o fuso), o prazo vira "N dias" e o fuso
 * fica só com o rótulo.
 */
function useBookingOverviewRows(
  settings: Tables<"barbershop_settings">,
  timeZone: string | undefined,
): BookingOverviewRow[] {
  const { t } = useI18n();
  const nameOf = useTimeZoneName();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  // Na demonstração, o relógio dela (o mesmo da Agenda), não o do aparelho.
  const now = useDemo()?.now ?? clock;
  const rule = slotRuleFromSettings(settings);
  const leadLabel = useMinLeadLabel();
  const lastDay = useLastBookableDay(settings.booking_horizon_days, timeZone ?? "UTC");
  const mode = staffModeOf(settings);
  const instructions = settings.booking_instructions?.trim();

  return [
    {
      id: BOOKING_CARD_IDS.slots,
      icon: Clock3,
      label: t("bookingRules.overview.slots"),
      value: (
        <Tag className="whitespace-nowrap">
          {rule.mode === "literal"
            ? t("slots.mode.literal.title")
            : t("slots.notice.badge.interval", {
                step: rule.mode === "custom" ? rule.stepMinutes : SLOT_STEP_MINUTES,
              })}
        </Tag>
      ),
    },
    // Antes da migration 20261013150000 a coluna não vem do banco e o cartão não aparece.
    ...("min_lead_minutes" in settings
      ? [
          {
            id: BOOKING_CARD_IDS.lead,
            icon: AlarmClock,
            label: t("lead.title"),
            value: (
              <Tag className="whitespace-nowrap">
                {leadLabel(validMinLeadMinutes(settings.min_lead_minutes))}
              </Tag>
            ),
          },
        ]
      : []),
    {
      id: BOOKING_CARD_IDS.horizon,
      icon: CalendarRange,
      label: t("bookingRules.overview.horizon"),
      value: (
        <Tag className="whitespace-nowrap">
          {timeZone
            ? t("bookingRules.horizon.until", { date: lastDay })
            : t("bookingRules.horizon.days", { days: settings.booking_horizon_days })}
        </Tag>
      ),
    },
    {
      id: BOOKING_CARD_IDS.staff,
      icon: UsersRound,
      label: t("bookingRules.overview.staff"),
      value: <Tag>{t(`bookingRules.staff.${mode}.title` as const)}</Tag>,
    },
    {
      id: BOOKING_CARD_IDS.instructions,
      icon: MessageSquareText,
      label: t("bookingRules.overview.instructions"),
      value: instructions ? (
        <span className="line-clamp-1 text-xs text-muted-foreground">“{instructions}”</span>
      ) : (
        <StatusBadge tone="neutral" variant="dot" label={t("bookingRules.overview.none")} />
      ),
    },
    {
      id: BOOKING_CARD_IDS.surveys,
      icon: Star,
      label: t("bookingRules.overview.surveys"),
      value: (
        <StatusBadge
          tone={settings.survey_program_enabled ? "success" : "neutral"}
          variant="dot"
          label={t(settings.survey_program_enabled ? "bookingRules.on" : "bookingRules.off")}
        />
      ),
    },
    {
      id: BOOKING_CARD_IDS.waiting,
      icon: Hourglass,
      label: t("bookingRules.overview.waiting"),
      value: (
        <StatusBadge
          tone={settings.waiting_enabled ? "success" : "neutral"}
          variant="dot"
          label={t(settings.waiting_enabled ? "bookingRules.on" : "bookingRules.off")}
        />
      ),
    },
    {
      id: BOOKING_CARD_IDS.timezone,
      icon: Globe2,
      label: t("bookingRules.overview.timezone"),
      value: timeZone ? (
        // Nome e relógio em blocos inteiros: se faltar espaço, quebram entre si, não no meio.
        <Tag className="flex-wrap">
          <span className="whitespace-nowrap">{nameOf(timeZone)}</span>
          <span className="whitespace-nowrap tabular-nums">· {clockInTimeZone(timeZone, now)}</span>
        </Tag>
      ) : null,
    },
  ];
}

/**
 * "Como seu cliente agenda hoje": o que já está valendo, em uma lista curta com ícone e valor.
 * Cada linha leva ao cartão que muda aquele ponto.
 */
export function BookingOverview({
  settings,
  timeZone,
  onOpen,
}: {
  settings: Tables<"barbershop_settings">;
  timeZone: string;
  /** Abre o ajuste sozinho (lista enxuta). Sem valor, rola até o cartão na mesma página. */
  onOpen?: (id: string) => void;
}) {
  const { t } = useI18n();
  const rows = useBookingOverviewRows(settings, timeZone);

  return (
    <section className="app-action-card space-y-3 p-5" aria-labelledby="booking-overview-title">
      <SectionHeader
        icon={CalendarCheck}
        id="booking-overview-title"
        title={t("bookingRules.overview.title")}
        description={t("bookingRules.overview.text")}
      />
      <ul className="divide-y divide-border/60">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => (onOpen ? onOpen(row.id) : scrollToCard(row.id))}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <Icon
                  className="mt-0.5 size-4 shrink-0 self-start text-gold sm:mt-0 sm:self-center"
                  aria-hidden
                />
                {/* Celular: rótulo em cima e valor embaixo, cada um com a largura toda (nada de
                    pílula quebrada em 3 linhas); do tablet em diante, em colunas. */}
                <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-semibold sm:w-44 sm:shrink-0">{row.label}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {row.value}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Trilho do Agendamento no computador (a partir de 1280 px): as mesmas oito linhas, em coluna
 * estreita à esquerda do ajuste aberto, com o rótulo em cima e o valor embaixo (como no
 * celular) e `aria-current` na escolhida. Só o SettingsHub o monta; o CSS está em
 * src/styles/ajustes.css.
 */
export function BookingRail({
  settings,
  timeZone,
  active,
  onOpen,
}: {
  settings: Tables<"barbershop_settings">;
  timeZone?: string;
  active: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const rows = useBookingOverviewRows(settings, timeZone);
  return (
    <nav className="ajustes-trilho app-action-card" aria-label={t("bookingRules.overview.title")}>
      <p className="ajustes-trilho-titulo">
        <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
        {t("bookingRules.overview.title")}
      </p>
      <ul data-ajustes-trilho>
        {rows.map((row) => {
          const Icon = row.icon;
          const current = row.id === active;
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onOpen(row.id)}
                className="ajustes-trilho-item"
              >
                <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{row.label}</span>
                  {row.value && (
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      {row.value}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Pílula de profissional nos exemplos de escolha (como o cliente vê em Agendar). */
function StaffPill({
  name,
  selected,
  icon: Icon,
}: {
  name: string;
  selected?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <li
      className={cn(
        "inline-flex max-w-[10rem] items-center gap-1 truncate rounded-lg border px-2 py-1 text-xs font-bold",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background",
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      {name}
    </li>
  );
}

/**
 * Regras do agendamento em cartões separados por assunto (prazo, profissional, orientação e
 * pesquisas), com um único rascunho e uma barra "Salvar mudanças" que só aparece quando algo
 * mudou. O rascunho é deste componente: mexer ou salvar outro cartão não o apaga.
 */
export function BookingRulesSettings({
  settings,
  timeZone,
  staffNames,
  onSave,
  only,
}: {
  settings: Tables<"barbershop_settings">;
  timeZone: string;
  /** Primeiros nomes da equipe, para os exemplos da escolha do profissional. */
  staffNames: string[];
  onSave: (draft: BookingRulesDraft) => Promise<"applied" | "pending">;
  /** Mostra só um dos cartões (ajuste aberto sozinho em Ajustes → Agendamento). */
  only?: string;
}) {
  const { t } = useI18n();
  const groupId = useId();
  // Só os campos deste formulário: salvar outro cartão não mexe no rascunho.
  const savedMode = staffModeOf(settings);
  const savedDraft = useMemo<BookingRulesDraft>(
    () => ({
      booking_instructions: settings.booking_instructions ?? "",
      booking_horizon_days: settings.booking_horizon_days,
      staff_assignment_mode: savedMode,
      survey_program_enabled: settings.survey_program_enabled,
    }),
    [
      settings.booking_instructions,
      settings.booking_horizon_days,
      settings.survey_program_enabled,
      savedMode,
    ],
  );
  const [draft, setDraft] = useState<BookingRulesDraft>(savedDraft);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [errorText, setErrorText] = useState<string | undefined>();

  useEffect(() => {
    setDraft(savedDraft);
  }, [savedDraft]);

  const changedFields = (Object.keys(draft) as (keyof BookingRulesDraft)[]).filter((key) =>
    key === "booking_instructions"
      ? draft.booking_instructions.trim() !== savedDraft.booking_instructions.trim()
      : draft[key] !== savedDraft[key],
  );
  const dirty = changedFields.length > 0;
  const lastDay = useLastBookableDay(draft.booking_horizon_days, timeZone);

  function update(patch: Partial<BookingRulesDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setState(null);
  }

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setState("saving");
    try {
      const result = await onSave({
        ...draft,
        booking_instructions: draft.booking_instructions.trim(),
      });
      setState(result === "applied" ? "saved" : "pending");
      // Enviado para aprovação: nada mudou ainda, então o cartão volta a mostrar o que vale.
      if (result === "pending") setDraft(savedDraft);
    } catch (error) {
      setErrorText(friendlyAuthError(error, t("visual.result.error")));
      setState("error");
    } finally {
      setSaving(false);
    }
  }

  const sample = [
    staffNames[0] ?? t("bookingRules.staff.sampleA"),
    staffNames[1] ?? t("bookingRules.staff.sampleB"),
  ];
  const anyone = t("bookingRules.staff.anyone");
  const staffExample: Record<StaffAssignmentMode, ReactNode> = {
    client_pick: (
      <ul className="flex flex-wrap gap-1.5" aria-label={t("bookingRules.staff.exampleAria")}>
        <StaffPill name={sample[0]} selected />
        <StaffPill name={sample[1]} />
      </ul>
    ),
    favorite_then_pick: (
      <ul className="flex flex-wrap gap-1.5" aria-label={t("bookingRules.staff.exampleAria")}>
        <StaffPill name={sample[1]} icon={Star} selected />
        <StaffPill name={sample[0]} />
        <StaffPill name={anyone} icon={Shuffle} />
      </ul>
    ),
    random_available: (
      <ul className="flex flex-wrap gap-1.5" aria-label={t("bookingRules.staff.exampleAria")}>
        <StaffPill name={anyone} icon={Shuffle} selected />
        <StaffPill name={sample[0]} />
        <StaffPill name={sample[1]} />
      </ul>
    ),
  };
  const staffIcon: Record<StaffAssignmentMode, LucideIcon> = {
    client_pick: UserRound,
    favorite_then_pick: Star,
    random_available: Shuffle,
  };

  const instructions = draft.booking_instructions;
  const used = instructions.length;
  const usedTone =
    used >= INSTRUCTIONS_MAX ? "danger" : used >= INSTRUCTIONS_MAX * 0.85 ? "warning" : null;

  // `ajustes-item`: a partir de 1024 px, campo e prévia ficam lado a lado quando o cartão tem
  // largura para isso (container query em src/styles/ajustes.css).
  const cardClass = "ajustes-item app-action-card scroll-mt-24 space-y-4 p-5 outline-none";

  return (
    <div className="space-y-6">
      {(!only || only === BOOKING_CARD_IDS.horizon) && (
        <section
          id={BOOKING_CARD_IDS.horizon}
          tabIndex={-1}
          className={cardClass}
          aria-labelledby={`${groupId}-horizon`}
        >
          <SectionHeader
            icon={CalendarRange}
            id={`${groupId}-horizon`}
            title={t("bookingRules.horizon.title")}
            description={t("bookingRules.horizon.text")}
          />
          <SplitLayout
            gap="1rem"
            asideWidth="20rem"
            aside={
              <div className="space-y-2">
                <div aria-hidden className="flex gap-0.5">
                  {Array.from({ length: 30 }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-3 min-w-0 flex-1 rounded-sm",
                        index < draft.booking_horizon_days ? "bg-primary" : "bg-muted",
                        index === 0 && "bg-gold",
                      )}
                    />
                  ))}
                </div>
                <p className="flex items-start gap-2 text-sm" aria-live="polite">
                  <CalendarCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  <span className="font-semibold">
                    {t("bookingRules.horizon.result", { date: lastDay })}
                  </span>
                </p>
              </div>
            }
          >
            <ChoiceChips
              label={t("bookingRules.horizon.title")}
              hideLabel
              options={HORIZON_OPTIONS.map((days) => ({
                value: days,
                label: t(horizonLabelKey(days)),
                note: t("bookingRules.horizon.days", { days }),
              }))}
              value={draft.booking_horizon_days}
              disabled={saving}
              onChange={(days) => update({ booking_horizon_days: days })}
            />
          </SplitLayout>
        </section>
      )}

      {(!only || only === BOOKING_CARD_IDS.staff) && (
        <section
          id={BOOKING_CARD_IDS.staff}
          tabIndex={-1}
          className={cardClass}
          aria-labelledby={`${groupId}-staff`}
        >
          <SectionHeader
            icon={UsersRound}
            id={`${groupId}-staff`}
            title={t("bookingRules.staff.title")}
            description={t("bookingRules.staff.text")}
          />
          <ChoiceCards
            legend={t("bookingRules.staff.title")}
            name={`${groupId}-staff-mode`}
            columns={3}
            value={draft.staff_assignment_mode}
            disabled={saving}
            onChange={(mode) => update({ staff_assignment_mode: mode })}
            options={STAFF_MODES.map((mode) => ({
              value: mode,
              icon: staffIcon[mode],
              title: t(`bookingRules.staff.${mode}.title` as const),
              description: t(`bookingRules.staff.${mode}.text` as const),
              content: staffExample[mode],
            }))}
          />
          <IconList items={[{ icon: UserCheck, text: t("bookingRules.staff.always") }]} />
        </section>
      )}

      {(!only || only === BOOKING_CARD_IDS.instructions) && (
        <section
          id={BOOKING_CARD_IDS.instructions}
          tabIndex={-1}
          className={cardClass}
          aria-labelledby={`${groupId}-instructions`}
        >
          <SectionHeader
            icon={MessageSquareText}
            id={`${groupId}-instructions`}
            title={t("bookingRules.instructions.title")}
            description={t("bookingRules.instructions.text")}
          />
          <SplitLayout
            gap="1rem"
            asideWidth="20rem"
            aside={
              <PreviewPanel
                icon={Store}
                title={t("bookingRules.instructions.preview")}
                badge={t("bookingRules.preview")}
              >
                {instructions.trim() ? (
                  <p className="flex items-start gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                    <Store className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                    <span className="min-w-0 break-words">{instructions.trim()}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="size-4 shrink-0" aria-hidden />
                    {t("bookingRules.instructions.empty")}
                  </p>
                )}
              </PreviewPanel>
            }
          >
            <div className="space-y-2">
              <label htmlFor={`${groupId}-instructions-field`} className="sr-only">
                {t("bookingRules.instructions.title")}
              </label>
              <textarea
                id={`${groupId}-instructions-field`}
                maxLength={INSTRUCTIONS_MAX}
                rows={3}
                value={instructions}
                disabled={saving}
                onChange={(event) => update({ booking_instructions: event.target.value })}
                placeholder={t("shop.settings.instructionsPlaceholder")}
                aria-describedby={`${groupId}-instructions-count`}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-base sm:text-sm"
              />
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      usedTone ? `tone-${usedTone} bg-[color:var(--tone-line)]` : "bg-primary/60",
                    )}
                    style={{ width: `${Math.min(100, (used / INSTRUCTIONS_MAX) * 100)}%` }}
                  />
                </span>
                <span
                  id={`${groupId}-instructions-count`}
                  className="shrink-0 text-xs tabular-nums text-muted-foreground"
                >
                  {t("bookingRules.instructions.count", { used, max: INSTRUCTIONS_MAX })}
                </span>
              </div>
            </div>
          </SplitLayout>
        </section>
      )}

      {(!only || only === BOOKING_CARD_IDS.surveys) && (
        <section
          id={BOOKING_CARD_IDS.surveys}
          tabIndex={-1}
          className={cardClass}
          aria-labelledby={`${groupId}-surveys`}
        >
          <SectionHeader
            icon={Star}
            id={`${groupId}-surveys`}
            title={t("bookingRules.surveys.title")}
            description={t("bookingRules.surveys.text")}
            aside={
              <StatusBadge
                tone={savedDraft.survey_program_enabled ? "success" : "neutral"}
                label={t(
                  savedDraft.survey_program_enabled ? "bookingRules.on" : "bookingRules.off",
                )}
                size="sm"
              />
            }
          />
          {(() => {
            const chips = (
              <ChoiceChips
                label={t("bookingRules.surveys.choice")}
                options={[
                  { value: "on", label: t("bookingRules.surveys.on") },
                  { value: "off", label: t("bookingRules.surveys.off") },
                ]}
                value={draft.survey_program_enabled ? "on" : "off"}
                disabled={saving}
                onChange={(value) => update({ survey_program_enabled: value === "on" })}
              />
            );
            if (!draft.survey_program_enabled) return chips;
            return (
              <SplitLayout
                gap="1rem"
                asideWidth="20rem"
                aside={
                  <PreviewPanel
                    icon={MessageSquareText}
                    title={t("bookingRules.surveys.preview")}
                    badge={t("bookingRules.example")}
                  >
                    <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
                      <p className="text-sm font-semibold">
                        {t("bookingRules.surveys.sampleQuestion")}
                      </p>
                      <p className="flex gap-1 text-gold" aria-hidden>
                        {Array.from({ length: 5 }, (_, index) => (
                          <Star key={index} className="size-5" fill="currentColor" />
                        ))}
                      </p>
                    </div>
                  </PreviewPanel>
                }
              >
                {chips}
              </SplitLayout>
            );
          })()}
          <IconList
            items={[
              { icon: Clock3, text: t("bookingRules.surveys.hintPace") },
              { icon: UserCheck, text: t("bookingRules.surveys.hintSkip") },
            ]}
          />
        </section>
      )}

      <UnsavedBar
        dirty={dirty}
        count={changedFields.length}
        saving={saving}
        state={state}
        stateText={
          state === "pending"
            ? t("visual.result.pending")
            : state === "error"
              ? errorText
              : state === "saved"
                ? t("bookingRules.saved")
                : undefined
        }
        onSave={() => void save()}
        onDiscard={() => {
          setDraft(savedDraft);
          setState(null);
        }}
      />
    </div>
  );
}
