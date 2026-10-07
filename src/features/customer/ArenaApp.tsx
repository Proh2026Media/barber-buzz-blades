import { SurveyCard } from "@/features/insights/SurveyCard";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n } from "@/lib/i18n";
import { useWaiting } from "@/features/waiting/useWaiting";
import { WaitingCards } from "@/features/waiting/WaitingUI";
import { blocksSlot } from "@/features/waiting/model";
import { CancellationDialog } from "@/features/insights/CancellationDialog";
import { cancellationReasonLabel, type CancellationReason } from "@/features/insights/cancellation";
// Agendar e Reservas: passos, ticket da reserva, filtros e janelas.
import {
  BookingDone,
  BookingSummaryBar,
  ChangeButton,
  DayStrip,
  RepeatPicker,
  RescheduleFromTo,
  ServiceChoices,
  ServiceSummary,
  StaffChoices,
  StaffSummary,
  StepCard,
  TimeGrid,
  type RepeatChoice,
  type StepState,
  type SummaryPill,
} from "./booking/BookingParts";
import { AppointmentTicket, ReservationStatusBadge, type TicketData } from "./booking/ticket";
import { useGroupReservations, useShortSlot } from "./booking/format";
import { ReservationFilters, StopRepeatDialog } from "./booking/ReservationsParts";
import { useClosedWeekdays } from "./booking/useClosedWeekdays";
import {
  LoadingState as BookingLoading,
  PersonAvatar as BookingAvatar,
  StatusBadge as BookingBadge,
} from "@/components/visual";
import {
  BellRing,
  CalendarCheck as CalendarCheckIcon,
  CalendarDays as CalendarDaysIcon,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Star as StarIcon,
  Store as StoreIcon,
} from "lucide-react";
import { PointsHistory, type AppointmentContext } from "./PointsHistory";
import { CustomerRewards } from "@/features/loyalty/CustomerRewards";
import {
  FALLBACK_PROGRAM,
  parseLoyaltyProgram,
  type LoyaltyProgram,
} from "@/features/loyalty/program";
import { usePendingRedemptions } from "@/features/loyalty/usePendingRedemptions";
import { CustomerRhythm } from "./CustomerRhythm";
import { CustomerProfile, type CustomerShop } from "./CustomerProfile";
import { SportsBoard } from "./SportsBoard";
import { ProfileSetup } from "./ProfileSetup";
import { MemberCard } from "./MemberCard";
import { NextVisitCard } from "./NextVisitCard";
import { ClubInfoDialog } from "./ClubInfoDialog";
import { CustomerNotices, type SessionNotice } from "./CustomerNotices";
import { offersFor } from "./offers";
import { CustomerPageHeader } from "./CustomerPageHeader";
import { shortWhen } from "./when";
import {
  AttentionList,
  Countdown,
  CountBadge,
  Notice,
  type AttentionItem,
} from "@/components/visual";
import { readSeenCancellations, writeSeenCancellations } from "./seenCancellations";
import { SpinningLoader } from "./SpinningLoader";
import { toast } from "sonner";
import { TermsUpdateGate } from "@/features/legal/TermsUpdateGate";
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
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import { DatePicker } from "@/components/ui/schedule-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  CalendarClock,
  CalendarPlus,
  Check,
  Compass,
  LogIn,
  Trophy,
  User,
  Timer,
  X,
  XCircle,
  Zap,
  ReceiptText,
  Scissors,
  ChevronRight,
  Clock3,
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
  validPrepMinutes,
  buildBookingDateKeys,
  dateFromLocalKey,
  formatShopDate as formatShopDateIn,
  formatSlotLabel as formatSlotLabelIn,
  shiftDateKey,
  shopDateKey,
  shopDateTime,
  shopDayRange,
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

import { ShopJoinDialog } from "./ShopJoinDialog";

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
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  // Passos do Agendar: a escolha que já vem pronta aparece como "Sugerido" até a pessoa tocar;
  // o passo escolhido recolhe numa linha-resumo com "Trocar".
  const [serviceChosen, setServiceChosen] = useState(false);
  const [staffChosen, setStaffChosen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(true);
  const [staffOpen, setStaffOpen] = useState(true);
  /** "Agendar de novo": serviço/profissional do atendimento antigo que saiu do catálogo. */
  const [againMissing, setAgainMissing] = useState<{
    service?: string | null;
    staff?: string | null;
  } | null>(null);
  const [favoriteSaved, setFavoriteSaved] = useState<string | null>(null);
  const [bookingDone, setBookingDone] = useState<{
    ticket: TicketData;
    rescheduled: boolean;
    previous: string | null;
    repeatLabel: string | null;
  } | null>(null);
  // Falha sem resposta clara: a reserva pode ter sido gravada (confira antes de repetir).
  const [bookingUncertain, setBookingUncertain] = useState(false);
  const bookingLock = useRef(false);
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
  // Falha ao entrar na barbearia do link: aparece dentro da janela, com "Tentar de novo".
  const [joinError, setJoinError] = useState<string | null>(null);
  // "Agora não" sem outra barbearia: Agendar mostra como entrar (em vez de "sem serviços").
  const [joinDeclined, setJoinDeclined] = useState<{ ref: string; name: string } | null>(null);
  // Barbearias em que o cliente entrou (Conta → Minhas barbearias).
  const [myShops, setMyShops] = useState<CustomerShop[]>([]);
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
  // Reservas: reserva aberta pelo link do aviso (destaque) e data em foco em cada repetição.
  const [focusedReservation, setFocusedReservation] = useState<string | null>(null);
  // De onde veio o destaque: link de um aviso ou "Ver detalhes" do Início (muda o selo).
  const [focusedFrom, setFocusedFrom] = useState<"notice" | "home">("notice");
  const [focusMissing, setFocusMissing] = useState(false);
  const [seriesFocus, setSeriesFocus] = useState<Record<string, string>>({});
  // Pontos ganhos em cada atendimento concluído (pílula "+50 pts" no ticket de Anteriores).
  const [earnedByAppointment, setEarnedByAppointment] = useState<Record<string, number>>({});
  const [appointmentsUpdatedAt, setAppointmentsUpdatedAt] = useState<number | null>(null);
  const [noticeShowsCancelled, setNoticeShowsCancelled] = useState(false);

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
          setAppointmentsUpdatedAt(Date.now());
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
        if (!cancelled) {
          setMyShops(
            customerMemberships.flatMap((m) =>
              m.barbershop
                ? [{ id: m.barbershop.id, name: m.barbershop.name, slug: m.barbershop.slug }]
                : [],
            ),
          );
        }
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
    setJoinError(null);
    try {
      const { error } = await supabase.rpc("join_shop_as_customer", {
        p_shop_ref: joinShopRef,
      });
      if (error) throw error;
      setJoinOpen(false);
      setJoinShopRef(null);
      setJoinDeclined(null);
      toast.success(t("conta.join.done", { shop: joinShopName || t("cust.thisShop") }));
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
      // A janela continua aberta, com o motivo e "Tentar de novo".
      setJoinError(friendlyAuthError(err, t("cust.joinError")));
    } finally {
      setJoinBusy(false);
    }
  }

  function dismissShopJoin() {
    setJoinOpen(false);
    setJoinError(null);
    if (joinShopRef) setJoinDeclined({ ref: joinShopRef, name: joinShopName });
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
          // Preparo depois de cada serviço: o do serviço, senão o da barbearia.
          const prepFor = (serviceId: string | null) =>
            validPrepMinutes(
              demo.services.find((row) => row.id === serviceId)?.prep_minutes ??
                demo.settings.prep_minutes,
            );
          setSlots(
            buildSlotsForWindow(
              selectedDay,
              selectedServiceDuration,
              [
                ...occupied.map((row) => ({ ...row, prep_minutes: prepFor(row.service_id) })),
                ...demo.waits.filter(
                  (w) => blocksSlot(w, demo.now) && w.staff_id === selectedStaffId,
                ),
              ],
              hours,
              demo.now,
              shopTimeZone,
              {
                ...slotRuleFromSettings(demo.settings),
                prepMinutes: prepFor(selectedServiceId),
                blocks,
              },
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
    setBookingUncertain(false);
    const endsAt = new Date(selectedSlot.getTime() + bookingService.duration_minutes * 60_000);
    let staffId = selectedStaff?.id ?? null;
    let staffName = selectedStaff?.display_name ?? t("booking.staffFallback");
    const previousRow = rescheduleId
      ? (shopAppointments.find((row) => row.id === rescheduleId) ?? null)
      : null;
    /** Mostra o ticket do sucesso e registra o aviso da sessão (a reserva já está gravada). */
    const finishBooking = (repeatApplied: boolean) => {
      const dateLabel = formatShopDate(selectedSlot, shopTimeZone, {
        day: "2-digit",
        month: "2-digit",
      });
      // Só anuncia a repetição quando uma série foi de fato criada.
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
      const previous = previousRow ? shortSlot(previousRow.starts_at, shopTimeZone) : null;
      setBookingDone({
        ticket: {
          startsAt: selectedSlot.toISOString(),
          endsAt: endsAt.toISOString(),
          serviceName: bookingService.name,
          serviceIcon: bookingService.icon,
          staffName,
          staffId,
          staffPhoto: staff.find((row) => row.id === staffId)?.avatar_url,
          // Remarcação com o mesmo serviço e profissional mantém o preço já reservado.
          priceCents:
            previousRow &&
            previousRow.service_id === bookingService.id &&
            previousRow.staff_id === staffId &&
            typeof previousRow.booked_price_cents === "number"
              ? previousRow.booked_price_cents
              : bookingService.price_cents,
        },
        rescheduled: Boolean(rescheduleId),
        previous: previous ? `${previous.day} · ${previous.time}` : null,
        repeatLabel: repeatApplied
          ? repeatKind === "weekday"
            ? t("booking.repeatCreatedWeekly")
            : t("booking.repeatCreatedDays", { days: repeatInterval })
          : null,
      });
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
          at: (demo?.now ?? new Date()).getTime(),
          read: false,
        },
        ...n,
      ]);
    };
    try {
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
      finishBooking(repeatApplied);
    } catch (err) {
      recordUsage("booking_failed");
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
      // Erro da própria tela (sem profissional livre etc.): a frase já diz o que fazer.
      if (err instanceof Error && !code) {
        setBookingError(err.message || t("booking.errorGeneric"));
        setAvailabilityVersion((v) => v + 1);
        return;
      }
      // Resultado incerto (conexão caiu, ou o horário "acabou de ser reservado" por nós mesmos
      // numa segunda tentativa): confere se a reserva já existe antes de dizer que falhou.
      if (!demo && code !== "22023" && staffId) {
        try {
          const { data: own } = await supabase
            .from("appointments")
            .select("id")
            .eq("customer_id", userId)
            .eq("staff_id", staffId)
            .eq("starts_at", selectedSlot.toISOString())
            .in("status", ["pending", "confirmed"])
            .limit(1);
          if (own?.length) {
            finishBooking(false);
            return;
          }
        } catch {
          /* Sem resposta: segue para o aviso de resultado incerto. */
        }
      }
      if (code === "23P01") setBookingError(t("booking.errorTaken"));
      else if (code === "22023")
        setBookingError(
          /passou/i.test(message) ? t("booking.errorPast") : t("booking.errorUnavailable"),
        );
      else setBookingUncertain(true);
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
      const when = shortSlot(row.starts_at, shopTimeZone);
      const cancelledText = t("bookings.cancelledNotice", {
        summary: `${when.day} · ${when.time}`,
      });
      setAppointmentsNotice(cancelledText);
      setNoticeShowsCancelled(true);
      // Fora de Reservas (ex.: item de atenção do Início) o aviso da lista não aparece:
      // confirma com o aviso rápido, com ícone e cor de sucesso.
      if (tab !== "reservas") toast.success(cancelledText);
    } catch {
      setAppointmentsError(t("bookings.cancelError"));
    } finally {
      setAppointmentBusy(null);
    }
  };

  /** Para a repetição. Lança erro para a janela mostrar a falha dentro dela. */
  const stopSeries = async (seriesId: string) => {
    setAppointmentBusy(seriesId);
    setAppointmentsError(null);
    setAppointmentsNotice(null);
    setNoticeShowsCancelled(false);
    try {
      // Na demonstração não há repetição gravada: a janela mostra o aviso.
      if (demo) throw new Error(t("bookings.repeatDemo"));
      const { error } = await supabase.rpc("stop_booking_series", { p_series_id: seriesId });
      if (error) throw error;
      setAppointmentVersion((v) => v + 1);
      setAvailabilityVersion((v) => v + 1);
      setStopSeriesTarget(null);
      setAppointmentsNotice(t("bookings.repeatStopped"));
    } finally {
      setAppointmentBusy(null);
    }
  };

  /** Abre Reservas no filtro certo, rola até a reserva e a destaca por alguns segundos. */
  const revealReservation = (match: CustomerAppointment, from: "notice" | "home" = "notice") => {
    setTab("reservas");
    setFocusedFrom(from);
    const upcoming =
      filterReservations([match], "upcoming", demo?.now.getTime() ?? Date.now()).length > 0;
    setReservationFilter(upcoming ? "upcoming" : "history");
    if (match.series_id) {
      const seriesId = match.series_id;
      setSeriesFocus((current) => ({ ...current, [seriesId]: match.id }));
    }
    setFocusedReservation(match.id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      const card = document.getElementById(`reserva-${match.id}`);
      card?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      card?.focus({ preventScroll: true });
    }, 300);
    window.setTimeout(
      () => setFocusedReservation((current) => (current === match.id ? null : current)),
      8000,
    );
  };

  // Link de um aviso (?reserva=): abre a reserva no filtro certo, rola até ela e a destaca.
  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focusToken || focusHandled.current) return;
    if (!appointmentsLoadedFor || appointmentsLoading) return;
    focusHandled.current = true;
    setTab("reservas");
    const match = shopAppointments.find((row) => row.public_token === focusToken);
    if (!match) {
      // Reserva de outra loja: só não destaca. Sumiu de vez: avisa.
      if (!appointments.some((row) => row.public_token === focusToken)) setFocusMissing(true);
      return;
    }
    revealReservation(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealReservation só usa setters e a demo.
  }, [
    focusToken,
    shopAppointments,
    appointments,
    appointmentsLoadedFor,
    appointmentsLoading,
    demo,
  ]);

  const beginReschedule = (row: CustomerAppointment) => {
    const serviceIndex = services.findIndex((item) => item.id === row.service_id);
    const staffIndex = staff.findIndex((item) => item.id === row.staff_id);
    // Sem o serviço ou o profissional originais no catálogo, remarcar trocaria a
    // reserva por outra seleção sem aviso: avisa e não entra no modo remarcação.
    if (serviceIndex < 0 || staffIndex < 0) {
      // Aviso (não erro): um erro esconderia a lista de reservas.
      setAppointmentsError(null);
      setNoticeShowsCancelled(false);
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
    setBookingUncertain(false);
    setBookingDone(null);
    setSelectedSlotAt(null);
    // Remarcar mantém serviço e profissional: os dois passos já vêm feitos (com "Trocar").
    setAgainMissing(null);
    setServiceChosen(true);
    setStaffChosen(true);
    setServiceOpen(false);
    setStaffOpen(false);
    setTab("agenda");
  };

  /* ---------------------------------------------------------------------------------------- */
  /* Agendar e Reservas: dados derivados para os passos, o resumo e os tickets.                */
  /* ---------------------------------------------------------------------------------------- */
  const bookingNow = demo?.now ?? new Date();
  const shortSlot = useShortSlot();
  const groupReservations = useGroupReservations();
  const closedWeekdays = useClosedWeekdays(shopId, demo ? demo.businessHours : null);
  // O sucesso não fica preso na aba: ao sair de Agendar, volta o formulário.
  useEffect(() => {
    if (tab === "agenda") return;
    setBookingDone(null);
    setBookingUncertain(false);
  }, [tab]);
  useEffect(() => {
    if (!favoriteSaved) return;
    const id = window.setTimeout(() => setFavoriteSaved(null), 4000);
    return () => window.clearTimeout(id);
  }, [favoriteSaved]);
  const staffPhotoOf = (id: string | null | undefined) =>
    staff.find((member) => member.id === id)?.avatar_url ?? null;
  const ticketFor = (row: CustomerAppointment): TicketData => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    serviceName: row.service?.name ?? t("booking.serviceFallback"),
    serviceIcon: row.service?.icon,
    staffName: row.staff?.display_name ?? t("bookings.staffFallback"),
    staffId: row.staff_id,
    staffPhoto: staffPhotoOf(row.staff_id),
    priceCents: row.booked_price_cents,
  });
  const rescheduleRow = rescheduleId
    ? (shopAppointments.find((row) => row.id === rescheduleId) ?? null)
    : null;
  // Preço mostrado em Conferir e no resumo: na remarcação com o mesmo serviço e o mesmo
  // profissional, o servidor mantém o preço já reservado.
  const reviewPriceCents =
    rescheduleRow &&
    bookingService &&
    !anyAvailable &&
    rescheduleRow.service_id === bookingService.id &&
    rescheduleRow.staff_id === selectedStaff?.id &&
    typeof rescheduleRow.booked_price_cents === "number"
      ? rescheduleRow.booked_price_cents
      : bookingService?.price_cents;
  const scrollToStep = (id: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      // O foco do teclado acompanha a rolagem: título do passo ou o próprio cartão (tabIndex -1).
      (document.getElementById(`${id}-title`) ?? target)?.focus({ preventScroll: true });
    }, 50);
  };
  const pickService = (index: number) => {
    setServiceIdx(index);
    setServiceChosen(true);
    setServiceOpen(false);
    setAgainMissing((prev) => (prev?.staff !== undefined ? { staff: prev.staff } : null));
    // O horário fica se continuar livre; senão a grade avisa (ver slotGone).
    setBookingError(null);
    setBookingUncertain(false);
    if (!staffChosen && !directLinkActive) setStaffOpen(true);
  };
  const pickStaff = (index: number) => {
    const member = staff[index];
    staffPickedByUser.current = true;
    setAnyAvailable(false);
    setStaffIdx(index);
    setStaffChosen(true);
    setStaffOpen(false);
    setAgainMissing((prev) => (prev?.service !== undefined ? { service: prev.service } : null));
    setBookingError(null);
    setBookingUncertain(false);
    if (member && !demo && shopId && userId && staffAssignmentMode === "favorite_then_pick") {
      void supabase.rpc("set_favorite_staff", { p_shop_id: shopId, p_staff_id: member.id });
      setFavoriteStaffId(member.id);
      setFavoriteSaved(member.display_name);
    }
  };
  const pickAnyStaff = () => {
    setAnyAvailable(true);
    setStaffChosen(true);
    setStaffOpen(false);
    setAgainMissing((prev) => (prev?.service !== undefined ? { service: prev.service } : null));
    setBookingError(null);
    setBookingUncertain(false);
  };
  const pickDay = (key: string) => {
    setSelectedDay(key);
    setSelectedSlotAt(null);
    setBookingError(null);
    setBookingUncertain(false);
  };
  const refreshTimes = () => {
    setBookingError(null);
    setSlotsFor("");
    setSelectedSlotAt(null);
    setAvailabilityVersion((v) => v + 1);
  };
  const slotLabel = (date: Date | string) => shortSlot(date, shopTimeZone);
  const selectedEnd =
    selectedSlot && bookingService
      ? new Date(selectedSlot.getTime() + bookingService.duration_minutes * 60_000)
      : null;
  // O horário escolhido deixou de estar livre com a nova combinação (serviço/profissional).
  const slotGone =
    Boolean(selectedSlotAt) &&
    !selectedSlot &&
    slotsFor === selectionKey &&
    !slotsLoading &&
    !bookingBusy;
  const gridState: "needChoice" | "loading" | "error" | "empty" | "ready" =
    !selectedService || (!selectedStaff && !anyAvailable)
      ? "needChoice"
      : slotsError
        ? "error"
        : slotsFor !== selectionKey
          ? "loading"
          : availableSlots.length === 0
            ? "empty"
            : "ready";
  // Vagas da lista de espera que podem abrir neste dia (aparecem na grade como "pode vagar").
  const mayOpenWaits = waiting.waits.filter(
    (w) =>
      !w.has_interest &&
      w.staff_id === selectedStaffId &&
      bookingService &&
      bookingService.duration_minutes * 60000 <= Date.parse(w.ends_at) - Date.parse(w.starts_at) &&
      shopDateKey(new Date(w.starts_at), shopTimeZone) === selectedDay &&
      Date.parse(w.hold_until) > +waiting.now,
  );
  const selectedDayIndex = bookingDayKeys.indexOf(selectedDay);
  const nextOpenDay = bookingDayKeys
    .slice(selectedDayIndex + 1)
    .find((key) => !closedWeekdays?.has(weekdayForDateKey(key)));
  // "amanhã" ou "qua 07" (botão "Ver …" do dia sem horários).
  const dayChipLabel = (key: string) => {
    if (key === bookingDayKeys[1]) return t("booking.tomorrow").toLocaleLowerCase(intlLocale);
    const noon = shopDateTime(key, "12:00:00", shopTimeZone);
    const weekday = formatShopDate(noon, shopTimeZone, { weekday: "short" }).replace(".", "");
    return `${weekday} ${formatShopDate(noon, shopTimeZone, { day: "2-digit" })}`;
  };
  // Um passo está feito quando tem valor e foi escolhido ou recolhido (o sugerido recolhe ao
  // tocar num horário). O primeiro que falta é o único "agora"; os seguintes ficam "a fazer".
  const staffHasValue = Boolean(selectedStaff) || anyAvailable;
  const stepsDone = [
    Boolean(selectedService) && (serviceChosen || !serviceOpen),
    staffHasValue && (staffChosen || !staffOpen || directLinkActive),
    Boolean(selectedSlot),
    false,
  ];
  const firstOpenStep = stepsDone.indexOf(false);
  const stepStateAt = (index: number): StepState =>
    stepsDone[index] ? "done" : index === firstOpenStep ? "current" : "upcoming";
  const serviceStep = stepStateAt(0);
  const staffStep = stepStateAt(1);
  const whenStep = stepStateAt(2);
  const reviewStep = stepStateAt(3);
  const repeatChoice: RepeatChoice = !repeatEnabled
    ? "once"
    : repeatKind === "weekday" || repeatInterval === 7
      ? "weekday"
      : (String(repeatInterval) as RepeatChoice);
  const canRepeat = !rescheduleId && !directLinkActive;
  const chosenSlot = selectedSlot ? slotLabel(selectedSlot) : null;
  const bookingButton = !selectedSlot
    ? { label: t("booking.chooseTime"), icon: Clock3 }
    : bookingBusy
      ? { label: t("booking.booking"), icon: CalendarCheckIcon }
      : rescheduleId
        ? {
            label: t("booking.moveTo", { day: chosenSlot!.day, time: chosenSlot!.time }),
            icon: CalendarClock,
          }
        : repeatEnabled && canRepeat
          ? {
              label: t("booking.confirmRepeat", { day: chosenSlot!.day, time: chosenSlot!.time }),
              icon: Repeat2,
            }
          : {
              label: t("booking.confirmAt", { day: chosenSlot!.day, time: chosenSlot!.time }),
              icon: CalendarCheckIcon,
            };
  const summaryPills: SummaryPill[] = [
    {
      key: "service",
      icon: Scissors,
      label: selectedService?.name ?? t("booking.service"),
      pending: !selectedService,
      onClick: () => {
        setServiceOpen(true);
        scrollToStep("booking-step-service");
      },
    },
    {
      key: "staff",
      icon: User,
      label: anyAvailable
        ? t("booking.anyStaff")
        : (selectedStaff?.display_name ?? t("booking.staff")),
      pending: !staffHasValue,
      media:
        selectedStaff && !anyAvailable ? (
          <BookingAvatar
            name={selectedStaff.display_name}
            src={selectedStaff.avatar_url}
            seed={selectedStaff.id}
            size="xs"
          />
        ) : undefined,
      onClick: directLinkActive
        ? undefined
        : () => {
            setStaffOpen(true);
            scrollToStep("booking-step-staff");
          },
    },
    {
      // Dia e horário são a mesma decisão ("quando"): uma pílula só.
      key: "when",
      lead: true,
      icon: selectedSlot ? CalendarDaysIcon : Clock3,
      label: `${slotLabel(shopDateTime(selectedDay, "12:00:00", shopTimeZone)).day} · ${
        selectedSlot && selectedEnd
          ? `${chosenSlot!.time}–${slotLabel(selectedEnd).time}`
          : t("booking.pendingTime")
      }`,
      pending: !selectedSlot,
      onClick: () => scrollToStep("booking-step-when"),
    },
  ];
  const reservationCounts = {
    upcoming: filterReservations(shopAppointments, "upcoming", reservationNowMs()).length,
    history: filterReservations(shopAppointments, "history", reservationNowMs()).length,
    completed: filterReservations(shopAppointments, "completed", reservationNowMs()).length,
    cancelled: filterReservations(shopAppointments, "cancelled", reservationNowMs()).length,
  };
  function reservationNowMs() {
    return demo?.now.getTime() ?? Date.now();
  }
  const seriesUpcoming = (seriesId: string) =>
    shopAppointments
      .filter(
        (row) =>
          row.series_id === seriesId &&
          filterReservations([row], "upcoming", reservationNowMs()).length > 0,
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  /**
   * Etiqueta da repetição com a frequência ("Repete toda semana", "Repete a cada 15 dias"). A regra
   * da série não vem para o cliente: usa o menor intervalo entre as datas já carregadas (um dia
   * ocupado pulado não engana). Com uma data só, fica o "Repete" genérico.
   */
  const seriesLabel = (seriesId: string) => {
    const keys = [
      ...new Set(
        shopAppointments
          .filter((row) => row.series_id === seriesId)
          .map((row) => shopDateKey(new Date(row.starts_at), shopTimeZone)),
      ),
    ].sort();
    let step = 0;
    for (let i = 1; i < keys.length; i += 1) {
      const diff = Math.round((Date.parse(keys[i]) - Date.parse(keys[i - 1])) / 86_400_000);
      if (diff > 0 && (step === 0 || diff < step)) step = diff;
    }
    if (step === 7) return t("booking.repeatCreatedWeekly");
    if (step > 0) return t("booking.repeatCreatedDays", { days: step });
    return t("bookings.recurring");
  };
  const stopSeriesDates = stopSeriesTarget
    ? seriesUpcoming(stopSeriesTarget).map((row) => row.starts_at)
    : [];
  /** Em Próximos, cada repetição vira um só ticket (a data em foco) com as outras em pílulas. */
  const displayedReservations = (rows: CustomerAppointment[]) =>
    reservationFilter !== "upcoming"
      ? rows
      : rows.filter((row) => {
          if (!row.series_id) return true;
          const dates = seriesUpcoming(row.series_id);
          const shown = dates.find((item) => item.id === seriesFocus[row.series_id!]) ?? dates[0];
          return !shown || shown.id === row.id;
        });
  const renderReservation = (row: CustomerAppointment) => {
    const upcomingView = reservationFilter === "upcoming";
    const canManage =
      row.status === "reschedule_requested" ||
      row.status === "pending" ||
      (row.status === "confirmed" && new Date(row.starts_at).getTime() > reservationNowMs());
    const series = upcomingView && row.series_id ? seriesUpcoming(row.series_id) : [];
    const cancelled = row.status === "cancelled" ? cancellationDetails[row.id] : undefined;
    const seriesId = row.series_id;
    return (
      <AppointmentTicket
        key={row.id}
        id={`reserva-${row.id}`}
        data={ticketFor(row)}
        now={bookingNow}
        timeZone={shopTimeZone}
        status={
          <ReservationStatusBadge
            status={row.status}
            startsAt={row.starts_at}
            now={bookingNow}
            size="sm"
            actionable={canManage}
          />
        }
        struck={row.status === "cancelled"}
        showUntil={upcomingView}
        repeatLabel={seriesId ? seriesLabel(seriesId) : undefined}
        className={
          row.status === "reschedule_requested"
            ? "tone-warning border-l-4 border-l-[color:var(--tone-line)]"
            : undefined
        }
        highlight={
          focusedReservation === row.id ? (
            <span className="absolute -top-3 left-4 z-10">
              <BookingBadge
                tone="highlight"
                icon={focusedFrom === "home" ? CalendarClock : BellRing}
                label={focusedFrom === "home" ? t("home.nextTitle") : t("bookings.fromNotice")}
                size="sm"
              />
            </span>
          ) : undefined
        }
        extra={
          <>
            {row.status === "completed" && showEarned && earnedByAppointment[row.id] ? (
              <p className="flex">
                <BookingBadge
                  tone="success"
                  icon={Gem}
                  size="sm"
                  label={`+${earnedByAppointment[row.id]} ${t("points.short")}`}
                />
              </p>
            ) : null}
            {row.status === "reschedule_requested" && (
              <Notice
                tone="warning"
                icon={CalendarClock}
                role="none"
                title={t("home.attention.rescheduleTitle")}
              >
                {t("bookings.shopRemovedConfirmation")}
              </Notice>
            )}
            {cancelled && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <XCircle className="size-3.5 shrink-0" aria-hidden />
                {cancelled.source === "customer"
                  ? t("bookings.cancelledByCustomer")
                  : t("bookings.cancelledByShop")}
                {` · ${cancellationReasonLabel(cancelled.reason)}`}
              </p>
            )}
            {seriesId && series.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("bookings.seriesDates")}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {series.map((item) => {
                    const active = item.id === row.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setSeriesFocus((current) => ({ ...current, [seriesId]: item.id }))
                          }
                          className={`min-h-11 rounded-xl border px-3 text-xs font-semibold tabular-nums ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {slotLabel(item.starts_at).day}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        }
        actions={
          canManage ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={appointmentBusy !== null}
                onClick={() => beginReschedule(row)}
                className="action-button action-edit min-h-11 w-full"
              >
                <CalendarClock aria-hidden />
                {t("bookings.reschedule")}
              </button>
              <button
                type="button"
                disabled={appointmentBusy !== null}
                onClick={() => setCancelTarget(row)}
                className="action-button action-danger min-h-11 w-full"
              >
                <X aria-hidden />
                {appointmentBusy === row.id ? t("bookings.cancelling") : t("bookings.cancel")}
              </button>
              {seriesId ? (
                <button
                  type="button"
                  disabled={appointmentBusy !== null}
                  onClick={() => setStopSeriesTarget(seriesId)}
                  className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"
                >
                  <Repeat2 className="size-4 text-gold" aria-hidden />
                  {t("bookings.stopRepeat")}
                </button>
              ) : null}
            </div>
          ) : row.status === "completed" && row.service && row.staff ? (
            <button
              type="button"
              onClick={() => bookAgain(row)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40"
            >
              <RotateCcw className="size-4 text-gold" aria-hidden />
              {t("bookings.bookAgain")}
            </button>
          ) : null
        }
      />
    );
  };
  const [notifications, setNotifications] = useState<SessionNotice[]>([]);
  useEffect(() => {
    if (tab !== "notifications") return;
    setNotifications((current) =>
      current.some((n) => !n.read) ? current.map((n) => ({ ...n, read: true })) : current,
    );
  }, [tab, notifications.length]);

  const loyaltyOn = loyaltyProgram.enabled;
  const pendingRedemptions = usePendingRedemptions(
    demo ? DEMO_CUSTOMER_ID : userId,
    shopId,
    pointsVersion,
  );
  // Só lê o extrato (a mesma tabela de "Meus pontos") quando a pessoa olha os Anteriores.
  const showEarned = loyaltyOn && tab === "reservas" && reservationFilter !== "upcoming";
  // A demonstração ganha objeto novo a cada tique: a lista de premiados vira uma chave estável.
  const demoAwardedKey = demo ? demo.awarded.join("|") : null;
  useEffect(() => {
    if (!showEarned) return;
    if (demoAwardedKey !== null) {
      // Mesmo valor que o extrato da demonstração mostra por atendimento concluído.
      const ids = demoAwardedKey ? demoAwardedKey.split("|") : [];
      setEarnedByAppointment(Object.fromEntries(ids.map((id) => [id, 50])));
      return;
    }
    if (!userId || !shopId) return;
    let cancelled = false;
    void supabase
      .from("loyalty_ledger")
      .select("appointment_id, delta")
      .eq("user_id", userId)
      .eq("barbershop_id", shopId)
      .not("appointment_id", "is", null)
      .gt("delta", 0)
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const earned: Record<string, number> = {};
        for (const row of data) {
          if (row.appointment_id)
            earned[row.appointment_id] = (earned[row.appointment_id] ?? 0) + row.delta;
        }
        setEarnedByAppointment(earned);
      });
    return () => {
      cancelled = true;
    };
  }, [showEarned, demoAwardedKey, userId, shopId, pointsVersion, appointmentVersion]);

  // O aviso de remarcação impossível não é uma confirmação: sem o check verde.
  const rescheduleBlockedNotice = appointmentsNotice === t("fix.cliente-app.rescheduleUnavailable");
  const reservationNow = demo?.now.getTime() ?? Date.now();
  const visibleReservations = filterReservations(
    shopAppointments,
    reservationFilter,
    reservationNow,
  );
  const upcomingAppointments = shopAppointments
    .filter(
      (row) =>
        (row.status === "pending" || row.status === "confirmed") &&
        new Date(row.starts_at).getTime() > (demo?.now.getTime() ?? Date.now()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextAppointment = upcomingAppointments[0];
  const appointmentOwnerKey = demo ? `demo:${demo.shop.id}:${DEMO_CUSTOMER_ID}` : userId;

  // Início: o que pede ação do cliente (mudança pedida pela barbearia e vaga liberada na espera).
  const homeNow = demo?.now ?? new Date();
  const rescheduleRequests = shopAppointments
    .filter(
      (row) =>
        row.status === "reschedule_requested" && new Date(row.starts_at).getTime() > +homeNow,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const waitOffers = offersFor(waiting);
  const staffNameById = (id: string) =>
    staff.find((member) => member.id === id)?.display_name ?? t("wait.card.staffFallback");
  // Cancelamentos feitos pela barbearia em horários que ainda não passaram.
  const shopCancelled = shopAppointments.filter(
    (row) =>
      row.status === "cancelled" &&
      cancellationDetails[row.id]?.source === "shop" &&
      new Date(row.starts_at).getTime() > +homeNow,
  );
  // Cancelamento da barbearia ainda não visto: acende o sininho e aparece no Início.
  const [seenCancelled, setSeenCancelled] = useState<string[]>(() =>
    readSeenCancellations(appointmentOwnerKey),
  );
  useEffect(() => {
    setSeenCancelled(readSeenCancellations(appointmentOwnerKey));
  }, [appointmentOwnerKey]);
  const unseenCancelled = shopCancelled
    .filter((row) => !seenCancelled.includes(row.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const markCancelledSeen = () => {
    if (!unseenCancelled.length) return;
    const next = [...seenCancelled, ...unseenCancelled.map((row) => row.id)];
    setSeenCancelled(next);
    writeSeenCancellations(appointmentOwnerKey, next);
  };
  useEffect(() => {
    if (tab === "notifications") markCancelledSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- marca ao abrir Avisos ou ao chegar outro.
  }, [tab, unseenCancelled.length]);
  // Cancelamento da barbearia mais próximo: explica o "sem horário" do cartão.
  const nearestShopCancelled = [...shopCancelled].sort((a, b) =>
    a.starts_at.localeCompare(b.starts_at),
  )[0];
  const unreadNotifications =
    notifications.filter((n) => !n.read).length +
    rescheduleRequests.length +
    waitOffers.length +
    unseenCancelled.length;
  const lastCompleted = shopAppointments
    .filter((row) => row.status === "completed")
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const openBookings = () => {
    setReservationFilter("upcoming");
    setTab("reservas");
  };
  const openRewards = () => {
    setShowVipInfo(false);
    setTab("pontos");
    // Leva direto à lista de prêmios, abaixo do resumo.
    window.setTimeout(
      () => document.getElementById("rewards-title")?.scrollIntoView({ block: "start" }),
      120,
    );
  };
  /** "Repetir o último": abre Agendar com o serviço e o profissional do último atendimento. */
  const bookAgain = (row: CustomerAppointment) => {
    const serviceIndex = services.findIndex((item) => item.id === row.service_id);
    const staffIndex = staff.findIndex((item) => item.id === row.staff_id);
    // Só vem marcado (✓ e recolhido) o que ainda existe; o que saiu abre o passo com aviso.
    if (serviceIndex >= 0) setServiceIdx(serviceIndex);
    setServiceChosen(serviceIndex >= 0);
    setServiceOpen(serviceIndex < 0);
    if (staffIndex >= 0) {
      staffPickedByUser.current = true;
      setAnyAvailable(false);
      setStaffIdx(staffIndex);
    }
    if (!directLinkActive) {
      setStaffChosen(staffIndex >= 0);
      setStaffOpen(staffIndex < 0);
    }
    setAgainMissing(
      serviceIndex < 0 || (staffIndex < 0 && !directLinkActive)
        ? {
            service: serviceIndex < 0 ? (row.service?.name ?? null) : undefined,
            staff:
              staffIndex < 0 && !directLinkActive ? (row.staff?.display_name ?? null) : undefined,
          }
        : null,
    );
    setRescheduleId(null);
    setBookingError(null);
    setBookingDone(null);
    setSelectedSlotAt(null);
    setTab("agenda");
  };
  const appointmentContext: AppointmentContext = Object.fromEntries(
    shopAppointments.map((row) => [
      row.id,
      {
        service: row.service?.name ?? t("booking.serviceFallback"),
        staff: row.staff?.display_name ?? t("bookings.staffFallback"),
      },
    ]),
  );
  const attentionItems: AttentionItem[] = [
    ...waitOffers.map((wait) => ({
      id: `offer-${wait.id}`,
      tone: "warning" as const,
      icon: Timer,
      title: t("home.attention.offerTitle"),
      description: `${shortWhen(wait.starts_at, homeNow, shopTimeZone, intlLocale)} · ${staffNameById(wait.staff_id)}`,
      // O Countdown usa o relógio do aparelho; a vaga segue o da loja (ou da demonstração).
      aside: (
        <Countdown
          endsAt={Date.parse(wait.claim_until) + (Date.now() - +waiting.now)}
          label={t("home.attention.offerLeft")}
        />
      ),
      action: {
        label: waiting.busy ? t("home.attention.offerBusy") : t("home.attention.offerAction"),
        icon: waiting.busy ? SpinningLoader : Check,
        onClick: () =>
          void waiting.act(wait.id, "claim").then((ok) => {
            if (!ok) return;
            setAppointmentVersion((v) => v + 1);
            toast.success(t("home.attention.offerDone"));
          }),
      },
    })),
    ...rescheduleRequests.map((row) => ({
      id: `reschedule-${row.id}`,
      tone: "warning" as const,
      icon: CalendarClock,
      title: t("home.attention.rescheduleTitle"),
      description: (
        <>
          <span className="line-through decoration-muted-foreground/60">
            {shortWhen(row.starts_at, homeNow, shopTimeZone, intlLocale)}
          </span>
          {` · ${row.service?.name ?? t("booking.serviceFallback")} · ${
            row.staff?.display_name ?? t("bookings.staffFallback")
          }`}
        </>
      ),
      aside: (
        <button
          type="button"
          disabled={appointmentBusy !== null}
          onClick={() => setCancelTarget(row)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <XCircle className="size-4" aria-hidden />
          {t("home.attention.cancelAction")}
        </button>
      ),
      action: {
        label: t("home.attention.rescheduleAction"),
        icon: CalendarClock,
        onClick: () => beginReschedule(row),
      },
    })),
    ...unseenCancelled.map((row) => ({
      id: `cancelled-${row.id}`,
      tone: "danger" as const,
      icon: XCircle,
      title: t("notices.shopCancelled"),
      description: (
        <>
          <span className="line-through decoration-muted-foreground/60">
            {shortWhen(row.starts_at, homeNow, shopTimeZone, intlLocale)}
          </span>
          {` · ${row.service?.name ?? t("booking.serviceFallback")} · ${
            row.staff?.display_name ?? t("bookings.staffFallback")
          }`}
        </>
      ),
      // Abre Agendar com o mesmo serviço e profissional do horário cancelado.
      action: {
        label: t("notices.bookAnother"),
        icon: CalendarPlus,
        onClick: () => {
          markCancelledSeen();
          bookAgain(row);
        },
      },
    })),
  ];
  // Sem horário marcado, o item de atenção já conta a história (mudança pedida ou cancelamento
  // não visto): o cartão vazio com "Agendar horário" contradiria e convidaria a marcar em dobro.
  const attentionCoversVisit =
    !nextAppointment &&
    !appointmentsLoading &&
    !appointmentsError &&
    (rescheduleRequests.length > 0 || unseenCancelled.length > 0);

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
    // Primeiro contato (sem nenhum horário nesta barbearia e sem pontos, logo sem prêmio para
    // trocar ou retirar e sem "Repetir"): o app abre direto em Agendar. Quem já tem histórico
    // fica no Início, que mostra pontos, prêmios e o convite para agendar ou repetir.
    if (
      !shopAppointments.length &&
      points <= 0 &&
      lifetimePoints <= 0 &&
      !nextAppointment &&
      !rescheduleRequests.length &&
      !waitOffers.length &&
      !unseenCancelled.length &&
      tab === "dashboard"
    )
      setTab("agenda");
  }, [
    appointmentOwnerKey,
    appointmentsError,
    appointmentsLoadedFor,
    appointmentsLoading,
    shopAppointments.length,
    points,
    lifetimePoints,
    nextAppointment,
    rescheduleRequests.length,
    waitOffers.length,
    unseenCancelled.length,
    tab,
  ]);

  type NavItemProps = {
    id: string;
    icon: LucideIcon;
    label: string;
  };

  // Meus pontos é uma tela filha do Início (o caminho para ela sai do cartão de membro).
  // Avisos não pertence a nenhum item da barra: o destaque fica no sininho do cabeçalho.
  const navTabFor = (current: string) => (current === "pontos" ? "dashboard" : current);
  const NavItem = ({ id, icon: Icon, label }: NavItemProps) => {
    const pressed = navTabFor(tab) === id;
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
      ? [{ id: "esportes" as const, icon: Trophy, label: t("nav.sports") }]
      : []),
    { id: "perfil", icon: User, label: t("nav.account") },
  ];
  const activeNavIndex = navItems.findIndex((item) => item.id === navTabFor(tab));
  const brandStyle = brandVariables(
    shopSettings.primary_color,
    shopSettings.accent_color,
    shopSettings.font_family,
    shopSettings.custom_font_url,
    shopSettings.header_font_weight,
    shopSettings.header_font_style,
    shopSettings.corner_style,
  );

  return (
    <div
      className={`arena-workspace customer-workspace bg-background text-foreground font-sans selection:bg-primary/20 transition-colors duration-300 ${brandFontScopeClass(shopSettings.font_scope)} ${brandCornerClass(shopSettings.corner_style)} ${shopSettings.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={brandStyle as React.CSSProperties}
    >
      <BrandRootVariables vars={brandStyle} />
      <BrandFontFace url={shopSettings.custom_font_url} faces={shopSettings.custom_font_faces} />
      <TermsUpdateGate disabled={Boolean(demoShopId)} />
      <CancellationDialog
        open={!!cancelTarget}
        busy={appointmentBusy !== null}
        reason={cancelReason}
        summary={cancelTarget ? describeAppointment(cancelTarget) : null}
        details={
          cancelTarget ? (
            <AppointmentTicket
              variant="mini"
              data={ticketFor(cancelTarget)}
              now={bookingNow}
              timeZone={shopTimeZone}
            />
          ) : null
        }
        error={cancelTarget ? appointmentsError : null}
        onReason={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
          setAppointmentsError(null);
        }}
        onConfirm={() => void cancelAppointment()}
      />
      <StopRepeatDialog
        open={!!stopSeriesTarget}
        dates={stopSeriesDates}
        timeZone={shopTimeZone}
        errorText={demo ? t("bookings.repeatDemo") : t("bookings.repeatStopError")}
        onKeep={() => setStopSeriesTarget(null)}
        onConfirm={() => (stopSeriesTarget ? stopSeries(stopSeriesTarget) : undefined)}
      />
      <ShopJoinDialog
        open={joinOpen}
        shopName={joinShopName || t("cust.thisShop")}
        busy={joinBusy}
        error={joinError}
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
      <header className="brand-header sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/50 p-4 flex items-center justify-between gap-2 max-[359px]:gap-1 max-[359px]:px-3">
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
          {/* Container: as linhas do nome e o slogan dependem do espaço que sobra ao lado dos
              botões, não da largura da tela. Com pouco espaço (celular de 320 px), o nome
              diminui e usa duas linhas, para continuar legível ("onde estou"); só num espaço
              mínimo vira uma linha com reticências. */}
          <div className="@container flex min-w-0 flex-1 flex-col justify-center">
            <h1
              className={`brand-header-title break-normal hyphens-auto text-sm font-bold tracking-tight text-foreground leading-tight @max-[3.5rem]:text-xs @max-[3.5rem]:break-words @max-[2.25rem]:block @max-[2.25rem]:text-ellipsis @max-[2.25rem]:whitespace-nowrap ${
                shopSettings.tagline ? "line-clamp-2 @min-[5.5rem]:line-clamp-1" : "line-clamp-2"
              }`}
            >
              {shopSettings.display_name?.trim() || shopName || t("cust.shopFallback")}
            </h1>
            <p className="mt-1 hidden truncate text-[11px] font-medium text-primary @min-[5.5rem]:block">
              {shopSettings.tagline}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 max-[359px]:gap-0.5 sm:gap-2">
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
            <span aria-hidden className="absolute -right-1 -top-1">
              <CountBadge
                count={unreadNotifications}
                tone="danger"
                max={9}
                className="ring-2 ring-[color:var(--app-header-surface)]"
              />
            </span>
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
              aria-current={tab === "perfil" ? "page" : undefined}
              onClick={() => setTab("perfil")}
              className={`app-icon-button ${tab === "perfil" ? "app-nav-current" : ""}`}
            >
              <User size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <main
        className={`p-4 max-w-xl mx-auto ${tab === "dashboard" || tab === "agenda" || tab === "perfil" || tab === "esportes" ? "customer-main-wide" : ""}`}
      >
        <div key={tab} className="mb-panel">
          {tab === "perfil" && (
            <CustomerProfile onSaved={setCustomerName} shops={myShops} currentShopId={shopId}>
              <CustomerRhythm
                shopId={shopId}
                visits={shopAppointments
                  .filter((row) => row.status === "completed")
                  .map((row) => row.starts_at)}
                upcoming={nextAppointment?.starts_at ?? null}
                timeZone={shopTimeZone}
                now={homeNow}
                onOpenBookings={openBookings}
                onBook={(dayKey) => {
                  if (dayKey && bookingDayKeys.includes(dayKey)) setSelectedDay(dayKey);
                  if (lastCompleted) bookAgain(lastCompleted);
                  else setTab("agenda");
                }}
              />
            </CustomerProfile>
          )}
          {tab === "pontos" &&
            (loyaltyOn ? (
              <PointsHistory
                userId={userId}
                shopId={shopId}
                refreshKey={pointsVersion}
                appointments={appointmentContext}
                now={homeNow}
                timeZone={shopTimeZone}
                onBack={() => setTab("dashboard")}
                summary={
                  <MemberCard
                    variant="summary"
                    name={customerName || t("cust.customerFallback")}
                    program={loyaltyProgram}
                    points={points}
                    lifetimePoints={lifetimePoints}
                    onOpenClub={() => setShowVipInfo(true)}
                  />
                }
              >
                <CustomerRewards
                  program={loyaltyProgram}
                  points={points}
                  pending={pendingRedemptions}
                  now={homeNow}
                  onChanged={() => setPointsVersion((value) => value + 1)}
                />
              </PointsHistory>
            ) : (
              <div className="space-y-5">
                <CustomerPageHeader
                  icon={ReceiptText}
                  title={t("points.title")}
                  onBack={() => setTab("dashboard")}
                />
                <EmptyState
                  tone="gift"
                  title={t("rewards.clubOffTitle")}
                  description={t("rewards.clubOffText")}
                />
              </div>
            ))}
          {tab === "dashboard" && (
            // Início em faixas: (1) o que pede ação, (2) o próximo horário, (3) o cartão de
            // membro. No computador, duas colunas: o que acontece à esquerda, pontos à direita.
            <div className="customer-home relative z-10 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6">
              <div className="mb-stagger min-w-0 space-y-4">
                <ProfileSetup disabled={Boolean(demoShopId)} onNameSaved={setCustomerName} />
                <AttentionList
                  title={t("home.attention.title")}
                  items={attentionItems}
                  headingLevel="h2"
                />
                {waiting.error && waitOffers.length > 0 && (
                  <Notice tone="danger" title={waiting.error} />
                )}
                {!attentionCoversVisit && (
                  <NextVisitCard
                    cancelledAt={!nextAppointment ? nearestShopCancelled?.starts_at : undefined}
                    loading={appointmentsLoading}
                    error={appointmentsError}
                    onRetry={() => setAppointmentVersion((version) => version + 1)}
                    now={homeNow}
                    timeZone={shopTimeZone}
                    visit={
                      nextAppointment
                        ? {
                            startsAt: nextAppointment.starts_at,
                            status: nextAppointment.status,
                            serviceName:
                              nextAppointment.service?.name ?? t("booking.serviceFallback"),
                            serviceIcon: nextAppointment.service?.icon,
                            staffName:
                              nextAppointment.staff?.display_name ?? t("bookings.staffFallback"),
                            staffId: nextAppointment.staff_id,
                            staffPhoto: staff.find(
                              (member) => member.id === nextAppointment.staff_id,
                            )?.avatar_url,
                          }
                        : null
                    }
                    moreCount={Math.max(0, upcomingAppointments.length - 1)}
                    onDetails={
                      nextAppointment
                        ? () => revealReservation(nextAppointment, "home")
                        : openBookings
                    }
                    onMore={openBookings}
                    onReschedule={
                      nextAppointment ? () => beginReschedule(nextAppointment) : undefined
                    }
                    onBook={() => setTab("agenda")}
                    repeat={
                      lastCompleted && lastCompleted.service && lastCompleted.staff
                        ? {
                            service: lastCompleted.service.name,
                            staff: lastCompleted.staff.display_name,
                            onClick: () => bookAgain(lastCompleted),
                          }
                        : null
                    }
                  />
                )}
                <SurveyCard
                  enabled={shopSettings.survey_program_enabled}
                  appointments={appointmentContext}
                  timeZone={shopTimeZone}
                />
              </div>
              {loyaltyOn && (
                <MemberCard
                  className="lg:sticky lg:top-4"
                  name={customerName || t("cust.customerFallback")}
                  program={loyaltyProgram}
                  points={points}
                  lifetimePoints={lifetimePoints}
                  pending={pendingRedemptions}
                  onOpenRewards={openRewards}
                  onOpenHistory={() => setTab("pontos")}
                  onOpenClub={() => setShowVipInfo(true)}
                />
              )}
            </div>
          )}

          {tab === "agenda" && (
            // Agendar em passos numa página só: 1 Serviço → 2 Profissional → 3 Dia e horário →
            // 4 Conferir. O resumo com o botão fica sempre à vista (fixo no celular, coluna da
            // direita no computador).
            <div className="space-y-5">
              <div className="app-section-title">
                {rescheduleId ? <CalendarClock /> : <Calendar />}
                <h2>{rescheduleId ? t("booking.titleReschedule") : t("booking.title")}</h2>
              </div>
              {bookingDone ? (
                <div className="mx-auto max-w-xl">
                  <BookingDone
                    title={
                      bookingDone.rescheduled ? t("booking.rescheduled") : t("booking.reserved")
                    }
                    data={bookingDone.ticket}
                    previous={bookingDone.previous}
                    repeatLabel={bookingDone.repeatLabel}
                    now={bookingNow}
                    timeZone={shopTimeZone}
                    onSeeBookings={() => {
                      setReservationFilter("upcoming");
                      setTab("reservas");
                    }}
                    onAnother={() => {
                      setBookingDone(null);
                      setBookingError(null);
                      setAgainMissing(null);
                      setServiceOpen(true);
                      setStaffOpen(!directLinkActive);
                      scrollToStep("booking-step-service");
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
                  <div className="min-w-0 space-y-4">
                    {rescheduleRow && (
                      <RescheduleFromTo
                        original={ticketFor(rescheduleRow)}
                        next={chosenSlot}
                        now={bookingNow}
                        timeZone={shopTimeZone}
                        disabled={bookingBusy}
                        onBack={() => {
                          setRescheduleId(null);
                          setSelectedSlotAt(null);
                          setBookingError(null);
                          setBookingUncertain(false);
                        }}
                      />
                    )}
                    {catalogLoading && (
                      <BookingLoading
                        variant="cards"
                        count={2}
                        label={t("booking.loadingCatalog")}
                      />
                    )}
                    {catalogError && (
                      <Notice
                        tone="danger"
                        title={catalogError}
                        action={{
                          label: t("visual.retry"),
                          icon: RotateCcw,
                          onClick: () => setCatalogRevision((v) => v + 1),
                        }}
                      />
                    )}

                    <StepCard
                      id="booking-step-service"
                      index={1}
                      title={t("booking.service")}
                      state={serviceStep}
                      aside={
                        !serviceOpen && selectedService ? (
                          <ChangeButton
                            label={`${t("booking.change")} · ${t("booking.service")}`}
                            disabled={bookingBusy}
                            onClick={() => setServiceOpen(true)}
                          />
                        ) : services.length > 1 ? (
                          <CatalogViewToggle
                            viewMode={serviceView}
                            onViewMode={changeServiceView}
                            className="booking-view-toggle"
                          />
                        ) : null
                      }
                    >
                      {!catalogLoading &&
                        !catalogError &&
                        services.length === 0 &&
                        (joinDeclined && !shopId ? (
                          // Recusou entrar na barbearia do link e não tem outra: mostra como entrar.
                          <EmptyState
                            variant="plain"
                            tone="store"
                            title={t("conta.join.notYet", {
                              shop: joinDeclined.name || t("cust.thisShop"),
                            })}
                            action={
                              <button
                                type="button"
                                onClick={() => {
                                  setJoinShopRef(joinDeclined.ref);
                                  setJoinShopName(joinDeclined.name);
                                  setJoinError(null);
                                  setJoinOpen(true);
                                }}
                                className="action-button action-confirm"
                              >
                                <LogIn aria-hidden />
                                {t("conta.join.enter")}
                              </button>
                            }
                          />
                        ) : (
                          <EmptyState
                            variant="plain"
                            tone="scissors"
                            title={t("booking.noServices")}
                          />
                        ))}
                      {againMissing?.service !== undefined && (
                        <Notice
                          tone="warning"
                          role="none"
                          title={
                            againMissing.service
                              ? t("booking.againServiceGone", { name: againMissing.service })
                              : t("booking.againServiceGoneAny")
                          }
                        />
                      )}
                      {!serviceOpen && selectedService && bookingService ? (
                        <ServiceSummary
                          service={selectedService}
                          terms={bookingService}
                          formatMoney={formatMoney}
                          suggested={!serviceChosen}
                        />
                      ) : (
                        <ServiceChoices
                          services={services}
                          selectedIndex={serviceIdx}
                          view={serviceView}
                          termsFor={(service) =>
                            (pickedStaff && termsFor(serviceTerms, pickedStaff.id, service)) ||
                            service
                          }
                          formatMoney={formatMoney}
                          suggested={!serviceChosen}
                          disabled={bookingBusy}
                          onPick={pickService}
                        />
                      )}
                    </StepCard>

                    <StepCard
                      id="booking-step-staff"
                      index={2}
                      title={t("booking.staff")}
                      state={staffStep}
                      aside={
                        directLinkActive ? null : !staffOpen && staffHasValue ? (
                          <ChangeButton
                            label={t("booking.changeStaff")}
                            disabled={bookingBusy}
                            onClick={() => setStaffOpen(true)}
                          />
                        ) : staffChoices.length > 1 ? (
                          <CatalogViewToggle
                            viewMode={staffView}
                            onViewMode={changeStaffView}
                            className="booking-view-toggle"
                          />
                        ) : null
                      }
                    >
                      {!catalogLoading && !catalogError && staffChoices.length === 0 && (
                        <EmptyState variant="plain" tone="people" title={t("booking.noStaff")} />
                      )}
                      {staffNotForService && pickedStaff && !directLinkActive && (
                        <Notice
                          tone="warning"
                          role="none"
                          title={t("booking.staffNotForService", {
                            name: pickedStaff.display_name,
                          })}
                        />
                      )}
                      {againMissing?.staff !== undefined && (
                        <Notice
                          tone="warning"
                          role="none"
                          title={
                            againMissing.staff
                              ? t("booking.againStaffGone", { name: againMissing.staff })
                              : t("booking.againStaffGoneAny")
                          }
                        />
                      )}
                      {favoriteSaved && (
                        <Notice
                          tone="success"
                          icon={StarIcon}
                          title={t("booking.favoriteSaved", { name: favoriteSaved })}
                        />
                      )}
                      {directLinkActive && selectedStaff ? (
                        <StaffSummary member={selectedStaff} locked />
                      ) : !staffOpen && staffHasValue ? (
                        <StaffSummary
                          member={anyAvailable ? null : selectedStaff}
                          any={anyAvailable}
                          favorite={Boolean(selectedStaff && selectedStaff.id === favoriteStaffId)}
                          suggested={!staffChosen}
                        />
                      ) : (
                        <StaffChoices
                          choices={staffChoices.map(({ m, i }) => ({ member: m, index: i }))}
                          selectedIndex={anyAvailable ? null : staffIdx}
                          anyOption={
                            staffAssignmentMode === "random_available" ||
                            staffAssignmentMode === "favorite_then_pick"
                          }
                          anyActive={anyAvailable}
                          favoriteId={favoriteStaffId}
                          favoriteName={
                            staffAssignmentMode === "favorite_then_pick"
                              ? staff.find((member) => member.id === favoriteStaffId)?.display_name
                              : null
                          }
                          view={staffView}
                          suggested={!staffChosen}
                          disabled={bookingBusy}
                          onPick={pickStaff}
                          onAny={pickAnyStaff}
                        />
                      )}
                    </StepCard>

                    <StepCard
                      id="booking-step-when"
                      index={3}
                      title={t("booking.step.when")}
                      state={whenStep}
                    >
                      <DayStrip
                        keys={bookingDayKeys}
                        selected={selectedDay}
                        timeZone={shopTimeZone}
                        closedWeekdays={closedWeekdays}
                        disabled={bookingBusy}
                        onSelect={pickDay}
                        calendar={
                          <DatePicker
                            compact
                            disabled={bookingBusy}
                            label={t("booking.pickCalendar")}
                            displayValue={t("booking.moreDates")}
                            value={selectedDay}
                            onChange={pickDay}
                            min={dateFromLocalKey(bookingDayKeys[0])}
                            max={dateFromLocalKey(bookingDayKeys[bookingDayKeys.length - 1])}
                          />
                        }
                      />
                      <TimeGrid
                        state={gridState}
                        error={slotsError}
                        onRetry={() => setAvailabilityVersion((v) => v + 1)}
                        slots={availableSlots}
                        selectedIso={selectedSlot ? selectedSlotAt : null}
                        onSelect={(iso) => {
                          setSelectedSlotAt(iso);
                          setBookingError(null);
                          setBookingUncertain(false);
                          // Escolher o horário aceita o serviço e o profissional sugeridos: os
                          // dois passos recolhem com ✓ (o resumo mantém o selo "Sugerido").
                          if (selectedService) setServiceOpen(false);
                          if (staffHasValue) setStaffOpen(false);
                        }}
                        timeZone={shopTimeZone}
                        currentIso={
                          rescheduleRow &&
                          shopDateKey(new Date(rescheduleRow.starts_at), shopTimeZone) ===
                            selectedDay
                            ? new Date(rescheduleRow.starts_at).toISOString()
                            : null
                        }
                        mayOpen={mayOpenWaits.map((wait) => ({
                          iso: new Date(wait.starts_at).toISOString(),
                          onClick: () => scrollToStep(`wait-${wait.id}`),
                        }))}
                        disabled={bookingBusy}
                        empty={{
                          closed: closedWeekdays?.has(weekdayForDateKey(selectedDay)) ?? false,
                          nextDay: nextOpenDay
                            ? {
                                label: dayChipLabel(nextOpenDay),
                                onClick: () => pickDay(nextOpenDay),
                              }
                            : null,
                          onChangeStaff:
                            !anyAvailable && !directLinkActive && staffChoices.length > 1
                              ? () => {
                                  setStaffOpen(true);
                                  scrollToStep("booking-step-staff");
                                }
                              : null,
                        }}
                        notice={
                          slotGone && selectedSlotAt ? (
                            <Notice
                              tone="warning"
                              title={
                                selectedStaff && !anyAvailable
                                  ? t("booking.slotGone", {
                                      time: slotLabel(selectedSlotAt).time,
                                      name: selectedStaff.display_name,
                                    })
                                  : t("booking.slotGoneAny", {
                                      time: slotLabel(selectedSlotAt).time,
                                    })
                              }
                            />
                          ) : null
                        }
                      />
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
                    </StepCard>

                    <StepCard
                      id="booking-step-review"
                      index={4}
                      title={
                        rescheduleId ? t("booking.step.reviewReschedule") : t("booking.step.review")
                      }
                      state={reviewStep}
                    >
                      {selectedSlot && bookingService ? (
                        <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-3">
                          <AppointmentTicket
                            variant="mini"
                            data={{
                              startsAt: selectedSlot.toISOString(),
                              endsAt: selectedEnd?.toISOString(),
                              serviceName: bookingService.name,
                              serviceIcon: bookingService.icon,
                              staffName: anyAvailable
                                ? t("booking.anyStaff")
                                : (selectedStaff?.display_name ?? t("booking.staff")),
                              staffId: selectedStaff?.id,
                              staffPhoto: anyAvailable ? null : selectedStaff?.avatar_url,
                              anyStaff: anyAvailable,
                            }}
                            now={bookingNow}
                            timeZone={shopTimeZone}
                          />
                          <p className="flex items-center justify-between border-t border-border pt-2 text-sm">
                            <span className="text-muted-foreground">{t("booking.total")}</span>
                            <span className="font-bold tabular-nums">
                              {formatMoney(reviewPriceCents ?? bookingService.price_cents)}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock3 className="size-4 shrink-0" aria-hidden />
                          {t("booking.chooseTime")}
                        </p>
                      )}
                      {selectedSlot && canRepeat && chosenSlot && (
                        <RepeatPicker
                          value={repeatChoice}
                          onChange={(value) => {
                            if (value === "once") {
                              setRepeatEnabled(false);
                              return;
                            }
                            setRepeatEnabled(true);
                            if (value === "weekday") setRepeatKind("weekday");
                            else {
                              setRepeatKind("interval_days");
                              setRepeatInterval(value === "15" ? 15 : 21);
                            }
                          }}
                          startKey={selectedDay}
                          horizonDays={shopSettings.booking_horizon_days}
                          timeLabel={chosenSlot.time}
                          timeZone={shopTimeZone}
                          disabled={bookingBusy}
                        />
                      )}
                      {shopSettings.booking_instructions && (
                        <p className="flex items-start gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                          <StoreIcon className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                          <span className="min-w-0">
                            <span className="sr-only">{t("booking.shopNoteAria")}: </span>
                            {shopSettings.booking_instructions}
                          </span>
                        </p>
                      )}
                    </StepCard>
                  </div>
                  <BookingSummaryBar
                    pills={summaryPills}
                    buttonLabel={bookingButton.label}
                    buttonIcon={bookingButton.icon}
                    ready={Boolean(selectedSlot && selectedService && staffHasValue)}
                    busy={bookingBusy}
                    price={
                      bookingService
                        ? formatMoney(reviewPriceCents ?? bookingService.price_cents)
                        : null
                    }
                    onConfirm={() => void confirmBooking()}
                  >
                    {bookingError && (
                      <Notice
                        tone="danger"
                        title={bookingError}
                        action={{
                          label: t("booking.refreshTimes"),
                          icon: RefreshCw,
                          onClick: refreshTimes,
                        }}
                      />
                    )}
                    {bookingUncertain && (
                      <Notice
                        tone="pending"
                        title={t("booking.uncertainTitle")}
                        action={{
                          label: t("booking.track"),
                          icon: CalendarCheckIcon,
                          onClick: () => {
                            setReservationFilter("upcoming");
                            setTab("reservas");
                          },
                        }}
                      >
                        {t("booking.uncertainHint")}
                      </Notice>
                    )}
                  </BookingSummaryBar>
                </div>
              )}
            </div>
          )}

          {tab === "reservas" && (
            // Reservas: título → o que pede ação (Precisa de você, lista de espera) → filtros →
            // tickets agrupados por quando acontecem.
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="app-section-title min-w-0 flex-1">
                  <Clock3 />
                  <h2>{t("bookings.title")}</h2>
                </div>
                {!demo && (
                  <div className="flex items-center gap-2">
                    {appointmentsUpdatedAt && (
                      <span className="text-xs text-muted-foreground" aria-live="polite">
                        {appointmentsRefreshing
                          ? t("bookings.checking")
                          : t("bookings.updatedAt", {
                              time: new Date(appointmentsUpdatedAt).toLocaleTimeString(intlLocale, {
                                hour: "2-digit",
                                minute: "2-digit",
                              }),
                            })}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={t("bookings.refresh")}
                      title={t("bookings.refresh")}
                      disabled={appointmentsRefreshing || !!appointmentBusy}
                      onClick={() => setAppointmentVersion((version) => version + 1)}
                      className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground transition hover:border-primary/40 disabled:opacity-60"
                    >
                      <RefreshCw
                        className={`size-5 ${appointmentsRefreshing ? "motion-safe:animate-spin" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                )}
              </div>
              <AttentionList
                title={t("home.attention.title")}
                items={attentionItems.filter((item) => !item.id.startsWith("offer-"))}
                headingLevel="h3"
              />
              <WaitingCards
                controller={waiting}
                mode="mine"
                staff={staff}
                timeZone={shopTimeZone}
                onChanged={() => setAppointmentVersion((v) => v + 1)}
              />
              <ReservationFilters
                value={reservationFilter}
                counts={reservationCounts}
                onChange={setReservationFilter}
              />
              {appointmentsError && !cancelTarget && (
                <Notice
                  tone="danger"
                  title={appointmentsError}
                  action={{
                    label: t("visual.retry"),
                    icon: RotateCcw,
                    onClick: () => setAppointmentVersion((version) => version + 1),
                  }}
                />
              )}
              {appointmentsNotice && !appointmentsError && (
                <Notice
                  tone={rescheduleBlockedNotice ? "info" : "success"}
                  title={appointmentsNotice}
                  onDismiss={() => {
                    setAppointmentsNotice(null);
                    setNoticeShowsCancelled(false);
                  }}
                  action={
                    noticeShowsCancelled && reservationFilter !== "cancelled"
                      ? {
                          label: t("bookings.seeCancelled"),
                          icon: XCircle,
                          onClick: () => setReservationFilter("cancelled"),
                        }
                      : undefined
                  }
                />
              )}
              {focusMissing && (
                <Notice
                  tone="neutral"
                  icon={BellRing}
                  title={t("bookings.noticeMissing")}
                  onDismiss={() => setFocusMissing(false)}
                />
              )}
              {appointmentsLoading ? (
                <BookingLoading variant="cards" count={2} label={t("bookings.loading")} />
              ) : visibleReservations.length === 0 &&
                appointmentsError ? null : visibleReservations.length === 0 ? (
                <EmptyState
                  tone={reservationFilter === "upcoming" ? "calendar" : "search"}
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
                    reservationFilter === "upcoming" || reservationFilter === "history" ? (
                      <button
                        type="button"
                        onClick={() => setTab("agenda")}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                      >
                        <CalendarPlus className="size-4" aria-hidden />
                        {t("bookings.bookNow")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReservationFilter("history")}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"
                      >
                        {t("bookings.seeAll")}
                      </button>
                    )
                  }
                />
              ) : (
                <div className="space-y-5">
                  {groupReservations(
                    displayedReservations(visibleReservations),
                    reservationFilter === "upcoming",
                    bookingNow,
                    shopTimeZone,
                  ).map((group) => (
                    <section
                      key={group.key}
                      aria-labelledby={`reservas-${group.key}`}
                      className="space-y-3"
                    >
                      <h3
                        id={`reservas-${group.key}`}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        {group.label}
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-foreground">
                          <span className="sr-only">: </span>
                          {group.rows.length}
                        </span>
                      </h3>
                      {group.rows.map((row) => renderReservation(row))}
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "esportes" && shopSettings.sports_enabled && (
            <SportsBoard demo={Boolean(demo)} onBack={() => setTab("dashboard")} />
          )}

          {tab === "notifications" && (
            <div className="space-y-5">
              <CustomerPageHeader
                icon={Bell}
                title={t("nav.notices")}
                onBack={() => setTab("dashboard")}
              />
              <CustomerNotices
                session={notifications}
                waiting={waiting}
                staffName={staffNameById}
                reschedules={rescheduleRequests.map((row) => ({
                  id: row.id,
                  startsAt: row.starts_at,
                  updatedAt: row.updated_at,
                  serviceName: row.service?.name ?? t("booking.serviceFallback"),
                  staffName: row.staff?.display_name ?? t("bookings.staffFallback"),
                }))}
                shopCancelled={shopCancelled.map((row) => ({
                  id: row.id,
                  startsAt: row.starts_at,
                  updatedAt: row.updated_at,
                  serviceName: row.service?.name ?? t("booking.serviceFallback"),
                  staffName: row.staff?.display_name ?? t("bookings.staffFallback"),
                }))}
                pending={loyaltyOn ? pendingRedemptions : []}
                now={homeNow}
                timeZone={shopTimeZone}
                onOpenBookings={openBookings}
                onReschedule={(id) => {
                  const row = rescheduleRequests.find((item) => item.id === id);
                  if (row) beginReschedule(row);
                }}
                onBookAgain={(id) => {
                  const row = shopCancelled.find((item) => item.id === id);
                  markCancelledSeen();
                  if (row) bookAgain(row);
                  else setTab("agenda");
                }}
                onOpenRewards={openRewards}
                onClaimed={() => {
                  setAppointmentVersion((v) => v + 1);
                  toast.success(t("home.attention.offerDone"));
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav
        className="app-mobile-nav app-mobile-nav-floating fixed left-4 right-4 z-40 mx-auto grid max-w-[34rem] overflow-hidden"
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
      <ClubInfoDialog
        isOpen={showVipInfo && loyaltyOn}
        program={loyaltyProgram}
        lifetimePoints={lifetimePoints}
        shopId={demo ? null : shopId}
        onClose={() => setShowVipInfo(false)}
        onOpenRewards={openRewards}
      />
    </div>
  );
}

export { ArenaApp };
