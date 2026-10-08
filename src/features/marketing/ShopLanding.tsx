import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Clock3,
  Info,
  Link2Off,
  LogIn,
  MapPin,
  Moon,
  RefreshCw,
  Scissors,
  Users,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmptyState, LoadingState, Notice, StatusBadge, type Tone } from "@/components/visual";
import { StaffPhoto } from "@/components/ui/staff-photo";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { brandCornerClass, brandVariables, DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { useAvailabilitySignal } from "@/lib/shop/availability-signal";
import {
  BookLink,
  MemberDayBadge,
  QuickActions,
  ServiceRow,
  SlotPills,
  TodayCard,
  WeekHours,
  type MemberDay,
} from "./ShopLandingParts";
import {
  endedToday,
  formatClock,
  groupHours,
  splitClosedToday,
  instagramUrl,
  mapsUrl,
  nextOpeningAfterToday,
  openStateAt,
  parseLandingData,
  sortStaffByAvailability,
  whatsappUrl,
  type LandingData,
} from "./shop-landing";

const REFRESH_MS = 60_000;
/** Cor de destaque ajustada para leitura nos dois temas (ícones de seção fora dos cartões). */
const accentIconClass =
  "text-[var(--brand-accent-readable)] dark:text-[var(--brand-accent-readable-dark,var(--brand-accent-readable))]";
const heroIconButton = "app-icon-button hero-icon-button";

/** Situação da última atualização dos horários (selo "Ao vivo" ou "Sem conexão"). */
export type LandingFreshness = {
  /** Momento da última atualização que deu certo (ISO). */
  updatedAt: string | null;
  /** A última tentativa de atualizar falhou: os horários podem estar velhos. */
  failed: boolean;
  onRefresh: () => void;
};

function nowInZone(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

/** Página pública da loja: busca os dados e atualiza os horários de hoje a cada minuto. */
export function ShopLanding({ shopRef, host }: { shopRef?: string; host?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<LandingData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    let result: Awaited<ReturnType<typeof supabase.rpc<"get_public_shop_landing">>> | null = null;
    try {
      result = await supabase.rpc("get_public_shop_landing", {
        p_shop_ref: shopRef ?? null,
        p_host: host ?? null,
      });
    } catch {
      result = null;
    }
    if (!result || result.error) {
      // Depois do primeiro carregamento, os horários antigos continuam, com o selo "Sem conexão".
      setFailed(true);
      setState((current) => (current === "ready" ? current : "error"));
      return;
    }
    const parsed = parseLandingData(result.data);
    setData(parsed);
    setFailed(false);
    setUpdatedAt(new Date().toISOString());
    setState(parsed ? "ready" : "missing");
  }, [shopRef, host]);

  const retry = useCallback(() => {
    setState("loading");
    void load();
  }, [load]);

  // Aba do navegador com o nome e a logo da barbearia.
  useShopFavicon(data?.shop.logo_url ?? null);
  const tabName = data ? data.shop.display_name || data.shop.name : null;
  const tabTitle = tabName ? t("shopLanding.docTitle", { name: tabName }) : null;
  useEffect(() => {
    if (!tabTitle) return;
    const previous = document.title;
    document.title = tabTitle;
    return () => {
      document.title = previous;
    };
  }, [tabTitle]);

  // Atualiza na hora quando a agenda muda; o recarregamento a cada minuto fica como reserva.
  useAvailabilitySignal(data?.shop.id, () => void load());

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  if (state === "loading") {
    // Esqueleto com o desenho da página (capa escura + cartões) e o verbo visível.
    return (
      <main className="public-page min-h-dvh bg-background">
        <div aria-hidden className="bg-[#141412] px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mx-auto max-w-3xl space-y-4">
            <span className="block size-12 rounded-[var(--control-radius)] bg-white/10" />
            <span className="mt-8 block h-9 w-2/3 rounded-md bg-white/10 motion-safe:animate-pulse" />
            <span className="block h-4 w-1/2 rounded-md bg-white/10 motion-safe:animate-pulse" />
            <span className="block h-36 rounded-[var(--panel-radius)] bg-white/10 motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <LoadingState
            label={t("shopLanding.loading")}
            variant="cards"
            count={2}
            onRetry={retry}
          />
        </div>
      </main>
    );
  }
  if (state !== "ready" || !data) {
    const missing = state === "missing";
    // "Endereço errado" e "sem internet" com desenhos e saídas diferentes.
    return (
      <main className="public-page flex min-h-dvh items-center justify-center bg-background p-4">
        <EmptyState
          className="public-card w-full max-w-sm"
          status={missing ? "neutral" : "warning"}
          icon={missing ? Link2Off : WifiOff}
          title={t(missing ? "shopLanding.missingTitle" : "shopLanding.errorTitle")}
          description={t(missing ? "shopLanding.checkLink" : "shopLanding.errorText")}
          action={
            missing ? (
              <Link
                to="/auth"
                search={{ next: "" }}
                className="action-button action-confirm min-h-12 w-full"
              >
                <LogIn aria-hidden />
                {t("shopLanding.signIn")}
              </Link>
            ) : (
              <button
                type="button"
                className="action-button action-confirm min-h-12 w-full"
                onClick={retry}
              >
                <RefreshCw aria-hidden />
                {t("shopLanding.retry")}
              </button>
            )
          }
          secondaryAction={
            missing ? (
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center text-sm font-semibold underline underline-offset-4"
              >
                {t("shopLanding.goHome")}
              </Link>
            ) : undefined
          }
        />
      </main>
    );
  }
  return (
    <ShopLandingView data={data} freshness={{ updatedAt, failed, onRefresh: () => void load() }} />
  );
}

/** Parte visual, usada também na prévia do editor (sem links ativos). */
export function ShopLandingView({
  data,
  preview = false,
  freshness,
}: {
  data: LandingData;
  preview?: boolean;
  freshness?: LandingFreshness;
}) {
  const { t, intlLocale } = useI18n();
  const { shop, landing, today } = data;
  const name = shop.display_name || shop.name;
  const headline = landing.headline || shop.tagline || t("shopLanding.defaultHeadline");
  // Na prévia do editor o espaço é estreito: fica sempre em uma coluna.
  const wide = !preview;
  const [nowHHMM, setNowHHMM] = useState(() => nowInZone(shop.timezone));
  useEffect(() => {
    const timer = window.setInterval(() => setNowHHMM(nowInZone(shop.timezone)), 30_000);
    return () => window.clearInterval(timer);
  }, [shop.timezone]);
  const open = openStateAt(today, nowHHMM);
  const ended = endedToday(today, nowHHMM);
  const nextOpen = open.kind === "closed" ? nextOpeningAfterToday(data.hours, today.weekday) : null;

  // Com sessão salva neste aparelho, "Agendar" vai direto ao app (leitura local, sem login).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (preview) return;
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data: session }) => {
        if (active) setSignedIn(!!session.session);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [preview]);

  // A barra fixa do celular (e o botão do painel lateral no computador) só aparece quando o
  // botão principal do cartão "Hoje" sai da tela: nunca dois botões iguais à vista.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    if (preview) return;
    const node = ctaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [preview]);

  const dayLong = useMemo(() => {
    const base = new Date(Date.UTC(2024, 0, 7));
    const format = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" });
    return (weekday: number) => format.format(new Date(base.getTime() + weekday * 86_400_000));
  }, [intlLocale]);
  const dayShort = useMemo(() => {
    const base = new Date(Date.UTC(2024, 0, 7));
    const format = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
    return (weekday: number) => {
      const label = format.format(new Date(base.getTime() + weekday * 86_400_000));
      return label.charAt(0).toLocaleUpperCase(intlLocale) + label.slice(1);
    };
  }, [intlLocale]);
  const money = (cents: number) =>
    (cents / 100).toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
    });

  const showStaff = landing.enabled && landing.show_staff && data.staff.length > 0;
  const showToday = showStaff && landing.show_today;
  const showServices = landing.enabled && landing.show_services && data.services.length > 0;
  const showHours = landing.enabled && landing.show_hours && data.hours.length > 0;
  const contact = {
    map: mapsUrl(landing.address),
    instagram: instagramUrl(landing.instagram),
    whatsapp: whatsappUrl(landing.whatsapp),
  };
  const address = landing.enabled ? landing.address.trim() : "";
  const showAbout = landing.enabled && !!landing.about.trim();

  // Equipe: quem tem vaga hoje primeiro; o horário mais cedo vira o "Próximo horário livre".
  const staff = useMemo(() => sortStaffByAvailability(data.staff), [data.staff]);
  const freeStaff = staff.filter((member) => member.offers_services && member.free_today.length);
  const nextSlot =
    showToday && freeStaff[0] ? { time: freeStaff[0].free_today[0], member: freeStaff[0] } : null;
  const dayOver = !today.is_open || open.kind === "closed";
  const dayState: MemberDay = dayOver ? (ended ? "ended" : "off") : "full";
  const memberDay = (member: (typeof staff)[number]): MemberDay =>
    !member.offers_services ? "noOnline" : member.free_today.length > 0 ? "free" : dayState;
  const anyOnline = staff.some((member) => member.offers_services);
  const nextDayLabel = nextOpen
    ? t("shopLanding.nextDay", { day: dayLong(nextOpen.weekday) })
    : null;

  const statusLabel =
    open.kind === "open"
      ? t("shopLanding.openUntil", { time: formatClock(open.until, intlLocale) })
      : open.kind === "later"
        ? t("shopLanding.opensAt", { time: formatClock(open.opens, intlLocale) })
        : nextOpen
          ? nextOpen.inDays === 1
            ? t("shopLanding.closedOpensTomorrow", {
                time: formatClock(nextOpen.opens, intlLocale),
              })
            : t("shopLanding.closedOpensDay", {
                day: dayLong(nextOpen.weekday),
                time: formatClock(nextOpen.opens, intlLocale),
              })
          : t("shopLanding.closedToday");
  const statusTone: Tone =
    open.kind === "open" ? "success" : open.kind === "later" ? "info" : "neutral";
  const statusIcon = open.kind === "later" ? Clock3 : open.kind === "closed" ? Moon : undefined;
  const updatedLabel = freshness?.updatedAt
    ? new Date(freshness.updatedAt).toLocaleTimeString(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  /** O selo aberto/fechado do topo leva ao horário da semana (o visível nesta largura). */
  const scrollToHours = () => {
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-hours]")).find(
      (element) => element.offsetParent !== null,
    );
    if (!target) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  const style = brandVariables(
    shop.primary_color,
    shop.accent_color,
    shop.font_family,
    shop.custom_font_url,
    shop.header_font_weight,
    shop.header_font_style,
    shop.corner_style,
  ) as CSSProperties;
  const brandFont: CSSProperties = {
    fontFamily: "var(--brand-font)",
    fontWeight: "var(--brand-header-font-weight)" as CSSProperties["fontWeight"],
    fontStyle: "var(--brand-header-font-style)",
  };

  const statusBadge = (
    <StatusBadge
      tone={statusTone}
      icon={statusIcon}
      live={open.kind === "open"}
      size="lg"
      label={statusLabel}
    />
  );
  const hoursSection = (aside: boolean) =>
    showHours && (
      <section
        aria-labelledby={aside ? "landing-hours-aside" : "landing-hours"}
        data-landing-hours
        tabIndex={-1}
        className={cn("scroll-mt-6 space-y-3 outline-none", wide && !aside && "lg:hidden")}
      >
        <h2
          id={aside ? "landing-hours-aside" : "landing-hours"}
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
        >
          <Clock3 className={`size-5 ${accentIconClass}`} aria-hidden />
          {t("shopLanding.hoursTitle")}
        </h2>
        <WeekHours
          groups={splitClosedToday(groupHours(data.hours), today.weekday, today.is_open)}
          todayWeekday={today.weekday}
          openNow={open.kind === "open"}
          dayShort={dayShort}
        />
      </section>
    );

  return (
    <div
      className={cn(
        "shop-landing public-page bg-background text-foreground",
        !preview && "brand-page min-h-dvh",
        brandCornerClass(shop.corner_style),
      )}
      style={style}
    >
      <BrandFontFace url={shop.custom_font_url} />
      <header className="relative isolate overflow-hidden bg-[#141412] text-[#f7f5f0]">
        <img
          src={shop.hero_image_url || DEFAULT_LOGIN_IMAGE}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-55"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/50 to-[#141412]"
          aria-hidden
        />
        <div
          className={cn(
            "mx-auto flex max-w-3xl items-center justify-between gap-3 px-4",
            wide && "lg:max-w-6xl",
            preview ? "pt-4" : "pt-[max(1rem,env(safe-area-inset-top))]",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={t("shopLanding.logoAlt", { name })}
                className="size-12 shrink-0 rounded-[var(--control-radius)] object-contain p-1"
                style={{ background: shop.logo_background_color || "#f7f5f0" }}
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--control-radius)] bg-[#f7f5f0] text-[#141412]">
                <Scissors className="size-5" aria-hidden />
              </span>
            )}
          </div>
          {!preview && (
            <div className="flex items-center gap-2">
              <LanguageSwitcher showCode buttonClassName={heroIconButton} />
              <ThemeToggle buttonClassName={heroIconButton} />
            </div>
          )}
        </div>
        <div
          className={cn(
            "mx-auto max-w-3xl px-4 pb-6 pt-8",
            wide &&
              "lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end lg:gap-10 lg:pb-10",
          )}
        >
          <div className="min-w-0 space-y-4">
            <h1 className="text-4xl leading-tight sm:text-5xl" style={brandFont}>
              {name}
            </h1>
            <p className="max-w-xl text-base text-[#f7f5f0]/85">{headline}</p>
            {showHours ? (
              <button
                type="button"
                onClick={scrollToHours}
                aria-label={`${statusLabel}. ${t("shopLanding.seeWeek")}`}
                className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-[var(--button-radius)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                {statusBadge}
                <ChevronDown className="size-4 shrink-0 text-[#f7f5f0]/80" aria-hidden />
              </button>
            ) : (
              <p>{statusBadge}</p>
            )}
            {landing.enabled && (
              <QuickActions
                preview={preview}
                map={contact.map}
                whatsapp={contact.whatsapp}
                instagram={contact.instagram}
                instagramHandle={landing.instagram.trim()}
                className="max-w-md"
              />
            )}
            {address && (
              <p className="flex max-w-md items-start gap-1.5 text-xs leading-snug text-[#f7f5f0]/80">
                <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 [overflow-wrap:anywhere]">{address}</span>
              </p>
            )}
          </div>
          <TodayCard
            slug={shop.slug}
            preview={preview}
            signedIn={signedIn}
            showToday={showToday}
            next={nextSlot}
            day={today.date || undefined}
            freeCount={freeStaff.length}
            dayState={anyOnline ? dayState : null}
            nextDayLabel={nextDayLabel}
            ctaRef={ctaRef}
            className={cn("mt-6", wide && "lg:mt-0")}
          />
        </div>
      </header>

      <div
        className={cn(
          "mx-auto max-w-3xl px-4 py-8",
          wide &&
            "pb-[calc(6rem+env(safe-area-inset-bottom))] lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-10 lg:pb-12",
        )}
      >
        <main className="min-w-0 space-y-8">
          {showStaff && (
            <section aria-labelledby="landing-staff" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="landing-staff"
                  className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
                >
                  <Users className={`size-5 ${accentIconClass}`} aria-hidden />
                  {t("shopLanding.staffTitle")}
                </h2>
                {showToday && freshness && !freshness.failed && updatedLabel && (
                  <StatusBadge
                    tone="success"
                    variant="dot"
                    live
                    label={t("shopLanding.live", { time: updatedLabel })}
                  />
                )}
              </div>
              {showToday && freshness?.failed && (
                <Notice
                  tone="warning"
                  icon={WifiOff}
                  title={t("shopLanding.offlineTitle")}
                  action={{
                    label: t("shopLanding.refresh"),
                    onClick: freshness.onRefresh,
                    icon: RefreshCw,
                  }}
                >
                  {t("shopLanding.offlineText")}
                </Notice>
              )}
              <ul className="grid gap-3 sm:grid-cols-2">
                {staff.map((member) => {
                  const day = memberDay(member);
                  const bookable = member.offers_services;
                  return (
                    <li
                      key={member.booking_slug ?? member.name}
                      className={cn(
                        "public-card relative flex flex-col gap-3 rounded-[var(--panel-radius)] border border-border p-4",
                        bookable ? "transition-colors hover:border-foreground/40" : "border-dashed",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <StaffPhoto
                          src={member.avatar_url}
                          className={cn("size-14 rounded-full", !bookable && "opacity-70")}
                          fallback={
                            <span
                              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold"
                              aria-hidden
                            >
                              {member.name.slice(0, 1).toUpperCase()}
                            </span>
                          }
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h3 className="font-bold leading-snug">{member.name}</h3>
                          {(showToday || !bookable) && (
                            <MemberDayBadge state={showToday ? day : "noOnline"} />
                          )}
                          {member.bio && (
                            <p className="text-sm text-muted-foreground">{member.bio}</p>
                          )}
                        </div>
                      </div>
                      {showToday && day === "free" && (
                        <SlotPills
                          member={member}
                          slug={shop.slug}
                          preview={preview}
                          signedIn={signedIn}
                          day={today.date || undefined}
                        />
                      )}
                      {bookable && (
                        <BookLink
                          slug={shop.slug}
                          preview={preview}
                          signedIn={signedIn}
                          barber={member.booking_slug}
                          className="public-accent mt-auto inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold after:absolute after:inset-0 after:rounded-[var(--panel-radius)] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                          {showToday && day !== "free"
                            ? t("shopLanding.otherDays")
                            : t("shopLanding.bookWith", { name: member.name.split(" ")[0] })}
                          <ChevronRight className="size-4" aria-hidden />
                        </BookLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {showServices && (
            <section aria-labelledby="landing-services" className="space-y-3">
              <h2
                id="landing-services"
                className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
              >
                <Scissors className={`size-5 ${accentIconClass}`} aria-hidden />
                {t("shopLanding.servicesTitle")}
              </h2>
              <ul className={cn("grid gap-2", wide && "lg:grid-cols-2 lg:gap-3")}>
                {data.services.map((service) => (
                  <ServiceRow
                    key={service.name}
                    service={service}
                    price={money(service.price_cents)}
                  />
                ))}
              </ul>
            </section>
          )}

          {hoursSection(false)}

          {showAbout && (
            <section aria-labelledby="landing-about" className="space-y-2">
              <h2
                id="landing-about"
                className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
              >
                <Info className={`size-5 ${accentIconClass}`} aria-hidden />
                {t("shopLanding.about")}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {landing.about}
              </p>
            </section>
          )}

          {!preview && (
            <footer className="space-y-2 border-t border-border pt-6 text-center text-xs text-muted-foreground">
              <p>{t("shopLanding.footer")}</p>
              <p className="flex justify-center gap-2">
                <Link
                  to="/privacidade"
                  className="inline-flex min-h-11 items-center px-2 font-semibold text-foreground underline underline-offset-4"
                >
                  {t("shopLanding.privacy")}
                </Link>
                <Link
                  to="/termos"
                  className="inline-flex min-h-11 items-center px-2 font-semibold text-foreground underline underline-offset-4"
                >
                  {t("shopLanding.terms")}
                </Link>
              </p>
            </footer>
          )}
        </main>

        {wide && (
          // Computador: painel lateral fixo com o horário e, quando o cartão "Hoje" sai da
          // tela, o botão de agendar (sem barra atravessando a tela).
          <aside className="hidden space-y-6 lg:sticky lg:top-6 lg:block">
            {!ctaVisible && (
              <div className="public-card space-y-2 rounded-[var(--panel-radius)] border border-border p-4">
                <p className="text-sm font-bold">{name}</p>
                <p>{statusBadge}</p>
                <BookLink
                  slug={shop.slug}
                  preview={preview}
                  signedIn={signedIn}
                  className="action-button action-confirm min-h-12 w-full text-sm"
                >
                  <CalendarPlus aria-hidden />
                  {t("shopLanding.bookCta")}
                </BookLink>
              </div>
            )}
            {hoursSection(true)}
          </aside>
        )}
      </div>

      {!preview && !ctaVisible && (
        <div className="public-sticky-bar public-card fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
          <div className="mx-auto max-w-3xl">
            <BookLink
              slug={shop.slug}
              preview={preview}
              signedIn={signedIn}
              className="action-button action-confirm min-h-12 w-full text-sm"
            >
              <CalendarPlus aria-hidden />
              {t("shopLanding.bookCta")}
            </BookLink>
          </div>
        </div>
      )}
    </div>
  );
}
