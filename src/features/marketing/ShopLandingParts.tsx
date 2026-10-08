import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  CalendarSearch,
  CalendarX,
  ChevronRight,
  Clock3,
  Instagram,
  LogIn,
  MapPin,
  MessageCircle,
  Moon,
  Pointer,
  Scissors,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, Steps, Tag, type Tone } from "@/components/visual";
import { ServiceIcon } from "@/components/ui/service-icon";
import { StaffPhoto } from "@/components/ui/staff-photo";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  formatClock,
  type HoursGroup,
  type LandingService,
  type LandingStaff,
} from "./shop-landing";

/** Quantos horários aparecem antes do "+N". */
const SLOTS_SHOWN = 6;
/** `get_public_shop_landing` devolve no máximo 12 horários livres por profissional. */
const SERVER_SLOTS_LIMIT = 12;

/** Horário tocado que segue escolhido para o app (sem a data de hoje, só abre a agenda). */
function pickedSlot(day: string | undefined, time: string, member: LandingStaff) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  return { day, time, who: member.name.split(" ")[0] };
}

/**
 * Link para agendar: com sessão salva no aparelho vai direto ao app; sem sessão passa pela
 * entrada e volta ao app com a loja (e o profissional) já escolhidos. Na prévia do editor não
 * navega.
 */
export function BookLink({
  slug,
  preview,
  signedIn,
  barber,
  slot,
  className,
  ariaLabel,
  children,
}: {
  slug: string;
  preview: boolean;
  signedIn: boolean;
  barber?: string | null;
  /**
   * Horário tocado: segue para o Agendar já escolhido (dia AAAA-MM-DD e HH:MM no fuso da loja),
   * passando pela entrada com o resumo à vista. `who` é o nome mostrado no resumo da entrada.
   */
  slot?: { day: string; time: string; who: string } | null;
  className: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  if (preview)
    return (
      <span className={className} aria-disabled="true" aria-label={ariaLabel}>
        {children}
      </span>
    );
  const search = {
    shop: slug,
    barber: barber ?? undefined,
    join: undefined,
    tab: undefined,
    reserva: undefined,
    ...(slot ? { day: slot.day, time: slot.time } : {}),
  };
  if (signedIn)
    return (
      <Link to="/app" search={search} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  const params = new URLSearchParams({ shop: slug });
  if (barber) params.set("barber", barber);
  if (slot) {
    params.set("day", slot.day);
    params.set("time", slot.time);
  }
  return (
    <Link
      to="/auth"
      search={{ next: `/app?${params.toString()}`, shop: slug, ...(slot ? { who: slot.who } : {}) }}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

/** Situação do profissional hoje, com a mesma cor e ícone em toda a página. */
export type MemberDay = "free" | "full" | "off" | "ended" | "noOnline";

const MEMBER_DAY: Record<MemberDay, { tone: Tone; icon: LucideIcon; key: string }> = {
  free: { tone: "success", icon: CalendarCheck, key: "shopLanding.freeToday" },
  full: { tone: "warning", icon: CalendarX, key: "shopLanding.fullToday" },
  off: { tone: "neutral", icon: Moon, key: "shopLanding.offToday" },
  ended: { tone: "neutral", icon: Moon, key: "shopLanding.endedToday" },
  noOnline: { tone: "neutral", icon: CalendarOff, key: "shopLanding.noOnline" },
};

export function MemberDayBadge({
  state,
  size = "sm",
  className,
}: {
  state: MemberDay;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useI18n();
  const meta = MEMBER_DAY[state];
  return (
    <StatusBadge
      tone={meta.tone}
      icon={meta.icon}
      label={t(meta.key as Parameters<typeof t>[0])}
      size={size}
      className={className}
    />
  );
}

/** As três etapas de agendar, com ícone, no lugar do parágrafo "Primeira vez?…". */
export function BookingSteps({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Steps
      variant="static"
      label={t("shopLanding.stepsLabel")}
      className={className}
      steps={[
        { label: t("shopLanding.step1"), icon: LogIn },
        { label: t("shopLanding.step2"), icon: Scissors },
        { label: t("shopLanding.step3"), icon: SquareCheckBig },
      ]}
    />
  );
}

/**
 * Cartão "Hoje": o que o cliente mais quer saber (dá para cortar hoje? que horas? com quem?) e
 * o botão de agendar, logo na primeira tela, sobre a capa.
 */
export function TodayCard({
  slug,
  preview,
  signedIn,
  showToday,
  next,
  day,
  freeCount,
  dayState,
  nextDayLabel,
  ctaRef,
  className,
}: {
  slug: string;
  preview: boolean;
  signedIn: boolean;
  showToday: boolean;
  /** Horário livre mais cedo de hoje e com quem. */
  next: { time: string; member: LandingStaff } | null;
  /** Data de hoje no fuso da loja (AAAA-MM-DD): o horário tocado segue escolhido para o app. */
  day?: string;
  freeCount: number;
  /** Situação da loja hoje quando não sobra horário (lotado, sem atendimento, encerrado). */
  dayState: MemberDay | null;
  /** "Próximo dia: segunda-feira" quando hoje acabou. */
  nextDayLabel: string | null;
  ctaRef?: Ref<HTMLDivElement>;
  className?: string;
}) {
  const { t, intlLocale } = useI18n();
  const noneToday = showToday && !next;
  return (
    <section
      aria-labelledby="landing-today"
      className={cn(
        "public-card space-y-3 rounded-[var(--panel-radius)] border border-border p-4 shadow-[0_18px_44px_rgb(0_0_0/0.28)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="landing-today"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          <CalendarCheck className="public-accent size-4" aria-hidden />
          {t("shopLanding.todayCard")}
        </h2>
        {showToday && next ? (
          <StatusBadge
            tone="success"
            icon={CalendarCheck}
            size="sm"
            label={
              freeCount === 1
                ? t("shopLanding.staffFreeOne")
                : t("shopLanding.staffFreeMany", { n: freeCount })
            }
          />
        ) : noneToday && dayState ? (
          <MemberDayBadge state={dayState} />
        ) : null}
      </div>

      {showToday && next && (
        <BookLink
          slug={slug}
          preview={preview}
          signedIn={signedIn}
          barber={next.member.booking_slug}
          slot={pickedSlot(day, next.time, next.member)}
          ariaLabel={`${t("shopLanding.nextFree")}: ${t("shopLanding.slotPickAria", {
            time: formatClock(next.time, intlLocale),
            name: next.member.name,
          })}`}
          className="flex min-h-16 items-center gap-3 rounded-[var(--control-radius)] border-2 border-foreground/80 bg-background/60 p-3 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StaffPhoto
            src={next.member.avatar_url}
            className="size-11 rounded-full"
            fallback={
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold"
                aria-hidden
              >
                {next.member.name.slice(0, 1).toUpperCase()}
              </span>
            }
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-muted-foreground">
              {t("shopLanding.nextFree")}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-extrabold leading-tight tabular-nums">
                {formatClock(next.time, intlLocale)}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold">
                {t("shopLanding.nextWith", { name: next.member.name.split(" ")[0] })}
              </span>
            </span>
            {/* O toque leva o horário escolhido ao app; a reserva só vale depois de confirmar. */}
            {!preview && (
              <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Pointer className="size-3.5 shrink-0" aria-hidden />
                {day
                  ? t("shopLanding.tapToPick")
                  : t("shopLanding.seeAgendaOf", { name: next.member.name.split(" ")[0] })}
              </span>
            )}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </BookLink>
      )}

      {noneToday && nextDayLabel && (
        <p className="text-sm font-semibold text-muted-foreground">{nextDayLabel}</p>
      )}

      <div ref={ctaRef}>
        <BookLink
          slug={slug}
          preview={preview}
          signedIn={signedIn}
          className="action-button action-confirm min-h-12 w-full text-sm"
        >
          {noneToday ? <CalendarSearch aria-hidden /> : <CalendarPlus aria-hidden />}
          {noneToday ? t("shopLanding.otherDays") : t("shopLanding.bookCta")}
        </BookLink>
      </div>

      {!signedIn && <BookingSteps className="pt-1" />}
    </section>
  );
}

/** Pílulas de horário livre de um profissional, com o mais cedo destacado e "+N" que abre o resto. */
export function SlotPills({
  member,
  slug,
  preview,
  signedIn,
  day,
}: {
  member: LandingStaff;
  slug: string;
  preview: boolean;
  signedIn: boolean;
  /** Data de hoje no fuso da loja (AAAA-MM-DD): o horário tocado segue escolhido para o app. */
  day?: string;
}) {
  const { t, intlLocale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterExpand = useRef(false);
  // O "+N" some ao abrir a lista: o foco vai para o primeiro horário novo, e não para o body.
  useEffect(() => {
    if (!expanded || !focusAfterExpand.current) return;
    focusAfterExpand.current = false;
    listRef.current?.querySelector<HTMLElement>(`li:nth-child(${SLOTS_SHOWN + 1}) a`)?.focus();
  }, [expanded]);
  const free = member.free_today;
  const shown = expanded ? free : free.slice(0, SLOTS_SHOWN);
  const hidden = free.length - shown.length;
  const atLimit = free.length >= SERVER_SLOTS_LIMIT;
  const pill =
    "relative z-10 inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[var(--control-radius)] border border-border bg-background px-3 text-sm font-semibold tabular-nums hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span>{t("shopLanding.todayTitle")}</span>
        {member.min_duration_minutes && (
          <Tag icon={Clock3}>{t("shopLanding.forMinutes", { n: member.min_duration_minutes })}</Tag>
        )}
        {/* O toque abre a agenda do profissional; ainda não reserva o horário escolhido. */}
        {!preview && (
          <span className="ml-auto inline-flex items-center gap-1 font-medium">
            <Pointer className="size-3.5" aria-hidden />
            {day ? t("shopLanding.tapToPick") : t("shopLanding.tapToOpen")}
          </span>
        )}
      </p>
      <ul
        ref={listRef}
        className="flex flex-wrap gap-2"
        aria-label={t("shopLanding.slotsOf", { name: member.name })}
      >
        {shown.map((time, index) => (
          <li key={time}>
            <BookLink
              slug={slug}
              preview={preview}
              signedIn={signedIn}
              barber={member.booking_slug}
              slot={pickedSlot(day, time, member)}
              ariaLabel={t(day ? "shopLanding.slotPickAria" : "shopLanding.slotAria", {
                time: formatClock(time, intlLocale),
                name: member.name,
              })}
              className={cn(pill, index === 0 && "public-slot-next font-extrabold leading-none")}
            >
              {index === 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("shopLanding.nextMark")}
                </span>
              )}
              {formatClock(time, intlLocale)}
            </BookLink>
          </li>
        ))}
        {hidden > 0 && !atLimit && (
          <li>
            <button
              type="button"
              onClick={() => {
                focusAfterExpand.current = true;
                setExpanded(true);
              }}
              aria-label={`+${hidden} · ${t("shopLanding.showMore", { n: hidden })}`}
              className={cn(pill, "border-dashed text-muted-foreground")}
            >
              +{hidden}
            </button>
          </li>
        )}
        {atLimit && (
          <li>
            <BookLink
              slug={slug}
              preview={preview}
              signedIn={signedIn}
              barber={member.booking_slug}
              className={cn(pill, "flex-row gap-1 border-dashed text-muted-foreground")}
            >
              {t("shopLanding.allSlots")}
              <ChevronRight className="size-4" aria-hidden />
            </BookLink>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Cartão de um serviço: ícone (ou tesoura padrão), nome, duração em pílula e preço em destaque. */
export function ServiceRow({ service, price }: { service: LandingService; price: string }) {
  const { t } = useI18n();
  return (
    <li className="public-card flex items-center gap-3 rounded-[var(--panel-radius)] border border-border p-3">
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--control-radius)] bg-muted text-muted-foreground">
        {/* Sem ícone escolhido vira a tesoura padrão: iniciais ficam só para pessoas. */}
        <ServiceIcon
          icon={service.icon}
          className="size-6"
          imageClassName="size-full object-cover"
        />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{service.name}</p>
        {service.description && (
          <p className="text-xs leading-snug text-muted-foreground">{service.description}</p>
        )}
        <Tag icon={Clock3}>{t("shopLanding.minutes", { n: service.duration_minutes })}</Tag>
      </div>
      <p className="shrink-0 text-base font-extrabold tabular-nums">{price}</p>
    </li>
  );
}

/** Semana em poucas linhas (dias iguais juntos), com hoje destacado pelo mesmo ponto do selo. */
export function WeekHours({
  groups,
  todayWeekday,
  openNow,
  dayShort,
}: {
  groups: HoursGroup[];
  todayWeekday: number;
  openNow: boolean;
  dayShort: (weekday: number) => string;
}) {
  const { t, intlLocale } = useI18n();
  return (
    <ul className="public-card overflow-hidden rounded-[var(--panel-radius)] border border-border">
      {groups.map((group) => {
        const isToday = group.days.includes(todayWeekday);
        const first = group.days[0];
        const last = group.days[group.days.length - 1];
        const label =
          group.days.length === 1
            ? dayShort(first)
            : t("shopLanding.dayRange", { from: dayShort(first), to: dayShort(last) });
        return (
          <li
            key={group.days.join("-")}
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "flex min-h-12 items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 text-sm last:border-b-0",
              isToday && "bg-muted font-bold",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {isToday && (
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full bg-[color:var(--tone-line)]",
                    openNow ? "tone-success" : "tone-neutral",
                  )}
                />
              )}
              <span>{label}</span>
              {isToday && (
                <span className="rounded-[var(--button-radius)] bg-card px-2 py-0.5 text-[11px] font-bold">
                  {t("shopLanding.today")}
                </span>
              )}
            </span>
            {group.is_open ? (
              <span className="shrink-0 tabular-nums">
                {t("shopLanding.hoursRange", {
                  from: formatClock(group.opens_at, intlLocale),
                  to: formatClock(group.closes_at, intlLocale),
                })}
              </span>
            ) : (
              <StatusBadge tone="neutral" icon={Moon} size="sm" label={t("shopLanding.closed")} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Como chegar, WhatsApp e Instagram em botões do mesmo tamanho logo abaixo do nome, só com os
 * canais que existem. Sobre a capa escura.
 */
export function QuickActions({
  preview,
  map,
  whatsapp,
  instagram,
  instagramHandle,
  className,
}: {
  preview: boolean;
  map: string | null;
  whatsapp: string | null;
  instagram: string | null;
  instagramHandle: string;
  className?: string;
}) {
  const { t } = useI18n();
  const items = [
    map && { href: map, icon: MapPin, label: t("shopLanding.directions"), title: undefined },
    whatsapp && {
      href: whatsapp,
      icon: MessageCircle,
      label: t("shopLanding.whatsapp"),
      title: undefined,
    },
    instagram && {
      href: instagram,
      icon: Instagram,
      label: t("shopLanding.instagram"),
      title: instagramHandle.startsWith("@") ? instagramHandle : `@${instagramHandle}`,
    },
  ].filter(Boolean) as { href: string; icon: LucideIcon; label: string; title?: string }[];
  if (!items.length) return null;
  const itemClass =
    "hero-quick-action flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--control-radius)] px-2 py-2 text-center text-xs font-semibold leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
  return (
    <ul
      aria-label={t("shopLanding.contactLabel")}
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ href, icon: Icon, label, title }) => (
        <li key={label}>
          {preview ? (
            <span className={itemClass}>
              <Icon className="size-5" aria-hidden />
              {label}
              {title && <span className="block max-w-full truncate text-[10px]">{title}</span>}
            </span>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              title={title}
            >
              <Icon className="size-5" aria-hidden />
              <span className="block min-w-0 max-w-full">
                {label}
                {title && (
                  <span className="block truncate text-[10px] font-medium">
                    <span className="sr-only"> </span>
                    {title}
                  </span>
                )}
                <span className="sr-only"> ({t("shopLanding.externalHint")})</span>
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
