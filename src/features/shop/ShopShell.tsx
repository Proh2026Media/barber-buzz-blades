import { useWaiting } from "@/features/waiting/useWaiting";
import { WaitingSettings } from "@/features/waiting/WaitingSettings";
import {
  BookingOverview,
  BookingRulesSettings,
  type BookingRulesDraft,
} from "@/features/shop/settings/BookingRulesSettings";
import { BOOKING_CARD_IDS } from "@/features/shop/settings/booking-cards";
import { LoyaltySettingsSummary } from "@/features/loyalty/LoyaltySettingsSummary";
import { ServicesTab } from "./catalog/ServicesTab";
import { TeamTab } from "./catalog/TeamTab";
import { useCatalogExtras } from "./catalog/useCatalogExtras";
import {
  HasBookingsError,
  type SaveOutcome,
  type ServiceDraft,
  type ServiceSaveResult,
  type StaffDraft,
} from "./catalog/types";
import type { CancellationReason } from "@/features/insights/cancellation";
import { AgendaTab } from "./agenda/AgendaTab";
import { TeamGovernance } from "@/features/shop/settings/TeamGovernance";
import { countDecisionsForMe } from "@/features/shop/settings/decision-queue";
import { PartnerCatalogSuggestions } from "./PartnerCatalogSuggestions";
import { ShopTeamAccessCard } from "./ShopTeamAccessCard";
import { ShopSetupChecklist, type SetupTarget } from "./ShopSetupChecklist";
import { BrandIdentityEditor } from "@/features/shop/BrandIdentityEditor";
import { WhatsAppChannelCard } from "@/features/shop/settings/WhatsAppChannelCard";
import { SlugRedirectsCard } from "@/features/shop/settings/SlugRedirectsCard";
import { ShopDepartureCard } from "@/features/shop/settings/ShopDepartureCard";
import { ShopDomainCard } from "@/features/shop/settings/ShopDomainCard";
import { GoogleConnectionCard } from "@/features/shop/settings/GoogleConnectionCard";
import { SettingsHub } from "@/features/shop/settings/SettingsHub";
import { LandingEditor } from "@/features/shop/settings/LandingEditor";
import { AppearanceOverview, BrandSummaryCard } from "@/features/shop/settings/AppearanceOverview";
import { GuardedEditorDialog } from "@/features/shop/settings/GuardedEditorDialog";
import { ShopLinkCard } from "@/features/shop/settings/ShopLinkCard";
import { ThemeSettingsCard } from "@/features/shop/settings/ThemeSettingsCard";
import type { BrandStep } from "@/features/shop/BrandIdentityEditor";
import { parseLandingConfig } from "@/features/marketing/shop-landing";
import { CountBadge, LoadingState, Notice } from "@/components/visual";
import { SlotModeNotice, SlotModeSettings } from "@/features/shop/settings/SlotModeSettings";
import { ShopTimezoneCard } from "@/features/shop/settings/ShopTimezoneCard";
import { useSettingsSignals } from "@/features/shop/settings/useSettingsSignals";
import { shopPublicOrigin } from "@/lib/shop/host";
import {
  readSectionFromUrl,
  useSettingsSection,
  type SettingsSection,
} from "@/features/shop/settings/section";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import { useIsMobile } from "@/hooks/use-mobile";
import { HoursTab, type HoursAppointment } from "./hours/HoursTab";
import type { BlockDraft } from "./hours/BlockDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ShopAccountMenu, ShopSwitcher } from "./ShopAccountMenu";
import { RoleBadge } from "./roles";
import { MyAccessCard } from "./settings/MyAccessCard";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  KeyRound,
  Hourglass,
  Lightbulb,
  Palette,
  RefreshCw,
  Save,
  Scissors,
  Settings2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { t as tNow, useI18n, type MessageKey } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { capabilitiesFor, type SessionProfile } from "@/lib/auth/session";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";
import { useShopFavicon } from "@/lib/shop/favicon";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { useDemo } from "@/features/demo/context";
import {
  shopDateKey,
  shopDateTime,
  shopDayRange,
  shiftDateKey,
  validTimeZone,
  validPrepMinutes,
  type SlotMode,
} from "@/lib/shop/appointments";

import {
  serviceImageToDataUrl,
  uploadServiceImage,
  uploadStaffAvatar,
  validateServiceImage,
} from "@/lib/shop/service-image";
import { PartnerOverview } from "./PartnerOverview";
import { ClientDirectory } from "./ClientDirectory";
import { ThemeToggle } from "@/components/ThemeToggle";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { useAvailabilitySignal } from "@/lib/shop/availability-signal";
import { TermsUpdateGate } from "@/features/legal/TermsUpdateGate";
import { WhatsappConfirmBanner } from "@/features/customer/WhatsappConfirmBanner";

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

const weekdays = [
  "shop.weekday.0",
  "shop.weekday.1",
  "shop.weekday.2",
  "shop.weekday.3",
  "shop.weekday.4",
  "shop.weekday.5",
  "shop.weekday.6",
] as const satisfies readonly MessageKey[];

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

export function ShopShell({ profile, headerActions }: ShopShellProps) {
  useScrollIndicators();
  const { t } = useI18n();
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
    void Promise.all([
      supabase.rpc("get_shop_access_context", { p_shop_id: actor.barbershop_id }),
      supabase.rpc("get_my_shop_permissions", { p_shop_id: actor.barbershop_id }),
    ]).then(([contextResult, permissionResult]) => {
      if (!active) return;
      let mode: SessionProfile["governanceMode"] = null;
      let canApply = false;
      if (
        !contextResult.error &&
        contextResult.data &&
        typeof contextResult.data === "object" &&
        !Array.isArray(contextResult.data)
      ) {
        const context = contextResult.data as {
          governance_mode?: unknown;
          can_apply_protected_change?: unknown;
        };
        if (["single", "equal", "majority"].includes(String(context.governance_mode))) {
          mode = context.governance_mode as SessionProfile["governanceMode"];
        }
        canApply = context.can_apply_protected_change === true;
      }
      let permissions: Record<string, boolean> | null = null;
      if (
        !permissionResult.error &&
        permissionResult.data &&
        typeof permissionResult.data === "object" &&
        !Array.isArray(permissionResult.data)
      ) {
        const payload = permissionResult.data as { permissions?: unknown };
        if (
          payload.permissions &&
          typeof payload.permissions === "object" &&
          !Array.isArray(payload.permissions)
        ) {
          permissions = payload.permissions as Record<string, boolean>;
        }
      }
      setGovernanceMode(mode);
      setCapabilities(capabilitiesFor(actor, mode, canApply, permissions));
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
    () => (readSectionFromUrl() ? "configuracoes" : "agenda"),
  );
  const [agendaRefresh, setAgendaRefresh] = useState(0);
  const [refreshingAgenda, setRefreshingAgenda] = useState(false);
  const [agendaDay, setAgendaDay] = useState(() =>
    shopDateKey(demo?.now ?? new Date(), validTimeZone(shop?.timezone)),
  );
  const [services, setServices] = useState<Tables<"services">[]>([]);
  const [staff, setStaff] = useState<Tables<"staff">[]>([]);
  const [appointments, setAppointments] = useState<DayAppointment[]>([]);
  const [businessHours, setBusinessHours] = useState<Tables<"business_hours">[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [settings, setSettings] = useState<Tables<"barbershop_settings"> | null>(null);
  useShopFavicon(settings?.logo_url);
  const [settingsSection, setSettingsSection] = useSettingsSection(tab === "configuracoes");
  const [brandOpen, setBrandOpen] = useState(false);
  const [landingOpen, setLandingOpen] = useState(false);
  const [brandStep, setBrandStep] = useState<BrandStep>("logo");
  const [governanceRevision, setGovernanceRevision] = useState(0);
  const [governanceMessage, setGovernanceMessage] = useState<string | null>(null);
  // Mudanças esperando a decisão de quem está vendo: viram bolha em Ajustes, aviso no topo da
  // Agenda e contador no menu de Ajustes. Conta como o painel de decisões (sem os próprios
  // pedidos nem os que a pessoa já aprovou), para o mesmo dado ter um número só.
  const [pendingDecisions, setPendingDecisions] = useState(0);
  const reviewsDecisions = !demo && (actor?.role === "owner" || actor?.role === "partner");
  const viewerId = profile.user.id;
  useEffect(() => {
    if (!reviewsDecisions || !actor) {
      setPendingDecisions(0);
      return;
    }
    let alive = true;
    void countDecisionsForMe(actor.barbershop_id, viewerId).then((count) => {
      if (alive && count != null) setPendingDecisions(count);
    });
    return () => {
      alive = false;
    };
  }, [reviewsDecisions, actor, viewerId, governanceRevision]);
  // Barbearias de quem está logado, com o papel em cada uma (troca pelo nome no cabeçalho).
  const shopChoices = demo
    ? []
    : profile.shopActors.map((candidate) => ({
        id: candidate.id,
        name: candidate.barbershop?.name ?? t("shop.header.shopName"),
        role: candidate.role,
      }));
  const waiting = useWaiting(shop?.id, true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatingAppointment, setUpdatingAppointment] = useState<string | null>(null);
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
  // Falha ao carregar serviços/equipe: fica até uma carga dar certo (não some ao trocar de aba),
  // para Serviços/Equipe não confundirem "não carregou" com "catálogo vazio".
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  // Falha ao carregar o funcionamento ou os bloqueios: só ela aparece na aba Horários.
  const [hoursLoadError, setHoursLoadError] = useState<string | null>(null);

  // Preço/duração da loja por serviço (o parceiro vê o próprio catálogo e compara com este).
  const [shopServiceTerms, setShopServiceTerms] = useState<
    Record<string, { price_cents: number; duration_minutes: number }>
  >({});
  // "Ver agenda dele" (Equipe) abre a Agenda já filtrada pelo profissional.
  const [agendaFocusStaff, setAgendaFocusStaff] = useState<string | null>(null);
  // Sugestões de preço esperando o parceiro decidir (0 esconde o atalho; null = não carregou).
  const [suggestionCount, setSuggestionCount] = useState<number | null>(0);
  // Equipe → "Bloquear horário": a aba Horários abre a janela de bloqueio com o profissional.
  const [hoursBlockRequest, setHoursBlockRequest] = useState<{ staffId: string | null } | null>(
    null,
  );
  const catalogRequestRef = useRef(0);

  async function loadCatalog() {
    if (demo) {
      catalogRequestRef.current += 1;
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
      setCatalogLoadError(null);
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
    // Só a carga mais recente aplica o resultado: em rede lenta, trocar de dia várias vezes
    // não deixa uma resposta antiga sobrescrever a agenda do dia escolhido.
    const requestId = ++catalogRequestRef.current;
    setLoading(true);
    setError(null);
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
      fetchDayAppointments(agendaDay),
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
    if (requestId !== catalogRequestRef.current) return;
    let catalogFailure: string | null = null;
    if (servicesResult.error) {
      catalogFailure = friendlyAuthError(servicesResult.error);
      setError(catalogFailure);
    } else {
      let visibleServices = servicesResult.data ?? [];
      if (actor?.role === "associate" && actor.staff_id) {
        const overrides = await supabase
          .from("staff_services")
          .select("*")
          .eq("barbershop_id", shop.id)
          .eq("staff_id", actor.staff_id);
        if (requestId !== catalogRequestRef.current) return;
        if (overrides.error) {
          catalogFailure = friendlyAuthError(overrides.error);
          setError(catalogFailure);
        } else {
          const byService = new Map((overrides.data ?? []).map((row) => [row.service_id, row]));
          setShopServiceTerms(
            Object.fromEntries(
              visibleServices.map((service) => [
                service.id,
                { price_cents: service.price_cents, duration_minutes: service.duration_minutes },
              ]),
            ),
          );
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
    if (staffResult.error) {
      catalogFailure = friendlyAuthError(staffResult.error);
      setError(catalogFailure);
    } else setStaff(staffResult.data ?? []);
    setCatalogLoadError(catalogFailure);
    if (appointmentsResult.error) {
      setError(friendlyAuthError(appointmentsResult.error, t("shop.error.refreshAgenda")));
    } else setAppointments(appointmentsResult.data ?? []);
    if (hoursResult.error) setError(friendlyAuthError(hoursResult.error));
    else setBusinessHours(hoursResult.data?.length ? hoursResult.data : defaultHours(shop.id));
    if (blocksResult.error) setError(friendlyAuthError(blocksResult.error));
    else setBlocks(blocksResult.data ?? []);
    setHoursLoadError(
      hoursResult.error
        ? friendlyAuthError(hoursResult.error)
        : blocksResult.error
          ? friendlyAuthError(blocksResult.error)
          : null,
    );
    if (settingsResult.error) setError(friendlyAuthError(settingsResult.error));
    else setSettings(settingsResult.data);
    setLoading(false);
  }

  /**
   * Atendimentos de um dia da loja. Quem tem papel na equipe lê pela RPC get_team_schedule
   * (que esconde os cancelados); os cancelados que o RLS libera para a pessoa vêm de uma
   * consulta direta, para o contador e o filtro "Cancelado" funcionarem.
   */
  async function fetchDayAppointments(
    day: string,
  ): Promise<{ data: DayAppointment[]; error: null } | { data: null; error: unknown }> {
    if (!shop?.id) return { data: [], error: null };
    const shopId = shop.id;
    const range = shopDayRange(day, shopTimeZone);
    const dayStart = range.start.toISOString();
    const dayEnd = range.end.toISOString();
    const directQuery = (onlyCancelled: boolean) => {
      let query = supabase
        .from("appointments")
        .select(
          "*, service:services(name, price_cents), staff:staff(display_name), customer:profiles(full_name)",
        )
        .eq("barbershop_id", shopId)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd);
      if (onlyCancelled) query = query.eq("status", "cancelled");
      return query.order("starts_at", { ascending: true });
    };
    if (!actor) {
      const result = await directQuery(false);
      if (result.error) return { data: null, error: result.error };
      return { data: (result.data ?? []) as DayAppointment[], error: null };
    }
    const [scheduleResult, cancelledResult] = await Promise.all([
      supabase.rpc("get_team_schedule", { p_shop_id: shopId, p_from: dayStart, p_to: dayEnd }),
      directQuery(true),
    ]);
    if (scheduleResult.error) return { data: null, error: scheduleResult.error };
    const rows = Array.isArray(scheduleResult.data) ? scheduleResult.data : [];
    const scheduled: DayAppointment[] = rows.map((value) => {
      const row = value as Record<string, unknown>;
      return {
        id: String(row.id),
        barbershop_id: shopId,
        customer_id: "",
        service_id: "",
        staff_id: String(row.staff_id),
        starts_at: String(row.starts_at),
        ends_at: String(row.ends_at),
        status: row.status as Tables<"appointments">["status"],
        booked_price_cents: typeof row.price_cents === "number" ? row.price_cents : null,
        public_token: "",
        series_id: row.series_id ? String(row.series_id) : null,
        created_at: String(row.starts_at),
        updated_at: String(row.starts_at),
        service: row.service_name
          ? { name: String(row.service_name), price_cents: Number(row.price_cents ?? 0) }
          : null,
        staff: { display_name: String(row.staff_name ?? t("shop.staffFallback")) },
        customer: row.customer_name ? { full_name: String(row.customer_name) } : null,
        visibility: row.visibility === "full" ? "full" : "busy",
      };
    });
    // Falha ao ler os cancelados não derruba a agenda: só ficam de fora da lista.
    const known = new Set(scheduled.map((row) => row.id));
    const cancelled = cancelledResult.error
      ? []
      : ((cancelledResult.data ?? []) as DayAppointment[])
          .filter((row) => !known.has(row.id))
          .map((row) => ({ ...row, visibility: "full" as const }));
    return {
      data: [...scheduled, ...cancelled].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      error: null,
    };
  }

  useEffect(() => {
    void loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when shop changes
  }, [shop?.id, demo, agendaDay]);

  // Vale também para quem tem papel na equipe: a lista vem da mesma RPC usada na carga.
  useAvailabilitySignal(!demo && tab === "agenda" ? shop?.id : null, () =>
    setAgendaRefresh((value) => value + 1),
  );

  useEffect(() => {
    if (demo || !shop?.id || tab !== "agenda" || busy || updatingAppointment) return;
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      setRefreshingAgenda(true);
      try {
        const result = await fetchDayAppointments(agendaDay);
        if (cancelled) return;
        if (result.error) setError(tNow("shop.error.refreshAgenda"));
        else {
          setAppointments(result.data ?? []);
          // Só apaga o aviso da própria atualização: o efeito roda de novo quando uma ação
          // termina (busy/updatingAppointment) e não pode sumir com o erro dessa ação.
          const refreshError = tNow("shop.error.refreshAgenda");
          setError((current) => (current === refreshError ? null : current));
        }
      } catch {
        if (!cancelled) setError(tNow("shop.error.refreshAgenda"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDayAppointments lê actor e o fuso da loja
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

  async function signOut() {
    if (demo) {
      demo.exit();
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function submitProtectedChange(kind: string, payload: Json) {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    const { data, error: requestError } = await supabase.rpc("request_shop_change", {
      p_shop_id: shop.id,
      p_kind: kind,
      p_payload: payload,
    });
    if (requestError) throw requestError;
    const result = data as { status?: "applied" | "pending" } | null;
    if (result?.status === "pending") {
      setError(null);
      setGovernanceMessage(t("shop.governance.pending"));
      setGovernanceRevision((value) => value + 1);
      return false;
    }
    setGovernanceMessage(t("shop.governance.applied"));
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
    // A Agenda mostra o resultado no próprio cartão: aqui só grava e, se falhar, avisa quem chamou.
    setUpdatingAppointment(row.id);
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
    } finally {
      setUpdatingAppointment(null);
    }
  }

  async function cancelAgendaAppointment(row: DayAppointment, reason: CancellationReason | null) {
    setUpdatingAppointment(row.id);
    try {
      if (demo) demo.dispatch({ type: "cancel", id: row.id, reason, source: "shop" });
      else {
        const result = await supabase.rpc("cancel_appointment", { p_id: row.id, p_reason: reason });
        if (result.error) throw result.error;
        await loadCatalog();
      }
      setAgendaRefresh((value) => value + 1);
    } finally {
      setUpdatingAppointment(null);
    }
  }

  async function stopSeriesFromShop(seriesId: string) {
    // Na demonstração a janela já avisa que não há repetição de verdade (botão desativado).
    if (demo) return;
    setUpdatingAppointment(seriesId);
    try {
      const result = await supabase.rpc("stop_booking_series", { p_series_id: seriesId });
      if (result.error) throw result.error;
      await loadCatalog();
      setAgendaRefresh((value) => value + 1);
    } finally {
      setUpdatingAppointment(null);
    }
  }

  /**
   * Pedido aos sócios para serviço/profissional: as abas mostram o próprio resultado (aviso com
   * ícone e selo no cartão), então a faixa geral do painel não repete a mensagem.
   */
  async function submitCatalogChange(kind: string, payload: Json): Promise<SaveOutcome> {
    const applied = await submitProtectedChange(kind, payload);
    setGovernanceMessage(null);
    return applied ? "applied" : "pending";
  }

  /** Grava o serviço do formulário. Erros sobem com frase amigável para a janela mostrar. */
  async function saveService(
    draft: ServiceDraft,
    editingService: Tables<"services"> | null,
  ): Promise<ServiceSaveResult> {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    // Duplo envio criaria dois serviços iguais no catálogo.
    if (busy) throw new Error(t("catalog.service.saveError"));
    setBusy(true);
    try {
      const service = {
        barbershop_id: shop.id,
        name: draft.name,
        description: draft.description,
        duration_minutes: draft.duration_minutes,
        price_cents: draft.price_cents,
        active: editingService?.active ?? true,
        icon: draft.icon,
        ...(prepSupported ? { prep_minutes: draft.prep_minutes } : {}),
      };
      let suggestion: ServiceSaveResult["suggestion"];
      if (demo) {
        demo.dispatch({
          type: editingService ? "service.edit" : "service.add",
          service: {
            ...service,
            prep_minutes: service.prep_minutes ?? null,
            id: editingService?.id ?? crypto.randomUUID(),
            created_at: editingService?.created_at ?? demo.now.toISOString(),
            updated_at: demo.now.toISOString(),
          },
        });
      } else if (actor?.role === "associate") {
        if (!editingService || !actor.staff_id) {
          throw new Error(t("shop.error.associateNoCreate"));
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
        // A sugestão aos outros parceiros vem marcada no próprio formulário.
        if (draft.suggestToPartners) {
          const { error: suggestError } = await supabase.rpc("suggest_partner_catalog", {
            p_shop_id: shop.id,
            p_service_id: editingService.id,
            p_price_cents: service.price_cents,
            p_duration_minutes: service.duration_minutes,
            p_display_name: service.name,
          });
          suggestion = suggestError ? "failed" : "sent";
        }
      } else if (actor && capabilities?.canProposeOperations) {
        const outcome = await submitCatalogChange(
          editingService ? "service.update" : "service.create",
          {
            ...service,
            id: editingService?.id,
          },
        );
        if (outcome === "pending") return { outcome };
      } else if (actor) {
        throw new Error(t("shop.error.roleServices"));
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
      if (!demo) await loadCatalog();
      return { outcome: "applied", suggestion };
    } catch (err) {
      throw new Error(friendlyAuthError(err, t("catalog.service.saveError")));
    } finally {
      setBusy(false);
    }
  }

  /** Foto recortada do serviço ou do profissional → endereço da imagem gravada. */
  async function uploadCatalogPicture(file: File, kind: "service" | "staff") {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    const validationError = validateServiceImage(file);
    if (validationError) throw new Error(validationError);
    try {
      if (demo) return await serviceImageToDataUrl(file);
      return kind === "service"
        ? await uploadServiceImage(shop.id, file)
        : await uploadStaffAvatar(shop.id, file);
    } catch (cause) {
      throw new Error(
        cause instanceof Error && cause.message
          ? cause.message
          : t(kind === "service" ? "shop.error.uploadImage" : "shop.error.uploadStaffPhoto"),
      );
    }
  }

  async function removeService(deleteService: Tables<"services">): Promise<SaveOutcome> {
    if (!shop) throw new Error(t("shop.error.shopNotFound"));
    setBusy(true);
    try {
      if (demo) {
        if (demo.appointments.some((row) => row.service_id === deleteService.id))
          throw new HasBookingsError(t("shop.error.serviceHasBookings"));
        demo.dispatch({ type: "service.delete", id: deleteService.id });
      } else if (actor && capabilities?.canProposeOperations) {
        const outcome = await submitCatalogChange("service.delete", { id: deleteService.id });
        if (outcome === "pending") return outcome;
      } else if (actor) {
        throw new Error(t("shop.error.roleDeleteServices"));
      } else {
        const result = await supabase
          .from("services")
          .delete()
          .eq("id", deleteService.id)
          .eq("barbershop_id", shop.id)
          .select("id")
          .single();
        if (result.error) {
          if (result.error.code === "23503")
            throw new HasBookingsError(t("shop.error.serviceHasBookings"));
          throw new Error(t("shop.error.deleteService"));
        }
      }
      if (!demo) await loadCatalog();
      return "applied";
    } catch (err) {
      if (err instanceof HasBookingsError) throw err;
      throw new Error(friendlyAuthError(err, t("shop.error.deleteFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function removeStaff(deleteStaff: Tables<"staff">): Promise<SaveOutcome> {
    if (!shop) throw new Error(t("shop.error.shopNotFound"));
    setBusy(true);
    try {
      if (demo) {
        if (demo.appointments.some((row) => row.staff_id === deleteStaff.id))
          throw new HasBookingsError(t("shop.error.staffHasBookings"));
        demo.dispatch({ type: "staff.delete", id: deleteStaff.id });
      } else if (actor && capabilities?.canProposeOperations) {
        const outcome = await submitCatalogChange("staff.delete", { id: deleteStaff.id });
        if (outcome === "pending") return outcome;
      } else if (actor) {
        throw new Error(t("shop.error.roleDeleteStaff"));
      } else {
        const result = await supabase
          .from("staff")
          .delete()
          .eq("id", deleteStaff.id)
          .eq("barbershop_id", shop.id)
          .select("id")
          .single();
        if (result.error) {
          if (result.error.code === "23503")
            throw new HasBookingsError(t("shop.error.staffHasBookings"));
          throw new Error(t("shop.error.deleteStaff"));
        }
      }
      if (!demo) await loadCatalog();
      return "applied";
    } catch (err) {
      if (err instanceof HasBookingsError) throw err;
      throw new Error(friendlyAuthError(err, t("shop.error.deleteFailed")));
    } finally {
      setBusy(false);
    }
  }

  /** Liga/desliga "aparece para clientes". Erro sobe com frase amigável (nunca a do banco). */
  async function toggleService(row: Tables<"services">): Promise<SaveOutcome> {
    if (demo) {
      demo.dispatch({ type: "service.toggle", id: row.id });
      return "applied";
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
      if (ownCatalogError)
        throw new Error(friendlyAuthError(ownCatalogError, t("shop.error.toggleService")));
      await loadCatalog();
      return "applied";
    }
    if (actor && capabilities?.canProposeOperations) {
      try {
        const outcome = await submitCatalogChange("service.toggle", {
          id: row.id,
          active: !row.active,
        });
        await loadCatalog();
        return outcome;
      } catch (changeError) {
        throw new Error(friendlyAuthError(changeError, t("shop.error.toggleService")));
      }
    }
    const { error: updateError } = await supabase
      .from("services")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (updateError) throw new Error(friendlyAuthError(updateError, t("shop.error.toggleService")));
    await loadCatalog();
    return "applied";
  }

  async function saveStaff(
    draft: StaffDraft,
    editingStaff: Tables<"staff"> | null,
  ): Promise<SaveOutcome> {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    // Duplo envio criaria dois profissionais iguais.
    if (busy) throw new Error(t("catalog.staff.saveError"));
    setBusy(true);
    try {
      const desiredSlug = draft.booking_slug;
      const staff = {
        barbershop_id: shop.id,
        display_name: draft.display_name,
        booking_slug: desiredSlug,
        active: editingStaff?.active ?? true,
        bio: draft.bio,
        avatar_url: draft.avatar_url,
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
        const outcome = await submitCatalogChange(editingStaff ? "staff.update" : "staff.create", {
          ...staff,
          id: editingStaff?.id,
        });
        if (outcome === "pending") return outcome;
      } else if (actor) {
        throw new Error(t("shop.error.roleTeam"));
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
      if (!demo) await loadCatalog();
      return "applied";
    } catch (err) {
      throw new Error(friendlyAuthError(err, t("catalog.staff.saveError")));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(row: Tables<"staff">): Promise<SaveOutcome> {
    if (demo) {
      demo.dispatch({ type: "staff.toggle", id: row.id });
      return "applied";
    }
    if (actor && capabilities?.canProposeOperations) {
      try {
        const outcome = await submitCatalogChange("staff.toggle", {
          id: row.id,
          active: !row.active,
        });
        await loadCatalog();
        return outcome;
      } catch (changeError) {
        throw new Error(friendlyAuthError(changeError, t("shop.error.toggleStaff")));
      }
    }
    const { error: updateError } = await supabase
      .from("staff")
      .update({ active: !row.active })
      .eq("id", row.id);
    if (updateError) throw new Error(friendlyAuthError(updateError, t("shop.error.toggleStaff")));
    await loadCatalog();
    return "applied";
  }

  /**
   * Só a lista de bloqueios (mesma consulta da carga): não regrava o funcionamento, para não
   * apagar o que está sendo editado na semana. Na demonstração, a carga já roda após cada ação.
   */
  async function loadBlocks() {
    if (demo || !shop?.id) return;
    const { data, error: blocksError } = await supabase
      .from("availability_blocks")
      .select("*, staff:staff(display_name)")
      .eq("barbershop_id", shop.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
    if (!blocksError) setBlocks(data ?? []);
  }

  /** Atendimentos de um dia, para o bloqueio avisar quem já está marcado no horário. */
  async function loadHoursDay(day: string): Promise<HoursAppointment[]> {
    if (demo) {
      return demo.appointments
        .filter((row) => shopDateKey(new Date(row.starts_at), shopTimeZone) === day)
        .map((row) => ({
          ...row,
          staff: demo.staff.find((member) => member.id === row.staff_id) ?? null,
          customer: {
            full_name:
              row.customer_id === demo.customerId
                ? demo.customerName
                : (demo.customers.find((customer) => customer.id === row.customer_id)?.name ??
                  null),
          },
        }));
    }
    const result = await fetchDayAppointments(day);
    if (result.error) throw result.error;
    return result.data ?? [];
  }

  /**
   * Grava o funcionamento da semana (o rascunho fica na aba). Devolve "pending" quando vira pedido
   * aos sócios; erros sobem com a frase pronta para aparecer junto do botão.
   */
  async function saveBusinessHours(rows: Tables<"business_hours">[]): Promise<SaveOutcome> {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    try {
      for (const row of rows) {
        // O banco devolve "HH:MM:SS" e o seletor grava "HH:MM": compara só horas e minutos.
        if (row.is_open && row.closes_at.slice(0, 5) <= row.opens_at.slice(0, 5)) {
          throw new Error(t("shop.error.closeAfterOpen", { day: t(weekdays[row.weekday]) }));
        }
      }
      if (demo) {
        demo.dispatch({ type: "hours.save", hours: rows });
        return "applied";
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("hours.replace", {
          hours: rows.map(({ weekday, is_open, opens_at, closes_at }) => ({
            weekday,
            is_open,
            opens_at,
            closes_at,
          })),
        });
        // O resultado aparece junto do botão Salvar, não no topo da página.
        setGovernanceMessage(null);
        if (!applied) return "pending";
      } else if (actor) {
        throw new Error(t("shop.error.roleHours"));
      } else {
        const payload = rows.map(({ weekday, is_open, opens_at, closes_at }) => ({
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
      // Gravou: o salvo passa a ser o rascunho (sem recarregar a aba inteira).
      setBusinessHours(rows);
      return "applied";
    } catch (err) {
      throw new Error(friendlyAuthError(err, t("shop.error.saveHours")));
    }
  }

  async function createBlock(draft: BlockDraft): Promise<SaveOutcome> {
    if (!shop?.id) throw new Error(t("shop.error.shopNotFound"));
    try {
      // O horário escolhido é a hora da parede da loja; converte para o instante correto.
      const startsAt = shopDateTime(draft.date, `${draft.start}:00`, shopTimeZone);
      const endsAt = shopDateTime(draft.date, `${draft.end}:00`, shopTimeZone);
      if (endsAt <= startsAt) throw new Error(t("shop.error.blockEndAfterStart"));
      const block = {
        barbershop_id: shop.id,
        staff_id: ownBlocksOnly ? (actor?.staff_id ?? null) : draft.staffId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: draft.reason?.trim() || null,
      };
      if (demo) {
        demo.dispatch({
          type: "block.add",
          block: { ...block, id: crypto.randomUUID(), created_at: demo.now.toISOString() },
        });
        return "applied";
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("availability.create", block);
        setGovernanceMessage(null);
        if (!applied) return "pending";
      } else if (actor?.role === "associate" && block.staff_id === actor.staff_id) {
        const { error: insertError } = await supabase.from("availability_blocks").insert(block);
        if (insertError) throw insertError;
      } else if (actor) {
        throw new Error(t("shop.error.ownBlockOnly"));
      } else {
        const { error: insertError } = await supabase.from("availability_blocks").insert(block);
        if (insertError) throw insertError;
      }
      await loadBlocks();
      return "applied";
    } catch (err) {
      throw new Error(friendlyAuthError(err, t("shop.error.createBlock")));
    }
  }

  async function deleteBlock(id: string): Promise<SaveOutcome> {
    try {
      if (demo) {
        demo.dispatch({ type: "block.delete", id });
        return "applied";
      } else if (actor && capabilities?.canProposeOperations) {
        const applied = await submitProtectedChange("availability.delete", { id });
        setGovernanceMessage(null);
        if (!applied) return "pending";
      } else if (actor?.role === "associate") {
        const { error: deleteError } = await supabase
          .from("availability_blocks")
          .delete()
          .eq("id", id)
          .eq("staff_id", actor.staff_id);
        if (deleteError) throw deleteError;
      } else if (actor) {
        throw new Error(t("shop.error.roleDeleteBlock"));
      } else {
        const { error: deleteError } = await supabase
          .from("availability_blocks")
          .delete()
          .eq("id", id);
        if (deleteError) throw deleteError;
      }
      await loadBlocks();
      return "applied";
    } catch (err) {
      throw new Error(friendlyAuthError(err, t("shop.error.deleteBlock")));
    }
  }

  /**
   * Regras do agendamento (prazo, profissional, orientação e pesquisas). O rascunho fica no
   * cartão; aqui só grava e junta ao `settings` os campos salvos, sem apagar rascunhos de outros
   * cartões. Erros sobem para o cartão mostrar junto do botão.
   */
  async function saveBookingRules(draft: BookingRulesDraft): Promise<"applied" | "pending"> {
    if (!settings) throw new Error(t("shop.error.saveSettings"));
    const merge = (patch: Partial<Tables<"barbershop_settings">>) =>
      setSettings((current) => (current ? ({ ...current, ...patch } as typeof current) : current));
    if (demo) {
      const next = { ...settings, ...draft, updated_at: new Date().toISOString() };
      demo.dispatch({ type: "settings.save", settings: next });
      merge(draft);
      return "applied";
    }
    if (actor && capabilities?.canProposeOperations) {
      const applied = await submitProtectedChange("settings.operational", {
        booking_instructions: draft.booking_instructions,
        booking_horizon_days: draft.booking_horizon_days,
        survey_program_enabled: draft.survey_program_enabled,
        waiting_enabled: settings.waiting_enabled,
        waiting_cutoff_minutes: settings.waiting_cutoff_minutes,
        staff_assignment_mode: draft.staff_assignment_mode,
      });
      if (applied) merge(draft);
      return applied ? "applied" : "pending";
    }
    if (actor) throw new Error(t("shop.error.roleSettings"));
    const { data, error: updateError } = await supabase
      .from("barbershop_settings")
      .update(draft)
      .eq("barbershop_id", settings.barbershop_id)
      .select(
        "booking_instructions, booking_horizon_days, survey_program_enabled, staff_assignment_mode",
      )
      .single();
    if (updateError) throw updateError;
    merge(data as Partial<Tables<"barbershop_settings">>);
    return "applied";
  }

  async function saveSlotMode(
    mode: SlotMode,
    stepMinutes: number,
    prepMinutes: number,
  ): Promise<"applied" | "pending"> {
    if (!settings) throw new Error(t("shop.error.saveSettings"));
    const change = {
      slot_mode: mode,
      slot_step_minutes: stepMinutes,
      ...(prepSupported ? { prep_minutes: prepMinutes } : {}),
    };
    if (demo) {
      const next = { ...settings, ...change };
      demo.dispatch({ type: "settings.save", settings: next });
      setSettings(next);
      return "applied";
    }
    if (actor && capabilities?.canProposeOperations) {
      const applied = await submitProtectedChange("settings.operational", change);
      if (applied) await loadCatalog();
      return applied ? "applied" : "pending";
    }
    if (actor) throw new Error(t("shop.error.roleSettings"));
    const { data, error: updateError } = await supabase
      .from("barbershop_settings")
      .update(change)
      .eq("barbershop_id", settings.barbershop_id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    setSettings(data);
    return "applied";
  }

  function openSlotModeSettings() {
    setTab("configuracoes");
    setSettingsSection("agendamento");
  }

  // Quem faz cada serviço, quem entra no painel e o que espera os sócios (Serviços/Equipe).
  const catalogExtras = useCatalogExtras({
    shopId: shop?.id,
    demo: Boolean(demo),
    active: tab === "servicos" || tab === "equipe",
    withAccess: !!actor && (actor.role === "owner" || actor.role === "partner"),
    withApprovals: !!actor && !!capabilities?.canProposeOperations,
    revision: governanceRevision + services.length * 1000 + staff.length,
  });
  const catalogLinkOrigin = shop?.slug
    ? shopPublicOrigin({
        slug: shop.slug,
        customDomain: shop.custom_domain,
        customDomainStatus: shop.custom_domain_status,
      })
    : null;
  // Escopo, filtros, números do dia e linha do tempo da Agenda ficam em AgendaTab.
  const agendaToday = shopDateKey(demo?.now ?? new Date(), shopTimeZone);
  // Equipe sempre mostra o dia de HOJE de cada profissional. Quando a Agenda está aberta em
  // outro dia, os atendimentos de hoje são buscados à parte (só leitura, mesma consulta da Agenda).
  const [teamTodayAppointments, setTeamTodayAppointments] = useState<Array<{
    starts_at: string;
    ends_at: string;
    staff_id: string;
    status: string;
  }> | null>(null);
  useEffect(() => {
    if (tab !== "equipe" || agendaDay === agendaToday) return;
    if (demo) {
      setTeamTodayAppointments(
        demo.appointments.filter(
          (row) => shopDateKey(new Date(row.starts_at), shopTimeZone) === agendaToday,
        ),
      );
      return;
    }
    let cancelled = false;
    setTeamTodayAppointments(null);
    void fetchDayAppointments(agendaToday)
      .then((result) => {
        if (!cancelled) setTeamTodayAppointments(result.error ? null : result.data);
      })
      .catch(() => {
        if (!cancelled) setTeamTodayAppointments(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDayAppointments usa shop/actor atuais
  }, [tab, agendaDay, agendaToday, demo, shopTimeZone, shop?.id, agendaRefresh]);
  const teamToday = agendaDay === agendaToday ? appointments : (teamTodayAppointments ?? null);
  // As capacidades vêm da matriz de permissões (com padrões por papel quando ela
  // ainda não foi carregada), então a interface acompanha o que o banco permite.
  const canEditServices = !actor || !!capabilities?.manageCatalog || !!capabilities?.editOwnCatalog;
  const canChangeGlobalCatalog = !actor || !!capabilities?.manageCatalog;
  // Tempo de preparo só depois da migration 20261005120000 (antes a coluna não vem do banco).
  const prepSupported = !!settings && "prep_minutes" in settings;
  // O parceiro só personaliza serviços existentes; criar novos é de quem gere o catálogo e
  // pode propor mudanças (mesma regra de createService: funcionário cairia em roleServices).
  const canCreateServices =
    !!demo || !actor || (canChangeGlobalCatalog && !!capabilities?.canProposeOperations);
  const canManageTeam = !actor || !!capabilities?.manageTeam;
  // Horários inclui os próprios bloqueios, então o parceiro também entra.
  const canManageOperations =
    !actor || !!capabilities?.manageOperations || !!capabilities?.editOwnCatalog;
  // Funcionamento semanal: só quem pode propor mudanças na operação (ou o dono sem papel).
  const canEditBusinessHours = !!demo || !actor || !!capabilities?.canProposeOperations;
  // Parceiro sem poder de operação cria e remove apenas os próprios bloqueios.
  const ownBlocksOnly = !demo && actor?.role === "associate" && !capabilities?.canProposeOperations;
  // Ajustes da loja continuam restritos a quem gerencia a operação inteira.
  const canManageShopSettings = !actor || !!capabilities?.manageOperations;
  const canViewMoney = !actor || !!capabilities?.viewMoney;
  // Identidade visual só da marca da loja: dono/co-dono com poder de aplicar.
  const canManageBranding =
    !actor ||
    !!capabilities?.canApplyOperations ||
    actor.role === "owner" ||
    actor.role === "partner";
  const canManageShopChannels = !actor || actor.role === "owner" || actor.role === "partner";
  // Seções operacionais (agendamento, pontos, endereços) exigem gerir a operação; avisos do
  // Google, pedido de saída e idioma ficam abertos ao parceiro e ao funcionário.
  const settingsSections: SettingsSection[] = [
    ...(canManageBranding ? (["aparencia"] as const) : []),
    ...(canManageShopSettings ? (["agendamento"] as const) : []),
    ...(!demo && canManageShopSettings ? (["pontos"] as const) : []),
    ...(canManageShopChannels || (!demo && actor?.role === "associate")
      ? (["avisos"] as const)
      : []),
    ...(!demo && canManageShopSettings ? (["enderecos"] as const) : []),
    // Equipe e sociedade: todo papel vê "Seu acesso nesta barbearia" (e, quando pode, a saída).
    ...(!demo && actor ? (["equipe"] as const) : []),
    "idioma",
    // Troca de senha: fica em Ajustes, no grupo "Sua conta" (fora da demonstração).
    ...(!demo ? (["conta"] as const) : []),
  ];
  // A aba Ajustes aparece sempre que houver alguma seção permitida ao papel (idioma, no mínimo).
  const canOpenSettings = settingsSections.length > 0;
  // Estado do WhatsApp e prêmios esperando entrega, para o menu de Ajustes mostrar sem abrir.
  const settingsSignals = useSettingsSignals({
    shopId: shop?.id,
    active: tab === "configuracoes" && settingsSection === null,
    demo: Boolean(demo),
    channels: canManageShopChannels,
    loyalty: canManageShopSettings && settings?.loyalty_enabled === true,
  });
  // Passo do guia "Deixe sua barbearia pronta" (Agenda e "Precisa da sua atenção" em Ajustes).
  const openSetupTarget = (target: SetupTarget) => {
    if (target === "horarios" || target === "servicos") return setTab(target);
    setTab("configuracoes");
    setSettingsSection("aparencia");
    if (target === "landing") setLandingOpen(true);
    else {
      setBrandStep("logo");
      setBrandOpen(true);
    }
  };
  // "Ver pedido" (Serviços/Equipe): os pedidos aos sócios ficam em Ajustes → Equipe.
  const openApprovals = settingsSections.includes("equipe")
    ? () => {
        setTab("configuracoes");
        setSettingsSection("equipe");
        // Leva direto às decisões entre donos (topo da seção).
        window.setTimeout(
          () =>
            document
              .getElementById("team-decisions")
              ?.scrollIntoView({ block: "start", behavior: "smooth" }),
          120,
        );
      }
    : undefined;
  // "Abrir Pessoas e papéis" (saída da barbearia): fica na aba Equipe, logo após a lista.
  const openPeople = canManageTeam
    ? () => {
        setTab("equipe");
        window.setTimeout(
          () =>
            document
              .getElementById("team-access")
              ?.scrollIntoView({ block: "start", behavior: "smooth" }),
          160,
        );
      }
    : undefined;

  useEffect(() => {
    // Só redireciona com capacidades já resolvidas — evita bounce enquanto a matriz carrega.
    if (actor && !capabilities) return;
    if (tab === "servicos" && !canEditServices) setTab("agenda");
    if (tab === "equipe" && !canManageTeam) setTab("agenda");
    if (tab === "horarios" && !canManageOperations) setTab("agenda");
    if (tab === "configuracoes" && !canOpenSettings) setTab("agenda");
    // "Equipe" na Agenda some sozinho para quem não vê a loja toda (ver AgendaTab).
  }, [
    tab,
    canEditServices,
    canManageTeam,
    canManageOperations,
    canOpenSettings,
    actor,
    capabilities,
  ]);

  // Erro de uma aba não fica à mostra na outra.
  useEffect(() => {
    setError(null);
    // O filtro "agenda dele" (vindo de Equipe) vale só para aquela visita à Agenda.
    if (tab !== "agenda") setAgendaFocusStaff(null);
    // O aviso de mudança protegida é da tela que salvou: não acompanha a troca de aba.
    setGovernanceMessage(null);
  }, [tab]);

  // "Mudança aplicada" é confirmação, não pendência: some em 4 s (a pendência fica até fechar).
  useEffect(() => {
    if (!governanceMessage || governanceMessage !== tNow("shop.governance.applied")) return;
    const timer = window.setTimeout(() => setGovernanceMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [governanceMessage]);

  const shopNavItems = (
    [
      { id: "agenda" as const, icon: Calendar, label: t("shop.nav.agenda") },
      { id: "servicos" as const, icon: Scissors, label: t("shop.nav.services") },
      { id: "equipe" as const, icon: Users, label: t("shop.nav.team") },
      { id: "horarios" as const, icon: Clock3, label: t("shop.nav.hours") },
      { id: "configuracoes" as const, icon: Settings2, label: t("shop.nav.settings") },
    ] as const
  ).filter(({ id }) => {
    if (id === "servicos") return canEditServices;
    if (id === "equipe") return canManageTeam;
    if (id === "horarios") return canManageOperations;
    if (id === "configuracoes") return canOpenSettings;
    return true;
  });
  const activeNavIndex = shopNavItems.findIndex((item) => item.id === tab);

  const brandStyle = settings
    ? brandVariables(
        settings.primary_color,
        settings.accent_color,
        settings.font_family,
        settings.custom_font_url,
        settings.header_font_weight,
        settings.header_font_style,
        settings.corner_style,
      )
    : null;

  return (
    <div
      className={`arena-workspace min-h-screen bg-background text-foreground ${brandFontScopeClass(settings?.font_scope)} ${brandCornerClass(settings?.corner_style)} ${settings?.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={brandStyle ? (brandStyle as CSSProperties) : undefined}
    >
      <BrandRootVariables vars={brandStyle} />
      {settings && (
        <BrandFontFace url={settings.custom_font_url} faces={settings.custom_font_faces} />
      )}
      <TermsUpdateGate
        disabled={Boolean(demo)}
        withDpa={!actor || actor.role === "owner" || actor.role === "partner"}
      />
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl px-4 py-3">
        {/* Cabeçalho com largura fixa no computador: não muda de posição ao trocar de aba
            e não aperta o nome da loja nem o selo do papel nas abas estreitas. */}
        <div className="mx-auto flex w-full max-w-[70rem] items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Onde estou e com que papel: nome da loja (troca de loja) + selo do papel. */}
            <ShopSwitcher
              name={shop?.name ?? t("shop.header.shopFallback")}
              shops={shopChoices}
              currentId={actor?.id ?? ""}
              onSwitch={setSelectedActorId}
            />
            {actor ? (
              <RoleBadge role={actor.role} className="mt-0.5 max-w-full" />
            ) : (
              <p className="truncate text-xs font-bold text-gold">{t("shop.header.kicker")}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {headerActions}
            {/* Na demonstração a visão Plataforma e a saída ficam no frasco e no menu da conta. */}
            {!demo && (
              <ShopAccountMenu
                name={profile.profile?.full_name || profile.user.email || t("eq.account.open")}
                email={profile.user.email}
                role={actor?.role}
                shopName={shop?.name}
                shops={shopChoices}
                currentShopId={actor?.id ?? ""}
                onSwitchShop={setSelectedActorId}
                showPlatform={profile.primaryRole === "platform_admin"}
                onSignOut={() => void signOut()}
              />
            )}
          </div>
        </div>
      </header>

      {/* A Agenda usa a largura do computador em duas colunas; as outras abas seguem estreitas. */}
      <main
        className={`mx-auto max-w-3xl space-y-6 p-4 pb-8 ${tab === "agenda" || tab === "horarios" ? "shop-agenda-wide" : ""}`}
      >
        <div key={tab} className="mb-panel space-y-6">
          {!shop && (
            <EmptyState
              tone="scissors"
              title={t("shop.noShop.title")}
              description={t("shop.noShop.description")}
            />
          )}
          {/* Na Agenda o erro aparece junto da lista, com "Tentar de novo". */}
          {/* Serviços e Equipe mostram o erro de carga dentro da aba, com "Tentar de novo". */}
          {/* Horários também: o erro de carga fica dentro de "Sua semana". */}
          {error &&
            tab !== "agenda" &&
            tab !== "servicos" &&
            tab !== "equipe" &&
            tab !== "horarios" && <p className="text-sm text-destructive">{error}</p>}
          {/* Mudança aplicada: verde, some sozinha. Aguardando sócios: âmbar, até fechar. */}
          {governanceMessage && (
            <Notice
              tone={governanceMessage === t("shop.governance.applied") ? "success" : "pending"}
              title={governanceMessage}
              action={
                governanceMessage !== t("shop.governance.applied") && openApprovals
                  ? { label: t("eq.common.seeRequest"), icon: Hourglass, onClick: openApprovals }
                  : undefined
              }
              onDismiss={() => setGovernanceMessage(null)}
            />
          )}
          {loading &&
            tab !== "agenda" &&
            tab !== "servicos" &&
            tab !== "equipe" &&
            tab !== "horarios" && (
              <p className="text-sm text-muted-foreground">{t("shop.loading")}</p>
            )}

          {tab === "agenda" && shop && (
            <AgendaTab
              shopId={shop.id}
              timeZone={shopTimeZone}
              actor={actor ? { role: actor.role, staff_id: actor.staff_id } : null}
              canSeeTeam={!!actor && !!capabilities?.viewFullShop}
              canViewMoney={canViewMoney}
              canManageOperations={canManageOperations}
              onOpenHours={() => setTab("horarios")}
              day={agendaDay}
              today={agendaToday}
              onDayChange={setAgendaDay}
              focusStaffId={agendaFocusStaff}
              loading={loading}
              error={error}
              refreshing={refreshingAgenda}
              onRefresh={demo ? null : () => setAgendaRefresh((value) => value + 1)}
              revision={agendaRefresh}
              appointments={appointments}
              staff={staff}
              services={services}
              businessHours={businessHours}
              blocks={blocks}
              settings={settings}
              cancellationDetails={cancellationDetails}
              waiting={waiting}
              updating={busy || !!updatingAppointment}
              actions={{
                setStatus: setAppointmentStatus,
                cancel: cancelAgendaAppointment,
                stopSeries: stopSeriesFromShop,
              }}
              setup={
                !demo &&
                !loading &&
                settings &&
                (!actor || actor.role === "owner" || actor.role === "partner") && (
                  <>
                    {/* Mudanças esperando a decisão dos donos: no topo, com um botão que leva lá. */}
                    {pendingDecisions > 0 && openApprovals && (
                      <Notice
                        tone="pending"
                        icon={Hourglass}
                        role="none"
                        title={
                          pendingDecisions === 1
                            ? t("eq.attention.decisionsOne")
                            : t("eq.attention.decisionsMany", { count: pendingDecisions })
                        }
                        action={{ label: t("eq.attention.review"), onClick: openApprovals }}
                      >
                        {t("eq.attention.decisionsHint")}
                      </Notice>
                    )}
                    <ShopSetupChecklist
                      shopId={shop.id}
                      publicUrl={shopPublicOrigin({
                        slug: shop.slug,
                        customDomain: shop.custom_domain,
                        customDomainStatus: shop.custom_domain_status,
                      })}
                      services={services}
                      businessHours={businessHours}
                      settings={settings}
                      onOpen={openSetupTarget}
                    />
                  </>
                )
              }
              extras={[
                ...(actor?.role === "associate" && actor.staff_id
                  ? [
                      {
                        id: "partner",
                        icon: Wallet,
                        label: t("agenda.extra.partner"),
                        wide: true,
                        content: (
                          <PartnerOverview
                            shopId={shop.id}
                            staffId={actor.staff_id}
                            shopSlug={shop.slug}
                            bookingSlug={actor.staff?.booking_slug}
                            customDomain={shop.custom_domain}
                            customDomainStatus={shop.custom_domain_status}
                          />
                        ),
                      },
                      {
                        id: "suggestions",
                        icon: Lightbulb,
                        label: t("agenda.extra.suggestions"),
                        count: suggestionCount ?? undefined,
                        countLabel:
                          suggestionCount != null
                            ? t("team.suggest.countAria", { count: suggestionCount })
                            : undefined,
                        content: (
                          <PartnerCatalogSuggestions
                            shopId={shop.id}
                            staffId={actor.staff_id}
                            onCount={setSuggestionCount}
                          />
                        ),
                      },
                    ]
                  : []),
                ...(actor && (actor.role === "owner" || actor.role === "partner")
                  ? [
                      {
                        id: "clients",
                        icon: Users,
                        label: t("shop.clients.title"),
                        content: (
                          <div className="rounded-2xl border border-border bg-card p-4">
                            <ClientDirectory
                              shopId={shop.id}
                              staffId={actor.staff_id}
                              scope="shop"
                              title={t("shop.clients.title")}
                              openOnHash="agenda-extra-clients"
                            />
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}

          {tab === "servicos" && shop && (
            <ServicesTab
              shopId={shop.id}
              services={services}
              staff={staff}
              terms={catalogExtras.terms}
              loading={loading}
              loadError={error ?? catalogLoadError}
              catalogLoadFailed={Boolean(catalogLoadError)}
              onRetry={() => void loadCatalog()}
              canCreate={canCreateServices}
              canEdit={canEditServices}
              canChangeGlobal={canChangeGlobalCatalog}
              isAssociate={!demo && actor?.role === "associate"}
              shopTerms={shopServiceTerms}
              prepSupported={prepSupported}
              shopPrep={validPrepMinutes(settings?.prep_minutes)}
              awaiting={catalogExtras.awaiting}
              slotNotice={
                services.length > 0 ? (
                  <SlotModeNotice
                    settings={settings}
                    services={services}
                    hours={businessHours}
                    onOpenSettings={canManageShopSettings ? openSlotModeSettings : undefined}
                  />
                ) : null
              }
              actions={{
                save: saveService,
                toggle: toggleService,
                remove: removeService,
                uploadImage: (file) => uploadCatalogPicture(file, "service"),
              }}
              onOpenApprovals={openApprovals}
            />
          )}
          {tab === "equipe" && shop && (
            <TeamTab
              shopId={shop.id}
              staff={staff}
              services={services}
              terms={catalogExtras.terms}
              loading={loading}
              loadError={error ?? catalogLoadError}
              catalogLoadFailed={Boolean(catalogLoadError)}
              onRetry={() => void loadCatalog()}
              awaiting={catalogExtras.awaiting}
              linkOrigin={catalogLinkOrigin}
              timeZone={shopTimeZone}
              today={
                teamToday
                  ? {
                      appointments: teamToday,
                      blocks,
                      dayStart: shopDayRange(agendaToday, shopTimeZone).start.getTime(),
                      dayEnd: shopDayRange(agendaToday, shopTimeZone).end.getTime(),
                      now: (demo?.now ?? new Date()).getTime(),
                    }
                  : null
              }
              access={catalogExtras.access}
              accessCard={
                !demo && actor && (actor.role === "owner" || actor.role === "partner") ? (
                  <ShopTeamAccessCard
                    shopId={shop.id}
                    canApplyProtected={!!capabilities?.canApplyOperations}
                    canEditSociety={actor.role === "owner" || actor.role === "partner"}
                    staff={staff}
                    currentUserId={profile.user.id}
                    onOpenDecisions={openApprovals}
                    onChanged={() => {
                      setGovernanceRevision((value) => value + 1);
                      void loadCatalog();
                    }}
                  />
                ) : null
              }
              actions={{
                save: saveStaff,
                toggle: toggleStaff,
                remove: removeStaff,
                uploadPhoto: (file) => uploadCatalogPicture(file, "staff"),
              }}
              onOpenAgenda={(staffId) => {
                setAgendaFocusStaff(staffId);
                setAgendaDay(agendaToday);
                setTab("agenda");
              }}
              onBlockTime={
                canManageOperations
                  ? (staffId) => {
                      setHoursBlockRequest({ staffId });
                      setTab("horarios");
                    }
                  : undefined
              }
              onOpenApprovals={openApprovals}
            />
          )}

          {tab === "horarios" && shop && (
            <HoursTab
              shopId={shop.id}
              timeZone={shopTimeZone}
              demoNow={demo?.now}
              hours={businessHours}
              blocks={blocks}
              staff={staff}
              loading={loading}
              loadError={hoursLoadError}
              onRetry={() => void loadCatalog()}
              canEditHours={canEditBusinessHours}
              ownStaffId={ownBlocksOnly ? (actor?.staff_id ?? null) : null}
              slotNotice={{
                settings,
                services,
                onOpenSettings: canManageShopSettings ? openSlotModeSettings : undefined,
              }}
              onSaveHours={saveBusinessHours}
              onCreateBlock={createBlock}
              onDeleteBlock={deleteBlock}
              loadDayAppointments={loadHoursDay}
              blockRequest={hoursBlockRequest}
              onBlockRequestHandled={() => setHoursBlockRequest(null)}
              onOpenApprovals={openApprovals}
            />
          )}

          {tab === "configuracoes" && shop && settings && (
            <section className="space-y-6">
              <div>
                <div className="app-section-title">
                  <Settings2 />
                  <h2>{t("shop.nav.settings")}</h2>
                </div>
              </div>
              {(!actor || actor.role === "owner" || actor.role === "partner") && (
                <WhatsappConfirmBanner disabled={Boolean(demo)} variant="owner" />
              )}
              <SettingsHub
                sections={settingsSections}
                section={settingsSection}
                onSectionChange={setSettingsSection}
                setupGuideShopId={
                  !demo && (!actor || actor.role === "owner" || actor.role === "partner")
                    ? shop.id
                    : undefined
                }
                onSetupGuideShown={() => {
                  setSettingsSection(null);
                  setTab("agenda");
                }}
                setupGuide={
                  // Mesmas condições do guia na Agenda (fora da demonstração e só com o
                  // catálogo carregado, para não mostrar um passo errado por um instante).
                  !demo &&
                  !loading &&
                  (!actor || actor.role === "owner" || actor.role === "partner")
                    ? { shopId: shop.id, services, businessHours, onOpenStep: openSetupTarget }
                    : undefined
                }
                overview={{
                  settings,
                  publicUrl: shopPublicOrigin({
                    slug: shop.slug,
                    customDomain: shop.custom_domain,
                    customDomainStatus: shop.custom_domain_status,
                  }),
                  customDomain: shop.custom_domain,
                  customDomainStatus: shop.custom_domain_status,
                  ...settingsSignals,
                  pendingDecisions,
                  teamHint:
                    actor?.role === "associate"
                      ? t("eq.settings.teamHintAssociate")
                      : actor?.role === "employee"
                        ? t("eq.settings.teamHintEmployee")
                        : undefined,
                }}
                renderSection={(section) => {
                  const shopLink = (withDomainShortcut: boolean) => {
                    const landing = parseLandingConfig(settings.landing);
                    return (
                      <ShopLinkCard
                        publicUrl={shopPublicOrigin({
                          slug: shop.slug,
                          customDomain: shop.custom_domain,
                          customDomainStatus: shop.custom_domain_status,
                        })}
                        openHref={`/b/${shop.slug}`}
                        autoUrl={shopPublicOrigin({ slug: shop.slug })}
                        landingEnabled={landing.enabled}
                        blocks={{
                          staff: landing.show_staff,
                          today: landing.show_staff && landing.show_today,
                          services: landing.show_services,
                          hours: landing.show_hours,
                        }}
                        photo={settings.login_image_url}
                        logoUrl={settings.logo_url}
                        logoBackground={settings.logo_background_color}
                        primary={settings.primary_color ?? undefined}
                        hideLink={Boolean(demo)}
                        onEditPage={canManageBranding ? () => setLandingOpen(true) : undefined}
                        onOpenDomain={
                          withDomainShortcut && settingsSections.includes("enderecos")
                            ? () => setSettingsSection("enderecos")
                            : undefined
                        }
                      />
                    );
                  };
                  if (section === "aparencia") {
                    return (
                      <AppearanceOverview
                        brand={
                          <BrandSummaryCard
                            settings={settings}
                            shopName={shop.name}
                            onEdit={() => {
                              setBrandStep("logo");
                              setBrandOpen(true);
                            }}
                          />
                        }
                        page={shopLink(true)}
                      />
                    );
                  }
                  if (section === "agendamento") {
                    return (
                      <>
                        <BookingOverview settings={settings} timeZone={shopTimeZone} />
                        <SlotModeSettings
                          settings={settings}
                          services={services}
                          hours={businessHours}
                          onSave={saveSlotMode}
                        />
                        <BookingRulesSettings
                          settings={settings}
                          timeZone={shopTimeZone}
                          staffNames={staff
                            .filter((member) => member.active)
                            .map((member) => member.display_name)
                            .slice(0, 2)}
                          onSave={saveBookingRules}
                        />
                        <WaitingSettings
                          id={BOOKING_CARD_IDS.waiting}
                          settings={settings}
                          onSaved={(patch) =>
                            setSettings((current) => (current ? { ...current, ...patch } : current))
                          }
                          onSaveRequest={
                            !demo && actor
                              ? async (enabled, cutoff) => {
                                  const applied = await submitProtectedChange(
                                    "settings.operational",
                                    {
                                      waiting_enabled: enabled,
                                      waiting_cutoff_minutes: cutoff,
                                    },
                                  );
                                  if (applied) await loadCatalog();
                                  return applied ? "applied" : "pending";
                                }
                              : undefined
                          }
                        />
                        <ShopTimezoneCard
                          id={BOOKING_CARD_IDS.timezone}
                          shopId={shop?.id}
                          timeZone={shop?.timezone}
                          canEdit={!demo && canManageShopChannels}
                        />
                      </>
                    );
                  }
                  if (section === "pontos") {
                    return <LoyaltySettingsSummary enabled={settings.loyalty_enabled} />;
                  }
                  if (section === "avisos") {
                    return (
                      <>
                        {canManageShopChannels && <WhatsAppChannelCard shopId={shop.id} />}
                        {(canManageShopChannels || actor?.role === "associate") && (
                          <GoogleConnectionCard
                            shopId={shop.id}
                            returnPath="/shop?secao=avisos"
                            canCopyWholeShop={canManageShopChannels}
                          />
                        )}
                      </>
                    );
                  }
                  if (section === "enderecos") {
                    return (
                      <>
                        {shopLink(false)}
                        {canManageShopChannels && <ShopDomainCard shopId={shop.id} />}
                        <SlugRedirectsCard
                          shopId={shop.id}
                          currentShopSlug={shop.slug}
                          canManageShopRedirects={canManageShopChannels}
                        />
                      </>
                    );
                  }
                  if (section === "equipe" && actor) {
                    return (
                      <>
                        {/* Decisões pendentes primeiro; depois o próprio acesso e a saída. */}
                        <TeamGovernance
                          revision={governanceRevision}
                          shopId={shop.id}
                          profile={effectiveProfile}
                          services={services}
                          staff={staff}
                          businessHours={businessHours}
                          blocks={blocks}
                          settings={settings}
                          timeZone={shopTimeZone}
                          onChanged={() => {
                            setGovernanceRevision((value) => value + 1);
                            void loadCatalog();
                          }}
                        />
                        <MyAccessCard role={actor.role} capabilities={capabilities} />
                        <ShopDepartureCard
                          shopId={shop.id}
                          role={actor.role}
                          onOpenPeople={openPeople}
                          canApproveRelease={actor.role === "owner" || actor.role === "partner"}
                          canRequestDeparture={
                            actor.role === "owner" ||
                            actor.role === "partner" ||
                            actor.role === "associate"
                          }
                        />
                      </>
                    );
                  }
                  if (section === "idioma") {
                    return (
                      <div className="grid items-start gap-4 lg:grid-cols-2">
                        <LanguageSettingsCard />
                        <ThemeSettingsCard />
                      </div>
                    );
                  }
                  if (section === "conta") return <ChangePasswordCard />;
                  return null;
                }}
              />
            </section>
          )}
        </div>
      </main>

      <nav
        className="app-mobile-nav app-mobile-nav-floating fixed left-4 right-4 z-40 mx-auto grid max-w-3xl overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${shopNavItems.length}, minmax(0, 1fr))` }}
        aria-label={t("shop.nav.aria")}
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
            <span className="relative mb-1.5">
              <Icon
                className={`h-5 w-5 transition-transform duration-300 ease-out ${tab === id ? "scale-110" : ""}`}
              />
              {/* Decisões dos donos esperando: bolha no item Ajustes. */}
              {id === "configuracoes" && (
                <CountBadge
                  count={pendingDecisions}
                  tone="pending"
                  label={t("eq.nav.pending", { count: pendingDecisions })}
                  className="absolute -right-3 -top-2"
                />
              )}
            </span>
            {/* Abaixo de 340 px o rótulo diminui um pouco para não encostar na pílula da aba. */}
            <span className="text-xs font-semibold max-[339px]:text-[11px] max-[339px]:tracking-tight">
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* Página da barbearia: fechar com mudanças pergunta antes ("Sair sem salvar?"). */}
      <GuardedEditorDialog
        open={landingOpen}
        onOpenChange={setLandingOpen}
        className="max-w-5xl"
        title={t("landingEditor.title")}
        description={t("landingEditor.description")}
        descriptionHidden
      >
        {(guard) =>
          !shop || !settings ? (
            <LoadingState variant="cards" count={2} label={t("shop.brand.loading")} />
          ) : (
            <LandingEditor
              key={shop.id}
              shopId={shop.id}
              shopSlug={shop.slug}
              publicUrl={shopPublicOrigin({
                slug: shop.slug,
                customDomain: shop.custom_domain,
                customDomainStatus: shop.custom_domain_status,
              })}
              settings={settings}
              timeZone={shop.timezone}
              onSaved={setSettings}
              guard={guard}
              onChangePhoto={
                canManageBranding
                  ? () =>
                      guard.requestClose(() => {
                        setBrandStep("entrada");
                        setBrandOpen(true);
                      })
                  : undefined
              }
              onOpenDomain={
                settingsSections.includes("enderecos")
                  ? () =>
                      guard.requestClose(() => {
                        setTab("configuracoes");
                        setSettingsSection("enderecos");
                      })
                  : undefined
              }
            />
          )
        }
      </GuardedEditorDialog>

      {/* Identidade visual: dono, sócio e parceiro personalizam a barbearia. */}
      <GuardedEditorDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        title={t("shop.settings.brand")}
        description={t("shop.brand.description")}
        descriptionHidden
      >
        {(guard) =>
          !shop || !settings ? (
            <LoadingState variant="cards" count={2} label={t("shop.brand.loading")} />
          ) : (
            <BrandIdentityEditor
              key={`${shop.id}:${brandStep}`}
              audience="shop"
              shopName={shop.name}
              settings={settings}
              mode={demo ? "demo" : "supabase"}
              guard={guard}
              initialStep={brandStep}
              onSaved={(next) => {
                setSettings(next);
                if (demo) demo.dispatch({ type: "settings.save", settings: next });
              }}
            />
          )
        }
      </GuardedEditorDialog>
    </div>
  );
}
