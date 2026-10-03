import { SurveyCard } from "@/features/insights/SurveyCard";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { useWaiting } from "@/features/waiting/useWaiting";
import { WaitingCards, WaitingNotices } from "@/features/waiting/WaitingUI";
import { blocksSlot } from "@/features/waiting/model";
import { CancellationDialog } from "@/features/insights/CancellationDialog";
import { cancellationReasonLabel, type CancellationReason } from "@/features/insights/cancellation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PointsHistory } from "./PointsHistory";
import { CustomerRewards } from "@/features/loyalty/CustomerRewards";
import {
  FALLBACK_PROGRAM,
  parseLoyaltyProgram,
  tierFor,
  tierStyleKey,
  type LoyaltyProgram,
} from "@/features/loyalty/program";
import { NextLevelCard, type NextLevelSummary } from "./NextLevelCard";
import { CustomerRhythm } from "./CustomerRhythm";
import { CustomerProfile } from "./CustomerProfile";
import { NamePrompt } from "./NamePrompt";
import {
  CatalogViewToggle,
  readCatalogViewPreference,
  writeCatalogViewPreference,
  type CatalogViewMode,
} from "@/features/shop/CatalogViewToggle";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/use-theme";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { DatePicker } from "@/components/ui/schedule-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@tanstack/react-router";
import { Fragment, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  Compass,
  Feather,
  User,
  Trophy,
  CheckCircle,
  Moon,
  Sun,
  Info,
  X,
  Zap,
  Star,
  Diamond,
  Armchair,
  Scissors,
  BadgeCheck,
  Sparkle,
  ChevronRight,
  Clock3,
  Receipt,
  SprayCan,
  Crown,
  Gem,
  Droplet,
  Flame,
  Wind,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getSessionProfile } from "@/lib/auth/session";
import { useDemo } from "@/features/demo/context";
import { useDemoChrome } from "@/features/demo/chrome";
import { DemoAccountMenu, DemoRoleSelector } from "@/features/demo/DemoAccountMenu";
import { DEMO_REWARDS, demoLifetimePoints, DEMO_CUSTOMER_ID } from "@/features/demo/model";
import {
  filterReservations,
  type ReservationFilter,
  buildSlotsForWindow,
  slotRuleFromSettings,
  buildBookingDateKeys,
  dateFromLocalKey,
  formatShopDate as formatShopDateIn,
  formatSlotLabel as formatSlotLabelIn,
  shiftDateKey,
  shopDateKey,
  shopDateTime,
  shopDayRange,
  shopHour,
  termsFor,
  validTimeZone,
  weekdayForDateKey,
  DEFAULT_SHOP_TIMEZONE,
  type ServiceTerms,
} from "@/lib/shop/appointments";
import { useAvailabilitySignal } from "@/lib/shop/availability-signal";

type CustomerAppointment = Tables<"appointments"> & {
  service: Pick<Tables<"services">, "name" | "duration_minutes" | "icon"> | null;
  staff: Pick<Tables<"staff">, "display_name"> | null;
  barbershop: Pick<Tables<"barbershops">, "name"> | null;
};

const statusKey = {
  pending: "status.pending",
  reschedule_requested: "status.reschedule_requested",
  confirmed: "status.confirmed",
  cancelled: "status.cancelled",
  completed: "status.completed",
} as const satisfies Record<Tables<"appointments">["status"], MessageKey>;

const matchStatusKey: Record<string, MessageKey> = {
  "AO VIVO": "sports.live",
  PRORROGAÇÃO: "sports.extraTime",
  ENC: "sports.final",
};

/** Troca `{nome}` do texto traduzido por elementos (ex.: trechos em negrito). */
function richText(template: string, nodes: Record<string, ReactNode>) {
  return template
    .split(/\{(\w+)\}/g)
    .map((part, i) => (i % 2 === 1 ? <Fragment key={i}>{nodes[part] ?? part}</Fragment> : part));
}

const matches = [
  {
    id: 1,
    league: "Brasileirão",
    home: "Flamengo",
    away: "Palmeiras",
    scoreH: 2,
    scoreA: 1,
    status: "AO VIVO",
    min: "82'",
  },
  {
    id: 2,
    league: "Champions League",
    home: "Real Madrid",
    away: "Man City",
    scoreH: 3,
    scoreA: 3,
    status: "PRORROGAÇÃO",
    min: "ET",
  },
  {
    id: 3,
    league: "Brasileirão",
    home: "Galo",
    away: "Cruzeiro",
    scoreH: 1,
    scoreA: 0,
    status: "ENC",
    min: "FT",
  },
  {
    id: 4,
    league: "NBA",
    home: "Lakers",
    away: "Celtics",
    scoreH: 102,
    scoreA: 108,
    status: "ENC",
    min: "FT",
  },
];
import { ShopJoinDialog } from "./ShopJoinDialog";
import { ServiceIcon } from "@/components/ui/service-icon";
import { StaffPhoto } from "@/components/ui/staff-photo";

function ArenaApp({
  headerActions,
  directBarberSlug,
  directShopSlug,
  promptJoin = false,
  initialTab,
  focusReservationToken,
}: {
  headerActions?: ReactNode;
  directBarberSlug?: string;
  directShopSlug?: string;
  /** Vindo do pós-login (?join=1); o diálogo também abre se o Host/?shop= apontar loja nova. */
  promptJoin?: boolean;
  initialTab?: string;
  focusReservationToken?: string;
} = {}) {
  useScrollIndicators();
  const demo = useDemo();
  // O estado da demonstração ganha objeto novo a cada tique do relógio; o catálogo
  // só pode recarregar quando a loja muda, senão desfaz a escolha do cliente.
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const demoShopId = demo?.shop.id ?? null;
  const { t, intlLocale } = useI18n();
  const formatShopDate = (
    date: Date | string,
    timeZone: string,
    options: Intl.DateTimeFormatOptions,
  ) => formatShopDateIn(date, timeZone, options, intlLocale);
  const formatSlotLabel = (date: Date, timeZone?: string) =>
    formatSlotLabelIn(date, timeZone, intlLocale);
  const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString(intlLocale, {
      style: "currency",
      currency: "BRL",
      currencyDisplay: "narrowSymbol",
    });
  const demoChrome = useDemoChrome();
  const [tab, setTab] = useState(initialTab ?? "dashboard");
  const [focusToken] = useState(focusReservationToken);
  const [points, setPoints] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram>(FALLBACK_PROGRAM);
  const [pointsVersion, setPointsVersion] = useState(0);
  const { isDark: isDarkMode } = useTheme();
  const [showVipInfo, setShowVipInfo] = useState(false);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [staffIdx, setStaffIdx] = useState(0);
  const [anyAvailable, setAnyAvailable] = useState(false);
  const [favoriteStaffId, setFavoriteStaffId] = useState<string | null>(null);
  const [staffAssignmentMode, setStaffAssignmentMode] = useState<
    "client_pick" | "favorite_then_pick" | "random_available"
  >("client_pick");
  const [serviceView, setServiceView] = useState<CatalogViewMode>("list");
  const [staffView, setStaffView] = useState<CatalogViewMode>("grid");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatKind, setRepeatKind] = useState<"weekday" | "interval_days">("weekday");
  const [repeatInterval, setRepeatInterval] = useState<7 | 15 | 21>(7);
  const [selectedSlotAt, setSelectedSlotAt] = useState<string | null>(null);
  const [bookingSummary, setBookingSummary] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const bookingLock = useRef(false);
  const [sportFilter, setSportFilter] = useState<"all" | "football" | "nba">("all");
  const [shopId, setShopId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [shopName, setShopName] = useState("");
  /** Fuso da barbearia: define os horários oferecidos, independente do aparelho. */
  const [shopTimeZone, setShopTimeZone] = useState<string>(DEFAULT_SHOP_TIMEZONE);
  const [shopSettings, setShopSettings] = useState<
    Pick<
      Tables<"barbershop_settings">,
      | "tagline"
      | "display_name"
      | "logo_url"
      | "logo_background_color"
      | "font_family"
      | "custom_font_url"
      | "custom_font_name"
      | "custom_font_faces"
      | "font_scope"
      | "header_font_weight"
      | "header_font_style"
      | "corner_style"
      | "floating_chrome"
      | "primary_color"
      | "accent_color"
      | "booking_instructions"
      | "booking_horizon_days"
      | "survey_program_enabled"
      | "sports_enabled"
    >
  >({
    display_name: null,
    logo_url: null,
    logo_background_color: null,
    font_family: "inter",
    custom_font_url: null,
    custom_font_name: null,
    custom_font_faces: [],
    font_scope: "header",
    header_font_weight: 700,
    header_font_style: "normal",
    corner_style: "soft",
    floating_chrome: false,
    primary_color: "#292925",
    accent_color: "#8A602F",
    tagline: "Club & Lounge",
    booking_instructions: "",
    booking_horizon_days: 14,
    survey_program_enabled: true,
    sports_enabled: false,
  });
  useShopFavicon(shopSettings.logo_url);
  const [userId, setUserId] = useState<string | null>(null);
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [staff, setStaff] = useState<Tables<"staff">[]>([]);
  // Quem faz cada serviço, com duração e preço próprios; null = todos fazem tudo (demonstração).
  const [serviceTerms, setServiceTerms] = useState<ServiceTerms[] | null>(null);
  const staffPickedByUser = useRef(false);

  useEffect(() => {
    if (!shopId) return;
    setServiceView(readCatalogViewPreference(shopId, "services", "list"));
    setStaffView(readCatalogViewPreference(shopId, "staff", "grid"));
  }, [shopId]);

  function changeServiceView(value: CatalogViewMode) {
    setServiceView(value);
    writeCatalogViewPreference(shopId, "services", value);
  }

  function changeStaffView(value: CatalogViewMode) {
    setStaffView(value);
    writeCatalogViewPreference(shopId, "staff", value);
  }

  const [slots, setSlots] = useState<Date[]>([]);
  const [slotsFor, setSlotsFor] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const waiting = useWaiting(shopId);
  const waitingKey = waiting.waits.map((w) => `${w.id}:${w.has_interest}:${w.state}`).join("|");
  useEffect(() => {
    setAvailabilityVersion((v) => v + 1);
  }, [waitingKey]);
  useEffect(() => {
    if (!demoChrome?.openProfileRequest) return;
    setTab("perfil");
    demoChrome.clearOpenProfileRequest();
  }, [demoChrome, demoChrome?.openProfileRequest]);
  useEffect(() => {
    const changed = () => setAvailabilityVersion((v) => v + 1);
    const timer = window.setInterval(() => {
      if (!document.hidden) changed();
    }, 10000);
    window.addEventListener("waiting-changed", changed);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("waiting-changed", changed);
    };
  }, []);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinShopName, setJoinShopName] = useState("");
  const [joinShopRef, setJoinShopRef] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  // Link de profissional que mudou para uma loja em que o cliente ainda não entrou:
  // o profissional do link não está neste catálogo, então a reserva segue o fluxo normal.
  const [directLinkBroken, setDirectLinkBroken] = useState(false);
  const directLinkActive = Boolean(directBarberSlug) && !directLinkBroken;
  // Valor inicial provisório: o efeito abaixo realinha ao fuso da barbearia
  // assim que ela é carregada.
  const [selectedDay, setSelectedDay] = useState(() =>
    shopDateKey(demo?.now ?? new Date(), DEFAULT_SHOP_TIMEZONE),
  );
  // Carrossel de datas: mantém o dia selecionado visível ao navegar pelas setas.
  const dayCarouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const carousel = dayCarouselRef.current;
    if (!carousel) return;
    const selected = carousel.querySelector<HTMLElement>('button[aria-pressed="true"]');
    selected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedDay]);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  // Cada loja é um ambiente separado: só as reservas da loja aberta aparecem aqui
  // (fuso, catálogo e remarcação são desta loja).
  const shopAppointments = useMemo(
    () => (shopId ? appointments.filter((row) => row.barbershop_id === shopId) : appointments),
    [appointments, shopId],
  );
  const [reservationFilter, setReservationFilter] = useState<ReservationFilter>("upcoming");
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsRefreshing, setAppointmentsRefreshing] = useState(false);
  const loadedAppointmentsUser = useRef<string | null>(null);
  const [appointmentsLoadedFor, setAppointmentsLoadedFor] = useState<string | null>(null);
  const handledInitialSchedule = useRef<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [appointmentsNotice, setAppointmentsNotice] = useState<string | null>(null);
  const [appointmentVersion, setAppointmentVersion] = useState(0);
  const [appointmentBusy, setAppointmentBusy] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CustomerAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [stopSeriesTarget, setStopSeriesTarget] = useState<string | null>(null);
  const [cancellationDetails, setCancellationDetails] = useState<
    Record<string, { reason: CancellationReason | null; source: "customer" | "shop" }>
  >({});

  useEffect(() => {
    if (demo) {
      setCancellationDetails(demo.cancellationReasons as typeof cancellationDetails);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    void supabase.rpc("get_appointment_cancellations", { p_shop_id: null }).then(({ data }) => {
      if (cancelled || !Array.isArray(data)) return;
      const rows = data as {
        appointment_id: string;
        reason: CancellationReason | null;
        source: "customer" | "shop";
      }[];
      setCancellationDetails(
        Object.fromEntries(
          rows.map((row) => [row.appointment_id, { reason: row.reason, source: row.source }]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [demo, userId, appointmentVersion]);

  const filteredMatches = (demo ? matches : []).filter((m) =>
    sportFilter === "all" ? true : sportFilter === "nba" ? m.league === "NBA" : m.league !== "NBA",
  );

  const selectedService = services[serviceIdx] ?? null;
  useEffect(() => {
    if (tab === "esportes" && !shopSettings.sports_enabled) setTab("dashboard");
  }, [tab, shopSettings.sports_enabled]);
  useEffect(() => {
    if (demo || !shopId) return;
    let cancelled = false;
    void supabase
      .from("barbershop_settings")
      .select("sports_enabled")
      .eq("barbershop_id", shopId)
      .single()
      .then(({ data, error }) => {
        if (!cancelled && !error && data)
          setShopSettings((current) => ({ ...current, sports_enabled: data.sports_enabled }));
      });
    return () => {
      cancelled = true;
    };
  }, [demo, shopId, availabilityVersion]);
  const pickedStaff = anyAvailable ? null : (staff[staffIdx] ?? null);
  const pickedStaffTerms =
    pickedStaff && selectedService ? termsFor(serviceTerms, pickedStaff.id, selectedService) : null;
  const selectedStaff = pickedStaff && (!selectedService || pickedStaffTerms) ? pickedStaff : null;
  const staffNotForService = Boolean(pickedStaff && selectedService && !pickedStaffTerms);
  // Serviço com a duração e o preço do profissional escolhido.
  const bookingService =
    selectedService && pickedStaffTerms
      ? { ...selectedService, ...pickedStaffTerms }
      : selectedService;
  const serviceLabel = (service: Tables<"services">) => {
    const shown = (pickedStaff && termsFor(serviceTerms, pickedStaff.id, service)) || service;
    return `${shown.duration_minutes} min · ${formatMoney(shown.price_cents)}`;
  };
  const staffChoices = staff
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !selectedService || termsFor(serviceTerms, m.id, selectedService));
  const selectedServiceId = selectedService?.id;
  const selectedServiceDuration = bookingService?.duration_minutes;
  const selectedStaffId = anyAvailable ? null : selectedStaff?.id;
  const selectionKey = `${shopId}:${selectedServiceId}:${selectedStaffId ?? "any"}:${selectedDay}:${anyAvailable ? "1" : "0"}`;
  // Chaves de data no fuso da loja: evitam qualquer conversão pelo fuso do aparelho.
  const bookingDayKeys = buildBookingDateKeys(
    demo?.now ?? new Date(),
    shopSettings.booking_horizon_days,
    shopTimeZone,
  );
  /**
   * Alinha o dia selecionado ao fuso da barbearia assim que ela é carregada.
   * O estado inicial usa o fuso do aparelho porque a loja ainda não é conhecida;
   * sem este acerto um cliente em outro fuso cairia no dia errado.
   */
  const alignedShop = useRef<string | null>(null);
  useEffect(() => {
    const identity = demo ? "demo" : shopId ? `${shopId}:${shopTimeZone}` : null;
    if (!identity || alignedShop.current === identity) return;
    alignedShop.current = identity;
    setSelectedDay(shopDateKey(demo?.now ?? new Date(), shopTimeZone));
  }, [demo, shopId, shopTimeZone]);
  // Virada do dia com o app aberto: o dia escolhido não pode ficar no passado.
  const firstBookingDay = bookingDayKeys[0];
  useEffect(() => {
    if (firstBookingDay && selectedDay < firstBookingDay) setSelectedDay(firstBookingDay);
  }, [firstBookingDay, selectedDay]);
  useEffect(() => {
    if (anyAvailable || !selectedService || staffPickedByUser.current) return;
    const current = staff[staffIdx];
    if (current && termsFor(serviceTerms, current.id, selectedService)) return;
    const next = staff.findIndex((m) => termsFor(serviceTerms, m.id, selectedService));
    if (next >= 0) setStaffIdx(next);
  }, [anyAvailable, selectedService, staff, staffIdx, serviceTerms]);
  const availableSlots =
    slotsFor === selectionKey
      ? slots.filter((slot) => slot.getTime() > (demo?.now.getTime() ?? Date.now()))
      : [];
  const selectedSlot = availableSlots.find((slot) => slot.toISOString() === selectedSlotAt) ?? null;

  useAvailabilitySignal(demo ? null : shopId, () => {
    setAvailabilityVersion((v) => v + 1);
    setAppointmentVersion((v) => v + 1);
  });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setAvailabilityVersion((v) => v + 1);
        setAppointmentVersion((v) => v + 1);
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (demo) {
      setPoints(demo.points);
      setLifetimePoints(demoLifetimePoints(demo));
      return;
    }
    if (!userId || !shopId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("loyalty_accounts")
        .select("points, lifetime_points")
        .eq("user_id", userId)
        .eq("barbershop_id", shopId)
        .maybeSingle();
      if (cancelled || error) return;
      setPoints(data?.points ?? 0);
      setLifetimePoints(data?.lifetime_points ?? data?.points ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, userId, shopId, tab, availabilityVersion, pointsVersion]);

  useEffect(() => {
    if (demo) {
      setLoyaltyProgram({
        ...FALLBACK_PROGRAM,
        enabled: demo.settings.loyalty_enabled !== false,
        rewards: DEMO_REWARDS,
      });
      return;
    }
    if (!shopId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_shop_loyalty_program", {
        p_shop_id: shopId,
      });
      // Sem resposta, mantém a regra padrão visível em vez de esconder os pontos do cliente.
      if (!cancelled && !error) setLoyaltyProgram(parseLoyaltyProgram(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, shopId, tab, pointsVersion]);

  useEffect(() => {
    if (demo) {
      const demoAppointmentsKey = `demo:${demo.shop.id}:${DEMO_CUSTOMER_ID}`;
      setAppointments(
        demo.appointments
          .filter((row) => row.customer_id === DEMO_CUSTOMER_ID)
          .map((row) => ({
            ...row,
            service: demo.services.find((service) => service.id === row.service_id) ?? null,
            staff: demo.staff.find((member) => member.id === row.staff_id) ?? null,
            barbershop: { name: demo.shop.name },
          }))
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      );
      setAppointmentsLoading(false);
      setAppointmentsRefreshing(false);
      setAppointmentsLoadedFor(demoAppointmentsKey);
      loadedAppointmentsUser.current = null;
      return;
    }
    if (!userId) return;
    let cancelled = false;
    const initialLoad = loadedAppointmentsUser.current !== userId;
    if (initialLoad) {
      setAppointments([]);
      setAppointmentsLoadedFor(null);
    }
    setAppointmentsLoading(initialLoad);
    setAppointmentsRefreshing(true);
    setAppointmentsError(null);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select(
            "*, service:services(name, duration_minutes, icon), staff:staff(display_name), barbershop:barbershops(name)",
          )
          .eq("customer_id", userId)
          .order("starts_at", { ascending: false });
        if (cancelled) return;
        if (error) setAppointmentsError(tNow("cust.appointmentsLoadError"));
        else {
          setAppointments(data ?? []);
          loadedAppointmentsUser.current = userId;
        }
      } catch {
        if (!cancelled) setAppointmentsError(tNow("cust.appointmentsRefreshError"));
      } finally {
        if (!cancelled) {
          setAppointmentsLoading(false);
          setAppointmentsRefreshing(false);
          setAppointmentsLoadedFor(userId);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, userId, appointmentVersion]);

  useEffect(() => {
    const demo = demoShopId ? demoRef.current : null;
    if (demo) {
      setShopId(demo.shop.id);
      setCustomerName(demo.customerName);
      setShopName(demo.shop.name);
      setShopSettings(demo.settings);
      setUserId(DEMO_CUSTOMER_ID);
      setServices(demo.services.filter((row) => row.active));
      setServiceTerms(null);
      staffPickedByUser.current = false;
      const demoStaff = demo.staff.filter((row) => row.active);
      setStaff(demoStaff);
      setCatalogLoading(false);
      setCatalogError(null);
      setJoinOpen(false);
      setServiceIdx(0);
      setStaffIdx(
        directBarberSlug
          ? Math.max(
              0,
              demoStaff.findIndex((row) => row.booking_slug === directBarberSlug),
            )
          : 0,
      );
      return;
    }
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      setDirectLinkBroken(false);
      try {
        const profile = await getSessionProfile();
        if (!cancelled) {
          setCustomerName(profile?.profile?.full_name?.trim() || "");
        }
        if (!profile?.user.id) {
          if (!cancelled) {
            setServices([]);
            setStaff([]);
            setCatalogError(tNow("cust.sessionInvalid"));
          }
          return;
        }

        const customerMemberships = profile.memberships.filter(
          (m) => m.role === "customer" && m.barbershop_id,
        );
        let catalogShopId: string | null = null;
        let directStaffId: string | null = null;
        let pendingJoinRef: string | null = null;
        let pendingJoinName = "";

        // Contexto do link / Host tem prioridade sobre a “primeira” membership.
        if (directShopSlug) {
          const preview = await supabase.rpc("get_shop_join_preview", {
            p_shop_ref: directShopSlug,
          });
          if (preview.error) throw preview.error;
          const info = preview.data as {
            found?: boolean;
            shop_id?: string;
            shop_name?: string;
            shop_slug?: string;
            is_member?: boolean;
          } | null;

          if (info?.found && info.shop_id) {
            if (info.is_member) {
              catalogShopId = info.shop_id;
              if (!cancelled && info.shop_name) setShopName(info.shop_name);
            } else {
              pendingJoinRef = info.shop_slug || directShopSlug;
              pendingJoinName = info.shop_name || "";
            }
          } else if (directBarberSlug) {
            throw new Error(tNow("cust.shopLinkInvalid"));
          }
        }

        if (!catalogShopId && !pendingJoinRef) {
          catalogShopId = customerMemberships[0]?.barbershop_id ?? null;
          if (!cancelled && customerMemberships[0]?.barbershop?.name) {
            setShopName(customerMemberships[0].barbershop.name);
          }
        }

        if (pendingJoinRef) {
          if (!cancelled) {
            setJoinShopRef(pendingJoinRef);
            setJoinShopName(pendingJoinName);
            setJoinOpen(true);
            // Enquanto não confirma, mostra loja já vinculada (se houver) ou mensagem.
            if (!catalogShopId && customerMemberships[0]?.barbershop_id) {
              catalogShopId = customerMemberships[0].barbershop_id;
              if (customerMemberships[0].barbershop?.name) {
                setShopName(customerMemberships[0].barbershop.name);
              }
            }
          }
          // Se veio explicitamente com join=1 e não tem outra loja, não carrega catálogo errado.
          if (!catalogShopId) {
            if (!cancelled) {
              setUserId(profile.user.id);
              setShopId(null);
              setServices([]);
              setStaff([]);
              setCatalogError(null);
            }
            return;
          }
        } else if (!cancelled) {
          setJoinOpen(false);
          setJoinShopRef(null);
        }

        if (!catalogShopId) {
          if (!cancelled) {
            setUserId(profile.user.id);
            setShopId(null);
            setServices([]);
            setStaff([]);
            setCatalogError(tNow("cust.noShopLinked"));
          }
          return;
        }

        if (directBarberSlug && directShopSlug && !pendingJoinRef) {
          const resolved = await supabase.rpc("resolve_direct_booking_staff", {
            p_shop_slug: directShopSlug,
            p_staff_slug: directBarberSlug,
          });
          if (resolved.error) throw resolved.error;
          const target = resolved.data as {
            shop_id?: string;
            staff_id?: string;
            shop_name?: string;
            shop_slug?: string;
            via_redirect?: boolean;
          };
          if (!target.staff_id || !target.shop_id) {
            throw new Error(tNow("cust.staffLinkUnavailable"));
          }
          const hasDestMembership = profile.memberships.some(
            (m) => m.barbershop_id === target.shop_id && m.role === "customer",
          );
          if (hasDestMembership || target.shop_id === catalogShopId) {
            catalogShopId = target.shop_id;
            directStaffId = target.staff_id;
            if (!cancelled && target.shop_name) setShopName(target.shop_name);
          } else if (target.via_redirect) {
            // Profissional mudou de loja e o cliente ainda não é dessa loja: oferece
            // entrar na loja de destino; até lá, o link não vale neste catálogo.
            directStaffId = null;
            if (!cancelled) {
              setDirectLinkBroken(true);
              setJoinShopRef(target.shop_slug || target.shop_id);
              setJoinShopName(target.shop_name || "");
              setJoinOpen(true);
            }
          } else {
            // Sem membership: força join no destino do link.
            if (!cancelled) {
              setJoinShopRef(directShopSlug);
              setJoinShopName(target.shop_name || "");
              setJoinOpen(true);
            }
          }
        }

        const [
          servicesResult,
          staffResult,
          loyaltyResult,
          settingsResult,
          shopResult,
          termsResult,
        ] = await Promise.all([
          supabase
            .from("services")
            .select("*")
            .eq("barbershop_id", catalogShopId)
            .eq("active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("staff")
            .select("*")
            .eq("barbershop_id", catalogShopId)
            .eq("active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("loyalty_accounts")
            .select("points, lifetime_points")
            .eq("user_id", profile.user.id)
            .eq("barbershop_id", catalogShopId)
            .maybeSingle(),
          supabase
            .from("barbershop_settings")
            .select(
              "display_name, logo_url, logo_background_color, font_family, custom_font_url, custom_font_name, custom_font_faces, font_scope, header_font_weight, header_font_style, corner_style, floating_chrome, primary_color, accent_color, tagline, booking_instructions, booking_horizon_days, survey_program_enabled, sports_enabled, staff_assignment_mode",
            )
            .eq("barbershop_id", catalogShopId)
            .single(),
          supabase.from("barbershops").select("timezone").eq("id", catalogShopId).maybeSingle(),
          supabase.rpc("get_booking_terms", { p_shop_id: catalogShopId }),
        ]);
        if (servicesResult.error) throw servicesResult.error;
        if (staffResult.error) throw staffResult.error;
        // Pontos são secundários: se a carteira falhar, o catálogo ainda carrega.
        if (loyaltyResult.error) {
          console.warn("[catalog] loyalty_accounts", loyaltyResult.error.message);
        }
        let shopSettingsData = settingsResult.data;
        if (settingsResult.error) {
          // PGRST116 = 0 rows with .single(); loja sem settings não deve derrubar o catálogo.
          if (settingsResult.error.code === "PGRST116") {
            shopSettingsData = null;
          } else if (settingsResult.error.code !== "42703") {
            throw settingsResult.error;
          } else {
            const legacySettings = await supabase
              .from("barbershop_settings")
              .select(
                "display_name, logo_url, logo_background_color, font_family, custom_font_url, custom_font_name, custom_font_faces, font_scope, header_font_weight, header_font_style, corner_style, primary_color, accent_color, tagline, booking_instructions, booking_horizon_days, survey_program_enabled, sports_enabled",
              )
              .eq("barbershop_id", catalogShopId)
              .maybeSingle();
            if (legacySettings.error) throw legacySettings.error;
            shopSettingsData = legacySettings.data
              ? {
                  ...legacySettings.data,
                  floating_chrome: false,
                  staff_assignment_mode: "client_pick",
                }
              : null;
          }
        }
        if (shopResult.error) throw shopResult.error;
        if (termsResult.error)
          console.warn("[catalog] get_booking_terms", termsResult.error.message);
        const terms: ServiceTerms[] | null = termsResult.error ? null : (termsResult.data ?? []);
        let availableServices = servicesResult.data ?? [];
        if (directStaffId) {
          const professionalCatalog = await supabase
            .from("staff_services")
            .select("*")
            .eq("staff_id", directStaffId)
            .eq("active", true);
          if (professionalCatalog.error) throw professionalCatalog.error;
          const overrides = new Map(
            (professionalCatalog.data ?? []).map((row) => [row.service_id, row]),
          );
          availableServices = availableServices
            .filter((service) =>
              terms ? termsFor(terms, directStaffId!, service) : overrides.has(service.id),
            )
            .map((service) => {
              const own = overrides.get(service.id);
              return {
                ...service,
                name: own?.display_name || service.name,
                duration_minutes: own?.duration_minutes ?? service.duration_minutes,
                price_cents: own?.price_cents ?? service.price_cents,
                icon: own?.icon || service.icon,
              };
            });
        }
        if (!cancelled) {
          // Fuso junto com a loja: o alinhamento do dia não pode rodar com o fuso padrão.
          setShopTimeZone(validTimeZone(shopResult.data?.timezone));
          setShopId(catalogShopId);
          setUserId(profile.user.id);
          setServices(availableServices);
          setServiceTerms(terms);
          staffPickedByUser.current = false;
          const availableStaff = staffResult.data ?? [];
          setStaff(availableStaff);
          setPoints(loyaltyResult.error ? 0 : (loyaltyResult.data?.points ?? 0));
          setLifetimePoints(
            loyaltyResult.error
              ? 0
              : (loyaltyResult.data?.lifetime_points ?? loyaltyResult.data?.points ?? 0),
          );
          if (shopSettingsData) setShopSettings(shopSettingsData);
          const modeRaw = (shopSettingsData as { staff_assignment_mode?: string } | null)
            ?.staff_assignment_mode;
          const mode =
            modeRaw === "favorite_then_pick" || modeRaw === "random_available"
              ? modeRaw
              : "client_pick";
          setStaffAssignmentMode(mode);

          let favoriteId: string | null = null;
          if (!demo && profile.user.id) {
            const pref = await (
              supabase as unknown as {
                from: (t: string) => {
                  select: (c: string) => {
                    eq: (
                      a: string,
                      b: string,
                    ) => {
                      eq: (
                        a: string,
                        b: string,
                      ) => {
                        maybeSingle: () => Promise<{
                          data: { favorite_staff_id: string | null } | null;
                        }>;
                      };
                    };
                  };
                };
              }
            )
              .from("customer_shop_preferences")
              .select("favorite_staff_id")
              .eq("user_id", profile.user.id)
              .eq("barbershop_id", catalogShopId)
              .maybeSingle();
            // Uma recarga mais nova pode ter começado durante a consulta.
            if (cancelled) return;
            favoriteId = pref.data?.favorite_staff_id ?? null;
            setFavoriteStaffId(favoriteId);
          }

          setServiceIdx(0);
          if (directStaffId) {
            setAnyAvailable(false);
            setStaffIdx(
              Math.max(
                0,
                availableStaff.findIndex((row) => row.id === directStaffId),
              ),
            );
          } else if (mode === "random_available") {
            setAnyAvailable(true);
            setStaffIdx(0);
          } else if (mode === "favorite_then_pick" && favoriteId) {
            const favIdx = availableStaff.findIndex((row) => row.id === favoriteId);
            setAnyAvailable(false);
            setStaffIdx(favIdx >= 0 ? favIdx : 0);
          } else {
            setAnyAvailable(false);
            setStaffIdx(0);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogError(friendlyAuthError(err, tNow("cust.catalogLoadError")));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoShopId, directBarberSlug, directShopSlug, promptJoin, catalogRevision]);

  async function confirmShopJoin() {
    if (!joinShopRef) return;
    setJoinBusy(true);
    try {
      const { error } = await supabase.rpc("join_shop_as_customer", {
        p_shop_ref: joinShopRef,
      });
      if (error) throw error;
      setJoinOpen(false);
      setJoinShopRef(null);
      // Limpa ?join= da URL sem perder shop/barber.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("join");
        if (joinShopRef && !url.searchParams.get("shop")) {
          url.searchParams.set("shop", joinShopRef);
        }
        window.history.replaceState({}, "", url.pathname + url.search);
      } catch {
        /* ignore */
      }
      setCatalogRevision((v) => v + 1);
    } catch (err) {
      setCatalogError(friendlyAuthError(err, t("cust.joinError")));
      setJoinOpen(false);
    } finally {
      setJoinBusy(false);
    }
  }

  function dismissShopJoin() {
    setJoinOpen(false);
    setJoinShopRef(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.pathname + url.search);
    } catch {
      /* ignore */
    }
    // Se não havia outra membership, o catálogo já mostrou o aviso.
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSlotsError(null);
      if (!selectedServiceId || !selectedServiceDuration || (!selectedStaffId && !anyAvailable)) {
        setSlotsLoading(false);
        return;
      }
      setSlotsLoading(true);
      try {
        if (demo) {
          const occupied = demo.appointments.filter(
            (row) =>
              row.staff_id === selectedStaffId &&
              row.status !== "cancelled" &&
              row.status !== "reschedule_requested",
          );
          const blocks = demo.availabilityBlocks.filter(
            (row) => row.staff_id === null || row.staff_id === selectedStaffId,
          );
          // O dia da semana vem da data escolhida, não do fuso do aparelho.
          const weekday = weekdayForDateKey(selectedDay);
          const hours = demo.businessHours.find((row) => row.weekday === weekday) ?? null;
          setSlots(
            buildSlotsForWindow(
              selectedDay,
              selectedServiceDuration,
              [
                ...occupied,
                ...demo.waits.filter(
                  (w) => blocksSlot(w, demo.now) && w.staff_id === selectedStaffId,
                ),
              ],
              hours,
              demo.now,
              shopTimeZone,
              { ...slotRuleFromSettings(demo.settings), blocks },
            ),
          );
          setSlotsFor(selectionKey);
          return;
        }
        // Fonte única: a mesma função do banco que a página pública e a escolha de profissional usam.
        const { data, error } = await supabase.rpc("get_available_slots", {
          p_shop_id: shopId!,
          p_service_id: selectedServiceId,
          p_date: selectedDay,
          p_staff_id: anyAvailable ? null : selectedStaffId!,
        });
        if (error) throw error;
        if (!cancelled) {
          const union = new Map<string, Date>();
          for (const row of data ?? []) {
            const slot = new Date(row.starts_at);
            union.set(slot.toISOString(), slot);
          }
          setSlots([...union.values()].sort((a, b) => a.getTime() - b.getTime()));
          setSlotsFor(selectionKey);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "";
          if (/not authorized|42501|permission|forbidden|403/i.test(message)) {
            setSlotsError(tNow("booking.errorShopUnavailable"));
          } else {
            setSlotsError(tNow("booking.errorTimes"));
          }
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedServiceDuration,
    selectedServiceId,
    selectedStaffId,
    anyAvailable,
    staff,
    selectionKey,
    availabilityVersion,
    demo,
    selectedDay,
    shopId,
    shopTimeZone,
  ]);

  function recordUsage(event: string) {
    if (demo || !shopId) return;
    void supabase.rpc("record_customer_usage", {
      p_id: crypto.randomUUID(),
      p_shop_id: shopId,
      p_event: event,
    });
  }

  const confirmBooking = async () => {
    if (bookingLock.current || !shopId || !userId || !bookingService || !selectedSlot) return;
    if (!anyAvailable && !selectedStaff) return;
    if (selectedSlot.getTime() <= (demo?.now.getTime() ?? Date.now())) {
      setBookingError(t("booking.errorPast"));
      setAvailabilityVersion((v) => v + 1);
      return;
    }
    recordUsage("booking_started");
    bookingLock.current = true;
    setBookingBusy(true);
    setBookingError(null);
    try {
      const endsAt = new Date(selectedSlot.getTime() + bookingService.duration_minutes * 60_000);
      let staffId = selectedStaff?.id ?? null;
      let staffName = selectedStaff?.display_name ?? t("booking.staffFallback");
      if (anyAvailable && !demo) {
        const prefer = staffAssignmentMode === "favorite_then_pick" ? favoriteStaffId : null;
        const { data: picked, error: pickError } = await supabase.rpc("pick_available_staff", {
          p_shop_id: shopId,
          p_service_id: bookingService.id,
          p_starts_at: selectedSlot.toISOString(),
          p_ends_at: endsAt.toISOString(),
          p_prefer_staff_id: prefer,
        });
        if (pickError) throw pickError;
        if (!picked) {
          throw new Error(t("cust.noStaffAtTime"));
        }
        staffId = picked as string;
        staffName =
          staff.find((row) => row.id === staffId)?.display_name ?? t("booking.anyStaffFallback");
      }
      if (!staffId) throw new Error(t("cust.pickStaff"));

      const booking = {
        barbershop_id: shopId,
        customer_id: userId,
        service_id: bookingService.id,
        staff_id: staffId,
        starts_at: selectedSlot.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed" as const,
        booked_price_cents: bookingService.price_cents,
      };
      let repeatApplied = false;
      if (demo) {
        if (rescheduleId) {
          demo.dispatch({
            type: "reschedule",
            id: rescheduleId,
            starts_at: booking.starts_at,
            ends_at: booking.ends_at,
            service_id: booking.service_id,
            staff_id: booking.staff_id,
          });
        } else {
          // Demonstração: mantém o aviso de recorrência como antes.
          repeatApplied = repeatEnabled && !directLinkActive;
          demo.dispatch({
            type: "book",
            appointment: {
              ...booking,
              id: crypto.randomUUID(),
              public_token: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
              series_id: null,
              created_at: demo.now.toISOString(),
              updated_at: demo.now.toISOString(),
            },
          });
        }
      } else if (rescheduleId) {
        const { error } = await supabase.rpc("reschedule_own_appointment", {
          p_appointment_id: rescheduleId,
          p_service_id: booking.service_id,
          p_staff_id: booking.staff_id,
          p_starts_at: booking.starts_at,
          p_ends_at: booking.ends_at,
        });
        if (error) throw error;
      } else if (directLinkActive && directBarberSlug && directShopSlug) {
        const { error } = await supabase.rpc("create_direct_appointment", {
          p_shop_slug: directShopSlug,
          p_staff_slug: directBarberSlug,
          p_service_id: booking.service_id,
          p_starts_at: booking.starts_at,
          p_ends_at: booking.ends_at,
        });
        if (error) throw error;
      } else if (repeatEnabled) {
        repeatApplied = true;
        const { error } = await supabase.rpc("create_booking_series", {
          p_shop_id: shopId,
          p_service_id: booking.service_id,
          p_staff_id: booking.staff_id,
          p_starts_at: booking.starts_at,
          p_kind: repeatKind,
          p_interval_days: repeatKind === "interval_days" ? repeatInterval : null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert(booking);
        if (error) throw error;
      }
      recordUsage("booking_succeeded");
      const dateLabel = formatShopDate(selectedSlot, shopTimeZone, {
        day: "2-digit",
        month: "2-digit",
      });
      // Só anuncia a recorrência quando uma série foi de fato criada.
      const repeatNote = repeatApplied
        ? repeatKind === "weekday"
          ? ` ${t("booking.repeatWeekdayNote")}`
          : ` ${t("booking.repeatIntervalNote", { days: repeatInterval })}`
        : "";
      const summary = `${rescheduleId ? t("booking.rescheduledPrefix") : ""}${t(
        "booking.describe",
        {
          service: bookingService.name,
          staff: staffName,
          date: dateLabel,
          time: formatSlotLabel(selectedSlot, shopTimeZone),
        },
      )}.${repeatNote}`;
      setBookingSummary(summary);
      setRepeatEnabled(false);
      setRescheduleId(null);
      setSlotsFor("");
      setSelectedSlotAt(null);
      setAvailabilityVersion((v) => v + 1);
      setAppointmentVersion((v) => v + 1);
      setNotifications((n) => [
        {
          id: Date.now(),
          title: rescheduleId ? t("booking.rescheduled") : t("booking.reserved"),
          text: summary,
          time: (demo?.now ?? new Date()).toLocaleTimeString(intlLocale, {
            hour: "2-digit",
            minute: "2-digit",
          }),
          read: false,
        },
        ...n,
      ]);
    } catch (err) {
      recordUsage("booking_failed");
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
      setBookingError(
        code === "23P01"
          ? t("booking.errorTaken")
          : code === "22023"
            ? /passou/i.test(message)
              ? t("booking.errorPast")
              : t("booking.errorUnavailable")
            : t("booking.errorGeneric"),
      );
      setAvailabilityVersion((v) => v + 1);
    } finally {
      bookingLock.current = false;
      setBookingBusy(false);
    }
  };

  const describeAppointment = (row: CustomerAppointment) =>
    t("booking.describe", {
      service: row.service?.name ?? t("booking.serviceFallback"),
      staff: row.staff?.display_name ?? t("booking.staffFallback"),
      date: formatShopDate(row.starts_at, shopTimeZone, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }),
      time: formatSlotLabel(new Date(row.starts_at), shopTimeZone),
    });

  const cancelAppointment = async () => {
    const row = cancelTarget;
    if (!row) return;
    setAppointmentBusy(row.id);
    setAppointmentsError(null);
    setAppointmentsNotice(null);
    try {
      if (demo)
        demo.dispatch({
          type: "cancel",
          id: row.id,
          reason: cancelReason || null,
          source: "customer",
        });
      else {
        const { error } = await supabase.rpc("cancel_appointment", {
          p_id: row.id,
          p_reason: cancelReason || null,
        });
        if (error) throw error;
      }
      setAppointmentVersion((v) => v + 1);
      setAvailabilityVersion((v) => v + 1);
      setCancelTarget(null);
      setCancelReason("");
      setAppointmentsNotice(t("bookings.cancelledNotice", { summary: describeAppointment(row) }));
    } catch {
      setAppointmentsError(t("bookings.cancelError"));
    } finally {
      setAppointmentBusy(null);
    }
  };

  const stopSeries = async (seriesId: string) => {
    setAppointmentBusy(seriesId);
    setAppointmentsError(null);
    setAppointmentsNotice(null);
    try {
      if (demo) {
        setAppointmentsError(t("bookings.repeatDemo"));
        return;
      }
      const { error } = await supabase.rpc("stop_booking_series", { p_series_id: seriesId });
      if (error) throw error;
      setAppointmentVersion((v) => v + 1);
      setAvailabilityVersion((v) => v + 1);
      setStopSeriesTarget(null);
      setAppointmentsNotice(t("bookings.repeatStopped"));
    } catch {
      setAppointmentsError(t("bookings.repeatStopError"));
    } finally {
      setAppointmentBusy(null);
    }
  };

  useEffect(() => {
    if (!focusToken || shopAppointments.length === 0) return;
    const match = shopAppointments.find((row) => row.public_token === focusToken);
    if (match) {
      setTab("reservas");
      setReservationFilter("upcoming");
    }
  }, [focusToken, shopAppointments]);

  const beginReschedule = (row: CustomerAppointment) => {
    const serviceIndex = services.findIndex((item) => item.id === row.service_id);
    const staffIndex = staff.findIndex((item) => item.id === row.staff_id);
    // Sem o serviço ou o profissional originais no catálogo, remarcar trocaria a
    // reserva por outra seleção sem aviso: avisa e não entra no modo remarcação.
    if (serviceIndex < 0 || staffIndex < 0) {
      // Aviso (não erro): um erro esconderia a lista de reservas.
      setAppointmentsError(null);
      setAppointmentsNotice(t("fix.cliente-app.rescheduleUnavailable"));
      return;
    }
    setServiceIdx(serviceIndex);
    staffPickedByUser.current = true;
    setAnyAvailable(false);
    setStaffIdx(staffIndex);
    setRepeatEnabled(false);
    const originalDay = shopDateKey(new Date(row.starts_at), shopTimeZone);
    setSelectedDay(bookingDayKeys.includes(originalDay) ? originalDay : bookingDayKeys[0]);
    setRescheduleId(row.id);
    setBookingError(null);
    setBookingSummary(null);
    setSelectedSlotAt(null);
    setTab("agenda");
  };
  const [notifications, setNotifications] = useState<
    { id: number; title: string; text: string; time: string; read: boolean }[]
  >([]);
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  useEffect(() => {
    if (tab !== "notifications") return;
    setNotifications((current) =>
      current.some((n) => !n.read) ? current.map((n) => ({ ...n, read: true })) : current,
    );
  }, [tab, notifications.length]);

  const tierPosition = tierFor(lifetimePoints, loyaltyProgram.tiers);
  const tierBenefit = (index: number) => {
    const tierRow = loyaltyProgram.tiers[index];
    if (tierRow?.benefit) return tierRow.benefit;
    if (loyaltyProgram.mode !== "default") return "";
    return t(`tier.${tierStyleKey(index, loyaltyProgram.tiers.length)}.benefit` as MessageKey);
  };
  const tierStyleKeyNow = tierStyleKey(tierPosition.index, loyaltyProgram.tiers.length);
  const tier = {
    ...TIER_STYLES[tierStyleKeyNow],
    key: tierStyleKeyNow,
    name: tierPosition.tier.name,
    benefit: tierBenefit(tierPosition.index),
  };
  const loyaltyOn = loyaltyProgram.enabled;

  // O aviso de remarcação impossível não é uma confirmação: sem o check verde.
  const rescheduleBlockedNotice = appointmentsNotice === t("fix.cliente-app.rescheduleUnavailable");
  const reservationNow = demo?.now.getTime() ?? Date.now();
  const visibleReservations = filterReservations(
    shopAppointments,
    reservationFilter,
    reservationNow,
  );
  const nextAppointment = shopAppointments
    .filter(
      (row) =>
        (row.status === "pending" || row.status === "confirmed") &&
        new Date(row.starts_at).getTime() > (demo?.now.getTime() ?? Date.now()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const appointmentOwnerKey = demo ? `demo:${demo.shop.id}:${DEMO_CUSTOMER_ID}` : userId;
  const nextLevel: NextLevelSummary | null = tierPosition.next
    ? {
        name: tierPosition.next.name,
        pointsRemaining: tierPosition.pointsToNext,
        progress: tierPosition.progress,
        benefit: tierBenefit(tierPosition.index + 1),
      }
    : null;

  useEffect(() => {
    if (
      !appointmentOwnerKey ||
      appointmentsLoadedFor !== appointmentOwnerKey ||
      appointmentsLoading ||
      appointmentsError ||
      handledInitialSchedule.current === appointmentOwnerKey
    )
      return;

    handledInitialSchedule.current = appointmentOwnerKey;
    if (!nextAppointment && tab === "dashboard") setTab("agenda");
  }, [
    appointmentOwnerKey,
    appointmentsError,
    appointmentsLoadedFor,
    appointmentsLoading,
    nextAppointment,
    tab,
  ]);

  type NavItemProps = {
    id: string;
    icon: LucideIcon;
    label: string;
  };

  const NavItem = ({ id, icon: Icon, label }: NavItemProps) => {
    const accountTabs =
      id === "perfil" && (tab === "perfil" || tab === "pontos" || tab === "notifications");
    const pressed = tab === id || accountTabs;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        aria-pressed={pressed}
        aria-current={pressed ? "page" : undefined}
        className={`relative z-10 flex min-w-0 flex-col items-center justify-center p-2.5 ${
          pressed ? "app-nav-current" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon
          className={`mb-1.5 h-5 w-5 transition-transform duration-300 ease-out ${pressed ? "scale-110" : ""}`}
        />
        <span className="text-xs font-semibold">{label}</span>
      </button>
    );
  };

  const navItems: NavItemProps[] = [
    { id: "dashboard", icon: Compass, label: t("nav.home") },
    { id: "agenda", icon: Calendar, label: t("nav.book") },
    { id: "reservas", icon: Clock3, label: t("nav.bookings") },
    ...(shopSettings.sports_enabled
      ? [{ id: "esportes" as const, icon: Feather, label: t("nav.sports") }]
      : []),
    { id: "perfil", icon: User, label: t("nav.account") },
  ];
  const activeNavIndex = navItems.findIndex((item) => {
    if (item.id === "perfil") {
      return tab === "perfil" || tab === "pontos" || tab === "notifications";
    }
    return item.id === tab;
  });
  const accountWhere =
    tab === "perfil"
      ? t("nav.profile")
      : tab === "pontos"
        ? t("nav.points")
        : tab === "notifications"
          ? t("nav.notices")
          : null;

  return (
    <div
      className={`arena-workspace bg-background text-foreground font-sans selection:bg-primary/20 transition-colors duration-300 ${brandFontScopeClass(shopSettings.font_scope)} ${brandCornerClass(shopSettings.corner_style)} ${shopSettings.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={
        brandVariables(
          shopSettings.primary_color,
          shopSettings.accent_color,
          shopSettings.font_family,
          shopSettings.custom_font_url,
          shopSettings.header_font_weight,
          shopSettings.header_font_style,
          shopSettings.corner_style,
        ) as React.CSSProperties
      }
    >
      <BrandFontFace url={shopSettings.custom_font_url} faces={shopSettings.custom_font_faces} />
      <CancellationDialog
        open={!!cancelTarget}
        busy={appointmentBusy !== null}
        reason={cancelReason}
        summary={cancelTarget ? describeAppointment(cancelTarget) : null}
        onReason={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
        }}
        onConfirm={() => void cancelAppointment()}
      />
      <AlertDialog
        open={!!stopSeriesTarget}
        onOpenChange={(open) => {
          if (!open && appointmentBusy === null) setStopSeriesTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bookings.stopRepeatTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bookings.stopRepeatBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button
              type="button"
              disabled={appointmentBusy !== null}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold"
              onClick={() => setStopSeriesTarget(null)}
            >
              {t("bookings.keepRepeat")}
            </button>
            <button
              type="button"
              disabled={appointmentBusy !== null || !stopSeriesTarget}
              className="action-button action-danger min-h-11"
              onClick={() => {
                if (stopSeriesTarget) void stopSeries(stopSeriesTarget);
              }}
            >
              {appointmentBusy ? t("bookings.cancelling") : t("bookings.stopRepeatConfirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ShopJoinDialog
        open={joinOpen}
        shopName={joinShopName || t("cust.thisShop")}
        busy={joinBusy}
        onConfirm={() => void confirmShopJoin()}
        onDismiss={dismissShopJoin}
      />
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          {/*
            BACKUP — os gradientes prata e holográfico usavam classes dark:stop para
            trocar suas cores no tema escuro. As classes foram removidas para que os
            gradientes dos níveis sejam idênticos nos dois modos.
          */}
          <linearGradient id="silver-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="30%" stopColor="#404040" />
            <stop offset="60%" stopColor="#808080" />
            <stop offset="100%" stopColor="#404040" />
          </linearGradient>
          <linearGradient id="bronze-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFCBA4" />
            <stop offset="40%" stopColor="#CD7F32" />
            <stop offset="70%" stopColor="#8B4513" />
            <stop offset="100%" stopColor="#FFCBA4" />
          </linearGradient>
          <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE29F" />
            <stop offset="35%" stopColor="#D4AF37" />
            <stop offset="75%" stopColor="#8A6623" />
            <stop offset="100%" stopColor="#FFE29F" />
          </linearGradient>
          <linearGradient id="hologram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#050505" />
            <stop offset="10%" stopColor="#0d0d0d" />
            <stop offset="30%" stopColor="#B3E5FC" />
            <stop offset="45%" stopColor="#4FC3F7" />
            <stop offset="60%" stopColor="#F8BBD0" />
            <stop offset="75%" stopColor="#FFF9C4" />
            <stop offset="90%" stopColor="#4FC3F7" />
            <stop offset="100%" stopColor="#050505" />
          </linearGradient>
          <linearGradient id="loyalty-card-silver-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--loyalty-silver-1)" />
            <stop offset="48%" stopColor="var(--loyalty-silver-2)" />
            <stop offset="100%" stopColor="var(--loyalty-silver-3)" />
          </linearGradient>
          <linearGradient id="loyalty-card-bronze-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--loyalty-bronze-1)" />
            <stop offset="48%" stopColor="var(--loyalty-bronze-2)" />
            <stop offset="100%" stopColor="var(--loyalty-bronze-3)" />
          </linearGradient>
          <linearGradient id="loyalty-card-gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--loyalty-gold-1)" />
            <stop offset="48%" stopColor="var(--loyalty-gold-2)" />
            <stop offset="100%" stopColor="var(--loyalty-gold-3)" />
          </linearGradient>
          <linearGradient id="loyalty-card-hologram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--loyalty-hologram-1)" />
            <stop offset="30%" stopColor="var(--loyalty-hologram-2)" />
            <stop offset="65%" stopColor="var(--loyalty-hologram-3)" />
            <stop offset="100%" stopColor="var(--loyalty-hologram-4)" />
          </linearGradient>
        </defs>
      </svg>
      {/* Header */}
      <header className="brand-header sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/50 p-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center pl-[4.5rem]">
          {shopSettings.logo_url ? (
            <span
              className="brand-header-logo-wrap"
              style={
                shopSettings.logo_background_color
                  ? { backgroundColor: shopSettings.logo_background_color }
                  : undefined
              }
            >
              <img
                src={shopSettings.logo_url}
                alt={t("cust.logoAlt", {
                  name: shopSettings.display_name?.trim() || shopName || t("cust.shopFallback"),
                })}
                className="brand-header-logo"
              />
            </span>
          ) : (
            <span
              className="brand-header-logo-wrap brand-header-logo-fallback"
              style={
                shopSettings.logo_background_color
                  ? { backgroundColor: shopSettings.logo_background_color }
                  : undefined
              }
            >
              <Scissors className="size-6" />
            </span>
          )}
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="brand-header-title truncate text-sm font-bold tracking-tight text-foreground leading-tight">
              {shopSettings.display_name?.trim() || shopName || t("cust.shopFallback")}
            </h1>
            <p className="mt-1 truncate text-[11px] font-medium text-primary">
              {shopSettings.tagline}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setTab("notifications")}
            aria-label={
              unreadNotifications > 0
                ? t(unreadNotifications === 1 ? "nav.noticesUnreadOne" : "nav.noticesUnreadMany", {
                    count: unreadNotifications,
                  })
                : t("nav.notices")
            }
            aria-current={tab === "notifications" ? "page" : undefined}
            className={`app-icon-button relative ${tab === "notifications" ? "app-nav-current" : ""}`}
          >
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground"
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>
          {headerActions}
          {demoChrome ? (
            <>
              <DemoAccountMenu onViewProfile={() => setTab("perfil")} />
              <DemoRoleSelector />
            </>
          ) : (
            <button
              type="button"
              aria-label={t("nav.myAccount")}
              aria-current={tab === "perfil" || tab === "pontos" ? "page" : undefined}
              onClick={() => setTab("perfil")}
              className={`app-icon-button ${tab === "perfil" || tab === "pontos" ? "app-nav-current" : ""}`}
            >
              <User size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <main className="p-4 max-w-xl mx-auto">
        {accountWhere ? (
          <p className="mb-3 text-xs font-semibold text-muted-foreground" role="status">
            {t("nav.youAreIn")} <span className="text-foreground">{accountWhere}</span>
            {" · "}
            <button
              type="button"
              className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => setTab("dashboard")}
            >
              {t("nav.backHome")}
            </button>
          </p>
        ) : null}
        <div key={tab} className="mb-panel">
          {tab === "perfil" && <CustomerProfile onSaved={setCustomerName} />}
          {tab === "perfil" && <CustomerRhythm shopId={shopId} />}
          {tab === "pontos" &&
            (loyaltyOn ? (
              <PointsHistory
                userId={userId}
                shopId={shopId}
                points={points}
                currentLevel={tier.name}
                nextLevel={nextLevel}
                refreshKey={pointsVersion}
              >
                <CustomerRewards
                  userId={userId}
                  shopId={shopId}
                  program={loyaltyProgram}
                  points={points}
                  onChanged={() => setPointsVersion((value) => value + 1)}
                />
              </PointsHistory>
            ) : (
              <EmptyState
                tone="bell"
                title={t("rewards.clubOffTitle")}
                description={t("rewards.clubOffText")}
              />
            ))}
          {tab === "dashboard" && (
            <div className="mb-stagger p-4 space-y-4 relative z-10">
              <NamePrompt disabled={Boolean(demoShopId)} onSaved={setCustomerName} />
              {/* Card 1: Seu Cartão (Loyalty Card) */}
              {loyaltyOn && (
                <section
                  className="app-action-card mb-loyalty-contrast-card mb-loyalty-member-card relative overflow-hidden flex flex-col gap-5 p-5 cursor-pointer transition-transform hover:scale-[1.01]"
                  onClick={() => setShowVipInfo(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowVipInfo(true);
                    }
                  }}
                >
                  <div className="mb-loyalty-sheen" aria-hidden />
                  <div className="flex justify-between items-start relative z-10">
                    <div className="min-w-0 pr-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {t("home.member")}
                      </p>
                      <h2 className="brand-loyalty-name text-2xl sm:text-3xl break-words">
                        {customerName || t("cust.customerFallback")}
                      </h2>
                    </div>
                    <div className="shrink-0 flex flex-col items-end">
                      <div
                        className={`mb-loyalty-tier-mark mb-loyalty-tier-${tier.key} flex size-12 sm:size-14 items-center justify-center rounded-full border shadow-sm`}
                      >
                        <tier.icon className="size-6 sm:size-7" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-2 relative z-10">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground mb-1">
                        {t("home.pointsBalance")}
                      </p>
                      <p
                        className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tight ${tier.colorClass}`}
                      >
                        {points}{" "}
                        <span className="text-xl font-semibold opacity-70 tracking-normal">
                          pts
                        </span>
                      </p>
                    </div>
                    <div
                      className={`mb-loyalty-tier-mark mb-loyalty-tier-${tier.key} flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm mb-1`}
                    >
                      <tier.icon className="size-4" />
                      <span className="text-xs font-bold whitespace-nowrap">
                        {t("tier.level", { name: tier.name })}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Card 2: Próximo nível — compartilhado com o Extrato. */}
              {loyaltyOn && <NextLevelCard nextLevel={nextLevel} />}

              {/* Extrato: quando o cliente ganhou ou perdeu pontos por nível. */}
              {loyaltyOn && (
                <button
                  type="button"
                  onClick={() => setTab("pontos")}
                  className="app-action-card flex w-full cursor-pointer items-center justify-between p-4 text-left transition-colors hover:border-gold"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-gold">
                      <Receipt className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{t("home.pointsStatement")}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t("home.pointsStatementHint")}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {/* Card 3: Próximo atendimento */}
              <section
                className="app-action-card cursor-pointer hover:border-gold transition-colors"
                aria-label={t("home.next")}
                onClick={() => {
                  setReservationFilter("upcoming");
                  setTab("reservas");
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setReservationFilter("upcoming");
                    setTab("reservas");
                  }
                }}
              >
                <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Calendar className="size-4" />
                    {t("home.next")}
                  </h3>
                </div>
                <div className="p-5">
                  {appointmentsLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      {t("home.loadingSchedule")}
                    </p>
                  ) : appointmentsError ? (
                    <div role="alert" className="space-y-3 text-sm text-destructive">
                      <p>{appointmentsError}</p>
                      <button
                        type="button"
                        onClick={() => setAppointmentVersion((version) => version + 1)}
                        className="action-button"
                      >
                        {t("common.retry")}
                      </button>
                    </div>
                  ) : nextAppointment ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="shrink-0 rounded-2xl border border-border bg-background px-4 py-3 text-center shadow-sm">
                          <span className="block text-4xl font-semibold tabular-nums leading-none tracking-tight">
                            {formatShopDate(nextAppointment.starts_at, shopTimeZone, {
                              day: "2-digit",
                            })}
                          </span>
                          <span className="mt-1 block text-xs uppercase tracking-wide text-muted-foreground">
                            {formatShopDate(nextAppointment.starts_at, shopTimeZone, {
                              month: "short",
                            })}
                          </span>
                        </div>
                        <div>
                          <p className="text-lg font-semibold tabular-nums">
                            {formatSlotLabel(new Date(nextAppointment.starts_at), shopTimeZone)}
                          </p>
                          <p className="text-sm font-bold mt-0.5">
                            {nextAppointment.service?.name ?? t("booking.serviceFallback")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("home.withStaff", {
                              name:
                                nextAppointment.staff?.display_name ?? t("bookings.staffFallback"),
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`status-pill status-${nextAppointment.status}`}>
                        {t(statusKey[nextAppointment.status])}
                      </span>
                    </div>
                  ) : (
                    <EmptyState
                      tone="calendar"
                      title={t("home.emptyTitle")}
                      description={t("home.emptyHint")}
                      className="border-0 bg-transparent px-0 py-2 shadow-none"
                    />
                  )}
                </div>
              </section>

              <SurveyCard enabled={shopSettings.survey_program_enabled} />
            </div>
          )}

          {tab === "agenda" && (
            <div className="space-y-6">
              <div className="app-section-title">
                <Calendar />
                <h2>{rescheduleId ? t("booking.titleReschedule") : t("booking.title")}</h2>
              </div>
              {bookingSummary && (
                <section
                  role="status"
                  className="space-y-4 border border-emerald-600/30 bg-card p-5 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="size-5" />
                    {t("booking.reserved")}
                  </div>
                  <p className="text-sm leading-relaxed">{bookingSummary}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("booking.doneHint")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReservationFilter("upcoming");
                      setTab("reservas");
                    }}
                    className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    {t("booking.track")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingSummary(null);
                      setBookingError(null);
                    }}
                    className="min-h-11 w-full text-sm font-semibold"
                  >
                    {t("booking.another")}
                  </button>
                </section>
              )}
              {!bookingSummary && (
                <>
                  {shopSettings.booking_instructions && (
                    <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>{shopSettings.booking_instructions}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    {catalogLoading && (
                      <p className="text-xs text-muted-foreground">{t("booking.loadingCatalog")}</p>
                    )}
                    {catalogError && <p className="text-xs text-destructive">{catalogError}</p>}

                    {rescheduleId && (
                      <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-semibold">{t("booking.pickNewTime")}</span>
                        <button
                          type="button"
                          disabled={bookingBusy}
                          onClick={() => setRescheduleId(null)}
                          className="min-h-11 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground"
                        >
                          {t("booking.keepTime")}
                        </button>
                      </div>
                    )}

                    <section className="booking-section" aria-labelledby="booking-date">
                      <h3 id="booking-date" className="booking-heading">
                        {t("booking.date")}
                      </h3>
                      <DatePicker
                        compact
                        disabled={bookingBusy}
                        label={t("booking.pickCalendar")}
                        value={selectedDay}
                        onChange={(value) => {
                          setSelectedDay(value);
                          setSelectedSlotAt(null);
                          setBookingSummary(null);
                          setBookingError(null);
                        }}
                        min={dateFromLocalKey(bookingDayKeys[0])}
                        max={dateFromLocalKey(bookingDayKeys[bookingDayKeys.length - 1])}
                      />
                      <div
                        ref={dayCarouselRef}
                        className="app-day-carousel flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 no-scrollbar"
                      >
                        {bookingDayKeys.map((key, index) => {
                          // Meio-dia no fuso da loja evita virada de dia na formatação.
                          const dayAtNoon = shopDateTime(key, "12:00:00", shopTimeZone);
                          const selected = selectedDay === key;
                          const weekday = formatShopDate(dayAtNoon, shopTimeZone, {
                            weekday: "short",
                          })
                            .replace(".", "")
                            .toUpperCase();
                          const dayNumber = formatShopDate(dayAtNoon, shopTimeZone, {
                            day: "2-digit",
                          });
                          const month = formatShopDate(dayAtNoon, shopTimeZone, {
                            month: "short",
                          })
                            .replace(".", "")
                            .toUpperCase();
                          return (
                            <button
                              key={key}
                              disabled={bookingBusy}
                              onClick={() => {
                                setSelectedDay(key);
                                setSelectedSlotAt(null);
                                setBookingSummary(null);
                                setBookingError(null);
                              }}
                              aria-pressed={selected}
                              aria-label={t("booking.dayAria", { weekday, day: dayNumber, month })}
                              className={`app-day-chip ${selected ? "app-day-chip-selected" : ""}`}
                            >
                              <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">
                                {index === 0 ? t("booking.today") : weekday}
                              </span>
                              <span className="mt-0.5 block text-xl font-black leading-none tabular-nums">
                                {dayNumber}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-semibold uppercase opacity-80">
                                {month}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-center text-xs font-semibold text-muted-foreground">
                        {formatShopDate(
                          shopDateTime(selectedDay, "12:00:00", shopTimeZone),
                          shopTimeZone,
                          { weekday: "long", day: "2-digit", month: "long" },
                        )}
                      </p>
                    </section>

                    <section className="booking-section" aria-labelledby="booking-service">
                      <div className="flex items-center justify-between gap-2">
                        <h3 id="booking-service" className="booking-heading">
                          {t("booking.service")}
                        </h3>
                        {services.length > 0 && (
                          <CatalogViewToggle
                            viewMode={serviceView}
                            onViewMode={changeServiceView}
                          />
                        )}
                      </div>
                      {!catalogLoading && !catalogError && services.length === 0 && (
                        <p role="status" className="text-sm text-muted-foreground">
                          {t("booking.noServices")}
                        </p>
                      )}
                      <div
                        className={
                          serviceView === "list"
                            ? "flex flex-col gap-2"
                            : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                        }
                      >
                        {services.map((s, i) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setServiceIdx(i);
                              setSelectedSlotAt(null);
                              setBookingSummary(null);
                              setBookingError(null);
                            }}
                            disabled={bookingBusy}
                            aria-pressed={serviceIdx === i}
                            className={
                              serviceView === "list"
                                ? `flex min-h-14 w-full items-stretch overflow-hidden rounded-xl border p-0 text-left text-xs font-bold transition-all ${
                                    serviceIdx === i
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-muted/20 text-foreground hover:border-primary/50"
                                  }`
                                : `min-w-0 flex flex-col gap-2 rounded-xl border p-3 text-left text-xs font-bold transition-all sm:p-4 ${
                                    serviceIdx === i
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-muted/20 text-foreground hover:border-primary/50"
                                  }`
                            }
                          >
                            {serviceView === "list" ? (
                              <>
                                <span
                                  className={`flex w-16 shrink-0 items-center justify-center overflow-hidden ${
                                    serviceIdx === i ? "bg-primary-foreground/10" : "bg-muted/50"
                                  }`}
                                >
                                  <ServiceIcon
                                    icon={s.icon}
                                    className={`size-5 ${
                                      serviceIdx === i
                                        ? "text-primary-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                    imageClassName="size-full min-h-14 w-16 object-cover !rounded-none !p-0"
                                  />
                                </span>
                                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <span className="brand-content-title block break-words">
                                      {s.name}
                                    </span>
                                    {s.description ? (
                                      <span
                                        className={`mt-0.5 line-clamp-1 block text-[11px] font-medium ${
                                          serviceIdx === i
                                            ? "text-primary-foreground/75"
                                            : "text-muted-foreground"
                                        }`}
                                      >
                                        {s.description}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span
                                    className={`shrink-0 text-xs font-medium ${
                                      serviceIdx === i
                                        ? "text-primary-foreground/80"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {serviceLabel(s)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-col gap-1.5">
                                  <ServiceIcon
                                    icon={s.icon}
                                    className="mb-1 size-5"
                                    imageClassName="mb-1 size-10 rounded-xl"
                                  />
                                  <span className="brand-content-title block break-words">
                                    {s.name}
                                  </span>
                                  {s.description ? (
                                    <span
                                      className={`line-clamp-2 text-[11px] font-medium ${
                                        serviceIdx === i
                                          ? "text-primary-foreground/75"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {s.description}
                                    </span>
                                  ) : null}
                                </div>
                                <span
                                  className={`mt-auto block text-xs font-medium ${
                                    serviceIdx === i
                                      ? "text-primary-foreground/80"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {serviceLabel(s)}
                                </span>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="booking-section" aria-labelledby="booking-staff">
                      <div className="flex items-center justify-between gap-2">
                        <h3 id="booking-staff" className="booking-heading">
                          {t("booking.staff")}
                        </h3>
                        {!directLinkActive && staff.length > 0 && (
                          <CatalogViewToggle viewMode={staffView} onViewMode={changeStaffView} />
                        )}
                      </div>
                      {!catalogLoading && !catalogError && staffChoices.length === 0 && (
                        <p role="status" className="text-sm text-muted-foreground">
                          {t("booking.noStaff")}
                        </p>
                      )}
                      {staffNotForService && pickedStaff && !directLinkActive && (
                        <p role="status" className="text-sm text-muted-foreground">
                          {t("booking.staffNotForService", { name: pickedStaff.display_name })}
                        </p>
                      )}
                      {directLinkActive && selectedStaff ? (
                        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("booking.directLink")}
                          </p>
                          <p className="mt-1 font-bold">{selectedStaff.display_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("booking.directLinkHint")}
                          </p>
                        </div>
                      ) : (
                        <div
                          className={
                            staffView === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"
                          }
                        >
                          {(staffAssignmentMode === "random_available" ||
                            staffAssignmentMode === "favorite_then_pick") && (
                            <button
                              type="button"
                              onClick={() => {
                                setAnyAvailable(true);
                                setSelectedSlotAt(null);
                                setBookingSummary(null);
                                setBookingError(null);
                              }}
                              disabled={bookingBusy}
                              aria-pressed={anyAvailable}
                              className={`rounded-xl border p-4 text-left text-xs font-bold transition-all ${
                                anyAvailable
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-muted/20 text-foreground hover:border-primary/50"
                              } ${staffView === "list" ? "col-span-full" : "col-span-2"}`}
                            >
                              {t("booking.anyStaff")}
                              {staffAssignmentMode === "favorite_then_pick" && favoriteStaffId
                                ? ` ${t("booking.preferFavorite")}`
                                : ""}
                            </button>
                          )}
                          {staffChoices.map(({ m, i }) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                staffPickedByUser.current = true;
                                setAnyAvailable(false);
                                setStaffIdx(i);
                                setSelectedSlotAt(null);
                                setBookingSummary(null);
                                setBookingError(null);
                                if (
                                  !demo &&
                                  shopId &&
                                  userId &&
                                  staffAssignmentMode === "favorite_then_pick"
                                ) {
                                  void supabase.rpc("set_favorite_staff", {
                                    p_shop_id: shopId,
                                    p_staff_id: m.id,
                                  });
                                  setFavoriteStaffId(m.id);
                                }
                              }}
                              disabled={bookingBusy}
                              aria-pressed={!anyAvailable && staffIdx === i}
                              className={
                                staffView === "list"
                                  ? `flex min-h-14 w-full items-stretch overflow-hidden rounded-xl border p-0 text-left text-xs font-bold transition-all ${
                                      !anyAvailable && staffIdx === i
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-muted/20 text-foreground hover:border-primary/50"
                                    }`
                                  : `rounded-xl border p-4 text-left text-xs font-bold transition-all ${
                                      !anyAvailable && staffIdx === i
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-muted/20 text-foreground hover:border-primary/50"
                                    }`
                              }
                            >
                              {staffView === "list" ? (
                                <>
                                  <span
                                    className={`flex w-16 shrink-0 items-center justify-center overflow-hidden ${
                                      !anyAvailable && staffIdx === i
                                        ? "bg-primary-foreground/10"
                                        : "bg-muted/50"
                                    }`}
                                  >
                                    <StaffPhoto
                                      src={m.avatar_url}
                                      className="size-full min-h-14 w-16"
                                      fallback={<Scissors className="size-4" aria-hidden="true" />}
                                    />
                                  </span>
                                  <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
                                    <span className="min-w-0 flex-1 break-words">
                                      {m.display_name}
                                      {m.bio ? (
                                        <span
                                          className={`mt-0.5 line-clamp-1 block text-[11px] font-medium ${
                                            !anyAvailable && staffIdx === i
                                              ? "text-primary-foreground/75"
                                              : "text-muted-foreground"
                                          }`}
                                        >
                                          {m.bio}
                                        </span>
                                      ) : null}
                                    </span>
                                    {!anyAvailable && staffIdx === i && (
                                      <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
                                    )}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="flex items-center gap-2">
                                    <StaffPhoto
                                      src={m.avatar_url}
                                      className="size-9 rounded-xl"
                                      fallback={
                                        <span
                                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                                            !anyAvailable && staffIdx === i
                                              ? "bg-primary-foreground/15"
                                              : "bg-muted"
                                          }`}
                                        >
                                          <Scissors className="size-4" aria-hidden="true" />
                                        </span>
                                      }
                                    />
                                    <span className="min-w-0 flex-1 break-words">
                                      {m.display_name}
                                    </span>
                                    {!anyAvailable && staffIdx === i && (
                                      <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
                                    )}
                                  </span>
                                  {m.bio ? (
                                    <span
                                      className={`mt-2 line-clamp-2 text-[11px] font-medium ${
                                        !anyAvailable && staffIdx === i
                                          ? "text-primary-foreground/75"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {m.bio}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="booking-section" aria-labelledby="booking-time">
                      <h3 id="booking-time" className="booking-heading">
                        {t("booking.time")}
                      </h3>
                      {!selectedService || (!selectedStaff && !anyAvailable) ? (
                        <p className="text-sm text-muted-foreground">
                          {t("booking.timesNeedChoice")}
                        </p>
                      ) : slotsLoading && slotsFor !== selectionKey ? (
                        <p className="text-xs text-muted-foreground">{t("booking.loadingTimes")}</p>
                      ) : slotsError ? (
                        <div className="space-y-2">
                          <p className="text-xs text-destructive" role="alert">
                            {slotsError}
                          </p>
                          <button
                            className="text-xs underline"
                            onClick={() => setAvailabilityVersion((v) => v + 1)}
                          >
                            {t("common.retry")}
                          </button>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{t("booking.noTimes")}</p>
                      ) : (
                        <div className="space-y-4 p-1">
                          {[
                            { label: t("booking.morning"), from: 0, to: 12, icon: Sun },
                            { label: t("booking.afternoon"), from: 12, to: 18, icon: Sun },
                            { label: t("booking.evening"), from: 18, to: 24, icon: Moon },
                          ].map(({ label, from, to, icon: Icon }) => {
                            const periodSlots = availableSlots.filter(
                              (slot) =>
                                shopHour(slot, shopTimeZone) >= from &&
                                shopHour(slot, shopTimeZone) < to,
                            );
                            if (!periodSlots.length) return null;
                            return (
                              <section key={label} aria-label={label} className="space-y-2">
                                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                  <Icon className="size-4 text-gold" />
                                  {label}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  {periodSlots.map((slot) => (
                                    <button
                                      key={slot.toISOString()}
                                      onClick={() => {
                                        setSelectedSlotAt(slot.toISOString());
                                        setBookingSummary(null);
                                      }}
                                      disabled={bookingBusy}
                                      aria-pressed={selectedSlotAt === slot.toISOString()}
                                      className={`min-h-11 rounded-xl border px-2 py-3 text-sm font-semibold tabular-nums transition-all ${selectedSlotAt === slot.toISOString() ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 border-border text-foreground hover:border-gold"}`}
                                    >
                                      {formatSlotLabel(slot, shopTimeZone)}
                                    </button>
                                  ))}
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <WaitingCards
                      controller={{
                        ...waiting,
                        waits: waiting.waits.filter((w) => w.staff_id === selectedStaffId),
                      }}
                      mode="opportunities"
                      staff={staff}
                      service={bookingService ?? undefined}
                      timeZone={shopTimeZone}
                      day={selectedDay}
                      onChanged={() => setTab("reservas")}
                    />
                    {selectedSlot &&
                      selectedService &&
                      (selectedStaff || anyAvailable) &&
                      !bookingSummary && (
                        <section
                          aria-label={t("booking.summaryAria")}
                          className="rounded-2xl border border-gold/30 bg-card p-4 space-y-3"
                        >
                          <p className="flex items-center gap-2 text-sm font-bold">
                            <Calendar className="size-4 text-gold" />
                            {t("booking.yourBooking")}
                          </p>
                          <div className="flex justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{selectedService.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {anyAvailable ? t("booking.anyStaff") : selectedStaff?.display_name}
                              </p>
                            </div>
                            <p className="text-sm font-bold">
                              {formatMoney((bookingService ?? selectedService).price_cents)}
                            </p>
                          </div>
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock3 className="size-4" />
                            {formatShopDate(selectedSlot, shopTimeZone, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}{" "}
                            · {formatSlotLabel(selectedSlot, shopTimeZone)} ·{" "}
                            {(bookingService ?? selectedService).duration_minutes} min
                          </p>
                          {!rescheduleId && !directLinkActive && (
                            <div className="space-y-2 border-t border-border/60 pt-3">
                              <label className="flex items-center justify-between gap-3 text-sm font-semibold">
                                {t("booking.repeat")}
                                <input
                                  type="checkbox"
                                  checked={repeatEnabled}
                                  onChange={(e) => setRepeatEnabled(e.target.checked)}
                                  className="size-5 accent-primary"
                                />
                              </label>
                              {repeatEnabled && (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      aria-pressed={repeatKind === "weekday"}
                                      onClick={() => setRepeatKind("weekday")}
                                      className={`min-h-9 rounded-xl border px-3 text-xs font-bold ${
                                        repeatKind === "weekday"
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-border text-muted-foreground"
                                      }`}
                                    >
                                      {t("booking.everyWeek")}
                                    </button>
                                    {([7, 15, 21] as const).map((days) => (
                                      <button
                                        key={days}
                                        type="button"
                                        aria-pressed={
                                          repeatKind === "interval_days" && repeatInterval === days
                                        }
                                        onClick={() => {
                                          setRepeatKind("interval_days");
                                          setRepeatInterval(days);
                                        }}
                                        className={`min-h-9 rounded-xl border px-3 text-xs font-bold ${
                                          repeatKind === "interval_days" && repeatInterval === days
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border text-muted-foreground"
                                        }`}
                                      >
                                        {t("booking.everyDays", { days })}
                                      </button>
                                    ))}
                                  </div>
                                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    {t("booking.repeatHint", {
                                      days: shopSettings.booking_horizon_days,
                                      time: formatSlotLabel(selectedSlot, shopTimeZone),
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    {bookingError && (
                      <div
                        role="alert"
                        className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                      >
                        <p>{bookingError}</p>
                        <button
                          type="button"
                          className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"
                          onClick={() => {
                            setBookingError(null);
                            setSlotsFor("");
                            setSelectedSlotAt(null);
                            setAvailabilityVersion((v) => v + 1);
                          }}
                        >
                          {t("booking.refreshTimes")}
                        </button>
                      </div>
                    )}
                    {!selectedSlot &&
                      !bookingBusy &&
                      selectedService &&
                      (selectedStaff || anyAvailable) && (
                        <p className="text-center text-xs text-muted-foreground">
                          {t("booking.chooseTime")}
                        </p>
                      )}
                    <button
                      onClick={() => void confirmBooking()}
                      disabled={
                        !selectedService ||
                        (!selectedStaff && !anyAvailable) ||
                        !selectedSlot ||
                        bookingBusy
                      }
                      className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {bookingBusy
                        ? t("booking.booking")
                        : rescheduleId
                          ? t("booking.confirmReschedule")
                          : t("booking.confirm")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "reservas" && (
            <div className="space-y-6">
              <WaitingCards
                controller={waiting}
                mode="mine"
                staff={staff}
                timeZone={shopTimeZone}
                onChanged={() => setAppointmentVersion((v) => v + 1)}
              />
              <WaitingNotices controller={waiting} timeZone={shopTimeZone} />
              <div>
                <div className="app-section-title">
                  <Clock3 />
                  <h2>{t("bookings.title")}</h2>
                </div>
                {!demo && (
                  <button
                    type="button"
                    disabled={appointmentsRefreshing || !!appointmentBusy}
                    onClick={() => setAppointmentVersion((version) => version + 1)}
                    className="mt-3 rounded-xl border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {appointmentsRefreshing ? t("bookings.checking") : t("bookings.checkNow")}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2" aria-label={t("bookings.filterAria")}>
                {(
                  [
                    { id: "upcoming", label: t("bookings.upcoming") },
                    { id: "history", label: t("bookings.history") },
                    { id: "completed", label: t("bookings.completed") },
                    { id: "cancelled", label: t("bookings.cancelled") },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setReservationFilter(id)}
                    aria-pressed={reservationFilter === id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-3 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    <span>{label}</span>
                    <span className="text-xs">
                      {filterReservations(shopAppointments, id, reservationNow).length}
                    </span>
                  </button>
                ))}
              </div>
              {appointmentsError && (
                <p className="text-xs text-destructive" role="alert">
                  {appointmentsError}
                </p>
              )}
              {appointmentsNotice && !appointmentsError && (
                <div
                  role="status"
                  className={`flex items-start gap-2 border bg-card p-3 text-sm rounded-lg ${
                    rescheduleBlockedNotice ? "border-primary/30" : "border-emerald-600/30"
                  }`}
                >
                  {rescheduleBlockedNotice ? (
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  )}
                  <p className="flex-1 leading-relaxed">{appointmentsNotice}</p>
                  <button
                    type="button"
                    onClick={() => setAppointmentsNotice(null)}
                    className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center text-xs font-semibold text-muted-foreground"
                  >
                    {t("cust.ok")}
                  </button>
                </div>
              )}
              {appointmentsLoading ? (
                <p className="text-xs text-muted-foreground">{t("bookings.loading")}</p>
              ) : visibleReservations.length === 0 &&
                appointmentsError ? null : visibleReservations.length === 0 ? (
                <EmptyState
                  tone="calendar"
                  title={
                    reservationFilter === "upcoming"
                      ? t("bookings.emptyUpcoming")
                      : t("bookings.emptyFilter")
                  }
                  description={
                    reservationFilter === "upcoming"
                      ? t("bookings.emptyUpcomingHint")
                      : t("bookings.emptyFilterHint")
                  }
                  action={
                    <button
                      onClick={() => setTab("agenda")}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      {t("bookings.bookNow")}
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {visibleReservations.map((row) => {
                    const startsAt = new Date(row.starts_at);
                    const canManage =
                      row.status === "reschedule_requested" ||
                      row.status === "pending" ||
                      (row.status === "confirmed" &&
                        startsAt.getTime() > (demo?.now.getTime() ?? Date.now()));
                    return (
                      <article
                        key={row.id}
                        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <ServiceIcon
                                icon={row.service?.icon}
                                className="size-4 text-gold"
                                imageClassName="size-8 rounded-lg"
                              />
                              <p className="text-sm font-black">
                                {row.service?.name ?? t("booking.serviceFallback")}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.barbershop?.name ?? t("bookings.shopFallback")} ·{" "}
                              {row.staff?.display_name ?? t("bookings.staffFallback")}
                            </p>
                          </div>
                          <span className={`status-pill status-${row.status}`}>
                            {t(statusKey[row.status])}
                          </span>
                        </div>
                        {row.series_id ? (
                          <p className="mt-2 inline-flex rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                            {t("bookings.recurring")}
                          </p>
                        ) : null}
                        <p className="mt-4 text-sm font-bold">
                          {formatShopDate(startsAt, shopTimeZone, {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          {t("booking.atTime", { time: formatSlotLabel(startsAt, shopTimeZone) })}
                        </p>
                        {row.status === "cancelled" && cancellationDetails[row.id] && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {cancellationDetails[row.id].source === "customer"
                              ? t("bookings.cancelledByCustomer")
                              : t("bookings.cancelledByShop")}
                            {` · ${cancellationReasonLabel(cancellationDetails[row.id].reason)}`}
                          </p>
                        )}
                        {canManage && (
                          <>
                            {row.status === "reschedule_requested" && (
                              <p className="mt-3 text-sm text-muted-foreground">
                                {t("bookings.shopRemovedConfirmation")}
                              </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                disabled={appointmentBusy !== null}
                                onClick={() => beginReschedule(row)}
                                className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50"
                              >
                                {t("bookings.reschedule")}
                              </button>
                              <button
                                disabled={appointmentBusy !== null}
                                onClick={() => setCancelTarget(row)}
                                className="action-button action-danger"
                              >
                                <X className="size-4" />
                                {appointmentBusy === row.id
                                  ? t("bookings.cancelling")
                                  : t("bookings.cancel")}
                              </button>
                              {row.series_id ? (
                                <button
                                  type="button"
                                  disabled={appointmentBusy !== null}
                                  onClick={() => setStopSeriesTarget(row.series_id!)}
                                  className="w-full rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50"
                                >
                                  {t("bookings.stopRepeat")}
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "esportes" && shopSettings.sports_enabled && (
            <div className="space-y-6">
              {!demo && (
                <p className="rounded-lg border border-border bg-card p-4 text-sm">
                  {t("sports.notConfigured")}
                </p>
              )}
              {demo && <p className="text-xs text-muted-foreground">{t("sports.demoNote")}</p>}
              <div className="app-section-title">
                <Feather />
                <h2>{t("sports.title")}</h2>
              </div>
              <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-border">
                {(
                  [
                    { id: "all", label: t("sports.all") },
                    { id: "football", label: t("sports.football") },
                    { id: "nba", label: "NBA" },
                  ] as const
                ).map(({ id: f, label }) => (
                  <button
                    key={f}
                    onClick={() => setSportFilter(f)}
                    aria-pressed={sportFilter === f}
                    type="button"
                    className={`min-h-11 text-xs uppercase font-bold px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${sportFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {filteredMatches.map((m) => (
                  <div
                    key={m.id}
                    className="bg-card p-5 rounded-2xl border border-border shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-muted-foreground font-bold uppercase">
                        {m.league} · {t(matchStatusKey[m.status])}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span className="text-foreground">{m.home}</span>
                      <span className="text-primary font-mono">{m.scoreH}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-sm mt-2">
                      <span className="text-muted-foreground">{m.away}</span>
                      <span className="text-muted-foreground/50 font-mono">{m.scoreA}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="space-y-6">
              <WaitingNotices controller={waiting} timeZone={shopTimeZone} />
              <div className="app-section-title">
                <Bell />
                <h2>{t("nav.notices")}</h2>
              </div>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyState
                    tone="bell"
                    title={t("notices.emptyTitle")}
                    description={t("notices.emptyHint")}
                  />
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform duration-300 ease-out hover:-translate-y-0.5"
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <h4 className="text-sm font-semibold tracking-tight text-foreground">
                          {n.title}
                        </h4>
                        <span className="text-xs font-bold text-muted-foreground">{n.time}</span>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                        {n.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav
        className="app-mobile-nav app-mobile-nav-floating fixed left-4 right-4 z-40 mx-auto grid max-w-3xl overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        aria-label={t("nav.main")}
      >
        <span
          aria-hidden
          className="app-mobile-nav-indicator"
          style={{
            width: `calc((100% - 0.9rem - ${(navItems.length - 1) * 0.3}rem) / ${navItems.length})`,
            transform: `translateX(calc(${Math.max(0, activeNavIndex)} * (100% + 0.3rem)))`,
            opacity: activeNavIndex >= 0 ? 1 : 0,
          }}
        />
        {navItems.map((item) => (
          <NavItem key={item.id} {...item} />
        ))}
      </nav>
      <VipInfoModal
        isOpen={showVipInfo && loyaltyOn}
        sportsEnabled={shopSettings.sports_enabled}
        program={loyaltyProgram}
        shopId={demo ? null : shopId}
        onClose={() => setShowVipInfo(false)}
      />
    </div>
  );
}

const TIER_STYLES = {
  classic: {
    icon: Armchair,
    colorClass: "text-gradient-silver",
    badge: "bg-silver-metallic",
    iconClass: "text-black",
  },
  select: {
    icon: BadgeCheck,
    colorClass: "text-gradient-bronze",
    badge: "bg-bronze-metallic",
    iconClass: "text-white",
  },
  privilege: {
    icon: Sparkle,
    colorClass: "text-gradient-gold",
    badge: "bg-gold-metallic",
    iconClass: "text-black",
  },
  exclusive: {
    icon: Diamond,
    colorClass: "text-gradient-hologram",
    badge: "bg-hologram-metallic",
    iconClass: "text-black",
  },
} as const;

const VipInfoModal = ({
  isOpen,
  sportsEnabled,
  program,
  shopId,
  onClose,
}: {
  isOpen: boolean;
  sportsEnabled: boolean;
  program: LoyaltyProgram;
  shopId: string | null;
  onClose: () => void;
}) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  // onClose chega como função nova a cada render do pai; a ref evita rodar o efeito
  // de novo (e devolver o foco ao botão Fechar) enquanto a janela está aberta.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Mantém o Tab dentro do diálogo: sem isso o foco vaza para o conteúdo
      // que está atrás do overlay.
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vip-benefits-title"
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Trophy className="text-primary size-5" />
            <h3 id="vip-benefits-title" className="font-bold text-foreground">
              {t("club.title")}
            </h3>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label={t("club.close")}
            className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="dialog-scroll-area flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t("club.howToEarn")}</h4>
            <div className="space-y-3">
              <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                <p className="text-xs font-medium leading-relaxed">
                  {richText(t("club.earnVisit"), {
                    points: (
                      <span className="font-bold text-primary">
                        {t(program.points_per_visit === 1 ? "club.pointsOne" : "club.pointsMany", {
                          n: program.points_per_visit,
                        })}
                      </span>
                    ),
                  })}
                </p>
              </div>
              {program.welcome_bonus > 0 && (
                <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                  <p className="text-xs font-medium leading-relaxed">
                    {richText(t("club.earnWelcome"), {
                      points: (
                        <span className="font-bold text-primary">
                          {t(program.welcome_bonus === 1 ? "club.pointsOne" : "club.pointsMany", {
                            n: program.welcome_bonus,
                          })}
                        </span>
                      ),
                    })}
                  </p>
                </div>
              )}
              {sportsEnabled && (
                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-2xl border border-border/50">
                  <Star size={16} className="text-primary mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    {richText(t("club.earnCheckin"), {
                      days: <span className="font-bold text-foreground">{t("club.gameDays")}</span>,
                      points: <span className="font-bold text-primary">{t("club.tenPoints")}</span>,
                    })}
                  </p>
                </div>
              )}
              {program.rewards.some((reward) => reward.active) && (
                <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                  <p className="text-xs font-medium leading-relaxed">{t("club.spendRewards")}</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-1 text-sm font-semibold text-foreground">{t("club.levels")}</h4>
            <p className="mb-3 text-xs text-muted-foreground">{t("club.levelsHint")}</p>
            <ol className="space-y-3">
              {program.tiers.map((tierRow, index) => {
                const styleKey = tierStyleKey(index, program.tiers.length);
                const style = TIER_STYLES[styleKey];
                const Icon = style.icon;
                const next = program.tiers[index + 1];
                const benefit =
                  tierRow.benefit ||
                  (program.mode === "default" ? t(`tier.${styleKey}.benefit` as MessageKey) : "");
                return (
                  <li
                    key={`${tierRow.name}-${index}`}
                    className="bg-muted/40 p-4 rounded-2xl border border-border/60 shadow-sm"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs font-semibold flex items-center gap-2 min-w-0">
                        <span className={`p-1.5 rounded-lg border border-white/20 ${style.badge}`}>
                          <Icon size={14} className={style.iconClass} aria-hidden />
                        </span>
                        <span className={`truncate ${style.colorClass}`}>{tierRow.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                        {next
                          ? t("club.range", { from: tierRow.min_points, to: next.min_points - 1 })
                          : t("club.rangeTop", { from: tierRow.min_points })}
                      </span>
                    </div>
                    {benefit && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed pl-9">
                        {benefit}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="space-y-2 border-t border-border bg-muted/20 p-4">
          <Link
            to="/politica"
            search={shopId ? { shop: shopId } : {}}
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {t("club.fullPolicy")} <ChevronRight size={14} />
          </Link>
          <button
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            {t("club.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ArenaApp };
