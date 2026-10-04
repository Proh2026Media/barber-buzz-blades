import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronRight,
  Clock3,
  Instagram,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  Scissors,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { brandCornerClass, brandVariables, DEFAULT_LOGIN_IMAGE } from "@/lib/shop/branding";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { ServiceIcon } from "@/components/ui/service-icon";
import { StaffPhoto } from "@/components/ui/staff-photo";
import { useAvailabilitySignal } from "@/lib/shop/availability-signal";
import {
  instagramUrl,
  mapsUrl,
  openStateAt,
  parseLandingData,
  whatsappUrl,
  type LandingData,
} from "./shop-landing";

const REFRESH_MS = 60_000;
const SLOTS_SHOWN = 6;
/** `get_public_shop_landing` devolve no máximo 12 horários livres por profissional. */
const SERVER_SLOTS_LIMIT = 12;
/** Cor de destaque ajustada para leitura nos dois temas (ícones de seção). */
const accentIconClass =
  "text-[var(--brand-accent-readable)] dark:text-[var(--brand-accent-readable-dark,var(--brand-accent-readable))]";

/** Mostra um "HH:MM" da loja no formato de hora do idioma (ex.: 02:30 PM em en-US). */
function formatClock(value: string | null | undefined, locale: string) {
  if (!value) return value ?? "";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 1, Number(match[1]), Number(match[2]))));
  } catch {
    return value;
  }
}

function appPath(slug: string, barber?: string | null) {
  const params = new URLSearchParams({ shop: slug });
  if (barber) params.set("barber", barber);
  return `/app?${params.toString()}`;
}

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

  const load = useCallback(async () => {
    const { data: raw, error } = await supabase.rpc("get_public_shop_landing", {
      p_shop_ref: shopRef ?? null,
      p_host: host ?? null,
    });
    if (error) {
      setState((current) => (current === "ready" ? current : "error"));
      return;
    }
    const parsed = parseLandingData(raw);
    setData(parsed);
    setState(parsed ? "ready" : "missing");
  }, [shopRef, host]);

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
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background" role="status">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">{t("shopLanding.loading")}</span>
      </main>
    );
  }
  if (state !== "ready" || !data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <Scissors className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-extrabold">
          {t(state === "missing" ? "shopLanding.missingTitle" : "shopLanding.errorTitle")}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t(state === "missing" ? "shopLanding.missingText" : "shopLanding.errorText")}
        </p>
        {state === "error" ? (
          <button
            type="button"
            className="action-button action-confirm"
            onClick={() => void load()}
          >
            {t("shopLanding.retry")}
          </button>
        ) : (
          <Link to="/" className="action-button action-confirm">
            {t("shopLanding.goHome")}
          </Link>
        )}
      </main>
    );
  }
  return <ShopLandingView data={data} />;
}

/** Parte visual, usada também na prévia do editor (sem links ativos). */
export function ShopLandingView({
  data,
  preview = false,
}: {
  data: LandingData;
  preview?: boolean;
}) {
  const { t, intlLocale } = useI18n();
  const { shop, landing, today } = data;
  const name = shop.display_name || shop.name;
  const headline = landing.headline || shop.tagline || t("shopLanding.defaultHeadline");
  const [nowHHMM, setNowHHMM] = useState(() => nowInZone(shop.timezone));
  useEffect(() => {
    const timer = window.setInterval(() => setNowHHMM(nowInZone(shop.timezone)), 30_000);
    return () => window.clearInterval(timer);
  }, [shop.timezone]);
  const open = openStateAt(today, nowHHMM);

  const weekdayName = useMemo(() => {
    const base = new Date(Date.UTC(2024, 0, 7));
    const format = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" });
    return (weekday: number) => {
      const label = format.format(new Date(base.getTime() + weekday * 86_400_000));
      return (
        label.charAt(0).toLocaleUpperCase(intlLocale) + label.slice(1).toLocaleLowerCase(intlLocale)
      );
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
  const hasAbout =
    landing.enabled && (landing.about || contact.map || contact.instagram || contact.whatsapp);

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

  return (
    <div
      className={`shop-landing ${preview ? "" : "brand-page min-h-dvh"} bg-background text-foreground ${brandCornerClass(shop.corner_style)}`}
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
          className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/45 to-[#141412]"
          aria-hidden
        />
        <div
          className={`mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 ${preview ? "pt-4" : "pt-[max(1rem,env(safe-area-inset-top))]"}`}
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
          {!preview && <LanguageSwitcher buttonClassName="app-icon-button hero-icon-button" />}
        </div>
        <div className="mx-auto max-w-3xl space-y-4 px-4 pb-8 pt-10">
          <h1 className="text-4xl leading-tight sm:text-5xl" style={brandFont}>
            {name}
          </h1>
          <p className="max-w-xl text-base text-[#f7f5f0]/85">{headline}</p>
          <p
            className={`inline-flex items-center gap-2 rounded-[var(--button-radius)] px-3 py-1.5 text-xs font-bold ${
              open.kind === "open"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-white/10 text-[#f7f5f0]/85"
            }`}
          >
            <span
              className={`size-2 rounded-full ${open.kind === "open" ? "bg-emerald-400" : "bg-white/50"}`}
              aria-hidden
            />
            {open.kind === "open"
              ? t("shopLanding.openUntil", { time: formatClock(open.until, intlLocale) })
              : open.kind === "later"
                ? t("shopLanding.opensAt", { time: formatClock(open.opens, intlLocale) })
                : t("shopLanding.closedToday")}
          </p>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <LoginLink
              slug={shop.slug}
              preview={preview}
              className="action-button action-confirm min-h-12 border-white/30 px-5 text-sm"
            >
              <LogIn aria-hidden />
              {t("shopLanding.cta")}
            </LoginLink>
          </div>
          <p className="text-xs text-[#f7f5f0]/70">{t("shopLanding.ctaHint")}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {showStaff && (
          <section aria-labelledby="landing-staff" className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserRound className={`size-5 ${accentIconClass}`} aria-hidden />
                <h2 id="landing-staff" className="text-lg font-extrabold tracking-tight">
                  {t("shopLanding.staffTitle")}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(showToday ? "shopLanding.staffHintToday" : "shopLanding.staffHint")}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.staff.map((member) => (
                <li
                  key={member.booking_slug ?? member.name}
                  className="relative flex flex-col gap-3 rounded-[var(--panel-radius)] border border-border bg-card p-4 transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-start gap-3">
                    <StaffPhoto
                      src={member.avatar_url}
                      className="size-14 rounded-full"
                      fallback={
                        <span
                          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold"
                          aria-hidden
                        >
                          {member.name.slice(0, 1).toUpperCase()}
                        </span>
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-bold">{member.name}</h3>
                      {member.bio && <p className="text-sm text-muted-foreground">{member.bio}</p>}
                    </div>
                  </div>
                  {showToday &&
                    (!member.offers_services ? (
                      <p className="rounded-[var(--control-radius)] bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {t("shopLanding.memberNoServices")}
                      </p>
                    ) : member.free_today.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {member.min_duration_minutes
                            ? t("shopLanding.todayFrom", { n: member.min_duration_minutes })
                            : t("shopLanding.todayTitle")}
                        </p>
                        <ul
                          className="flex flex-wrap gap-2"
                          aria-label={t("shopLanding.slotsOf", { name: member.name })}
                        >
                          {member.free_today.slice(0, SLOTS_SHOWN).map((time) => (
                            <li key={time}>
                              <LoginLink
                                slug={shop.slug}
                                preview={preview}
                                barber={member.booking_slug}
                                className="relative z-10 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--control-radius)] border border-border bg-background px-3 text-sm font-semibold tabular-nums hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {formatClock(time, intlLocale)}
                              </LoginLink>
                            </li>
                          ))}
                          {member.free_today.length > SLOTS_SHOWN && (
                            <li className="inline-flex min-h-11 items-center px-2 text-xs text-muted-foreground">
                              {member.free_today.length >= SERVER_SLOTS_LIMIT
                                ? t("fix.landing-espera-pwa.moreSlotsMany")
                                : t("shopLanding.moreSlots", {
                                    n: member.free_today.length - SLOTS_SHOWN,
                                  })}
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <p className="rounded-[var(--control-radius)] bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {today.is_open && open.kind !== "closed"
                          ? t("shopLanding.memberNoSlots")
                          : t("shopLanding.memberClosed")}
                      </p>
                    ))}
                  <LoginLink
                    slug={shop.slug}
                    preview={preview}
                    barber={member.booking_slug}
                    className="mt-auto inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-[var(--brand-accent-readable)] dark:text-[var(--brand-accent-readable-dark,var(--brand-accent-readable))] after:absolute after:inset-0 after:rounded-[var(--panel-radius)] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {t("shopLanding.bookWith", { name: member.name.split(" ")[0] })}
                    <ChevronRight className="size-4" aria-hidden />
                  </LoginLink>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showServices && (
          <section aria-labelledby="landing-services" className="space-y-3">
            <div className="flex items-center gap-2">
              <Scissors className={`size-5 ${accentIconClass}`} aria-hidden />
              <h2 id="landing-services" className="text-lg font-extrabold tracking-tight">
                {t("shopLanding.servicesTitle")}
              </h2>
            </div>
            <ul className="divide-y divide-border rounded-[var(--panel-radius)] border border-border bg-card">
              {data.services.map((service) => (
                <li key={service.name} className="flex items-center gap-3 p-4">
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--control-radius)] bg-muted text-muted-foreground">
                    <ServiceIcon
                      icon={service.icon}
                      className="size-6"
                      imageClassName="size-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground">{service.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("shopLanding.minutes", { n: service.duration_minutes })}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums">{money(service.price_cents)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showHours && (
          <section aria-labelledby="landing-hours" className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className={`size-5 ${accentIconClass}`} aria-hidden />
              <h2 id="landing-hours" className="text-lg font-extrabold tracking-tight">
                {t("shopLanding.hoursTitle")}
              </h2>
            </div>
            <ul className="rounded-[var(--panel-radius)] border border-border bg-card">
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                const row = data.hours.find((item) => item.weekday === weekday);
                const isToday = weekday === today.weekday;
                return (
                  <li
                    key={weekday}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                      isToday ? "font-bold" : ""
                    }`}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span>
                      {weekdayName(weekday)}
                      {isToday && (
                        <span className="ml-2 rounded-[var(--button-radius)] bg-muted px-2 py-0.5 text-[11px]">
                          {t("shopLanding.today")}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {row?.is_open
                        ? t("shopLanding.hoursRange", {
                            from: formatClock(row.opens_at, intlLocale),
                            to: formatClock(row.closes_at, intlLocale),
                          })
                        : t("shopLanding.closed")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {hasAbout && (
          <section aria-labelledby="landing-about" className="space-y-3">
            <h2 id="landing-about" className="text-lg font-extrabold tracking-tight">
              {t("shopLanding.aboutTitle", { name })}
            </h2>
            {landing.about && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {landing.about}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {contact.map && (
                <ContactLink href={contact.map} preview={preview} icon={<MapPin aria-hidden />}>
                  {landing.address}
                </ContactLink>
              )}
              {contact.whatsapp && (
                <ContactLink
                  href={contact.whatsapp}
                  preview={preview}
                  icon={<MessageCircle aria-hidden />}
                >
                  {t("shopLanding.whatsapp")}
                </ContactLink>
              )}
              {contact.instagram && (
                <ContactLink
                  href={contact.instagram}
                  preview={preview}
                  icon={<Instagram aria-hidden />}
                >
                  {landing.instagram.startsWith("@") ? landing.instagram : `@${landing.instagram}`}
                </ContactLink>
              )}
            </div>
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

      <div
        className={`${preview ? "sticky" : "fixed"} inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur-xl ${preview ? "" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"}`}
      >
        <div className="mx-auto max-w-3xl">
          <LoginLink
            slug={shop.slug}
            preview={preview}
            className="action-button action-confirm min-h-12 w-full text-sm"
          >
            <LogIn aria-hidden />
            {t("shopLanding.cta")}
          </LoginLink>
        </div>
      </div>
    </div>
  );
}

function LoginLink({
  slug,
  preview,
  barber,
  className,
  children,
}: {
  slug: string;
  preview: boolean;
  barber?: string | null;
  className: string;
  children: ReactNode;
}) {
  if (preview)
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    );
  return (
    <Link to="/auth" search={{ next: appPath(slug, barber), shop: slug }} className={className}>
      {children}
    </Link>
  );
}

function ContactLink({
  href,
  preview,
  icon,
  children,
}: {
  href: string;
  preview: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  const className =
    "flex min-h-11 items-center gap-3 rounded-[var(--control-radius)] border border-border bg-card px-3 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-[var(--brand-accent-readable)] dark:[&>svg]:text-[var(--brand-accent-readable-dark,var(--brand-accent-readable))]";
  if (preview)
    return (
      <span className={className}>
        {icon}
        <span className="min-w-0 py-2.5 leading-snug [overflow-wrap:anywhere]">{children}</span>
      </span>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {icon}
      <span className="min-w-0 py-2.5 leading-snug [overflow-wrap:anywhere]">{children}</span>
    </a>
  );
}
