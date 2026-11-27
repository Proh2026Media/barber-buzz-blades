import { DescricaoServico } from "@/components/ui/DescricaoServico";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { emDominioDeLoja } from "@/lib/auth/agendamento-rapido";
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
  UserRound,
  MapPin,
  MessageCircle,
  Moon,
  Pointer,
  Scissors,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, Steps, Tag, type Tone } from "@/components/visual";
import { FotoServico } from "@/components/ui/FotoServico";
import { StaffPhoto } from "@/components/ui/staff-photo";
import { useDevice } from "@/lib/device";
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
    tab: emDominioDeLoja() ? "agendar" : undefined,
    reserva: undefined,
    ...(slot ? { day: slot.day, time: slot.time } : {}),
  };
  if (signedIn || emDominioDeLoja())
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
      className={cn("shop-badge", className)}
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
        { label: t("booking.staff"), icon: UserRound },
        { label: t("booking.service"), icon: Scissors },
        { label: t("booking.step.when"), icon: CalendarCheck },
        { label: t("booking.step.review"), icon: SquareCheckBig },
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
  escolhaLivre,
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
  escolhaLivre: boolean;
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
  // "Toque para escolher" só onde se toca; no tablet e no computador, "Escolha um horário".
  const pickHint = t(useDevice() === "celular" ? "shopLanding.tapToPick" : "booking.chooseTime");
  const noneToday = showToday && !next;
  return (
    <section
      aria-labelledby="landing-today"
      className={cn(
        "public-card space-y-3 rounded-[var(--panel-radius)] shop-today-card border border-border p-4",
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
            className="shop-badge"
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

      {showToday && next && escolhaLivre && (
        <p className="flex items-center gap-2">
          <CalendarCheck className="size-4" aria-hidden />
          {t("shopLanding.nextFree")} <strong>{formatClock(next.time, intlLocale)}</strong>
        </p>
      )}
      {showToday && next && !escolhaLivre && (
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
          className="flex min-h-16 items-center gap-3 shop-inner-card border-2 border-foreground/80 bg-background p-3 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StaffPhoto
            src={next.member.avatar_url}
            className="size-11 retrato-profissional"
            fallback={
              <span
                className="flex size-11 shrink-0 items-center justify-center retrato-profissional bg-muted text-base font-bold"
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
                  ? pickHint
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
        <BookLink slug={slug} preview={preview} signedIn={signedIn} className="shop-cta w-full">
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
  // "Toque para escolher" só onde se toca; no tablet e no computador, "Escolha um horário".
  const pickHint = t(useDevice() === "celular" ? "shopLanding.tapToPick" : "booking.chooseTime");
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
          <Tag className="shop-badge" icon={Clock3}>
            {t("shopLanding.forMinutes", { n: member.min_duration_minutes })}
          </Tag>
        )}
        {/* O toque abre a agenda do profissional; ainda não reserva o horário escolhido. */}
        {!preview && (
          <span className="ml-auto inline-flex items-center gap-1 font-medium">
            <Pointer className="size-3.5" aria-hidden />
            {day ? pickHint : t("shopLanding.tapToOpen")}
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
                <span className="text-xs font-bold leading-none text-muted-foreground">
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

/** O catálogo e o perfil usam a mesma apresentação; no perfil, o cartão abre a agenda do titular. */
export function ServiceRow({
  service,
  price,
  reserva,
}: {
  service: LandingService;
  price: string;
  reserva?: { shop: string; barber: string; service: string };
}) {
  const { t } = useI18n();
  const conteudo = (
    <>
      <FotoServico nome={service.name} icone={service.icon} className="foto-servico-vitrine" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5 py-1">
        <strong className="leading-snug [overflow-wrap:anywhere]">{service.name}</strong>
        <DescricaoServico nome={service.name} descricao={service.description} />
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag className="shop-badge" icon={Clock3}>
            {t("shopLanding.minutes", { n: service.duration_minutes })}
          </Tag>
          <span className="text-sm font-bold tabular-nums">{price}</span>
        </span>
      </span>
      {reserva && <ChevronRight className="mr-1 size-4 shrink-0" aria-hidden />}
    </>
  );
  const classe = "flex h-full min-w-0 items-center gap-3 p-2 sm:gap-4";
  return (
    <li className="public-card min-w-0 rounded-[var(--panel-radius)] border border-border">
      {reserva ? (
        <Link
          to="/app"
          search={{ ...reserva, tab: "agendar", join: undefined, reserva: undefined }}
          className={cn(
            classe,
            "rounded-[inherit] hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
          )}
        >
          {conteudo}
        </Link>
      ) : (
        <div className={classe}>{conteudo}</div>
      )}
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
    // public-week: linhas mais baixas a partir de 768 px na página de verdade (.brand-page), não
    // na prévia do editor (src/styles/publicas.css).
    <ul className="public-week public-card overflow-hidden rounded-[var(--panel-radius)] border border-border">
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
                <span className="shop-badge bg-card px-2 py-0.5 text-xs font-bold">
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
              <StatusBadge
                className="shop-badge"
                tone="neutral"
                icon={Moon}
                size="sm"
                label={t("shopLanding.closed")}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Como chegar, WhatsApp e Instagram em botões do mesmo tamanho logo abaixo do nome, só com os
 * canais que existem, em pílulas sobre a capa da loja.
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
    "hero-quick-action shop-hero-focus inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] px-4 py-2 text-sm font-semibold leading-tight";
  return (
    <ul
      aria-label={t("shopLanding.contactLabel")}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {items.map(({ href, icon: Icon, label, title }) => (
        <li key={label}>
          {preview ? (
            <span className={itemClass}>
              <Icon className="size-4 shrink-0" aria-hidden />
              {title ?? label}
            </span>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              title={title}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 max-w-[14rem] truncate">
                {title ? <span className="sr-only">{label}: </span> : null}
                {title ?? label}
                <span className="sr-only"> ({t("shopLanding.externalHint")})</span>
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
