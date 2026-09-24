import { AttendanceControls } from "@/features/insights/AttendanceControls";
import { useWaiting } from "@/features/waiting/useWaiting";
import { WaitingCards, WaitingSettings } from "@/features/waiting/WaitingUI";
import { canHold } from "@/features/waiting/model";
import { CatalogFilters, type CatalogStatus } from "./CatalogFilters";
import { StaffSurveyDialog } from "@/features/insights/StaffSurveyDialog";
import { CancellationDialog } from "@/features/insights/CancellationDialog";
import { cancellationReasonLabel, type CancellationReason } from "@/features/insights/cancellation";
import { BusinessInsights } from "@/features/insights/BusinessInsights";
import { ProfessionalInsights } from "@/features/insights/ProfessionalInsights";
import { TeamGovernance } from "./TeamGovernance";
import { BrandIdentityEditor } from "@/features/shop/BrandIdentityEditor";
import { WhatsAppSettingsCard } from "@/features/shop/WhatsAppSettingsCard";
import { SlugRedirectsCard } from "@/features/shop/SlugRedirectsCard";
import { ShopDepartureCard } from "@/features/shop/ShopDepartureCard";
import { ShopDomainCard } from "@/features/shop/ShopDomainCard";
import { GoogleIntegrationsCard } from "@/features/shop/GoogleIntegrationsCard";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import { isValidBookingSlug, slugifyPt } from "@/lib/shop/slugify";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker, TimePicker } from "@/components/ui/schedule-picker";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  KeyRound,
  LogOut,
  MessageSquarePlus,
  Plus,
  Palette,
  Pencil,
  RefreshCw,
  Scissors,
  Search,
  ShieldCheck,
  Upload,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { capabilitiesFor, type SessionProfile } from "@/lib/auth/session";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { useDemo } from "@/features/demo/context";
import {
  formatShopDate,
  formatSlotLabel,
  shopDateKey,
  shopDateTime,
  shopDayRange,
  shiftDateKey,
  validTimeZone,
} from "@/lib/shop/appointments";

import { ServiceIcon, SERVICE_ICON_GROUPS, searchServiceIcons } from "@/components/ui/service-icon";
import {
  isServiceImageSource,
  SERVICE_IMAGE_ACCEPT,
  serviceImageToDataUrl,
  uploadServiceImage,
  validateServiceImage,
} from "@/lib/shop/service-image";
import { PartnerOverview } from "./PartnerOverview";
import { ClientDirectory } from "./ClientDirectory";
import { ServiceImageCropDialog } from "./ServiceImageCropDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

type ShopShellProps = {
  profile: SessionProfile;
  headerActions?: ReactNode;
};

type DayAppointment = Tables<"appointments"> & {
  service: Pick<Tables<"services">, "name" | "price_cents"> | null;
  staff: Pick<Tables<"staff">, "display_name"> | null;
  customer: Pick<Tables<"profiles">, "full_name"> | null;
  visibility?: "full" | "busy";
};

type AvailabilityBlock = Tables<"availability_blocks"> & {
  staff: Pick<Tables<"staff">, "display_name"> | null;
};

const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function defaultHours(shopId: string): Tables<"business_hours">[] {
  const stamp = new Date().toISOString();
  return weekdays.map((_, weekday) => ({
    id: `new-${weekday}`,
    barbershop_id: shopId,
    weekday,
    is_open: weekday !== 0,
    opens_at: "09:00:00",
    closes_at: "19:00:00",
    created_at: stamp,
    updated_at: stamp,
  }));
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ShopShell({ profile, headerActions }: ShopShellProps) {
  useScrollIndicators();
  const demo = useDemo();
  const [selectedActorId, setSelectedActorId] = useState(() => {
    const saved =
      typeof window === "undefined" ? null : window.localStorage.getItem("arena:active-shop-actor");
    return profile.shopActors.some((candidate) => candidate.id === saved)
      ? saved!
      : (profile.activeShopActor?.id ?? "");
  });
  const actor =
    profile.shopActors.find((candidate) => candidate.id === selectedActorId) ??
    profile.activeShopActor;
  const [governanceMode, setGovernanceMode] = useState(profile.governanceMode);
  const [capabilities, setCapabilities] = useState(profile.capabilities);
  useEffect(() => {
    if (!actor) return;
    window.localStorage.setItem("arena:active-shop-actor", actor.id);
    setCapabilities(null);
    setGovernanceMode(null);
    let active = true;
    if (demo) {
      const mode = actor.role === "owner" ? "single" : actor.role === "partner" ? "equal" : null;
      setGovernanceMode(mode);
      setCapabilities(
        capabilitiesFor(
          actor as unknown as NonNullable<SessionProfile["activeShopActor"]>,
          mode,
          mode !== "equal",
        ),
      );
      return;
    }
    void supabase
      .rpc("get_shop_access_context", { p_shop_id: actor.barbershop_id })
      .then(({ data, error }) => {
        if (!active || error || !data || typeof data !== "object" || Array.isArray(data)) return;
        const context = data as { governance_mode?: unknown; can_apply_protected_change?: unknown };
        const mode = ["single", "equal", "majority"].includes(String(context.governance_mode))
          ? (context.governance_mode as SessionProfile["governanceMode"])
          : null;
        setGovernanceMode(mode);
        setCapabilities(capabilitiesFor(actor, mode, context.can_apply_protected_change === true));
      });
    return () => {
      active = false;
    };
  }, [actor, demo]);
  const effectiveProfile: SessionProfile = {
    ...profile,
    activeShopActor: actor,
    capabilities,
    governanceMode,
  };
  const shop =
    demo?.shop ??
    actor?.barbershop ??
    profile.memberships.find((m) => m.role === "shop_admin")?.barbershop ??
    profile.memberships.find((m) => m.barbershop)?.barbershop;
  /** Fuso da barbearia: a agenda é do dia da loja, não do aparelho de quem abre o painel. */
  const shopTimeZone = validTimeZone(shop?.timezone);

  const [tab, setTab] = useState<"agenda" | "servicos" | "equipe" | "horarios" | "configuracoes">(
    "agenda",
  );
  const [agendaRefresh, setAgendaRefresh] = useState(0);
  const [refreshingAgenda, setRefreshingAgenda] = useState(false);
  const [agendaSearch, setAgendaSearch] = useState("");
  const [agendaScope, setAgendaScope] = useState<"mine" | "team">("mine");
  const [agendaStaff, setAgendaStaff] = useState("");
  const [agendaStatus, setAgendaStatus] = useState("");
  const [agendaDay, setAgendaDay] = useState(() =>
    shopDateKey(demo?.now ?? new Date(), validTimeZone(shop?.timezone)),
  );
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [staff, setStaff] = useState<Tables<"staff">[]>([]);
  const [appointments, setAppointments] = useState<DayAppointment[]>([]);
  const [businessHours, setBusinessHours] = useState<Tables<"business_hours">[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [settings, setSettings] = useState<Tables<"barbershop_settings"> | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [governanceRevision, setGovernanceRevision] = useState(0);
  const [governanceMessage, setGovernanceMessage] = useState<string | null>(null);
  const waiting = useWaiting(shop?.id, true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatingAppointment, setUpdatingAppointment] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DayAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [surveyTarget, setSurveyTarget] = useState<DayAppointment | null>(null);
  const [cancellationDetails, setCancellationDetails] = useState<
    Record<string, { reason: CancellationReason | null; source: "customer" | "shop" }>
  >({});

  useEffect(() => {
    if (demo) {
      setCancellationDetails(demo.cancellationReasons as typeof cancellationDetails);
      return;
    }
    if (!shop?.id || (actor && !capabilities?.viewFullShop)) return;
    let cancelled = false;
    void supabase.rpc("get_appointment_cancellations", { p_shop_id: shop.id }).then(({ data }) => {
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
  }, [demo, shop?.id, agendaRefresh, actor, capabilities?.viewFullShop]);
  const [error, setError] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState("");
  const [serviceDuration, setServiceDuration] = useState("30");
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [servicePrice, setServicePrice] = useState("45");
  const [serviceIcon, setServiceIcon] = useState<string>("Scissors");
  const [serviceIconQuery, setServiceIconQuery] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [serviceImageToCrop, setServiceImageToCrop] = useState<File | null>(null);
  // O input de arquivo fica fora da tela; o botão visível dispara o seletor,
  // o que mantém o envio acessível por teclado.
  const iconInputRef = useRef<HTMLInputElement>(null);
  // Identificadores estáveis para os rótulos do formulário de bloqueio.
  const blockStaffFieldId = useId();
  const blockReasonFieldId = useId();

  /** Agrupa o catálogo já filtrado pela busca, mantendo as categorias visíveis. */
  const filteredIconGroups = useMemo(() => {
    const allowed = new Set(searchServiceIcons(serviceIconQuery).map((entry) => entry.id));
    return SERVICE_ICON_GROUPS.map((group) => ({
      ...group,
      icons: group.icons.filter((entry) => allowed.has(entry.id)),
    })).filter((group) => group.icons.length > 0);
  }, [serviceIconQuery]);
  const [deleteStaff, setDeleteStaff] = useState<Tables<"staff"> | null>(null);
  const [deleteService, setDeleteService] = useState<Tables<"services"> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Tables<"services"> | null>(null);
  const [editingStaff, setEditingStaff] = useState<Tables<"staff"> | null>(null);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<DayAppointment | null>(null);
  const [serviceQuery, setServiceQuery] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [serviceStatus, setServiceStatus] = useState<CatalogStatus>("all");
  const [staffStatus, setStaffStatus] = useState<CatalogStatus>("all");
  const [staffName, setStaffName] = useState("");
  const [staffSlug, setStaffSlug] = useState("");
  const [staffSlugTouched, setStaffSlugTouched] = useState(false);
  const [blockDate, setBlockDate] = useState(() =>
    shopDateKey(new Date(), validTimeZone(shop?.timezone)),
  );
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockStaffId, setBlockStaffId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockCustomOpen, setBlockCustomOpen] = useState(false);

  async function loadCatalog() {
    if (demo) {
      setServices(demo.services);
      setStaff(demo.staff);
      setBusinessHours(demo.businessHours);
      setBlocks(
        demo.availabilityBlocks
          .map((row) => ({
            ...row,
            staff: demo.staff.find((member) => member.id === row.staff_id) ?? null,
          }))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      );
      setSettings(demo.settings);
      setAppointments(
        demo.appointments
          .filter((row) => shopDateKey(new Date(row.starts_at), shopTimeZone) === agendaDay)
          .map((row) => ({
            ...row,
            service: demo.services.find((service) => service.id === row.service_id) ?? null,
            staff: demo.staff.find((staff) => staff.id === row.staff_id) ?? null,
            customer: {
              full_name:
                row.customer_id === demo.customerId
                  ? demo.customerName
                  : (demo.customers.find((customer) => customer.id === row.customer_id)?.name ??
                    "Cliente demo"),
            },
          }))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      );
      setLoading(false);
      return;
    }
    if (!shop?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const agendaRange = shopDayRange(agendaDay, shopTimeZone);
    const dayStart = agendaRange.start.toISOString();
    const dayEnd = agendaRange.end.toISOString();
    const [
      servicesResult,
      staffResult,
      appointmentsResult,
      hoursResult,
      blocksResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", shop.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("staff")
        .select("*")
        .eq("barbershop_id", shop.id)
        .order("created_at", { ascending: true }),
      actor
        ? supabase.rpc("get_team_schedule", {
            p_shop_id: shop.id,
            p_from: dayStart,
            p_to: dayEnd,
          })
        : supabase
            .from("appointments")
            .select(
              "*, service:services(name, price_cents), staff:staff(display_name), customer:profiles(full_name)",
            )
            .eq("barbershop_id", shop.id)
            .gte("starts_at", dayStart)
            .lte("starts_at", dayEnd)
            .order("starts_at", { ascending: true }),
      supabase
        .from("business_hours")
        .select("*")
        .eq("barbershop_id", shop.id)
        .order("weekday", { ascending: true }),
      supabase
        .from("availability_blocks")
        .select("*, staff:staff(display_name)")
        .eq("barbershop_id", shop.id)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
      supabase.from("barbershop_settings").select("*").eq("barbershop_id", shop.id).single(),
    ]);
    if (servicesResult.error) setError(servicesResult.error.message);
    else {
      let visibleServices = servicesResult.data ?? [];
      if (actor?.role === "associate" && actor.staff_id) {
        const overrides = await supabase
          .from("staff_services")
          .select("*")
          .eq("barbershop_id", shop.id)
          .eq("staff_id", actor.staff_id);
        if (overrides.error) setError(overrides.error.message);
        else {
          const byService = new Map((overrides.data ?? []).map((row) => [row.service_id, row]));
          visibleServices = visibleServices.map((service) => {
            const own = byService.get(service.id);
            return own
              ? {
                  ...service,
                  name: own.display_name || service.name,
                  duration_minutes: own.duration_minutes,
                  price_cents: own.price_cents,
                  active: own.active,
                }
              : service;
          });
        }
      }
      setServices(visibleServices);
    }
    if (staffResult.error) setError(staffResult.error.message);
    else setStaff(staffResult.data ?? []);
    if (appointmentsResult.error) setError(appointmentsResult.error.message);
    else if (actor) {
      const rows = Array.isArray(appointmentsResult.data) ? appointmentsResult.data : [];
      setAppointments(
        rows.map((value) => {
          const row = value as Record<string, unknown>;
          return {
            id: String(row.id),
            barbershop_id: shop.id,
            customer_id: "",
            service_id: "",
            staff_id: String(row.staff_id),
            starts_at: String(row.starts_at),
            ends_at: String(row.ends_at),
            status: row.status as Tables<"appointments">["status"],
            booked_price_cents: typeof row.price_cents === "number" ? row.price_cents : null,
            created_at: String(row.starts_at),
            updated_at: String(row.starts_at),
            service: row.service_name
              ? { name: String(row.service_name), price_cents: Number(row.price_cents ?? 0) }
              : null,
            staff: { display_name: String(row.staff_name ?? "Profissional") },
            customer: row.customer_name ? { full_name: String(row.customer_name) } : null,
            visibility: row.visibility === "full" ? "full" : "busy",
          };
        }),
      );
    } else setAppointments((appointmentsResult.data ?? []) as DayAppointment[]);
    if (hoursResult.error) setError(hoursResult.error.message);
    else setBusinessHours(hoursResult.data?.length ? hoursResult.data : defaultHours(shop.id));
    if (blocksResult.error) setError(blocksResult.error.message);
    else setBlocks(blocksResult.data ?? []);
    if (settingsResult.error) setError(settingsResult.error.message);
    else setSettings(settingsResult.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when shop changes
  }, [shop?.id, demo, agendaDay]);

  useEffect(() => {
    if (demo || actor || !shop?.id || tab !== "agenda" || busy || updatingAppointment) return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      setRefreshingAgenda(true);
      try {
        const result = await supabase
          .from("appointments")
          .select(
            "*, service:services(name, price_cents), staff:staff(display_name), customer:profiles(full_name)",
          )
          .eq("barbershop_id", shop.id)
          .gte("starts_at", shopDayRange(agendaDay, shopTimeZone).start.toISOString())
          .lte("starts_at", shopDayRange(agendaDay, shopTimeZone).end.toISOString())
          .order("starts_at", { ascending: true });
        if (cancelled) return;
        if (result.error) setError("Não foi possível atualizar a agenda. Tente novamente.");
        else {
          setAppointments(result.data ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Não foi possível atualizar a agenda. Tente novamente.");
      } finally {
        running = false;
        if (!cancelled) setRefreshingAgenda(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    demo,
    actor,
    shop?.id,
    tab,
    agendaDay,
    agendaRefresh,
    busy,
    updatingAppointment,
    shopTimeZone,
  ]);

  function moveAgendaDay(offset: number) {
    setAgendaDay((current) => shiftDateKey(current, offset));
  }

  async function signOut() {
    if (demo) {
      demo.exit();
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function submitProtectedChange(kind: string, payload: Json) {
    if (!shop?.id) throw new Error("Barbearia não encontrada.");
    const { data, error: requestError } = await supabase.rpc("request_shop_change", {
      p_shop_id: shop.id,
      p_kind: kind,
      p_payload: payload,
    });
    if (requestError) throw requestError;
    const result = data as { status?: "applied" | "pending" } | null;
    if (result?.status === "pending") {
      setError(null);
      setSettingsSaved(false);
      setGovernanceMessage(
        "Mudança enviada aos demais sócios. Nada será alterado até a aprovação.",
      );
      setGovernanceRevision((value) => value + 1);
      return false;
    }
    setGovernanceMessage("Mudança aplicada.");
    return true;
  }

  async function setAppointmentStatus(
    row: DayAppointment,
    status: Tables<"appointments">["status"],
  ) {
    if (demo) {
      demo.dispatch({ type: "status", id: row.id, status });
      return;
    }
    setUpdatingAppointment(row.id);
    setError(null);
    try {
      const { error: updateError } =
        status === "reschedule_requested"
          ? await supabase.rpc("withdraw_appointment_confirmation", { p_id: row.id })
          : await supabase
              .from("appointments")
              .update({ status })
              .eq("id", row.id)
              .eq("status", row.status)
              .select("id")
              .single();
      if (updateError) throw updateError;
      await loadCatalog();
      await waiting.refresh();
    } catch {
      setError("Não foi possível alterar o atendimento. Atualize a agenda e tente novamente.");
    } finally {
      setUpdatingAppointment(null);
    }
  }

  async function cancelSelectedAppointment() {
    const row = cancelTarget;
    if (!row) return;
    setUpdatingAppointment(row.id);
    setError(null);
    try {
      if (demo)
        demo.dispatch({ type: "cancel", id: row.id, reason: cancelReason || null, source: "shop" });
      else {
        const result = await supabase.rpc("cancel_appointment", {
          p_id: row.id,
          p_reason: cancelReason || null,
        });
        if (result.error) throw result.error;
        await loadCatalog();
      }
      setCancelTarget(null);
      setCancelReason("");
      setAgendaRefresh((value) => value + 1);
    } catch {
      setError("Não foi possível cancelar o atendimento.");
    } finally {
      setUpdatingAppointment(null);
    }
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!shop?.id) return;
    // Duplo envio criaria dois serviços iguais no catálogo.
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const duration = Number(serviceDuration);
      const priceReais = Number(servicePrice.replace(",", "."));
      if (!Number.isInteger(duration) || duration <= 0) throw new Error("Duração inválida");
      if (!Number.isFinite(priceReais) || priceReais < 0) throw new Error("Preço inválido");
      if (!serviceName.trim()) throw new Error("Informe o nome do serviço.");
      if (!servicePrice.trim()) throw new Error("Informe o preço.");
      const service = {
        barbershop_id: shop.id,
        name: serviceName.trim(),
        duration_minutes: duration,
        price_cents: Math.round(priceReais * 100),
        active: editingService?.active ?? true,
        icon: serviceIcon,
      };
      if (demo) {
        demo.dispatch({
          type: editingService ? "service.edit" : "service.add",
          service: {
            ...service,
            id: editingService?.id ?? crypto.randomUUID(),
            created_at: editingService?.created_at ?? demo.now.toISOString(),
            updated_at: demo.now.toISOString(),
          },
        });
      } else if (actor?.role === "associate") {
        if (!editingService || !actor.staff_id) {
          throw new Error(
            "O parceiro pode personalizar serviços existentes, mas não criar o catálogo global.",
          );
        }
        const { error: ownCatalogError } = await supabase.from("staff_services").upsert(
          {
            barbershop_id: shop.id,
            staff_id: actor.staff_id,
            service_id: editingService.id,
            display_name: service.name,
            duration_minutes: service.duration_minutes,
            price_cents: service.price_cents,
            active: service.active,
            icon: service.icon,
          },
          { onConflict: "staff_id,service_id" },
        );
        if (ownCatalogError) throw ownCatalogError;
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange(
          editingService ? "service.update" : "service.create",
          {
            ...service,
            id: editingService?.id,
          },
        );
        if (!applied) {
          setServiceFormOpen(false);
          return;
        }
      } else if (actor) {
        throw new Error("Seu papel não permite alterar serviços.");
      } else {
        const { error: insertError } = editingService
          ? await supabase
              .from("services")
              .update(service)
              .eq("id", editingService.id)
              .eq("barbershop_id", shop.id)
              .select("id")
              .single()
          : await supabase.from("services").insert(service);
        if (insertError) throw insertError;
      }
      setEditingService(null);
      setServiceName("");
      setServiceDuration("30");
      setCustomDurationOpen(false);
      setServicePrice("45");
      setServiceIcon("Scissors");
      setServiceFormOpen(false);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar serviço");
    } finally {
      setBusy(false);
    }
  }

  function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !shop?.id) return;
    const validationError = validateServiceImage(file);
    if (validationError) {
      setError(validationError);
      e.target.value = "";
      return;
    }
    setError(null);
    setServiceImageToCrop(file);
    e.target.value = "";
  }

  async function saveCroppedServiceImage(file: File) {
    if (!shop?.id) return;
    const validationError = validateServiceImage(file);
    if (validationError) throw new Error(validationError);
    setUploadingIcon(true);
    setError(null);
    try {
      const image = demo
        ? await serviceImageToDataUrl(file)
        : await uploadServiceImage(shop.id, file);
      setServiceIcon(image);
      setServiceIconQuery("");
      setServiceImageToCrop(null);
    } catch (cause) {
      throw new Error(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível enviar a imagem. Verifique o arquivo e tente novamente.",
      );
    } finally {
      setUploadingIcon(false);
    }
  }

  async function confirmDeleteService() {
    if (!deleteService || !shop) return;
    setBusy(true);
    setDeleteError(null);
    try {
      if (demo) {
        if (demo.appointments.some((row) => row.service_id === deleteService.id))
          throw new Error(
            "Este serviço possui agendamentos. Desative-o para preservar o histórico.",
          );
        demo.dispatch({ type: "service.delete", id: deleteService.id });
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("service.delete", { id: deleteService.id });
        if (!applied) {
          setDeleteService(null);
          return;
        }
      } else if (actor) {
        throw new Error("Seu papel não permite excluir serviços.");
      } else {
        const result = await supabase
          .from("services")
          .delete()
          .eq("id", deleteService.id)
          .eq("barbershop_id", shop.id)
          .select("id")
          .single();
        if (result.error)
          throw new Error(
            result.error.code === "23503"
              ? "Este serviço possui agendamentos. Desative-o para preservar o histórico."
              : "Não foi possível excluir o serviço. Tente novamente.",
          );
      }
      if (editingService?.id === deleteService.id) {
        setEditingService(null);
        setServiceName("");
        setServiceDuration("30");
        setCustomDurationOpen(false);
        setServicePrice("45");
      }
      setDeleteService(null);
      if (!demo) await loadCatalog();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteStaff() {
    if (!deleteStaff || !shop) return;
    setBusy(true);
    setDeleteError(null);
    try {
      if (demo) {
        if (demo.appointments.some((row) => row.staff_id === deleteStaff.id))
          throw new Error(
            "Este profissional possui agendamentos. Desative-o para preservar o histórico.",
          );
        demo.dispatch({ type: "staff.delete", id: deleteStaff.id });
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("staff.delete", { id: deleteStaff.id });
        if (!applied) {
          setDeleteStaff(null);
          return;
        }
      } else if (actor) {
        throw new Error("Seu papel não permite excluir profissionais.");
      } else {
        const result = await supabase
          .from("staff")
          .delete()
          .eq("id", deleteStaff.id)
          .eq("barbershop_id", shop.id)
          .select("id")
          .single();
        if (result.error)
          throw new Error(
            result.error.code === "23503"
              ? "Este profissional possui agendamentos. Desative-o para preservar o histórico."
              : "Não foi possível excluir o profissional. Tente novamente.",
          );
      }
      if (editingStaff?.id === deleteStaff.id) {
        setEditingStaff(null);
        setStaffName("");
        setStaffSlug("");
        setStaffSlugTouched(false);
      }
      setDeleteStaff(null);
      if (!demo) await loadCatalog();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleService(row: Tables<"services">) {
    if (demo) {
      demo.dispatch({ type: "service.toggle", id: row.id });
      return;
    }
    if (actor?.role === "associate" && actor.staff_id) {
      const { error: ownCatalogError } = await supabase.from("staff_services").upsert(
        {
          barbershop_id: shop!.id,
          staff_id: actor.staff_id,
          service_id: row.id,
          display_name: row.name,
          duration_minutes: row.duration_minutes,
          price_cents: row.price_cents,
          active: !row.active,
        },
        { onConflict: "staff_id,service_id" },
      );
      if (ownCatalogError) setError(ownCatalogError.message);
      else await loadCatalog();
      return;
    }
    if (actor && capabilities?.canProposeOperations) {
      try {
        await submitProtectedChange("service.toggle", { id: row.id, active: !row.active });
        await loadCatalog();
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : "Não foi possível alterar o serviço.",
        );
      }
      return;
    }
    const { error: updateError } = await supabase
      .from("services")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (updateError) setError(updateError.message);
    else await loadCatalog();
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!shop?.id) return;
    // Duplo envio criaria dois profissionais iguais.
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!staffName.trim()) throw new Error("Informe o nome do profissional.");
      const desiredSlug = slugifyPt(staffSlug || staffName);
      if (!desiredSlug || !isValidBookingSlug(desiredSlug)) {
        throw new Error("Informe um slug válido (letras minúsculas, números e hífen).");
      }
      const staff = {
        barbershop_id: shop.id,
        display_name: staffName.trim(),
        booking_slug: desiredSlug,
        active: editingStaff?.active ?? true,
      };
      if (demo) {
        demo.dispatch({
          type: editingStaff ? "staff.edit" : "staff.add",
          staff: {
            ...staff,
            user_id: editingStaff?.user_id ?? null,
            booking_slug: desiredSlug,
            id: editingStaff?.id ?? crypto.randomUUID(),
            created_at: editingStaff?.created_at ?? demo.now.toISOString(),
            updated_at: demo.now.toISOString(),
          },
        });
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange(
          editingStaff ? "staff.update" : "staff.create",
          {
            ...staff,
            id: editingStaff?.id,
          },
        );
        if (!applied) {
          setStaffFormOpen(false);
          return;
        }
      } else if (actor) {
        throw new Error("Seu papel não permite alterar a equipe.");
      } else {
        const { error: insertError } = editingStaff
          ? await supabase
              .from("staff")
              .update(staff)
              .eq("id", editingStaff.id)
              .eq("barbershop_id", shop.id)
              .select("id")
              .single()
          : await supabase.from("staff").insert(staff);
        if (insertError) throw insertError;
      }
      setEditingStaff(null);
      setStaffName("");
      setStaffSlug("");
      setStaffSlugTouched(false);
      setStaffFormOpen(false);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar barbeiro");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(row: Tables<"staff">) {
    if (demo) {
      demo.dispatch({ type: "staff.toggle", id: row.id });
      return;
    }
    if (actor && capabilities?.canProposeOperations) {
      try {
        await submitProtectedChange("staff.toggle", { id: row.id, active: !row.active });
        await loadCatalog();
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : "Não foi possível alterar o profissional.",
        );
      }
      return;
    }
    const { error: updateError } = await supabase
      .from("staff")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (updateError) setError(updateError.message);
    else await loadCatalog();
  }

  function updateHours(weekday: number, change: Partial<Tables<"business_hours">>) {
    setBusinessHours((rows) =>
      rows.map((row) => (row.weekday === weekday ? { ...row, ...change } : row)),
    );
  }

  async function saveBusinessHours() {
    if (!shop?.id) return;
    setBusy(true);
    setError(null);
    try {
      for (const row of businessHours) {
        if (row.is_open && row.closes_at <= row.opens_at) {
          throw new Error(`${weekdays[row.weekday]}: o fechamento deve ser após a abertura.`);
        }
      }
      if (demo) {
        demo.dispatch({ type: "hours.save", hours: businessHours });
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("hours.replace", {
          hours: businessHours.map(({ weekday, is_open, opens_at, closes_at }) => ({
            weekday,
            is_open,
            opens_at,
            closes_at,
          })),
        });
        if (!applied) return;
      } else if (actor) {
        throw new Error("Seu papel não permite alterar o funcionamento da barbearia.");
      } else {
        const payload = businessHours.map(({ weekday, is_open, opens_at, closes_at }) => ({
          barbershop_id: shop.id,
          weekday,
          is_open,
          opens_at,
          closes_at,
        }));
        const { error: saveError } = await supabase
          .from("business_hours")
          .upsert(payload, { onConflict: "barbershop_id,weekday" });
        if (saveError) throw saveError;
      }
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar horários");
    } finally {
      setBusy(false);
    }
  }

  async function createBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!shop?.id) return;
    setBusy(true);
    setError(null);
    try {
      // O horário digitado é a hora da parede da loja; converte para o instante correto.
      const startsAt = shopDateTime(blockDate, `${blockStart}:00`, shopTimeZone);
      const endsAt = shopDateTime(blockDate, `${blockEnd}:00`, shopTimeZone);
      if (endsAt <= startsAt) throw new Error("O fim do bloqueio deve ser após o início.");
      const block = {
        barbershop_id: shop.id,
        staff_id: blockStaffId || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: blockReason.trim() || null,
      };
      if (demo) {
        demo.dispatch({
          type: "block.add",
          block: { ...block, id: crypto.randomUUID(), created_at: demo.now.toISOString() },
        });
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("availability.create", block);
        if (!applied) return;
      } else if (actor?.role === "associate" && block.staff_id === actor.staff_id) {
        const { error: insertError } = await supabase.from("availability_blocks").insert(block);
        if (insertError) throw insertError;
      } else if (actor) {
        throw new Error(
          "Você só pode bloquear a própria agenda quando essa permissão estiver disponível.",
        );
      } else {
        const { error: insertError } = await supabase.from("availability_blocks").insert(block);
        if (insertError) throw insertError;
      }
      setBlockReason("");
      setBlockCustomOpen(false);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar bloqueio");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlock(id: string) {
    setBusy(true);
    setError(null);
    if (demo) demo.dispatch({ type: "block.delete", id });
    else if (actor && capabilities?.canProposeOperations) {
      try {
        await submitProtectedChange("availability.delete", { id });
      } catch (changeError) {
        setError(
          changeError instanceof Error
            ? changeError.message
            : "Não foi possível excluir o bloqueio.",
        );
      }
    } else if (actor?.role === "associate") {
      const { error: deleteError } = await supabase
        .from("availability_blocks")
        .delete()
        .eq("id", id)
        .eq("staff_id", actor.staff_id);
      if (deleteError) setError(deleteError.message);
    } else if (actor) {
      setError("Seu papel não permite excluir este bloqueio.");
    } else {
      const { error: deleteError } = await supabase
        .from("availability_blocks")
        .delete()
        .eq("id", id);
      if (deleteError) setError(deleteError.message);
    }
    await loadCatalog();
    setBusy(false);
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSettingsSaved(false);
    try {
      const next = {
        ...settings,
        tagline: settings.tagline.trim(),
        updated_at: new Date().toISOString(),
      };
      if (demo) {
        demo.dispatch({ type: "settings.save", settings: next });
        setSettings(next);
      } else if (actor && capabilities?.canProposeOperations) {
        const visualResult = await supabase
          .from("barbershop_settings")
          .update({
            tagline: next.tagline,
          })
          .eq("barbershop_id", settings.barbershop_id)
          .select("*")
          .single();
        if (visualResult.error) setError(visualResult.error.message);
        else {
          setSettings(visualResult.data);
          const applied = await submitProtectedChange("settings.operational", {
            booking_instructions: next.booking_instructions.trim(),
            booking_horizon_days: next.booking_horizon_days,
            survey_program_enabled: next.survey_program_enabled,
            waiting_enabled: next.waiting_enabled,
            waiting_cutoff_minutes: next.waiting_cutoff_minutes,
          });
          setSettingsSaved(applied);
        }
      } else if (actor) {
        throw new Error("Seu papel não permite alterar as configurações da barbearia.");
      } else {
        const { data, error: updateError } = await supabase
          .from("barbershop_settings")
          .update({
            tagline: next.tagline,
            booking_instructions: next.booking_instructions.trim(),
            booking_horizon_days: next.booking_horizon_days,
            survey_program_enabled: next.survey_program_enabled,
          })
          .eq("barbershop_id", settings.barbershop_id)
          .select("*")
          .single();
        if (updateError) setError(updateError.message);
        else setSettings(data);
      }
      if (!actor) setSettingsSaved(true);
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : "Não foi possível salvar as configurações.",
      );
    } finally {
      setBusy(false);
    }
  }

  const completedValue = appointments.reduce(
    (total, row) => total + (row.status === "completed" ? (row.service?.price_cents ?? 0) : 0),
    0,
  );
  const expectedValue = appointments.reduce(
    (total, row) =>
      total +
      (row.status === "pending" || row.status === "confirmed"
        ? (row.service?.price_cents ?? 0)
        : 0),
    0,
  );
  const cancelledCount = appointments.filter((row) => row.status === "cancelled").length;

  const normalizeSearch = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  const visibleServices = services.filter(
    (row) =>
      normalizeSearch(row.name).includes(normalizeSearch(serviceQuery)) &&
      (serviceStatus === "all" || row.active === (serviceStatus === "active")),
  );
  const visibleStaff = staff.filter(
    (row) =>
      normalizeSearch(row.display_name).includes(normalizeSearch(staffQuery)) &&
      (staffStatus === "all" || row.active === (staffStatus === "active")),
  );
  const filteredAppointments = appointments.filter(
    (row) =>
      (agendaScope === "team" || !actor?.staff_id || row.staff_id === actor.staff_id) &&
      (!agendaStaff || row.staff_id === agendaStaff) &&
      (!agendaStatus || row.status === agendaStatus) &&
      normalizeSearch(`${row.customer?.full_name ?? ""} ${row.service?.name ?? ""}`).includes(
        normalizeSearch(agendaSearch.trim()),
      ),
  );
  const agendaToday = shopDateKey(demo?.now ?? new Date(), shopTimeZone);
  const isAgendaToday = agendaDay === agendaToday;
  const agendaDayLabel = (() => {
    const [year, month, day] = agendaDay.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  })();
  // As capacidades vêm da matriz de permissões (com padrões por papel quando ela
  // ainda não foi carregada), então a interface acompanha o que o banco permite.
  const canEditServices = !actor || !!capabilities?.manageCatalog || !!capabilities?.editOwnCatalog;
  const canChangeGlobalCatalog = !actor || !!capabilities?.manageCatalog;
  const canManageTeam = !actor || !!capabilities?.manageTeam;
  // Horários inclui os próprios bloqueios, então o parceiro também entra.
  const canManageOperations =
    !actor || !!capabilities?.manageOperations || !!capabilities?.editOwnCatalog;
  // Ajustes da loja continuam restritos a quem gerencia a operação inteira.
  const canManageShopSettings = !actor || !!capabilities?.manageOperations;
  const canViewMoney = !actor || !!capabilities?.viewMoney;
  // Identidade visual: dono, sócio e parceiro personalizam a própria barbearia;
  // o contratado não.
  const canManageBranding = !actor || actor.role !== "employee";

  useEffect(() => {
    if (tab === "servicos" && !canEditServices) setTab("agenda");
    if (tab === "equipe" && !canManageTeam) setTab("agenda");
    if (tab === "horarios" && !canManageOperations) setTab("agenda");
    if (tab === "configuracoes" && !canManageShopSettings) setTab("agenda");
    if (agendaScope === "team" && actor && !capabilities?.viewFullShop) setAgendaScope("mine");
  }, [
    tab,
    canEditServices,
    canManageTeam,
    canManageOperations,
    canManageShopSettings,
    agendaScope,
    actor,
    capabilities?.viewFullShop,
  ]);

  const shopNavItems = (
    [
      { id: "agenda" as const, icon: Calendar, label: "Agenda" },
      { id: "servicos" as const, icon: Scissors, label: "Serviços" },
      { id: "equipe" as const, icon: Users, label: "Equipe" },
      { id: "horarios" as const, icon: Clock3, label: "Horários" },
      { id: "configuracoes" as const, icon: Settings2, label: "Ajustes" },
    ] as const
  ).filter(({ id }) => {
    if (id === "equipe") return canManageTeam;
    if (id === "horarios") return canManageOperations;
    if (id === "configuracoes") return canManageShopSettings;
    return true;
  });
  const activeNavIndex = shopNavItems.findIndex((item) => item.id === tab);

  return (
    <div
      className={`arena-workspace min-h-screen bg-background text-foreground ${brandFontScopeClass(settings?.font_scope)} ${brandCornerClass(settings?.corner_style)} ${settings?.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={
        settings
          ? (brandVariables(
              settings.primary_color,
              settings.accent_color,
              settings.font_family,
              settings.custom_font_url,
              settings.header_font_weight,
              settings.header_font_style,
              settings.corner_style,
            ) as CSSProperties)
          : undefined
      }
    >
      {settings && (
        <BrandFontFace url={settings.custom_font_url} faces={settings.custom_font_faces} />
      )}
      <AlertDialog
        open={!!withdrawTarget}
        onOpenChange={(open) => {
          if (!open && !updatingAppointment) setWithdrawTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar confirmação?</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawTarget &&
              settings &&
              canHold(
                withdrawTarget.starts_at,
                waiting.now,
                settings.waiting_enabled,
                settings.waiting_cutoff_minutes,
              )
                ? "O horário ficará retido por 10 minutos. Um interessado poderá aguardar e terá 5 minutos para confirmar após a liberação. Você poderá restaurar a confirmação durante a retenção."
                : "O horário será liberado imediatamente: a espera está desligada ou não há antecedência suficiente."}{" "}
              O cliente poderá remarcar ou cancelar definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!updatingAppointment}>Voltar</AlertDialogCancel>
            <button
              disabled={!!updatingAppointment}
              className="action-button action-danger"
              onClick={async () => {
                if (withdrawTarget) {
                  await setAppointmentStatus(withdrawTarget, "reschedule_requested");
                  setWithdrawTarget(null);
                }
              }}
            >
              <X className="size-4" />
              Retirar confirmação
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CancellationDialog
        open={!!cancelTarget}
        busy={updatingAppointment !== null}
        reason={cancelReason}
        onReason={setCancelReason}
        onCancel={() => {
          setCancelTarget(null);
          setCancelReason("");
        }}
        onConfirm={() => void cancelSelectedAppointment()}
      />
      <StaffSurveyDialog
        appointment={surveyTarget}
        open={!!surveyTarget}
        onClose={() => setSurveyTarget(null)}
        onSaved={() => setAgendaRefresh((value) => value + 1)}
      />
      <AlertDialog
        open={!!deleteService}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteService(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço “{deleteService?.name}” será removido do catálogo. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <button
              disabled={busy}
              onClick={() => void confirmDeleteService()}
              className="action-button action-danger"
            >
              <Trash2 className="size-4" />
              {busy ? "Excluindo…" : "Excluir serviço"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleteStaff}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteStaff(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional “{deleteStaff?.display_name}” será removido da equipe. Os bloqueios
              deste profissional também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <button
              disabled={busy}
              onClick={() => void confirmDeleteStaff()}
              className="action-button action-danger"
            >
              <Trash2 className="size-4" />
              {busy ? "Excluindo…" : "Excluir profissional"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl px-4 py-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gold">Gestão da barbearia</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">
            {shop?.name ?? "Sua barbearia"}
          </h1>
          {!demo && profile.shopActors.length > 1 && (
            <label className="mt-1 block text-[11px] text-muted-foreground">
              <span className="sr-only">Barbearia ativa</span>
              <select
                value={actor?.id ?? ""}
                onChange={(event) => setSelectedActorId(event.target.value)}
                className="max-w-48 rounded-lg border border-border bg-background px-2 py-1 font-semibold text-foreground"
              >
                {profile.shopActors.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.barbershop?.name ?? "Barbearia"} ·{" "}
                    {candidate.role === "owner"
                      ? "Dono"
                      : candidate.role === "partner"
                        ? "Sócio"
                        : candidate.role === "associate"
                          ? "Parceiro"
                          : "Contratado"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {headerActions}
          {profile.primaryRole === "platform_admin" && (
            <>
              <Link
                to="/platform"
                aria-label="Abrir painel da plataforma"
                className="app-icon-button sm:hidden"
              >
                <ShieldCheck size={20} />
              </Link>
              <Link
                to="/platform"
                className="hidden text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline"
              >
                Plataforma
              </Link>
            </>
          )}
          <button onClick={signOut} aria-label="Sair" className="app-icon-button">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-8">
        <div key={tab} className="mb-panel space-y-6">
          {!shop && (
            <EmptyState
              tone="scissors"
              title="Nenhuma barbearia vinculada"
              description="Esta conta ainda não tem uma loja associada para gerenciar."
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {governanceMessage && (
            <p
              role="status"
              className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200"
            >
              {governanceMessage}
            </p>
          )}
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {tab === "agenda" && shop && (
            <section className="mb-stagger space-y-4">
              <div className="app-section-title">
                <Calendar />
                <h2>Agenda</h2>
                {!demo && (
                  <button
                    type="button"
                    disabled={refreshingAgenda || busy || !!updatingAppointment}
                    onClick={() => setAgendaRefresh((v) => v + 1)}
                    className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${refreshingAgenda ? "animate-spin" : ""}`} />
                    {refreshingAgenda ? "Atualizando…" : "Atualizar"}
                  </button>
                )}
              </div>

              <div className="agenda-toolbar app-action-card p-3 sm:p-4">
                {actor && capabilities?.viewFullShop && (
                  <div className="agenda-scope" aria-label="Escopo da agenda">
                    <button
                      type="button"
                      aria-pressed={agendaScope === "mine"}
                      onClick={() => setAgendaScope("mine")}
                    >
                      <Calendar className="size-4" />
                      Minha agenda
                    </button>
                    <button
                      type="button"
                      aria-pressed={agendaScope === "team"}
                      onClick={() => setAgendaScope("team")}
                    >
                      <Users className="size-4" />
                      Equipe
                    </button>
                  </div>
                )}

                <div className="agenda-date-navigation">
                  <button
                    type="button"
                    aria-label="Ver dia anterior"
                    title="Dia anterior"
                    onClick={() => moveAgendaDay(-1)}
                    className="app-icon-button agenda-date-arrow"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <div className="agenda-date-current">
                    <span className="agenda-date-caption">
                      {isAgendaToday ? "Hoje" : "Data selecionada"}
                    </span>
                    <DatePicker
                      compact
                      label="Escolher outra data"
                      value={agendaDay}
                      onChange={setAgendaDay}
                      displayValue={agendaDayLabel}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Ver próximo dia"
                    title="Próximo dia"
                    onClick={() => moveAgendaDay(1)}
                    className="app-icon-button agenda-date-arrow"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  <button
                    type="button"
                    disabled={isAgendaToday}
                    aria-current={isAgendaToday ? "date" : undefined}
                    onClick={() => setAgendaDay(agendaToday)}
                    className="agenda-today-button"
                  >
                    Hoje
                  </button>
                </div>
              </div>

              <WaitingCards
                controller={waiting}
                mode="shop"
                staff={staff}
                day={agendaDay}
                onChanged={() => setAgendaRefresh((v) => v + 1)}
              />

              {/* Indicadores do dia em seção expansível (substitui os antigos cartões
                  soltos, que repetiam os mesmos números). */}
              <details className="app-action-card group overflow-hidden" open>
                <summary className="flex min-h-14 list-none items-center gap-3 px-4 text-sm font-bold [&::-webkit-details-marker]:hidden">
                  <BarChart3 className="size-5 text-gold" />
                  <span className="flex-1">Indicadores do dia</span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/70 p-3">
                  {actor ? (
                    <ProfessionalInsights
                      shopId={shop.id}
                      day={agendaDay}
                      revision={agendaRefresh}
                      staffId={actor.staff_id}
                      role={actor.role}
                    />
                  ) : (
                    <BusinessInsights shopId={shop?.id} day={agendaDay} revision={agendaRefresh} />
                  )}
                </div>
              </details>

              <div className="agenda-filters space-y-3 rounded-2xl border border-border bg-card p-4">
                <label className="block space-y-1 text-xs font-semibold">
                  <span className="sr-only">Buscar atendimento</span>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={agendaSearch}
                      onChange={(event) => setAgendaSearch(event.target.value)}
                      placeholder="Buscar cliente ou serviço"
                      className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm"
                    />
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0 space-y-1 text-xs font-semibold">
                    <span>Profissional</span>
                    <select
                      aria-label="Profissional"
                      value={agendaStaff}
                      onChange={(event) => setAgendaStaff(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
                    >
                      <option value="">Toda a equipe</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 space-y-1 text-xs font-semibold">
                    <span>Status</span>
                    <select
                      aria-label="Status"
                      value={agendaStatus}
                      onChange={(event) => setAgendaStatus(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="pending">Em revisão</option>
                      <option value="reschedule_requested">Remarcação solicitada</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span role="status">
                    {filteredAppointments.length} de {appointments.length} atendimentos
                  </span>
                  {(agendaSearch || agendaStaff || agendaStatus) && (
                    <button
                      onClick={() => {
                        setAgendaSearch("");
                        setAgendaStaff("");
                        setAgendaStatus("");
                      }}
                      className="underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>
              <div className="agenda-list" aria-label="Atendimentos do dia">
                {filteredAppointments.length > 0 && (
                  <div className="agenda-list-heading" aria-hidden="true">
                    <span>Horário</span>
                    <span>Cliente</span>
                    <span>Serviço</span>
                    <span>Profissional</span>
                    <span>Status</span>
                  </div>
                )}
                {filteredAppointments.map((row) => (
                  <article key={row.id} className="agenda-appointment app-action-card">
                    <div className="agenda-appointment-summary">
                      <div className="agenda-time" aria-label="Horário">
                        <Clock3 className="size-4" />
                        <span>{formatSlotLabel(new Date(row.starts_at), shopTimeZone)}</span>
                      </div>
                      <div className="agenda-client" data-label="Cliente">
                        <p>{row.customer?.full_name ?? "Cliente"}</p>
                      </div>
                      <div className="agenda-detail" data-label="Serviço">
                        <Scissors className="size-4" />
                        <span>{row.service?.name ?? "Serviço"}</span>
                      </div>
                      <div className="agenda-detail" data-label="Profissional">
                        <Users className="size-4" />
                        <span>{row.staff?.display_name ?? "—"}</span>
                      </div>
                      <div className="agenda-status" data-label="Status">
                        <span className={`status-pill status-${row.status}`}>
                          {
                            {
                              pending: "Em revisão",
                              reschedule_requested: "Remarcação solicitada",
                              confirmed: "Confirmado",
                              completed: "Concluído",
                              cancelled: "Cancelado",
                            }[row.status]
                          }
                        </span>
                      </div>
                    </div>
                    <div className="agenda-appointment-details">
                      {row.visibility !== "busy" && (
                        <AttendanceControls
                          id={row.id}
                          startsAt={row.starts_at}
                          endsAt={row.ends_at}
                          active={row.status === "pending" || row.status === "confirmed"}
                          status={row.status}
                          onChanged={() => setAgendaRefresh((v) => v + 1)}
                        />
                      )}
                      {row.visibility === "busy" && (
                        <p className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                          Horário ocupado por outro profissional. Os dados do cliente, serviço e
                          valores permanecem privados.
                        </p>
                      )}
                      {row.status === "cancelled" && cancellationDetails[row.id] && (
                        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                          Cancelado pelo{" "}
                          {cancellationDetails[row.id].source === "customer"
                            ? "cliente"
                            : "estabelecimento"}
                          {` · ${cancellationReasonLabel(cancellationDetails[row.id].reason)}`}
                        </p>
                      )}
                      {row.visibility !== "busy" && (
                        <div className="flex flex-wrap gap-2">
                          {row.status === "reschedule_requested" && (
                            <button
                              disabled={updatingAppointment !== null}
                              onClick={() => setCancelTarget(row)}
                              className="action-button action-danger"
                            >
                              <X className="size-4" />
                              Cancelar definitivamente
                            </button>
                          )}
                          {row.status === "confirmed" && (
                            <button
                              disabled={updatingAppointment !== null}
                              onClick={() => setWithdrawTarget(row)}
                              className="action-button action-danger"
                            >
                              <X className="size-4" />
                              Retirar confirmação
                            </button>
                          )}
                          {row.status === "pending" && (
                            <button
                              onClick={() => void setAppointmentStatus(row, "confirmed")}
                              disabled={updatingAppointment !== null}
                              className="action-button action-confirm"
                            >
                              <Check className="size-3.5" />
                              Confirmar
                            </button>
                          )}
                          {(row.status === "pending" || row.status === "confirmed") && (
                            <>
                              <button
                                onClick={() => void setAppointmentStatus(row, "completed")}
                                disabled={updatingAppointment !== null}
                                className="action-button action-success"
                              >
                                <CircleCheck className="size-3.5" />
                                Concluir
                              </button>
                              <button
                                onClick={() => setCancelTarget(row)}
                                disabled={updatingAppointment !== null}
                                className="action-button action-danger"
                              >
                                <X className="size-3.5" />
                                Cancelar
                              </button>
                            </>
                          )}
                          {row.status === "completed" &&
                            settings?.survey_program_enabled !== false && (
                              <button
                                onClick={() => setSurveyTarget(row)}
                                className="flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/30 px-3 text-xs font-bold text-primary"
                              >
                                <MessageSquarePlus className="size-3.5" />
                                Registrar opinião
                              </button>
                            )}
                        </div>
                      )}
                      {(row.status === "pending" || row.status === "confirmed") && (
                        <p className="text-xs text-muted-foreground">
                          Conclua somente se o cliente foi atendido: essa ação concede pontos. Em
                          caso de falta, use Ocorrências.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
                {filteredAppointments.length === 0 && !loading && (
                  <EmptyState
                    tone="calendar"
                    title={
                      appointments.length
                        ? "Nenhum atendimento corresponde aos filtros"
                        : "Nenhum agendamento nesta data"
                    }
                    description={
                      appointments.length
                        ? "Ajuste a busca, o profissional ou o status para ver outros horários."
                        : "Troque o dia ou aguarde novas reservas dos clientes."
                    }
                  />
                )}
              </div>

              {/* Extras: valores e visão do parceiro, abaixo da lista. */}
              {canViewMoney && (
                <section
                  aria-label="Resumo de valores do dia"
                  className="space-y-3 rounded-2xl border border-primary/20 bg-card p-4"
                >
                  <h3 className="text-sm font-bold">Resumo do dia</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Serviços concluídos</p>
                      <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(completedValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ainda agendado</p>
                      <p className="mt-1 text-xl font-bold text-primary">
                        {formatPrice(expectedValue)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Cancelamentos</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAgendaStatus("cancelled");
                        setAgendaSearch("");
                        setAgendaStaff("");
                      }}
                      className="action-button action-danger"
                      aria-label={`Ver ${cancelledCount} cancelamentos do dia`}
                    >
                      {cancelledCount}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Estimativa com os preços atuais.
                  </p>
                </section>
              )}
              {actor?.role === "associate" && shop?.id && actor.staff_id && (
                <div className="rounded-2xl border border-primary/20 bg-card p-4">
                  <PartnerOverview
                    shopId={shop.id}
                    staffId={actor.staff_id}
                    shopSlug={shop.slug}
                    bookingSlug={actor.staff?.booking_slug}
                    customDomain={shop.custom_domain}
                    customDomainStatus={shop.custom_domain_status}
                  />
                </div>
              )}
              {actor && (actor.role === "owner" || actor.role === "partner") && shop?.id && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <ClientDirectory
                    shopId={shop.id}
                    staffId={actor.staff_id}
                    scope="shop"
                    title="Clientes da barbearia"
                  />
                </div>
              )}
            </section>
          )}

          {tab === "servicos" && shop && (
            <section className="space-y-4">
              <div className="app-section-title">
                <Scissors />
                <h2>Serviços</h2>
                <button
                  type="button"
                  disabled={busy}
                  className="ml-auto flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
                  onClick={() => {
                    setEditingService(null);
                    setServiceName("");
                    setServiceDuration("30");
                    setCustomDurationOpen(false);
                    setServicePrice("45");
                    setServiceIcon("Scissors");
                    setError(null);
                    setServiceFormOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Adicionar
                </button>
              </div>
              <CatalogFilters
                query={serviceQuery}
                onQuery={setServiceQuery}
                status={serviceStatus}
                onStatus={setServiceStatus}
                total={services.length}
                active={services.filter((row) => row.active).length}
                visible={visibleServices.length}
                label="Buscar serviço"
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleServices.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-2 items-center gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="col-span-2 flex items-center gap-3">
                      <ServiceIcon
                        icon={s.icon}
                        className="size-9 shrink-0 rounded-xl bg-gold/10 p-2 text-gold"
                        imageClassName="size-18 shrink-0 rounded-2xl"
                      />
                      <div>
                        <p className="text-sm font-bold">{s.name}</p>
                        <span
                          className={
                            s.active
                              ? "text-xs text-emerald-700 dark:text-emerald-300"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {s.active ? "Disponível" : "Pausado"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        <span className="block text-lg font-bold tracking-normal text-foreground">
                          {formatPrice(s.price_cents)}
                        </span>
                        <span className="mt-1 flex items-center gap-1">
                          <Clock3 size={12} />
                          {s.duration_minutes} min
                        </span>
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Switch
                        disabled={busy || !canEditServices}
                        checked={s.active}
                        onCheckedChange={() => void toggleService(s)}
                        aria-label={`Ativar ${s.name}`}
                      />
                    </div>
                    {canEditServices && (
                      <button
                        disabled={busy}
                        className="action-button action-edit"
                        aria-label={`Editar ${s.name}`}
                        onClick={() => {
                          setEditingService(s);
                          setServiceName(s.name);
                          setServiceDuration(String(s.duration_minutes));
                          setServicePrice(String(s.price_cents / 100));
                          setServiceIcon(s.icon || "Scissors");
                          setError(null);
                          setServiceFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" /> Editar
                      </button>
                    )}
                    {canChangeGlobalCatalog && (
                      <button
                        disabled={busy}
                        aria-label={`Excluir ${s.name}`}
                        onClick={() => {
                          setDeleteService(s);
                          setDeleteError(null);
                        }}
                        className="action-button action-danger"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    )}
                  </div>
                ))}
                {visibleServices.length === 0 && !loading && (
                  <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {services.length
                      ? "Nenhum serviço corresponde aos filtros."
                      : "Adicione seu primeiro serviço pelo botão acima."}
                  </p>
                )}
              </div>

              <Dialog
                open={serviceFormOpen}
                onOpenChange={(open) => {
                  if (!busy) {
                    setServiceFormOpen(open);
                    if (!open) setServiceImageToCrop(null);
                  }
                }}
              >
                <DialogContent
                  className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-hidden rounded-3xl p-0 sm:rounded-3xl"
                  onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                  }}
                  onPointerDownOutside={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  <DialogScrollArea className="grid max-h-[calc(85dvh-2px)] gap-4 overflow-y-auto p-6">
                    <DialogTitle>{editingService ? "Editar serviço" : "Novo serviço"}</DialogTitle>
                    <DialogDescription>Nome, duração e valor para o agendamento.</DialogDescription>
                    <form
                      id="service-form"
                      onSubmit={createService}
                      className="space-y-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <label htmlFor="service-name" className="block text-xs font-semibold">
                        Nome do serviço
                      </label>
                      <input
                        id="service-name"
                        required
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder="Nome"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                      <div className="space-y-2">
                        <span className="block text-xs font-semibold">Duração</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["15", "20", "30", "45", "60", "90", "120"].map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              onClick={() => {
                                setServiceDuration(minutes);
                                setCustomDurationOpen(false);
                              }}
                              aria-pressed={serviceDuration === minutes}
                              className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition-colors ${
                                serviceDuration === minutes
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {minutes} min
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setCustomDurationOpen((value) => !value)}
                            aria-pressed={customDurationOpen}
                            className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition-colors ${
                              customDurationOpen
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-dashed border-border bg-background text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            Personalizado
                          </button>
                        </div>
                        {customDurationOpen && (
                          <label className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                            <span className="text-xs font-semibold">Duração personalizada</span>
                            <input
                              type="number"
                              min={5}
                              max={600}
                              step={5}
                              value={serviceDuration}
                              onChange={(e) => setServiceDuration(e.target.value)}
                              inputMode="numeric"
                              placeholder="min"
                              className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">min</span>
                          </label>
                        )}
                      </div>
                      <label className="space-y-2 text-xs font-semibold">
                        Preço (R$)
                        <input
                          required
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                          placeholder="Preço (R$)"
                          inputMode="decimal"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>

                      <div className="space-y-2 pt-2">
                        <span className="block text-xs font-semibold">
                          Imagem ou ícone do serviço
                        </span>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="search"
                            value={serviceIconQuery}
                            onChange={(e) => setServiceIconQuery(e.target.value)}
                            placeholder="Buscar ícone (ex.: navalha, unha, massagem)"
                            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => iconInputRef.current?.click()}
                            disabled={uploadingIcon}
                            aria-label="Enviar foto ou imagem do serviço"
                            title="Enviar foto ou imagem do serviço"
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
                          >
                            {uploadingIcon ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <>
                                <Upload className="size-4" />
                                Enviar foto
                              </>
                            )}
                          </button>
                          <input
                            ref={iconInputRef}
                            type="file"
                            accept={SERVICE_IMAGE_ACCEPT}
                            className="sr-only"
                            onChange={handleIconUpload}
                            disabled={uploadingIcon}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {serviceIconQuery.trim()
                              ? `${filteredIconGroups.reduce((total, group) => total + group.icons.length, 0)} ícones encontrados`
                              : "PNG, JPEG, WebP ou SVG · recorte quadrado · até 2 MB"}
                          </span>
                        </div>
                        <div className="app-service-icon-picker max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
                          {filteredIconGroups.length === 0 && (
                            <p className="py-4 text-center text-xs text-muted-foreground">
                              Nenhum ícone com esse nome. Tente outro termo ou envie uma imagem.
                            </p>
                          )}
                          {filteredIconGroups.map((group) => (
                            <div key={group.id} className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {group.label}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.icons.map((preset) => {
                                  const isSelected = serviceIcon === preset.id;
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => setServiceIcon(preset.id)}
                                      title={preset.label}
                                      aria-label={preset.label}
                                      aria-pressed={isSelected}
                                      className={`flex size-10 items-center justify-center rounded-xl border transition-colors ${
                                        isSelected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                                      }`}
                                    >
                                      <ServiceIcon
                                        icon={preset.id}
                                        className="size-5"
                                        imageClassName="size-10 rounded-xl"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {isServiceImageSource(serviceIcon) && (
                          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border p-2">
                            <img
                              src={serviceIcon}
                              alt="Ícone personalizado"
                              className="size-12 rounded-xl bg-muted object-cover"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              Imagem personalizada
                            </span>
                          </div>
                        )}
                      </div>

                      {error && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {busy ? "Salvando..." : editingService ? "Salvar serviço" : "Criar serviço"}
                      </button>
                      {editingService && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingService(null);
                            setServiceName("");
                            setServiceDuration("30");
                            setCustomDurationOpen(false);
                            setServicePrice("45");
                            setServiceFormOpen(false);
                          }}
                          className="text-sm underline"
                        >
                          Cancelar edição
                        </button>
                      )}
                    </form>
                  </DialogScrollArea>
                </DialogContent>
              </Dialog>
              <ServiceImageCropDialog
                file={serviceImageToCrop}
                onCancel={() => setServiceImageToCrop(null)}
                onConfirm={saveCroppedServiceImage}
              />
            </section>
          )}

          {tab === "equipe" && shop && (
            <section className="space-y-4">
              <div className="app-section-title">
                <Users />
                <h2>Equipe</h2>
                <button
                  type="button"
                  disabled={busy}
                  className="ml-auto flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffName("");
                    setStaffSlug("");
                    setStaffSlugTouched(false);
                    setError(null);
                    setStaffFormOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Adicionar
                </button>
              </div>
              <CatalogFilters
                query={staffQuery}
                onQuery={setStaffQuery}
                status={staffStatus}
                onStatus={setStaffStatus}
                total={staff.length}
                active={staff.filter((row) => row.active).length}
                visible={visibleStaff.length}
                label="Buscar profissional"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleStaff.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-2 items-center gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="col-span-2">
                      <Users className="mb-2 size-9 rounded-xl bg-gold/10 p-2 text-gold" />
                      <p className="text-sm font-bold">{member.display_name}</p>
                      {member.booking_slug ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          /{member.booking_slug}
                        </p>
                      ) : null}
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {member.active ? "Disponível" : "Desativado"}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      className="action-button action-edit"
                      aria-label={`Editar ${member.display_name}`}
                      onClick={() => {
                        setEditingStaff(member);
                        setStaffName(member.display_name);
                        setStaffSlug(member.booking_slug ?? slugifyPt(member.display_name));
                        setStaffSlugTouched(true);
                        setError(null);
                        setStaffFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" /> Editar
                    </button>
                    <button
                      disabled={busy}
                      aria-label={`Excluir ${member.display_name}`}
                      onClick={() => {
                        setDeleteStaff(member);
                        setDeleteError(null);
                      }}
                      className="action-button action-danger"
                    >
                      <Trash2 size={14} />
                      Excluir
                    </button>
                    <label className="col-span-2 flex items-center justify-between text-xs text-muted-foreground">
                      Aceitar reservas{" "}
                      <Switch
                        disabled={busy}
                        checked={member.active}
                        onCheckedChange={() => void toggleStaff(member)}
                        aria-label={`Ativar ${member.display_name}`}
                      />
                    </label>
                  </div>
                ))}
                {visibleStaff.length === 0 && !loading && (
                  <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {staff.length
                      ? "Nenhum profissional corresponde aos filtros."
                      : "Adicione seu primeiro profissional pelo botão acima."}
                  </p>
                )}
              </div>

              <Dialog
                open={staffFormOpen}
                onOpenChange={(open) => {
                  if (!busy) setStaffFormOpen(open);
                }}
              >
                <DialogContent
                  className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-hidden rounded-3xl p-0 sm:rounded-3xl"
                  onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                  }}
                  onPointerDownOutside={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  <DialogScrollArea className="grid max-h-[calc(85dvh-2px)] gap-4 overflow-y-auto p-6">
                    <DialogTitle>
                      {editingStaff ? "Editar profissional" : "Novo profissional"}
                    </DialogTitle>
                    <DialogDescription>
                      Nome e slug do link que o cliente usa para agendar com este profissional.
                    </DialogDescription>
                    <form
                      id="staff-form"
                      onSubmit={createStaff}
                      className="space-y-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <label htmlFor="staff-name" className="block text-xs font-semibold">
                        Nome do profissional
                      </label>
                      <input
                        id="staff-name"
                        required
                        value={staffName}
                        onChange={(e) => {
                          const next = e.target.value;
                          setStaffName(next);
                          if (!staffSlugTouched) setStaffSlug(slugifyPt(next));
                        }}
                        placeholder="Nome de exibição"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      />
                      <label htmlFor="staff-slug" className="block text-xs font-semibold">
                        Slug do link
                      </label>
                      <input
                        id="staff-slug"
                        required
                        value={staffSlug}
                        onChange={(e) => {
                          setStaffSlugTouched(true);
                          setStaffSlug(slugifyPt(e.target.value));
                        }}
                        placeholder="ex.: ezequiel"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <p className="text-xs text-muted-foreground">
                        Link:{" "}
                        <span className="font-semibold">
                          …/app?barber={staffSlug || "slug"}
                        </span>
                        {" · "}também funciona{" "}
                        <span className="font-semibold">/{staffSlug || "slug"}/</span> no domínio da
                        loja. Trocar o slug redireciona o link antigo.
                      </p>
                      {error && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {busy
                          ? "Salvando..."
                          : editingStaff
                            ? "Salvar profissional"
                            : "Criar barbeiro"}
                      </button>
                      {editingStaff && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingStaff(null);
                            setStaffName("");
                            setStaffSlug("");
                            setStaffSlugTouched(false);
                            setStaffFormOpen(false);
                          }}
                          className="text-sm underline"
                        >
                          Cancelar edição
                        </button>
                      )}
                    </form>
                  </DialogScrollArea>
                </DialogContent>
              </Dialog>
            </section>
          )}

          {tab === "horarios" && shop && (
            <section className="space-y-6">
              <div>
                <div className="app-section-title">
                  <Clock3 />
                  <h2>Horários</h2>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  Funcionamento semanal
                </h3>
                {businessHours.map((row) => (
                  <div
                    key={row.weekday}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:grid-cols-[120px_1fr]"
                  >
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Switch
                        checked={row.is_open}
                        aria-label={`${weekdays[row.weekday]} aberto`}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          updateHours(row.weekday, { is_open: checked })
                        }
                      />
                      {weekdays[row.weekday]}
                    </label>
                    {row.is_open ? (
                      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                        <TimePicker
                          label="Abertura"
                          value={row.opens_at.slice(0, 5)}
                          disabled={busy}
                          onChange={(value) => updateHours(row.weekday, { opens_at: value })}
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <TimePicker
                          label="Fechamento"
                          value={row.closes_at.slice(0, 5)}
                          disabled={busy}
                          onChange={(value) => updateHours(row.weekday, { closes_at: value })}
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">Fechado</span>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => void saveBusinessHours()}
                  disabled={busy}
                  className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar funcionamento"}
                </button>
              </div>

              <form
                onSubmit={createBlock}
                className="space-y-3 rounded-2xl border border-border bg-card p-4"
              >
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Novo bloqueio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Feriado, pausa ou indisponibilidade de um profissional.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <DatePicker
                    label="Data do bloqueio"
                    value={blockDate}
                    onChange={setBlockDate}
                    disabled={busy}
                  />
                  <TimePicker
                    label="Início"
                    value={blockStart}
                    onChange={setBlockStart}
                    disabled={busy}
                  />
                  <TimePicker label="Fim" value={blockEnd} onChange={setBlockEnd} disabled={busy} />
                </div>
                <div>
                  <label
                    htmlFor={blockStaffFieldId}
                    className="block text-xs font-semibold text-muted-foreground"
                  >
                    Profissional afetado
                  </label>
                  <select
                    id={blockStaffFieldId}
                    value={blockStaffId}
                    onChange={(e) => setBlockStaffId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Toda a barbearia</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        Somente {member.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={blockReasonFieldId}
                    className="block text-xs font-semibold text-muted-foreground"
                  >
                    Motivo
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {["Feriado", "Pausa", "Manutenção", "Falta do profissional"].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setBlockReason(reason);
                          setBlockCustomOpen(false);
                        }}
                        aria-pressed={blockReason === reason}
                        className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition-colors ${
                          blockReason === reason
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setBlockCustomOpen((value) => !value);
                        setBlockReason("");
                      }}
                      aria-pressed={blockCustomOpen}
                      className={`min-h-9 rounded-xl border px-3 text-xs font-bold transition-colors ${
                        blockCustomOpen
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-dashed border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      Personalizado
                    </button>
                  </div>
                  {blockCustomOpen && (
                    <label className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                      <span className="text-xs font-semibold">Qual o motivo?</span>
                      <input
                        id={blockReasonFieldId}
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        placeholder="Escreva o motivo"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                      />
                    </label>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Bloquear período"}
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground">Próximos bloqueios</h3>
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{block.reason ?? "Agenda bloqueada"}</p>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {formatShopDate(block.starts_at, shopTimeZone, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}{" "}
                        até {formatSlotLabel(new Date(block.ends_at), shopTimeZone)} ·{" "}
                        {block.staff?.display_name ?? "Toda a equipe"}
                      </p>
                    </div>
                    <button
                      onClick={() => void deleteBlock(block.id)}
                      disabled={busy}
                      aria-label="Excluir bloqueio"
                      className="action-button action-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum bloqueio futuro.</p>
                )}
              </div>
            </section>
          )}

          {tab === "configuracoes" && shop && settings && (
            <section className="space-y-6">
              <div>
                <div className="app-section-title">
                  <Settings2 />
                  <h2>Ajustes</h2>
                </div>
              </div>
              {canManageBranding && (
                <button
                  type="button"
                  onClick={() => setBrandOpen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
                >
                  <Palette className="size-5 text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">Identidade visual</span>
                    <span className="block text-xs text-muted-foreground">
                      Logo, nome, fonte, cores e fundo da logo da barbearia.
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )}
              {(!actor || actor.role === "owner" || actor.role === "partner" || !actor) && (
                <WhatsAppSettingsCard shopId={shop.id} />
              )}
              {!demo && (!actor || actor.role === "owner" || actor.role === "partner" || actor.role === "associate") && (
                <GoogleIntegrationsCard returnPath="/shop" />
              )}
              {!demo && shop.id && (!actor || actor.role === "owner" || actor.role === "partner") && (
                <ShopDomainCard shopId={shop.id} />
              )}
              {!demo && shop.id && (
                <SlugRedirectsCard
                  shopId={shop.id}
                  currentShopSlug={shop.slug}
                  canManageShopRedirects={
                    !actor || actor.role === "owner" || actor.role === "partner"
                  }
                />
              )}
              {!demo && shop.id && actor && (
                <ShopDepartureCard
                  shopId={shop.id}
                  canApproveRelease={actor.role === "owner" || actor.role === "partner"}
                  canRequestDeparture={
                    actor.role === "owner" ||
                    actor.role === "partner" ||
                    actor.role === "associate"
                  }
                />
              )}
              {!demo && actor && (
                <TeamGovernance
                  key={governanceRevision}
                  shopId={shop.id}
                  profile={effectiveProfile}
                  onChanged={() => {
                    setGovernanceRevision((value) => value + 1);
                    void loadCatalog();
                  }}
                />
              )}
              <WaitingSettings
                settings={settings}
                onSaved={setSettings}
                onSaveRequest={
                  !demo && actor
                    ? async (enabled, cutoff) => {
                        const applied = await submitProtectedChange("settings.operational", {
                          waiting_enabled: enabled,
                          waiting_cutoff_minutes: cutoff,
                        });
                        if (applied) await loadCatalog();
                        return applied ? "applied" : "pending";
                      }
                    : undefined
                }
              />
              <form
                onSubmit={saveSettings}
                className="space-y-5 rounded-2xl border border-border bg-card p-5"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="shop-tagline"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Frase abaixo do nome
                  </label>
                  <input
                    id="shop-tagline"
                    required
                    maxLength={60}
                    value={settings.tagline}
                    onChange={(event) => {
                      setSettingsSaved(false);
                      setSettings({ ...settings, tagline: event.target.value });
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Aparece no cabeçalho do aplicativo do cliente.
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="booking-instructions"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Orientação para o agendamento
                  </label>
                  <textarea
                    id="booking-instructions"
                    maxLength={240}
                    rows={3}
                    value={settings.booking_instructions}
                    onChange={(event) => {
                      setSettingsSaved(false);
                      setSettings({ ...settings, booking_instructions: event.target.value });
                    }}
                    placeholder="Ex.: chegue 5 minutos antes."
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm"
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {settings.booking_instructions.length}/240
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="booking-horizon"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Agenda aberta por
                  </label>
                  <select
                    id="booking-horizon"
                    value={settings.booking_horizon_days}
                    onChange={(event) => {
                      setSettingsSaved(false);
                      setSettings({
                        ...settings,
                        booking_horizon_days: Number(event.target.value),
                      });
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                  >
                    {[7, 14, 21, 30].map((days) => (
                      <option key={days} value={days}>
                        {days} dias
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 p-4">
                  <div>
                    <p className="text-sm font-bold">Pesquisas com clientes</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Controla o programa da barbearia. A escolha individual de cada cliente
                      continua sendo respeitada.
                    </p>
                  </div>
                  <Switch
                    checked={settings.survey_program_enabled}
                    onCheckedChange={(checked) => {
                      setSettingsSaved(false);
                      setSettings({ ...settings, survey_program_enabled: checked });
                    }}
                    aria-label="Ativar pesquisas com clientes"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar configurações"}
                </button>
                {settingsSaved && (
                  <p role="status" className="text-center text-xs font-semibold text-primary">
                    Configurações salvas.
                  </p>
                )}
              </form>
            </section>
          )}
        </div>

        {!demo && (
          <section className="space-y-3">
            <div className="app-section-title">
              <KeyRound />
              <h2>Sua conta</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Altere a senha de acesso desta conta. Vale para o painel da barbearia e para o restante
              do sistema.
            </p>
            <ChangePasswordCard />
          </section>
        )}
      </main>

      <nav
        className="app-mobile-nav app-mobile-nav-floating fixed left-4 right-4 z-40 mx-auto grid max-w-3xl overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${shopNavItems.length}, minmax(0, 1fr))` }}
        aria-label="Navegação principal"
      >
        <span
          aria-hidden
          className="app-mobile-nav-indicator"
          style={{
            width: `calc((100% - 0.9rem - ${(shopNavItems.length - 1) * 0.3}rem) / ${shopNavItems.length})`,
            transform: `translateX(calc(${Math.max(0, activeNavIndex)} * (100% + 0.3rem)))`,
            opacity: activeNavIndex >= 0 ? 1 : 0,
          }}
        />
        {shopNavItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
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
        ))}
      </nav>

      {/* Identidade visual: dono, sócio e parceiro personalizam a barbearia. */}
      <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-3xl border-border bg-card p-0">
          <DialogScrollArea className="grid max-h-[calc(92dvh-2px)] gap-4 overflow-y-auto p-5 sm:p-6">
            <DialogTitle className="text-lg font-extrabold tracking-tight">
              Identidade visual
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O que você salvar aqui vale na hora para a equipe e para os clientes desta barbearia.
            </DialogDescription>
            {!shop || !settings ? (
              <p className="text-sm text-muted-foreground">Carregando identidade…</p>
            ) : (
              <BrandIdentityEditor
                key={shop.id}
                audience="shop"
                shopName={shop.name}
                settings={settings}
                mode={demo ? "demo" : "supabase"}
                onSaved={(next) => {
                  setSettings(next);
                  if (demo) demo.dispatch({ type: "settings.save", settings: next });
                }}
              />
            )}
          </DialogScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
