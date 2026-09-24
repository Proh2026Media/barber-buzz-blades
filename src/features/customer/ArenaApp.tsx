import { SurveyCard } from "@/features/insights/SurveyCard";
import { useWaiting } from "@/features/waiting/useWaiting";
import { WaitingCards, WaitingNotices } from "@/features/waiting/WaitingUI";
import { blocksSlot } from "@/features/waiting/model";
import { CancellationDialog } from "@/features/insights/CancellationDialog";
import { cancellationReasonLabel, type CancellationReason } from "@/features/insights/cancellation";
import { PointsHistory } from "./PointsHistory";
import { NextLevelCard, type NextLevelSummary } from "./NextLevelCard";
import { CustomerRhythm } from "./CustomerRhythm";
import { CustomerProfile } from "./CustomerProfile";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/lib/use-theme";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { DatePicker } from "@/components/ui/schedule-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";
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
import { DEMO_CUSTOMER_ID } from "@/features/demo/model";
import {
  filterReservations,
  type ReservationFilter,
  buildSlotsForWindow,
  buildBookingDateKeys,
  dateFromLocalKey,
  formatShopDate,
  formatSlotLabel,
  shiftDateKey,
  shopDateKey,
  shopDateTime,
  shopDayRange,
  validTimeZone,
  weekdayForDateKey,
  DEFAULT_SHOP_TIMEZONE,
} from "@/lib/shop/appointments";

type CustomerAppointment = Tables<"appointments"> & {
  service: Pick<Tables<"services">, "name" | "duration_minutes" | "icon"> | null;
  staff: Pick<Tables<"staff">, "display_name"> | null;
  barbershop: Pick<Tables<"barbershops">, "name"> | null;
};

const statusLabel: Record<Tables<"appointments">["status"], string> = {
  pending: "Em revisão",
  reschedule_requested: "Remarcação solicitada",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

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

function ArenaApp({
  headerActions,
  directBarberSlug,
  directShopSlug,
  promptJoin = false,
}: {
  headerActions?: ReactNode;
  directBarberSlug?: string;
  directShopSlug?: string;
  /** Vindo do pós-login (?join=1); o diálogo também abre se o Host/?shop= apontar loja nova. */
  promptJoin?: boolean;
} = {}) {
  useScrollIndicators();
  const demo = useDemo();
  const demoChrome = useDemoChrome();
  const [tab, setTab] = useState("dashboard");
  const [points, setPoints] = useState(0);
  const { isDark: isDarkMode } = useTheme();
  const [showVipInfo, setShowVipInfo] = useState(false);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [staffIdx, setStaffIdx] = useState(0);
  const [selectedSlotAt, setSelectedSlotAt] = useState<string | null>(null);
  const [bookingSummary, setBookingSummary] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const bookingLock = useRef(false);
  const [sportFilter, setSportFilter] = useState("Todos");
  const [shopId, setShopId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("Cliente");
  const [shopName, setShopName] = useState("Sua barbearia");
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
  const [reservationFilter, setReservationFilter] = useState<ReservationFilter>("upcoming");
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsRefreshing, setAppointmentsRefreshing] = useState(false);
  const loadedAppointmentsUser = useRef<string | null>(null);
  const [appointmentsLoadedFor, setAppointmentsLoadedFor] = useState<string | null>(null);
  const handledInitialSchedule = useRef<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [appointmentVersion, setAppointmentVersion] = useState(0);
  const [appointmentBusy, setAppointmentBusy] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CustomerAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
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
    sportFilter === "Todos"
      ? true
      : sportFilter === "NBA"
        ? m.league === "NBA"
        : m.league !== "NBA",
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
  const selectedStaff = staff[staffIdx] ?? null;
  const selectedServiceId = selectedService?.id;
  const selectedServiceDuration = selectedService?.duration_minutes;
  const selectedStaffId = selectedStaff?.id;
  const selectionKey = `${shopId}:${selectedServiceId}:${selectedStaffId}:${selectedDay}`;
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
    const identity = demo ? "demo" : shopId;
    if (!identity || alignedShop.current === identity) return;
    alignedShop.current = identity;
    setSelectedDay(shopDateKey(demo?.now ?? new Date(), shopTimeZone));
  }, [demo, shopId, shopTimeZone]);
  const availableSlots =
    slotsFor === selectionKey
      ? slots.filter((slot) => slot.getTime() > (demo?.now.getTime() ?? Date.now()))
      : [];
  const selectedSlot = availableSlots.find((slot) => slot.toISOString() === selectedSlotAt) ?? null;

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
      return;
    }
    if (!userId || !shopId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("loyalty_accounts")
        .select("points")
        .eq("user_id", userId)
        .eq("barbershop_id", shopId)
        .maybeSingle();
      if (!cancelled && !error) setPoints(data?.points ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, userId, shopId, tab, availabilityVersion]);

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
        if (error) setAppointmentsError("Não foi possível carregar seus agendamentos.");
        else {
          setAppointments(data ?? []);
          loadedAppointmentsUser.current = userId;
        }
      } catch {
        if (!cancelled)
          setAppointmentsError("Não foi possível atualizar seus agendamentos. Tente novamente.");
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
    if (demo) {
      setShopId(demo.shop.id);
      setCustomerName(demo.customerName);
      setShopName(demo.shop.name);
      setShopSettings(demo.settings);
      setUserId(DEMO_CUSTOMER_ID);
      setServices(demo.services.filter((row) => row.active));
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
      try {
        const profile = await getSessionProfile();
        if (!cancelled) {
          setCustomerName(profile?.profile?.full_name?.trim() || "Cliente");
        }
        if (!profile?.user.id) {
          if (!cancelled) {
            setServices([]);
            setStaff([]);
            setCatalogError("Sessão inválida. Entre novamente.");
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
              pendingJoinName = info.shop_name || "esta barbearia";
            }
          } else if (directBarberSlug) {
            throw new Error("Link de barbearia inválido ou indisponível.");
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
            setCatalogError(
              "Nenhuma barbearia vinculada. Abra o link da barbearia para confirmar o acesso.",
            );
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
            via_redirect?: boolean;
          };
          if (!target.staff_id || !target.shop_id) {
            throw new Error("Este link de profissional não está disponível.");
          }
          const hasDestMembership = profile.memberships.some(
            (m) => m.barbershop_id === target.shop_id && m.role === "customer",
          );
          if (hasDestMembership || target.shop_id === catalogShopId) {
            catalogShopId = target.shop_id;
            directStaffId = target.staff_id;
            if (!cancelled && target.shop_name) setShopName(target.shop_name);
          } else if (target.via_redirect) {
            // Cliente ainda sem vínculo no destino: o diálogo de join cobre o caso.
            directStaffId = null;
          } else {
            // Sem membership: força join no destino do link.
            if (!cancelled) {
              setJoinShopRef(directShopSlug);
              setJoinShopName(target.shop_name || "esta barbearia");
              setJoinOpen(true);
            }
          }
        }

        const [servicesResult, staffResult, loyaltyResult, settingsResult, shopResult] =
          await Promise.all([
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
              .select("points")
              .eq("user_id", profile.user.id)
              .eq("barbershop_id", catalogShopId)
              .maybeSingle(),
            supabase
              .from("barbershop_settings")
              .select(
                "display_name, logo_url, logo_background_color, font_family, custom_font_url, custom_font_name, custom_font_faces, font_scope, header_font_weight, header_font_style, corner_style, floating_chrome, primary_color, accent_color, tagline, booking_instructions, booking_horizon_days, survey_program_enabled, sports_enabled",
              )
              .eq("barbershop_id", catalogShopId)
              .single(),
            supabase.from("barbershops").select("timezone").eq("id", catalogShopId).maybeSingle(),
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
            ? { ...legacySettings.data, floating_chrome: false }
            : null;
          }
        }
        if (shopResult.error) throw shopResult.error;
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
            .filter((service) => overrides.has(service.id))
            .map((service) => {
              const own = overrides.get(service.id)!;
              return {
                ...service,
                name: own.display_name || service.name,
                duration_minutes: own.duration_minutes,
                price_cents: own.price_cents,
                icon: own.icon || service.icon,
              };
            });
        }
        if (!cancelled) {
          setShopId(catalogShopId);
          setUserId(profile.user.id);
          setServices(availableServices);
          const availableStaff = staffResult.data ?? [];
          setStaff(availableStaff);
          setPoints(loyaltyResult.error ? 0 : (loyaltyResult.data?.points ?? 0));
          if (shopSettingsData) setShopSettings(shopSettingsData);
          setShopTimeZone(validTimeZone(shopResult.data?.timezone));
          setServiceIdx(0);
          setStaffIdx(
            directStaffId
              ? Math.max(
                  0,
                  availableStaff.findIndex((row) => row.id === directStaffId),
                )
              : 0,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Falha ao carregar catálogo");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, directBarberSlug, directShopSlug, promptJoin, catalogRevision]);

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
      setCatalogError(
        err instanceof Error ? err.message : "Não foi possível vincular a barbearia.",
      );
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
      if (!selectedServiceId || !selectedServiceDuration || !selectedStaffId) {
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
                ...blocks,
                ...demo.waits.filter(
                  (w) => blocksSlot(w, demo.now) && w.staff_id === selectedStaffId,
                ),
              ],
              hours,
              demo.now,
              shopTimeZone,
            ),
          );
          setSlotsFor(selectionKey);
          return;
        }
        const dayRange = shopDayRange(selectedDay, shopTimeZone);
        const [busyResult, hoursResult] = await Promise.all([
          supabase.rpc("get_staff_busy_intervals", {
            p_staff_id: selectedStaffId,
            p_starts_at: dayRange.start.toISOString(),
            p_ends_at: dayRange.end.toISOString(),
          }),
          supabase
            .from("business_hours")
            .select("is_open, opens_at, closes_at")
            .eq("barbershop_id", shopId!)
            .eq("weekday", weekdayForDateKey(selectedDay))
            .maybeSingle(),
        ]);
        if (busyResult.error) throw busyResult.error;
        if (hoursResult.error) throw hoursResult.error;
        if (!cancelled) {
          setSlots(
            buildSlotsForWindow(
              selectedDay,
              selectedServiceDuration,
              busyResult.data ?? [],
              hoursResult.data,
              new Date(),
              shopTimeZone,
            ),
          );
          setSlotsFor(selectionKey);
        }
      } catch {
        if (!cancelled) setSlotsError("Não foi possível consultar os horários. Tente novamente.");
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
    if (
      bookingLock.current ||
      !shopId ||
      !userId ||
      !selectedService ||
      !selectedStaff ||
      !selectedSlot
    )
      return;
    if (selectedSlot.getTime() <= (demo?.now.getTime() ?? Date.now())) {
      setBookingError("O horário selecionado já passou. Escolha outro horário.");
      setAvailabilityVersion((v) => v + 1);
      return;
    }
    recordUsage("booking_started");
    bookingLock.current = true;
    setBookingBusy(true);
    setBookingError(null);
    try {
      const endsAt = new Date(selectedSlot.getTime() + selectedService.duration_minutes * 60_000);
      const booking = {
        barbershop_id: shopId,
        customer_id: userId,
        service_id: selectedService.id,
        staff_id: selectedStaff.id,
        starts_at: selectedSlot.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed" as const,
        booked_price_cents: selectedService.price_cents,
      };
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
          demo.dispatch({
            type: "book",
            appointment: {
              ...booking,
              id: crypto.randomUUID(),
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
      } else if (directBarberSlug && directShopSlug) {
        const { error } = await supabase.rpc("create_direct_appointment", {
          p_shop_slug: directShopSlug,
          p_staff_slug: directBarberSlug,
          p_service_id: booking.service_id,
          p_starts_at: booking.starts_at,
          p_ends_at: booking.ends_at,
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
      const summary = `${rescheduleId ? "Remarcado: " : ""}${selectedService.name} com ${selectedStaff.display_name} em ${dateLabel} às ${formatSlotLabel(selectedSlot, shopTimeZone)}. Reserva confirmada.`;
      setBookingSummary(summary);
      setRescheduleId(null);
      setNotifications((n) => [
        {
          id: Date.now(),
          title: rescheduleId ? "Agendamento remarcado" : "Agendamento confirmado",
          text: summary,
          time: (demo?.now ?? new Date()).toLocaleTimeString("pt-BR", {
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
      setBookingError(
        code === "23P01"
          ? "Este horário acabou de ser reservado. Escolha outro horário."
          : code === "22023"
            ? "O horário selecionado já passou. Escolha outro horário."
            : "Não foi possível agendar. Consulte os horários e tente novamente.",
      );
    } finally {
      setSlotsFor("");
      setSelectedSlotAt(null);
      setAvailabilityVersion((v) => v + 1);
      setAppointmentVersion((v) => v + 1);
      bookingLock.current = false;
      setBookingBusy(false);
    }
  };

  const cancelAppointment = async () => {
    const row = cancelTarget;
    if (!row) return;
    setAppointmentBusy(row.id);
    setAppointmentsError(null);
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
    } catch {
      setAppointmentsError("Não foi possível cancelar. Atualize a lista e tente novamente.");
    } finally {
      setAppointmentBusy(null);
    }
  };

  const beginReschedule = (row: CustomerAppointment) => {
    const serviceIndex = services.findIndex((item) => item.id === row.service_id);
    const staffIndex = staff.findIndex((item) => item.id === row.staff_id);
    if (serviceIndex >= 0) setServiceIdx(serviceIndex);
    if (staffIndex >= 0) setStaffIdx(staffIndex);
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

  const getTierData = (pts: number) => {
    if (pts >= 500)
      return {
        key: "exclusive",
        name: "Exclusive",
        colorClass: "text-gradient-hologram",
        iconColorClass: "text-fuchsia-500 dark:text-fuchsia-400",
        gradientId: "hologram-gradient",
        bg: "bg-black dark:bg-white/5",
        border:
          "border-black/20 dark:border-white/40 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]",
        badge: "bg-hologram-metallic text-black font-black",
        icon: Diamond,
        greeting: "Bem-vindo ao topo, Membro Exclusive.",
        minPoints: 500,
        nextAt: null,
        benefit: "Prioridade máxima e acesso às experiências mais exclusivas do clube.",
      };
    if (pts >= 300)
      return {
        key: "privilege",
        name: "Privilege",
        colorClass: "text-gradient-gold",
        iconColorClass: "text-yellow-600 dark:text-yellow-400",
        gradientId: "gold-gradient",
        bg: "bg-gold/10",
        border: "border-gold/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]",
        badge: "bg-gold-metallic text-black font-black",
        icon: Sparkle,
        greeting: "Bom dia, Membro Privilege.",
        minPoints: 300,
        nextAt: 500,
        benefit: "Descontos em produtos e uma experiência de atendimento premium.",
      };
    if (pts >= 100)
      return {
        key: "select",
        name: "Select",
        colorClass: "text-gradient-bronze",
        iconColorClass: "text-amber-700 dark:text-amber-500",
        gradientId: "bronze-gradient",
        bg: "bg-orange-400/5",
        border: "border-orange-400/20 shadow-[0_0_10px_rgba(205,127,50,0.1)]",
        badge: "bg-bronze-metallic text-white font-black",
        icon: BadgeCheck,
        greeting: "Olá, Membro Select.",
        minPoints: 100,
        nextAt: 300,
        benefit: "Prioridade na agenda e lugar cativo na experiência da barbearia.",
      };
    return {
      key: "classic",
      name: "Classic",
      colorClass: "text-gradient-silver",
      iconColorClass: "text-slate-500 dark:text-slate-400",
      bg: "bg-slate-400/5",
      border: "border-slate-400/20 shadow-[0_0_10px_rgba(192,192,192,0.1)]",
      badge: "bg-silver-metallic text-black font-black",
      icon: Armchair,
      greeting: "Bem-vindo, Membro Classic.",
      minPoints: 0,
      nextAt: 100,
      benefit: "Você acumula pontos enquanto mantém o cuidado com o seu visual.",
    };
  };

  const reservationNow = demo?.now.getTime() ?? Date.now();
  const visibleReservations = filterReservations(appointments, reservationFilter, reservationNow);
  const tier = getTierData(points);
  const nextAppointment = appointments
    .filter(
      (row) =>
        (row.status === "pending" || row.status === "confirmed") &&
        new Date(row.starts_at).getTime() > (demo?.now.getTime() ?? Date.now()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const appointmentOwnerKey = demo ? `demo:${demo.shop.id}:${DEMO_CUSTOMER_ID}` : userId;
  const pointsToNextTier = tier.nextAt === null ? 0 : Math.max(0, tier.nextAt - points);
  const tierProgress =
    tier.nextAt === null
      ? 100
      : Math.max(
          0,
          Math.min(100, ((points - tier.minPoints) / (tier.nextAt - tier.minPoints)) * 100),
        );
  const nextLevel: NextLevelSummary | null =
    tier.nextAt === null
      ? null
      : {
          name: getTierData(tier.nextAt).name,
          pointsRemaining: pointsToNextTier,
          progress: tierProgress,
          benefit: getTierData(tier.nextAt).benefit,
        };

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

  const NavItem = ({ id, icon: Icon, label }: NavItemProps) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`relative z-10 flex min-w-0 flex-col items-center justify-center p-2.5 ${
        tab === id ? "app-nav-current" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon
        className={`mb-1.5 h-5 w-5 transition-transform duration-300 ease-out ${tab === id ? "scale-110" : ""}`}
      />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );

  const navItems: NavItemProps[] = [
    { id: "dashboard", icon: Compass, label: "Início" },
    { id: "agenda", icon: Calendar, label: "Agendar" },
    { id: "reservas", icon: Clock3, label: "Reservas" },
    ...(shopSettings.sports_enabled ? [{ id: "esportes", icon: Feather, label: "Esportes" }] : []),
  ];
  const activeNavIndex = navItems.findIndex((item) => item.id === tab);

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
        onReason={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
        }}
        onConfirm={() => void cancelAppointment()}
      />
      <ShopJoinDialog
        open={joinOpen}
        shopName={joinShopName || "esta barbearia"}
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
                alt={`Logo de ${shopSettings.display_name?.trim() || shopName}`}
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
              {shopSettings.display_name?.trim() || shopName}
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
                ? `Notificações, ${unreadNotifications} não ${unreadNotifications === 1 ? "lida" : "lidas"}`
                : "Notificações"
            }
            className="app-icon-button relative"
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
              aria-label="Meu perfil"
              onClick={() => setTab("perfil")}
              className="app-icon-button"
            >
              <User size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <main className="p-4 max-w-xl mx-auto">
        <div key={tab} className="mb-panel">
          {tab === "perfil" && <CustomerProfile onSaved={setCustomerName} />}
          {tab === "perfil" && <CustomerRhythm shopId={shopId} />}
          {tab === "pontos" && (
            <PointsHistory
              userId={userId}
              shopId={shopId}
              points={points}
              currentLevel={tier.name}
              nextLevel={nextLevel}
            />
          )}
          {tab === "dashboard" && (
            <div className="mb-stagger p-4 space-y-4 relative z-10">
              {/* Card 1: Seu Cartão (Loyalty Card) */}
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
                      Membro
                    </p>
                    <h2 className="brand-loyalty-name text-2xl sm:text-3xl break-words">
                      {customerName}
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
                      Saldo de pontos
                    </p>
                    <p
                      className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tight ${tier.colorClass}`}
                    >
                      {points}{" "}
                      <span className="text-xl font-semibold opacity-70 tracking-normal">pts</span>
                    </p>
                  </div>
                  <div
                    className={`mb-loyalty-tier-mark mb-loyalty-tier-${tier.key} flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm mb-1`}
                  >
                    <tier.icon className="size-4" />
                    <span className="text-xs font-bold whitespace-nowrap">Nível {tier.name}</span>
                  </div>
                </div>
              </section>

              {/* Card 2: Próximo nível — compartilhado com o Extrato. */}
              <NextLevelCard nextLevel={nextLevel} />

              {/* Extrato: quando o cliente ganhou ou perdeu pontos por nível. */}
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
                    <span className="block text-sm font-bold">Extrato de pontos</span>
                    <span className="block text-xs text-muted-foreground">
                      Veja quando você ganhou ou perdeu pontos
                    </span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              {/* Card 3: Próximo atendimento */}
              <section
                className="app-action-card cursor-pointer hover:border-gold transition-colors"
                aria-label="Próximo atendimento"
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
                    Próximo atendimento
                  </h3>
                </div>
                <div className="p-5">
                  {appointmentsLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      Consultando sua agenda…
                    </p>
                  ) : appointmentsError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {appointmentsError}
                    </p>
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
                            {nextAppointment.service?.name ?? "Serviço"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Com {nextAppointment.staff?.display_name ?? "Profissional"}
                          </p>
                        </div>
                      </div>
                      <span className={`status-pill status-${nextAppointment.status}`}>
                        {statusLabel[nextAppointment.status]}
                      </span>
                    </div>
                  ) : (
                    <EmptyState
                      tone="calendar"
                      title="Nenhum horário marcado"
                      description="Escolha um dia, um serviço e um barbeiro em poucos toques."
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
                <h2>{rescheduleId ? "Remarcar atendimento" : "Agendar atendimento"}</h2>
              </div>
              {bookingSummary && (
                <section
                  role="status"
                  className="space-y-4 border border-emerald-600/30 bg-card p-5 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="size-5" />
                    Reserva confirmada
                  </div>
                  <p className="text-sm leading-relaxed">{bookingSummary}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setReservationFilter("upcoming");
                      setTab("reservas");
                    }}
                    className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    Acompanhar reserva
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingSummary(null);
                      setBookingError(null);
                    }}
                    className="min-h-11 w-full text-sm font-semibold"
                  >
                    Marcar outro horário
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
                      <p className="text-xs text-muted-foreground">Carregando catálogo...</p>
                    )}
                    {catalogError && <p className="text-xs text-destructive">{catalogError}</p>}

                    {rescheduleId && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs">
                        <span className="font-bold">Escolha o novo horário da reserva.</span>
                        <button
                          disabled={bookingBusy}
                          onClick={() => setRescheduleId(null)}
                          className="font-bold text-muted-foreground underline"
                        >
                          Sair
                        </button>
                      </div>
                    )}

                    <section className="booking-section" aria-labelledby="booking-date">
                      <h3 id="booking-date" className="booking-heading">
                        Data
                      </h3>
                      <DatePicker
                        compact
                        disabled={bookingBusy}
                        label="Escolher no calendário"
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
                              aria-label={`${weekday}, ${dayNumber} de ${month}`}
                              className={`app-day-chip ${selected ? "app-day-chip-selected" : ""}`}
                            >
                              <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80">
                                {index === 0 ? "Hoje" : weekday}
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
                      <h3 id="booking-service" className="booking-heading">
                        Serviço
                      </h3>
                      {!catalogLoading && !catalogError && services.length === 0 && (
                        <p role="status" className="text-sm text-muted-foreground">
                          Nenhum serviço disponível para agendar.
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2">
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
                            className={`min-w-0 flex flex-col gap-2 p-3 sm:p-4 rounded-xl border text-left text-xs font-bold transition-all ${serviceIdx === i ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 border-border text-foreground hover:border-primary/50"}`}
                          >
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
                              className={`mt-auto block text-xs font-medium ${serviceIdx === i ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                            >
                              {s.duration_minutes} min ·{" "}
                              {(s.price_cents / 100).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="booking-section" aria-labelledby="booking-staff">
                      <h3 id="booking-staff" className="booking-heading">
                        Barbeiro
                      </h3>
                      {!catalogLoading && !catalogError && staff.length === 0 && (
                        <p role="status" className="text-sm text-muted-foreground">
                          Nenhum profissional disponível para agendar.
                        </p>
                      )}
                      {directBarberSlug && selectedStaff ? (
                        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Link direto do profissional
                          </p>
                          <p className="mt-1 font-bold">{selectedStaff.display_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Este agendamento está vinculado a este barbeiro.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {staff.map((m, i) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setStaffIdx(i);
                                setSelectedSlotAt(null);
                                setBookingSummary(null);
                                setBookingError(null);
                              }}
                              disabled={bookingBusy}
                              aria-pressed={staffIdx === i}
                              className={`p-4 rounded-xl border text-left text-xs font-bold transition-all ${staffIdx === i ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 border-border text-foreground hover:border-primary/50"}`}
                            >
                              <span className="flex items-center gap-2">
                                {m.avatar_url ? (
                                  <img
                                    src={m.avatar_url}
                                    alt=""
                                    className="size-9 shrink-0 rounded-xl object-cover"
                                  />
                                ) : (
                                  <span
                                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                                      staffIdx === i ? "bg-primary-foreground/15" : "bg-muted"
                                    }`}
                                  >
                                    <Scissors className="size-4" aria-hidden="true" />
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 break-words">{m.display_name}</span>
                                {staffIdx === i && (
                                  <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
                                )}
                              </span>
                              {m.bio ? (
                                <span
                                  className={`mt-2 line-clamp-2 text-[11px] font-medium ${
                                    staffIdx === i
                                      ? "text-primary-foreground/75"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {m.bio}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="booking-section" aria-labelledby="booking-time">
                      <h3 id="booking-time" className="booking-heading">
                        Horário
                      </h3>
                      {!selectedService || !selectedStaff ? (
                        <p className="text-sm text-muted-foreground">
                          Os horários aparecem quando há serviço e profissional disponíveis.
                        </p>
                      ) : slotsLoading && slotsFor !== selectionKey ? (
                        <p className="text-xs text-muted-foreground">Consultando horários...</p>
                      ) : slotsError ? (
                        <div className="space-y-2">
                          <p className="text-xs text-destructive" role="alert">
                            {slotsError}
                          </p>
                          <button
                            className="text-xs underline"
                            onClick={() => setAvailabilityVersion((v) => v + 1)}
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Sem horários livres. Escolha outra data ou outro barbeiro.
                        </p>
                      ) : (
                        <div className="space-y-4 p-1">
                          {[
                            { label: "Manhã", from: 0, to: 12, icon: Sun },
                            { label: "Tarde", from: 12, to: 18, icon: Sun },
                            { label: "Noite", from: 18, to: 24, icon: Moon },
                          ].map(({ label, from, to, icon: Icon }) => {
                            const periodSlots = availableSlots.filter(
                              (slot) => slot.getHours() >= from && slot.getHours() < to,
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
                      service={selectedService ?? undefined}
                      day={selectedDay}
                      onChanged={() => setTab("reservas")}
                    />
                    {selectedSlot && selectedService && selectedStaff && !bookingSummary && (
                      <section
                        aria-label="Resumo da reserva"
                        className="rounded-2xl border border-gold/30 bg-card p-4 space-y-3"
                      >
                        <p className="flex items-center gap-2 text-sm font-bold">
                          <Calendar className="size-4 text-gold" />
                          Sua reserva
                        </p>
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{selectedService.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedStaff.display_name}
                            </p>
                          </div>
                          <p className="text-sm font-bold">
                            {(selectedService.price_cents / 100).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
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
                          {selectedService.duration_minutes} min
                        </p>
                      </section>
                    )}
                    {bookingError && (
                      <p
                        role="alert"
                        className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                      >
                        {bookingError}
                      </p>
                    )}
                    {!selectedSlot && !bookingBusy && selectedService && selectedStaff && (
                      <p className="text-center text-xs text-muted-foreground">
                        Selecione um horário para continuar.
                      </p>
                    )}
                    <button
                      onClick={() => void confirmBooking()}
                      disabled={!selectedService || !selectedStaff || !selectedSlot || bookingBusy}
                      className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {bookingBusy
                        ? "Enviando…"
                        : rescheduleId
                          ? "Confirmar remarcação"
                          : "Confirmar reserva"}
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
                onChanged={() => setAppointmentVersion((v) => v + 1)}
              />
              <WaitingNotices controller={waiting} />
              <div>
                <div className="app-section-title">
                  <Clock3 />
                  <h2>Meus agendamentos</h2>
                </div>
                {!demo && (
                  <button
                    type="button"
                    disabled={appointmentsRefreshing || !!appointmentBusy}
                    onClick={() => setAppointmentVersion((version) => version + 1)}
                    className="mt-3 rounded-xl border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {appointmentsRefreshing ? "Conferindo…" : "Conferir agora"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2" aria-label="Filtrar agendamentos">
                {(
                  [
                    { id: "upcoming", label: "Próximos" },
                    { id: "history", label: "Histórico" },
                    { id: "completed", label: "Concluídos" },
                    { id: "cancelled", label: "Cancelados" },
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
                      {filterReservations(appointments, id, reservationNow).length}
                    </span>
                  </button>
                ))}
              </div>
              {appointmentsError && (
                <p className="text-xs text-destructive" role="alert">
                  {appointmentsError}
                </p>
              )}
              {appointmentsLoading ? (
                <p className="text-xs text-muted-foreground">Carregando agendamentos...</p>
              ) : visibleReservations.length === 0 &&
                appointmentsError ? null : visibleReservations.length === 0 ? (
                <EmptyState
                  tone="calendar"
                  title={
                    reservationFilter === "upcoming"
                      ? "Você não tem próximos agendamentos"
                      : "Nenhum agendamento neste filtro"
                  }
                  description={
                    reservationFilter === "upcoming"
                      ? "Reserve um horário e ele aparece aqui com status e opções de gestão."
                      : "Troque o filtro ou marque um novo atendimento."
                  }
                  action={
                    <button
                      onClick={() => setTab("agenda")}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      Agendar agora
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
                              <p className="text-sm font-black">{row.service?.name ?? "Serviço"}</p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.barbershop?.name ?? "Barbearia"} ·{" "}
                              {row.staff?.display_name ?? "Profissional"}
                            </p>
                          </div>
                          <span className={`status-pill status-${row.status}`}>
                            {statusLabel[row.status]}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-bold">
                          {formatShopDate(startsAt, shopTimeZone, {
                            weekday: "long",
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          às {formatSlotLabel(startsAt, shopTimeZone)}
                        </p>
                        {row.status === "cancelled" && cancellationDetails[row.id] && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Cancelado pela{" "}
                            {cancellationDetails[row.id].source === "customer"
                              ? "pessoa cliente"
                              : "barbearia"}
                            {` · ${cancellationReasonLabel(cancellationDetails[row.id].reason)}`}
                          </p>
                        )}
                        {canManage && (
                          <>
                            {row.status === "reschedule_requested" && (
                              <p className="mt-3 text-sm text-muted-foreground">
                                A barbearia retirou a confirmação. Remarque ou cancele
                                definitivamente.
                              </p>
                            )}
                            <div className="mt-4 flex gap-2">
                              <button
                                disabled={appointmentBusy !== null}
                                onClick={() => beginReschedule(row)}
                                className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50"
                              >
                                Remarcar
                              </button>
                              <button
                                disabled={appointmentBusy !== null}
                                onClick={() => setCancelTarget(row)}
                                className="action-button action-danger"
                              >
                                <X className="size-4" />
                                {appointmentBusy === row.id ? "Cancelando..." : "Cancelar"}
                              </button>
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
                  Módulo Esportes ativo. A programação de jogos ainda não foi configurada.
                </p>
              )}
              {demo && (
                <p className="text-xs text-muted-foreground">
                  Placares fictícios para demonstração.
                </p>
              )}
              <div className="app-section-title">
                <Feather />
                <h2>Noticiário e resultados</h2>
              </div>
              <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-border">
                {["Todos", "Futebol", "NBA"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSportFilter(f)}
                    aria-pressed={sportFilter === f}
                    className={`text-xs uppercase font-bold px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${sportFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                  >
                    {f}
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
                        {m.league} · {m.status}
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
              <WaitingNotices controller={waiting} />
              <div className="app-section-title">
                <Bell />
                <h2>Notificações</h2>
              </div>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <EmptyState
                    tone="bell"
                    title="Tudo quieto por aqui"
                    description="Avisos de espera, reservas e novidades da barbearia aparecem neste espaço."
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
        aria-label="Navegação principal"
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
        isOpen={showVipInfo}
        isDarkMode={isDarkMode}
        sportsEnabled={shopSettings.sports_enabled}
        onClose={() => setShowVipInfo(false)}
      />
    </div>
  );
}

const VipInfoModal = ({
  isOpen,
  isDarkMode,
  sportsEnabled,
  onClose,
}: {
  isOpen: boolean;
  isDarkMode: boolean;
  sportsEnabled: boolean;
  onClose: () => void;
}) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [isOpen, onClose]);
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
              Clube de Benefícios
            </h3>
          </div>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label="Fechar o clube de benefícios"
            className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="dialog-scroll-area flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Como acumular</h4>
            <div className="space-y-3">
              <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                <p className="text-xs font-medium leading-relaxed">
                  Cada <span className="font-bold text-foreground">R$ 1,00 gasto</span> em serviços
                  ou produtos equivale a <span className="font-bold text-primary">1 Ponto</span>.
                </p>
              </div>
              {sportsEnabled && (
                <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-2xl border border-border/50">
                  <Star size={16} className="text-primary mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    Check-in em <span className="font-bold text-foreground">dias de jogo</span> na
                    Arena garante <span className="font-bold text-primary">10 Pontos</span> bônus.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Níveis do clube</h4>
            <div className="space-y-4">
              {/* Classic */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/60 shadow-sm group hover:bg-muted/60 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <div className="p-1.5 bg-silver-metallic rounded-lg border border-white/20">
                      <Armchair size={14} className="text-black" />
                    </div>
                    <span className="text-gradient-silver">Classic</span>
                  </span>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                    0 - 99 pts
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                  O alicerce: Tradição e manutenção impecável do seu visual (Prata Metálico).
                </p>
              </div>

              {/* Select */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/60 shadow-sm group hover:bg-muted/60 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <div className="p-1.5 bg-bronze-metallic rounded-lg border border-white/20">
                      <BadgeCheck size={14} className="text-white" />
                    </div>
                    <span className="text-gradient-bronze">Select</span>
                  </span>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                    100 - 299 pts
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                  Conveniência: Prioridade na agenda e lugar cativo na Arena (Bronze Metálico).
                </p>
              </div>

              {/* Privilege */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/60 shadow-sm group hover:bg-muted/60 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <div className="p-1.5 bg-gold-metallic rounded-lg border border-white/20">
                      <Sparkle size={14} className="text-black" />
                    </div>
                    <span className="text-gradient-gold">Privilege</span>
                  </span>
                  <span className="text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/50">
                    300 - 499 pts
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                  Experiência: Descontos em produtos e atendimento premium (Ouro Metálico).
                </p>
              </div>

              {/* Exclusive */}
              <div className="bg-muted/40 p-4 rounded-2xl border border-border/70 shadow-sm relative overflow-hidden group hover:bg-muted/60 transition-all ring-1 ring-border/50">
                <div className="absolute -right-2 -top-2 opacity-5 transition-transform group-hover:scale-110">
                  <Diamond size={64} fill="currentColor" className="text-foreground" />
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg border shadow-inner ${isDarkMode ? "bg-hologram-metallic border-transparent" : "bg-[#050505] border-border/40"}`}
                    >
                      <Diamond
                        size={14}
                        className={isDarkMode ? "text-[#050505]" : "text-white"}
                        style={{
                          fill: isDarkMode ? "#050505" : "url(#hologram-gradient)",
                          stroke: "none",
                        }}
                      />
                    </div>
                    <span className="text-gradient-hologram">Exclusive</span>
                  </span>
                  <span className="text-xs font-black text-black bg-hologram-metallic px-3 py-0.5 rounded-full shadow-md">
                    500+ pts ou Assinatura
                  </span>
                </div>
                <ul className="space-y-1.5">
                  <li className="text-xs font-bold flex items-center gap-2">
                    <CheckCircle size={10} className="text-gradient-hologram" /> Prioridade máxima
                    nos horários disputados
                  </li>
                  <li className="text-xs font-bold flex items-center gap-2 text-foreground/80">
                    <CheckCircle size={10} className="text-gradient-hologram" /> Acesso irrestrito
                    ao Lounge VIP
                  </li>
                  <li className="text-xs font-bold flex items-center gap-2 text-foreground/80">
                    <CheckCircle size={10} className="text-gradient-hologram" /> Plano de Cortes
                    Ilimitados (Exclusivo)
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Por que assinar o Sócio Arena?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Diferente dos pontos, a assinatura garante benefícios{" "}
              <span className="font-semibold text-foreground">imediatos</span> e exclusivos como o{" "}
              <span className="font-semibold text-foreground">Corte Ilimitado mensal</span> e acesso
              ao Lounge VIP.
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t border-border bg-muted/20 p-4">
          <Link
            to="/politica"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Política completa <ChevronRight size={14} />
          </Link>
          <button
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export { ArenaApp };
