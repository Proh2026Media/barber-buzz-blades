import {
  ArrowDown,
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  Check,
  CheckCircle2,
  Clock3,
  Hourglass,
  ListChecks,
  Loader2,
  Lock,
  Moon,
  Pencil,
  Repeat2,
  Scissors,
  SkipForward,
  // Estrela = favorito; brilho = sugerido (ícones diferentes para significados diferentes).
  Sparkles,
  Star,
  Store,
  Sun,
  Sunrise,
  Sunset,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  ChoiceChips,
  EmptyState,
  IconList,
  IconTile,
  Notice,
  PersonAvatar,
  StatusBadge,
  Tag,
} from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import type { CatalogViewMode } from "@/features/shop/CatalogViewToggle";
import {
  formatShopDate,
  shiftDateKey,
  shopDateTime,
  shopHour,
  weekdayForDateKey,
} from "@/lib/shop/appointments";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AppointmentTicket, type TicketData } from "./ticket";

/* -------------------------------------------------------------------------------------------- */
/* Passos                                                                                        */
/* -------------------------------------------------------------------------------------------- */

export type StepState = "done" | "current" | "upcoming";

/** Selo do passo: número (a fazer), número preenchido (agora) ou ✓ verde (feito). */
function StepMarker({ index, state }: { index: number; state: StepState }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold tabular-nums",
        state === "done" &&
          "tone-success border-[color:var(--tone-ink)] bg-[color:var(--tone-ink)] text-[color:var(--tone-on-ink)]",
        state === "current" &&
          "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
        state === "upcoming" && "border-border bg-card text-muted-foreground",
      )}
    >
      {state === "done" ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <span aria-hidden>{index}</span>
      )}
      <span className="sr-only">
        {t("booking.stepOf", { n: index })}
        {state === "done" ? ` · ${t("visual.steps.done")}` : ""}
        {state === "current" ? ` · ${t("visual.steps.current")}` : ""}
      </span>
    </span>
  );
}

/**
 * Cartão de um passo do agendamento: selo numerado que vira ✓, título e, à direita, uma ação
 * curta (Trocar, grade/lista). O conteúdo pode ser a escolha inteira ou só o resumo do escolhido.
 * A margem de rolagem (scroll-mt-24) evita que o cabeçalho fixo cubra o título do passo quando a
 * pessoa toca numa pílula do resumo.
 */
export function StepCard({
  id,
  index,
  title,
  state,
  aside,
  children,
  className,
}: {
  id: string;
  index: number;
  title: string;
  state: StepState;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      aria-current={state === "current" ? "step" : undefined}
      className={cn("booking-section scroll-mt-24", className)}
    >
      <div className="flex min-h-11 items-center gap-3">
        <StepMarker index={index} state={state} />
        {/* tabIndex -1: o resumo leva o foco do teclado até aqui depois de rolar. */}
        <h3 id={`${id}-title`} tabIndex={-1} className="booking-heading min-w-0 flex-1">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Botão "Trocar" de um passo já feito (reabre a escolha). */
export function ChangeButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
    >
      <Pencil className="size-3.5" aria-hidden />
      {t("booking.change")}
    </button>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Cartões selecionáveis (padrão da onda 1: borda primária, fundo claro e ✓ em círculo)          */
/* -------------------------------------------------------------------------------------------- */

function SelectCheck({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border-2",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-card",
      )}
    >
      {selected && <Check className="size-3.5" />}
    </span>
  );
}

const SELECT_CARD =
  "relative flex w-full min-w-0 rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
const SELECT_ON = "border-primary bg-primary/5";
const SELECT_OFF = "border-border bg-card hover:border-primary/40";

/* -------------------------------------------------------------------------------------------- */
/* Serviço                                                                                       */
/* -------------------------------------------------------------------------------------------- */

export type PriceTerms = { duration_minutes: number; price_cents: number };

export function ServiceFacts({
  terms,
  formatMoney,
}: {
  terms: PriceTerms;
  formatMoney: (cents: number) => string;
}) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Tag icon={Clock3}>{t("booking.minutes", { minutes: terms.duration_minutes })}</Tag>
      <span className="text-sm font-bold tabular-nums">{formatMoney(terms.price_cents)}</span>
    </span>
  );
}

export function ServiceChoices({
  services,
  selectedIndex,
  view,
  termsFor,
  formatMoney,
  suggested,
  disabled,
  onPick,
}: {
  services: Tables<"services">[];
  selectedIndex: number;
  view: CatalogViewMode;
  termsFor: (service: Tables<"services">) => PriceTerms;
  formatMoney: (cents: number) => string;
  /** A escolha veio pronta (primeiro da lista): mostra "Sugerido" até a pessoa tocar. */
  suggested: boolean;
  disabled?: boolean;
  onPick: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={
        view === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2 max-[359px]:grid-cols-1"
      }
    >
      {services.map((service, index) => {
        const selected = index === selectedIndex;
        const terms = termsFor(service);
        const icon = (
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold">
            <ServiceIcon
              icon={service.icon}
              className="size-5"
              imageClassName="size-12 object-cover !rounded-none !p-0"
            />
          </span>
        );
        return (
          <button
            key={service.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onPick(index)}
            className={cn(
              SELECT_CARD,
              selected ? SELECT_ON : SELECT_OFF,
              view === "list" ? "items-start gap-3" : "flex-col gap-2",
            )}
          >
            {view === "list" ? (
              icon
            ) : (
              <span className="flex w-full items-start justify-between gap-2">
                {icon}
                <SelectCheck selected={selected} />
              </span>
            )}
            <span className="min-w-0 flex-1 space-y-1.5">
              <span className="brand-content-title line-clamp-2 block break-normal text-sm font-bold hyphens-auto">
                {service.name}
              </span>
              {service.description ? (
                <span
                  className={cn(
                    "block text-xs text-muted-foreground",
                    view === "list" ? "line-clamp-1" : "line-clamp-2",
                  )}
                >
                  {service.description}
                </span>
              ) : null}
              <ServiceFacts terms={terms} formatMoney={formatMoney} />
              {selected && suggested ? (
                <StatusBadge
                  tone="highlight"
                  icon={Sparkles}
                  label={t("booking.suggested")}
                  size="sm"
                />
              ) : null}
            </span>
            {view === "list" && <SelectCheck selected={selected} />}
          </button>
        );
      })}
    </div>
  );
}

/** Resumo do serviço escolhido, quando o passo está recolhido. */
export function ServiceSummary({
  service,
  terms,
  formatMoney,
  suggested,
}: {
  service: Tables<"services">;
  terms: PriceTerms;
  formatMoney: (cents: number) => string;
  /** Veio sugerido e foi aceito ao escolher o horário: mantém o selo "Sugerido". */
  suggested?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-gold">
        <ServiceIcon
          icon={service.icon}
          className="size-5"
          imageClassName="size-10 object-cover !rounded-none !p-0"
        />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block break-normal text-sm font-bold hyphens-auto">{service.name}</span>
        <ServiceFacts terms={terms} formatMoney={formatMoney} />
        {suggested ? (
          <StatusBadge tone="highlight" icon={Sparkles} label={t("booking.suggested")} size="sm" />
        ) : null}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Profissional                                                                                  */
/* -------------------------------------------------------------------------------------------- */

export function StaffChoices({
  choices,
  selectedIndex,
  anyOption,
  anyActive,
  favoriteId,
  favoriteName,
  view,
  suggested,
  disabled,
  onPick,
  onAny,
}: {
  choices: { member: Tables<"staff">; index: number }[];
  /** Índice escolhido (no catálogo completo); null com "qualquer profissional". */
  selectedIndex: number | null;
  anyOption: boolean;
  anyActive: boolean;
  favoriteId: string | null;
  favoriteName?: string | null;
  view: CatalogViewMode;
  suggested: boolean;
  disabled?: boolean;
  onPick: (index: number) => void;
  onAny: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={
        view === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2 max-[359px]:grid-cols-1"
      }
    >
      {anyOption && (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={anyActive}
          onClick={onAny}
          className={cn(
            SELECT_CARD,
            "col-span-full items-center gap-3",
            anyActive ? SELECT_ON : SELECT_OFF,
          )}
        >
          <IconTile icon={Users} size="lg" tone={anyActive ? "selected" : "muted"} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{t("booking.anyStaff")}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {favoriteName ? (
                <>
                  <Star className="size-3.5 shrink-0 fill-current text-gold" aria-hidden />
                  {t("booking.anyStaffFavorite", { name: favoriteName })}
                </>
              ) : (
                t("booking.anyStaffHint")
              )}
            </span>
          </span>
          <SelectCheck selected={anyActive} />
        </button>
      )}
      {choices.map(({ member, index }) => {
        const selected = !anyActive && selectedIndex === index;
        const favorite = favoriteId === member.id;
        const avatar = (
          <PersonAvatar
            name={member.display_name}
            src={member.avatar_url}
            seed={member.id}
            size="md"
            badge={
              favorite ? (
                <Star className="fill-current text-gold" aria-label={t("booking.favorite")} />
              ) : undefined
            }
          />
        );
        return (
          <button
            key={member.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onPick(index)}
            className={cn(
              SELECT_CARD,
              selected ? SELECT_ON : SELECT_OFF,
              view === "list" ? "items-center gap-3" : "flex-col items-center gap-2 text-center",
            )}
          >
            {view === "grid" && (
              <span className="absolute right-2 top-2">
                <SelectCheck selected={selected} />
              </span>
            )}
            {avatar}
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block break-normal text-sm font-bold hyphens-auto">
                {member.display_name}
              </span>
              {view === "list" && member.bio ? (
                <span className="line-clamp-1 block text-xs text-muted-foreground">
                  {member.bio}
                </span>
              ) : null}
              {selected && suggested ? (
                <StatusBadge
                  tone="highlight"
                  icon={Sparkles}
                  label={t("booking.suggested")}
                  size="sm"
                />
              ) : null}
            </span>
            {view === "list" && <SelectCheck selected={selected} />}
          </button>
        );
      })}
    </div>
  );
}

/** Profissional escolhido (resumo do passo recolhido) ou fixo pelo link direto. */
export function StaffSummary({
  member,
  any,
  locked,
  favorite,
  suggested,
}: {
  member: Tables<"staff"> | null;
  any?: boolean;
  locked?: boolean;
  favorite?: boolean;
  /** Veio sugerido e foi aceito ao escolher o horário: mantém o selo "Sugerido". */
  suggested?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3">
      {any || !member ? (
        <IconTile icon={Users} size="md" tone="muted" />
      ) : (
        <PersonAvatar
          name={member.display_name}
          src={member.avatar_url}
          seed={member.id}
          size="md"
          badge={favorite ? <Star className="fill-current text-gold" aria-hidden /> : undefined}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block break-normal text-sm font-bold hyphens-auto">
          {any || !member
            ? t("booking.anyStaff")
            : locked
              ? t("booking.directWith", { name: member.display_name })
              : member.display_name}
        </span>
        {any ? (
          <span className="block text-xs text-muted-foreground">{t("booking.anyStaffHint")}</span>
        ) : null}
        {suggested && !locked ? (
          <StatusBadge
            tone="highlight"
            icon={Sparkles}
            label={t("booking.suggested")}
            size="sm"
            className="mt-1"
          />
        ) : null}
      </span>
      {locked && <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Dias                                                                                          */
/* -------------------------------------------------------------------------------------------- */

export function DayStrip({
  keys,
  selected,
  timeZone,
  closedWeekdays,
  disabled,
  calendar,
  onSelect,
}: {
  keys: string[];
  selected: string;
  timeZone: string;
  /** Dias da semana em que a loja não abre (0 = domingo); null quando não se sabe. */
  closedWeekdays: Set<number> | null;
  disabled?: boolean;
  /** Calendário completo ("Mais datas"). */
  calendar: ReactNode;
  onSelect: (key: string) => void;
}) {
  const { t, intlLocale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  // Centraliza o dia escolhido só dentro da faixa (sem rolar a página inteira).
  useEffect(() => {
    const strip = ref.current;
    const chip = strip?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!strip || !chip) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({
      left: chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [selected]);
  const noon = (key: string) => shopDateTime(key, "12:00:00", timeZone);
  const fmt = (key: string, options: Intl.DateTimeFormatOptions) =>
    formatShopDate(noon(key), timeZone, options, intlLocale);
  const monthName = fmt(selected, { month: "long" });
  const last = keys[keys.length - 1];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold capitalize">
          <CalendarDays className="size-4 text-gold" aria-hidden />
          {monthName}
        </p>
        <div className="w-auto shrink-0">{calendar}</div>
      </div>
      <div
        ref={ref}
        role="group"
        aria-label={t("booking.date")}
        className="app-day-carousel flex min-w-0 gap-1.5 overflow-x-auto pb-1 no-scrollbar"
      >
        {keys.map((key, index) => {
          const isSelected = key === selected;
          const closed = closedWeekdays?.has(weekdayForDateKey(key)) ?? false;
          const top =
            index === 0
              ? t("booking.today")
              : index === 1
                ? t("booking.tomorrow")
                : fmt(key, { weekday: "short" }).replace(".", "");
          const full = fmt(key, { weekday: "long", day: "numeric", month: "long" });
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={[index <= 1 ? top : null, full, closed ? t("booking.closed") : null]
                .filter(Boolean)
                .join(", ")}
              className={cn(
                "app-day-chip shrink-0",
                isSelected && "app-day-chip-selected",
                // Fechado: borda tracejada e texto apagado com contraste AA (sem opacidade, que
                // derrubava o "FECHADO" para ~3:1). O "!" vence a borda sólida do .app-day-chip.
                closed && !isSelected && "border-dashed! border-muted-foreground/60!",
              )}
            >
              <span
                className={cn(
                  "block text-[10px] font-bold uppercase tracking-wide",
                  closed && !isSelected ? "text-muted-foreground" : "opacity-80",
                )}
              >
                {top}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xl font-black leading-none tabular-nums",
                  closed && !isSelected && "text-muted-foreground",
                )}
              >
                {fmt(key, { day: "2-digit" })}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-[10px] font-semibold uppercase",
                  closed && !isSelected ? "text-muted-foreground" : "opacity-80",
                )}
              >
                {closed ? t("booking.closed") : fmt(key, { month: "short" }).replace(".", "")}
              </span>
            </button>
          );
        })}
        {last && (
          <span
            className="flex min-w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--control-radius)] border border-dashed border-border px-2 text-center text-[11px] font-semibold leading-tight text-muted-foreground"
            aria-hidden
          >
            <CalendarRange className="size-4 text-gold" />
            {t("booking.openUntil", { date: fmt(last, { day: "2-digit", month: "2-digit" }) })}
          </span>
        )}
      </div>
      {last && (
        <p className="sr-only">
          {t("booking.openUntil", { date: fmt(last, { day: "2-digit", month: "2-digit" }) })}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Horários                                                                                      */
/* -------------------------------------------------------------------------------------------- */

export type MayOpenSlot = { iso: string; onClick: () => void };

type Period = { key: string; label: string; icon: LucideIcon; from: number; to: number };

const SLOT =
  "flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition";

export function TimeGrid({
  state,
  error,
  onRetry,
  slots,
  selectedIso,
  onSelect,
  timeZone,
  currentIso,
  mayOpen,
  disabled,
  empty,
  notice,
}: {
  state: "needChoice" | "loading" | "error" | "empty" | "ready";
  error?: string | null;
  onRetry: () => void;
  slots: Date[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  timeZone: string;
  /** Horário atual da reserva sendo remarcada (pílula tracejada "atual"). */
  currentIso?: string | null;
  /** Vagas da lista de espera que podem abrir neste dia. */
  mayOpen: MayOpenSlot[];
  disabled?: boolean;
  empty: {
    closed: boolean;
    nextDay?: { label: string; onClick: () => void } | null;
    onChangeStaff?: (() => void) | null;
  };
  /** Aviso dentro da grade (ex.: o horário escolhido deixou de estar livre). */
  notice?: ReactNode;
}) {
  const { t, intlLocale } = useI18n();
  const label = (date: Date | string) =>
    formatShopDate(date, timeZone, { hour: "2-digit", minute: "2-digit" }, intlLocale);

  if (state === "needChoice") {
    return (
      <Notice tone="neutral" icon={ListChecks} role="none" title={t("booking.timesNeedChoice")} />
    );
  }
  if (state === "loading") {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          {t("booking.loadingTimes")}
        </p>
        <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="h-11 rounded-xl bg-muted motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (state === "error") {
    return (
      <Notice
        tone="danger"
        title={error ?? t("booking.errorTimes")}
        action={{ label: t("visual.retry"), onClick: onRetry }}
      />
    );
  }

  const periods: Period[] = [
    { key: "morning", label: t("booking.morning"), icon: Sunrise, from: 0, to: 12 },
    { key: "afternoon", label: t("booking.afternoon"), icon: Sun, from: 12, to: 18 },
    { key: "evening", label: t("booking.evening"), icon: Moon, from: 18, to: 24 },
  ];
  type Item =
    | { kind: "free"; date: Date; iso: string }
    | { kind: "current"; date: Date; iso: string }
    | { kind: "mayOpen"; date: Date; iso: string; onClick: () => void };
  const items: Item[] = [
    ...slots.map((date) => ({ kind: "free" as const, date, iso: date.toISOString() })),
    ...(currentIso && !slots.some((slot) => slot.toISOString() === currentIso)
      ? [{ kind: "current" as const, date: new Date(currentIso), iso: currentIso }]
      : []),
    ...mayOpen
      .filter((item) => !slots.some((slot) => slot.toISOString() === item.iso))
      .map((item) => ({
        kind: "mayOpen" as const,
        date: new Date(item.iso),
        iso: item.iso,
        onClick: item.onClick,
      })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  if (state === "empty" && !items.length) {
    return (
      <div className="space-y-3">
        {notice}
        <EmptyState
          variant="plain"
          status={empty.closed ? "neutral" : "pending"}
          icon={empty.closed ? Store : CalendarX2}
          title={empty.closed ? t("booking.closedDayTitle") : t("booking.fullDayTitle")}
          description={empty.closed ? t("booking.closedDayHint") : t("booking.fullDayHint")}
          className="py-4"
          action={
            empty.nextDay ? (
              <button
                type="button"
                onClick={empty.nextDay.onClick}
                className="action-button action-edit min-h-11 w-full"
              >
                <CalendarClock className="size-4" aria-hidden />
                {t("booking.seeDay", { day: empty.nextDay.label })}
              </button>
            ) : undefined
          }
          secondaryAction={
            !empty.closed && empty.onChangeStaff ? (
              <button
                type="button"
                onClick={empty.onChangeStaff}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"
              >
                <Users className="size-4 text-gold" aria-hidden />
                {t("booking.changeStaff")}
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  // Atalho só quando a grade é longa (com poucos horários, ele só repetiria o primeiro).
  const firstFree = slots.length > 8 ? items.find((item) => item.kind === "free") : undefined;
  return (
    <div className="space-y-4">
      {notice}
      {firstFree && firstFree.iso !== selectedIso && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(firstFree.iso)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-gold/60 px-3 text-sm font-semibold"
        >
          <Clock3 className="size-4 text-gold" aria-hidden />
          {t("booking.firstFree", { time: label(firstFree.date) })}
        </button>
      )}
      {periods.map((period) => {
        const inPeriod = items.filter((item) => {
          const hour = shopHour(item.date, timeZone);
          return hour >= period.from && hour < period.to;
        });
        if (!inPeriod.length) return null;
        const free = inPeriod.filter((item) => item.kind === "free").length;
        const Icon = period.key === "evening" && free === 0 ? Sunset : period.icon;
        return (
          <section key={period.key} aria-label={period.label} className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Icon className="size-4 text-gold" aria-hidden />
              <span className="text-foreground">{period.label}</span>
              <span aria-hidden>·</span>
              <span>
                {free === 1 ? t("booking.freeOne") : t("booking.freeCount", { count: free })}
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
              {inPeriod.map((item) => {
                const time = label(item.date);
                if (item.kind === "current") {
                  return (
                    // Sem papel, um aria-label em <span> é ignorado por muitos leitores: o texto
                    // falado vai em sr-only e o visual fica escondido deles.
                    <span
                      key={item.iso}
                      className={cn(
                        SLOT,
                        "border-dashed border-muted-foreground/50 bg-muted/40 text-muted-foreground",
                      )}
                    >
                      <span className="sr-only">{t("booking.slotCurrentAria", { time })}</span>
                      <span aria-hidden className="line-through">
                        {time}
                      </span>
                      <span aria-hidden className="text-[10px] font-bold uppercase">
                        {t("booking.slotCurrent")}
                      </span>
                    </span>
                  );
                }
                if (item.kind === "mayOpen") {
                  return (
                    <button
                      key={item.iso}
                      type="button"
                      disabled={disabled}
                      onClick={item.onClick}
                      aria-label={t("booking.slotMayOpenAria", { time })}
                      className={cn(
                        SLOT,
                        "tone-pending border-dashed border-[color:var(--tone-line)] bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)]",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <Hourglass className="size-3" aria-hidden />
                        {time}
                      </span>
                      <span className="text-[10px] font-bold">{t("booking.slotMayOpen")}</span>
                    </button>
                  );
                }
                const selected = item.iso === selectedIso;
                return (
                  <button
                    key={item.iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(item.iso)}
                    aria-pressed={selected}
                    className={cn(
                      SLOT,
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-md"
                        : "border-border bg-card text-foreground hover:border-gold",
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Repetir                                                                                       */
/* -------------------------------------------------------------------------------------------- */

export type RepeatChoice = "once" | "weekday" | "15" | "21";

export function RepeatPicker({
  value,
  onChange,
  startKey,
  horizonDays,
  timeLabel,
  timeZone,
  disabled,
}: {
  value: RepeatChoice;
  onChange: (value: RepeatChoice) => void;
  /** Dia escolhido (chave AAAA-MM-DD no fuso da loja). */
  startKey: string;
  horizonDays: number;
  timeLabel: string;
  timeZone: string;
  disabled?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const step = value === "weekday" ? 7 : value === "once" ? 0 : Number(value);
  // Prévia: sempre ao menos 3 datas, para mostrar o ritmo mesmo com "a cada 21 dias". As que
  // passam da agenda aberta ficam tracejadas: entram sozinhas quando a agenda chegar até elas.
  const dates: { key: string; later: boolean }[] = [];
  if (step > 0) {
    const limit = Math.max(7, Math.min(horizonDays, 30));
    for (
      let offset = 0;
      (dates.length < 3 || offset <= limit) && dates.length < 6;
      offset += step
    ) {
      dates.push({ key: shiftDateKey(startKey, offset), later: offset > horizonDays });
    }
  }
  const hasLater = dates.some((date) => date.later);
  // "seg 12/10" (sem a vírgula que o navegador põe entre o dia da semana e a data).
  const pill = (key: string) => {
    const noon = shopDateTime(key, "12:00:00", timeZone);
    const weekday = formatShopDate(noon, timeZone, { weekday: "short" }, intlLocale);
    const date = formatShopDate(noon, timeZone, { day: "2-digit", month: "2-digit" }, intlLocale);
    return `${weekday.replace(".", "")} ${date}`;
  };
  return (
    <div className="space-y-3">
      <ChoiceChips
        label={t("booking.repeatLabel")}
        icon={Repeat2}
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={[
          { value: "once", label: t("booking.repeatOnce") },
          { value: "weekday", label: t("booking.repeatWeekly") },
          { value: "15", label: t("booking.everyDays", { days: 15 }) },
          { value: "21", label: t("booking.everyDays", { days: 21 }) },
        ]}
      />
      {dates.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("booking.repeatPreview", { time: timeLabel })}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {dates.map(({ key, later }, index) => (
              <li key={key}>
                <Tag
                  icon={index === 0 ? CalendarCheck : later ? CalendarClock : CalendarDays}
                  className={cn(
                    index === 0 && "bg-primary/10",
                    later &&
                      "border border-dashed border-muted-foreground/60 bg-transparent text-muted-foreground",
                  )}
                >
                  {pill(key)}
                </Tag>
              </li>
            ))}
            <li>
              <Tag icon={Repeat2}>…</Tag>
            </li>
          </ul>
          <IconList
            items={[
              ...(hasLater
                ? [{ key: "later", icon: CalendarClock, text: t("booking.repeatLater") }]
                : []),
              { key: "until", icon: Repeat2, text: t("booking.repeatUntilStop") },
              { key: "skip", icon: SkipForward, text: t("booking.repeatSkip") },
            ]}
          />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Barra de resumo e ação                                                                        */
/* -------------------------------------------------------------------------------------------- */

export type SummaryPill = {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Ainda falta escolher (pílula tracejada). */
  pending?: boolean;
  /** No celular vem primeiro e ocupa a linha inteira (o "quando", que muda mais). */
  lead?: boolean;
  media?: ReactNode;
  onClick?: () => void;
};

/**
 * Resumo sempre à vista: as escolhas em pílulas (tocar leva ao passo) e o botão principal, que
 * diz o que vai acontecer. No celular fica fixa acima da barra de navegação; no computador vira a
 * coluna da direita.
 */
export function BookingSummaryBar({
  pills,
  buttonLabel,
  buttonIcon: ButtonIcon,
  ready,
  busy,
  price,
  onConfirm,
  children,
}: {
  pills: SummaryPill[];
  buttonLabel: string;
  buttonIcon: LucideIcon;
  ready: boolean;
  busy: boolean;
  price?: string | null;
  onConfirm: () => void;
  /** Resultado/erro do envio, logo acima do botão. */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={t("booking.summaryAria")}
      className="booking-summary-bar app-action-card sticky z-20 min-w-0 space-y-2 p-2.5 shadow-lg lg:space-y-3 lg:p-4"
    >
      <p className="hidden items-center gap-2 text-sm font-bold lg:flex">
        <CalendarCheck className="size-4 text-gold" aria-hidden />
        {t("booking.yourBooking")}
      </p>
      {/* No celular, duas linhas sem rolagem: o "quando" inteiro em cima, serviço e profissional
          lado a lado embaixo. No computador, uma coluna na ordem dos passos. */}
      <ul className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-2">
        {pills.map((pill) => {
          const Icon = pill.icon;
          const content = (
            <>
              {pill.media ?? <Icon className="size-3.5 shrink-0 text-gold" aria-hidden />}
              <span className="min-w-0 truncate">{pill.label}</span>
            </>
          );
          const cls = cn(
            "inline-flex min-h-10 w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--button-radius)] border px-2.5 text-xs font-semibold lg:text-sm",
            pill.pending
              ? "border-dashed border-muted-foreground/50 text-muted-foreground"
              : "border-border bg-background/70",
          );
          return (
            <li
              key={pill.key}
              className={cn("min-w-0", pill.lead && "order-first col-span-2 lg:order-none")}
            >
              {pill.onClick ? (
                <button type="button" onClick={pill.onClick} className={cls}>
                  {content}
                </button>
              ) : (
                <span className={cls}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
      {price && (
        <p className="hidden items-center justify-between border-t border-border pt-2 text-sm lg:flex">
          <span className="text-muted-foreground">{t("booking.total")}</span>
          <span className="font-bold tabular-nums">{price}</span>
        </p>
      )}
      {children}
      <button
        type="button"
        onClick={onConfirm}
        disabled={!ready || busy}
        aria-busy={busy || undefined}
        className="action-button action-confirm min-h-11 w-full lg:min-h-12"
      >
        {busy ? (
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
        ) : (
          <ButtonIcon className="size-4" aria-hidden />
        )}
        <span className="min-w-0 truncate">{buttonLabel}</span>
      </button>
    </aside>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Remarcar: De → Para                                                                           */
/* -------------------------------------------------------------------------------------------- */

export function RescheduleFromTo({
  original,
  next,
  now,
  timeZone,
  onBack,
  disabled,
}: {
  original: TicketData;
  next: { day: string; time: string } | null;
  now: Date;
  timeZone: string;
  onBack: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <section
      aria-label={t("booking.rescheduleAria")}
      className="app-action-card space-y-3 border-l-4 border-l-gold p-4"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("booking.rescheduleFrom")}
      </p>
      <AppointmentTicket
        variant="mini"
        data={original}
        now={now}
        timeZone={timeZone}
        struck={Boolean(next)}
      />
      <div className="flex items-center gap-2 text-gold" aria-hidden>
        <ArrowDown className="size-4" />
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("booking.rescheduleTo")}
      </p>
      {next ? (
        <p className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone="info"
            icon={CalendarClock}
            size="lg"
            label={`${next.day} · ${next.time}`}
          />
        </p>
      ) : (
        <p className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-muted-foreground/50 px-3 text-sm font-semibold text-muted-foreground">
          <Clock3 className="size-4" aria-hidden />
          {t("booking.rescheduleChoose")}
        </p>
      )}
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("booking.keepTime")}
      </button>
    </section>
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Depois de reservar                                                                            */
/* -------------------------------------------------------------------------------------------- */

export function BookingDone({
  title,
  data,
  previous,
  repeatLabel,
  now,
  timeZone,
  onSeeBookings,
  onAnother,
}: {
  title: string;
  data: TicketData;
  /** Horário anterior (remarcação): aparece riscado acima do novo. */
  previous?: string | null;
  repeatLabel?: string | null;
  now: Date;
  timeZone: string;
  onSeeBookings: () => void;
  onAnother: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    // Sem role=status: o foco já vai para o título, que o leitor anuncia uma vez só.
    <section aria-labelledby="booking-done-title" className="space-y-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="tone-success grid size-16 place-items-center rounded-full bg-[color:var(--tone-bg)] text-[color:var(--tone-ink)] motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
          <CheckCircle2 className="size-9" aria-hidden />
        </span>
        <h3
          ref={ref}
          id="booking-done-title"
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          {title}
        </h3>
      </div>
      {previous ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">{t("visual.before")}:</span>
          <span className="line-through">{previous}</span>
        </p>
      ) : null}
      <AppointmentTicket
        data={data}
        now={now}
        timeZone={timeZone}
        repeatLabel={repeatLabel ?? undefined}
        status={
          <StatusBadge tone="info" icon={CalendarCheck} label={t("status.confirmed")} size="sm" />
        }
      />
      <IconList items={[{ key: "manage", icon: CalendarClock, text: t("booking.doneHint") }]} />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSeeBookings}
          className="action-button action-confirm min-h-12 w-full"
        >
          <CalendarCheck className="size-4" aria-hidden />
          {t("booking.track")}
        </button>
        <button
          type="button"
          onClick={onAnother}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold"
        >
          <CalendarDays className="size-4 text-gold" aria-hidden />
          {t("booking.another")}
        </button>
      </div>
    </section>
  );
}
