import { DataRights } from "@/features/insights/DataRights";
import { SurveyCatalog } from "@/features/insights/SurveyCatalog";
import { BusinessInsights } from "@/features/insights/BusinessInsights";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Palette,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogScrollArea,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandIdentityEditor } from "@/features/shop/BrandIdentityEditor";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { ChangePasswordCard } from "@/features/auth/ChangePasswordCard";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { PlatformWhatsAppCard } from "./PlatformWhatsAppCard";
import { PlatformPermissionsEditor } from "./PlatformPermissionsEditor";
import { AccountManagersPanel } from "./AccountManagersPanel";
import { PlatformDashboard } from "./PlatformDashboard";
import { DemoAccountMenu, DemoRoleSelector } from "@/features/demo/DemoAccountMenu";
import { DemoTourHub } from "@/features/demo/DemoTourHub";
import { useDemoChrome } from "@/features/demo/chrome";
import { LoginPreviewDialog } from "@/features/shop/LoginPreviewDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SessionProfile } from "@/lib/auth/session";
import { friendlyAuthError } from "@/lib/auth/friendly-error";
import { t as tNow, useI18n } from "@/lib/i18n";
import {
  brandCornerClass,
  brandFontScopeClass,
  brandVariables,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CORNER_STYLE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_HEADER_FONT_STYLE,
  DEFAULT_HEADER_FONT_WEIGHT,
  DEFAULT_PRIMARY_COLOR,
  normalizeCornerStyle,
  normalizeHeaderFontStyle,
  normalizeHeaderFontWeight,
  normalizeLoginLayout,
} from "@/lib/shop/branding";

type PlatformShellProps = {
  profile: SessionProfile;
  headerActions?: ReactNode;
  demoMode?: boolean;
};

type InviteResult = {
  ok?: boolean;
  email?: string;
  created?: boolean;
  temporary_password?: string | null;
  error?: string;
  status?: string;
  barbershop?: { name: string; slug: string };
  role?: "owner" | "partner" | "associate" | "employee";
  ownership_percent?: number | null;
};

/** "America/Sao_Paulo" → "Horário de Brasília"; mantém o código se o navegador não souber o nome. */
function friendlyTimeZone(timeZone: string, locale: string) {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longGeneric" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function PlatformShell({ profile, headerActions, demoMode = false }: PlatformShellProps) {
  useScrollIndicators();
  const { t, intlLocale } = useI18n();
  const demoChrome = useDemoChrome();
  const [shops, setShops] = useState<Tables<"barbershops">[]>([]);
  const [memberships, setMemberships] = useState<
    Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">[]
  >([]);
  const [shopSearch, setShopSearch] = useState("");
  const [shopStatus, setShopStatus] = useState<"all" | "active" | "suspended">("all");
  const [statusTarget, setStatusTarget] = useState<Tables<"barbershops"> | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [platformTab, setPlatformTab] = useState<"overview" | "shops" | "insights" | "permissions">(
    "overview",
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteShopId, setInviteShopId] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "associate" | "employee">("employee");
  const [inviteOwnership, setInviteOwnership] = useState("50");
  const [inviteBusy, setInviteBusy] = useState(false);
  // Identificadores estáveis para associar rótulos visíveis aos campos dos formulários.
  const shopNameFieldId = useId();
  const shopSlugFieldId = useId();
  const inviteEmailFieldId = useId();
  const inviteNameFieldId = useId();
  const inviteShopFieldId = useId();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sportsModules, setSportsModules] = useState<Record<string, boolean>>({});
  const [loyaltyModules, setLoyaltyModules] = useState<Record<string, boolean>>({});
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
  const [brandShop, setBrandShop] = useState<Tables<"barbershops"> | null>(null);
  const [brandSettings, setBrandSettings] = useState<Tables<"barbershop_settings"> | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [demoShopId, setDemoShopId] = useState("");
  const [loginTourOpen, setLoginTourOpen] = useState(false);
  const [loginTourSettings, setLoginTourSettings] = useState<Tables<"barbershop_settings"> | null>(
    null,
  );
  const demoState = demoChrome?.state ?? null;
  const demoDispatch = demoChrome?.dispatch ?? null;

  const loadShops = useCallback(async () => {
    if (demoState) {
      setShops([demoState.shop]);
      setMemberships([
        ...demoState.customers.map((customer) => ({
          barbershop_id: demoState.shop.id,
          role: "customer" as const,
          user_id: customer.id,
        })),
        { barbershop_id: demoState.shop.id, role: "shop_admin" as const, user_id: "demo-admin" },
      ]);
      setSportsModules({ [demoState.shop.id]: demoState.settings.sports_enabled });
      setLoyaltyModules({ [demoState.shop.id]: demoState.settings.loyalty_enabled });
      setInviteShopId(demoState.shop.id);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [shopsResult, membershipsResult, modulesResult] = await Promise.all([
      supabase.from("barbershops").select("*").order("created_at", { ascending: true }),
      supabase.from("memberships").select("barbershop_id, role, user_id"),
      supabase.from("barbershop_settings").select("barbershop_id, sports_enabled, loyalty_enabled"),
    ]);
    const loadError = shopsResult.error || membershipsResult.error || modulesResult.error;
    if (loadError) {
      setError(friendlyAuthError(loadError, tNow("plat.shell.loadError")));
    } else {
      setShops(shopsResult.data ?? []);
      setMemberships(membershipsResult.data ?? []);
      setSportsModules(
        Object.fromEntries(
          (modulesResult.data ?? []).map((row) => [row.barbershop_id, row.sports_enabled]),
        ),
      );
      setLoyaltyModules(
        Object.fromEntries(
          (modulesResult.data ?? []).map((row) => [row.barbershop_id, row.loyalty_enabled]),
        ),
      );
      setInviteShopId((current) => current || shopsResult.data?.[0]?.id || "");
      setDemoShopId(
        (current) =>
          current ||
          shopsResult.data?.find((shop) => shop.status === "active")?.id ||
          shopsResult.data?.[0]?.id ||
          "",
      );
    }
    setLoading(false);
  }, [demoState]);

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (brandShop && demoState) setBrandSettings(demoState.settings);
  }, [brandShop, demoState]);

  async function openBranding(shop: Tables<"barbershops">) {
    setError(null);
    setBrandShop(shop);
    if (demoState) {
      setBrandSettings(demoState.settings);
      return;
    }
    setBrandLoading(true);
    setBrandSettings(null);
    const { data, error: settingsError } = await supabase
      .from("barbershop_settings")
      .select("*")
      .eq("barbershop_id", shop.id)
      .single();
    if (settingsError) {
      setError(friendlyAuthError(settingsError, t("plat.shell.brandOpenError")));
      setBrandShop(null);
    } else {
      setBrandSettings(data);
    }
    setBrandLoading(false);
  }

  async function openLoginTour() {
    setError(null);
    if (demoState) {
      setLoginTourSettings(demoState.settings);
      setLoginTourOpen(true);
      return;
    }
    if (!demoShopId) return;
    const { data, error: settingsError } = await supabase
      .from("barbershop_settings")
      .select("*")
      .eq("barbershop_id", demoShopId)
      .single();
    if (settingsError) {
      setError(friendlyAuthError(settingsError, t("plat.shell.loginPreviewError")));
      return;
    }
    setLoginTourSettings(data);
    setLoginTourOpen(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault();
    // Duplo clique ou dois Enter no mesmo tick inseririam duas barbearias.
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("barbershops").insert({
        name: name.trim(),
        status: "active",
      });
      if (insertError) throw insertError;
      setName("");
      setSlug("");
      await loadShops();
    } catch (err) {
      setError(friendlyAuthError(err, t("plat.shell.createError")));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(shop: Tables<"barbershops">) {
    const next = shop.status === "active" ? "suspended" : "active";
    if (demoDispatch) {
      demoDispatch({ type: "shop.update", shop: { status: next } });
      setStatusTarget(null);
      return;
    }
    setStatusBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("barbershops")
      .update({ status: next })
      .eq("id", shop.id);
    setStatusBusy(false);
    setStatusTarget(null);
    if (updateError) {
      setError(
        friendlyAuthError(
          updateError,
          next === "suspended" ? t("plat.status.suspendError") : t("plat.status.reactivateError"),
        ),
      );
    } else await loadShops();
  }

  async function toggleSports(shopId: string, enabled: boolean) {
    if (demoDispatch && demoState) {
      demoDispatch({
        type: "settings.save",
        settings: { ...demoState.settings, sports_enabled: enabled },
      });
      return;
    }
    setModuleBusy(shopId);
    setError(null);
    try {
      const result = await supabase.rpc("set_shop_sports_module", {
        p_shop_id: shopId,
        p_enabled: enabled,
      });
      if (result.error) throw result.error;
      setSportsModules((current) => ({ ...current, [shopId]: enabled }));
    } catch {
      setError(t("plat.shops.sportsError"));
    } finally {
      setModuleBusy(null);
    }
  }

  async function toggleLoyalty(shopId: string, enabled: boolean) {
    if (demoDispatch && demoState) {
      demoDispatch({
        type: "settings.save",
        settings: { ...demoState.settings, loyalty_enabled: enabled },
      });
      return;
    }
    setModuleBusy(shopId);
    setError(null);
    try {
      const result = await supabase.rpc("set_shop_loyalty_module", {
        p_shop_id: shopId,
        p_enabled: enabled,
      });
      if (result.error) throw result.error;
      setLoyaltyModules((current) => ({ ...current, [shopId]: enabled }));
    } catch {
      setError(t("plat.shops.loyaltyError"));
    } finally {
      setModuleBusy(null);
    }
  }

  async function inviteShopAdmin(e: React.FormEvent) {
    e.preventDefault();
    // Duplo envio criaria dois convites para o mesmo e-mail.
    if (inviteBusy) return;
    setInviteBusy(true);
    setInviteMessage(null);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error(t("plat.invite.invalidSession"));

      const { data, error: fnError } = await supabase.functions.invoke<InviteResult>(
        "invite-shop-admin",
        {
          body: {
            email: inviteEmail.trim(),
            barbershop_id: inviteShopId,
            full_name: inviteName.trim() || undefined,
            role: inviteRole,
            ownership_percent: inviteRole === "owner" ? Number(inviteOwnership) : undefined,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const shopLabel = data?.barbershop?.name ?? t("plat.invite.shopFallback");
      if (data?.created && data.temporary_password) {
        setInviteMessage(
          t("plat.invite.created", {
            email: data.email ?? inviteEmail,
            shop: shopLabel,
            password: data.temporary_password,
          }),
        );
      } else {
        setInviteMessage(
          t(data?.status === "pending" ? "plat.invite.linkedPending" : "plat.invite.linked", {
            email: data?.email ?? inviteEmail,
            shop: shopLabel,
            role:
              inviteRole === "owner"
                ? t("plat.invite.roleOwner")
                : inviteRole === "associate"
                  ? t("plat.invite.roleAssociate")
                  : t("plat.invite.roleEmployee"),
          }),
        );
      }
      setInviteEmail("");
      setInviteName("");
    } catch (err) {
      setError(friendlyAuthError(err, t("plat.invite.error")));
    } finally {
      setInviteBusy(false);
    }
  }

  const normalizedSearch = shopSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredShops = shops.filter(
    (shop) =>
      (shopStatus === "all" || shop.status === shopStatus) &&
      `${shop.name} ${shop.slug}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
  );
  const demoShop = shops.find((shop) => shop.id === demoShopId) ?? null;
  // Na demonstração, a visão Plataforma representa a mesma barbearia fictícia
  // das visões Cliente e Barbearia. Assim, a opção visual salva no editor pode
  // ser conferida nos três shells sem aplicar a marca de uma loja ao admin
  // global real, que gerencia várias unidades ao mesmo tempo.
  const demoBrandSettings = demoState?.settings ?? null;

  return (
    <div
      className={`arena-workspace min-h-screen bg-background text-foreground ${brandFontScopeClass(demoBrandSettings?.font_scope)} ${brandCornerClass(demoBrandSettings?.corner_style)} ${demoBrandSettings?.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={
        demoBrandSettings
          ? (brandVariables(
              demoBrandSettings.primary_color,
              demoBrandSettings.accent_color,
              demoBrandSettings.font_family,
              demoBrandSettings.custom_font_url,
              demoBrandSettings.header_font_weight,
              demoBrandSettings.header_font_style,
              demoBrandSettings.corner_style,
            ) as CSSProperties)
          : undefined
      }
    >
      {demoBrandSettings && (
        <BrandFontFace
          url={demoBrandSettings.custom_font_url}
          faces={demoBrandSettings.custom_font_faces}
        />
      )}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl px-4 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gold">{t("plat.header.eyebrow")}</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">
            {t("plat.header.title")}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {headerActions}
          {demoMode || demoChrome ? (
            <>
              <DemoAccountMenu />
              <DemoRoleSelector />
            </>
          ) : (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {profile.profile?.full_name ?? profile.user.email}
              </span>
              <Link
                to="/shop"
                aria-label={t("plat.header.openShop")}
                className="app-icon-button sm:hidden"
              >
                <Building2 size={20} />
              </Link>
              <Link
                to="/shop"
                aria-label={t("plat.header.openShop")}
                className="hidden text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline"
              >
                {t("plat.header.shop")}
              </Link>
              <button
                onClick={signOut}
                aria-label={t("plat.header.signOut")}
                className="app-icon-button"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
        <div key={platformTab} className="mb-panel space-y-6">
          <nav
            aria-label={t("plat.tabs.aria")}
            className="grid grid-cols-4 gap-1 rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-sm"
          >
            {[
              { id: "overview" as const, label: t("plat.tabs.overview"), icon: LayoutDashboard },
              { id: "shops" as const, label: t("plat.tabs.shops"), icon: Building2 },
              { id: "permissions" as const, label: t("plat.tabs.permissions"), icon: ShieldAlert },
              { id: "insights" as const, label: t("plat.tabs.insights"), icon: MessageSquareText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={platformTab === id}
                onClick={() => setPlatformTab(id)}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold text-muted-foreground transition-all aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {platformTab === "overview" && (
            <>
              <PlatformDashboard
                shops={shops}
                memberships={memberships}
                sportsModules={sportsModules}
                loading={loading}
              />
              {!demoMode && <PlatformWhatsAppCard />}
              {demoMode ? (
                <section className="space-y-3 rounded-3xl border border-primary/20 bg-card p-5">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={18} className="text-primary" />
                    <h2 className="text-sm font-semibold">{t("plat.demo.title")}</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("plat.demo.body")}
                  </p>
                </section>
              ) : (
                <>
                  <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
                    {t("plat.tour.shopLabel")}
                    <select
                      value={demoShopId}
                      onChange={(event) => setDemoShopId(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                          {shop.status === "suspended" ? t("plat.shops.suspendedSuffix") : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <DemoTourHub
                    shopId={demoShopId}
                    shopName={shops.find((shop) => shop.id === demoShopId)?.name}
                    disabled={!demoShopId}
                    onPreviewLogin={() => void openLoginTour()}
                  />
                </>
              )}
            </>
          )}

          {platformTab === "insights" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="app-section-title">
                  <MessageSquareText />
                  <h2>{t("plat.insights.title")}</h2>
                </div>
              </div>
              <BusinessInsights />
              <SurveyCatalog />
              <DataRights admin />
            </div>
          )}

          {platformTab === "permissions" && (
            <div className="mb-panel">
              <PlatformPermissionsEditor shops={shops} />
            </div>
          )}

          {platformTab === "shops" && (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-primary" />
                    <h2 className="text-xl font-extrabold tracking-tight">
                      {t("plat.shops.title")}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("plat.shops.count", { shown: filteredShops.length, total: shops.length })}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <label className="relative">
                    <span className="sr-only">{t("plat.shops.search")}</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={shopSearch}
                      onChange={(event) => setShopSearch(event.target.value)}
                      placeholder={t("plat.shops.searchPlaceholder")}
                      className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm"
                    />
                  </label>
                  <select
                    aria-label={t("plat.shops.filterAria")}
                    value={shopStatus}
                    onChange={(event) => setShopStatus(event.target.value as typeof shopStatus)}
                    className="rounded-xl border border-input bg-background px-3 py-3 text-sm"
                  >
                    <option value="all">{t("plat.shops.filterAll")}</option>
                    <option value="active">{t("plat.shops.filterActive")}</option>
                    <option value="suspended">{t("plat.shops.filterSuspended")}</option>
                  </select>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">{t("plat.common.loading")}</p>
                ) : shops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("plat.shops.empty")}</p>
                ) : filteredShops.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {t("plat.shops.noMatch")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredShops.map((shop) => {
                      const shopMemberships = memberships.filter(
                        (membership) => membership.barbershop_id === shop.id,
                      );
                      const customers = shopMemberships.filter(
                        (membership) => membership.role === "customer",
                      ).length;
                      const admins = shopMemberships.filter(
                        (membership) => membership.role === "shop_admin",
                      ).length;
                      return (
                        <div
                          key={shop.id}
                          className="grid gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <p className="text-sm font-bold">{shop.name}</p>
                            <label className="my-3 flex items-center gap-3 text-sm">
                              <Switch
                                checked={sportsModules[shop.id] ?? false}
                                disabled={moduleBusy !== null}
                                onCheckedChange={(enabled) => void toggleSports(shop.id, enabled)}
                                aria-label={t("plat.shops.sportsAria", { name: shop.name })}
                              />
                              {t("plat.shops.sports")}
                            </label>
                            <label className="mb-3 flex items-center gap-3 text-sm">
                              <Switch
                                checked={loyaltyModules[shop.id] ?? false}
                                disabled={moduleBusy !== null}
                                onCheckedChange={(enabled) => void toggleLoyalty(shop.id, enabled)}
                                aria-label={t("plat.shops.loyaltyAria", { name: shop.name })}
                              />
                              <span>
                                {t("plat.shops.loyalty")}
                                <span className="block text-xs text-muted-foreground">
                                  {t("plat.shops.loyaltyHint")}
                                </span>
                              </span>
                            </label>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground">
                              /{shop.slug}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-1">
                                {t(
                                  customers === 1
                                    ? "plat.shops.customerOne"
                                    : "plat.shops.customerMany",
                                  {
                                    count: customers,
                                  },
                                )}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {t(admins === 1 ? "plat.shops.adminOne" : "plat.shops.adminMany", {
                                  count: admins,
                                })}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {friendlyTimeZone(shop.timezone, intlLocale)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                shop.status === "active"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {shop.status === "active"
                                ? t("plat.shops.active")
                                : t("plat.shops.suspended")}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                statusTriggerRef.current = event.currentTarget;
                                setStatusTarget(shop);
                              }}
                              aria-label={
                                shop.status === "active"
                                  ? t("plat.status.suspendAria", { name: shop.name })
                                  : t("plat.status.reactivateAria", { name: shop.name })
                              }
                              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
                            >
                              {shop.status === "active" ? (
                                <PauseCircle
                                  className="size-4 text-destructive"
                                  aria-hidden="true"
                                />
                              ) : (
                                <PlayCircle className="size-4 text-primary" aria-hidden="true" />
                              )}
                              {shop.status === "active"
                                ? t("plat.status.suspend")
                                : t("plat.status.reactivate")}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openBranding(shop)}
                              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
                            >
                              <Palette className="size-4 text-primary" aria-hidden="true" />
                              {t("plat.shops.customize")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">{t("plat.newShop.title")}</h3>
                </div>
                <form onSubmit={createShop} className="space-y-3">
                  <div>
                    <label
                      htmlFor={shopNameFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      {t("plat.newShop.name")}
                    </label>
                    <input
                      id={shopNameFieldId}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("plat.newShop.namePlaceholder")}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={shopSlugFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      {t("plat.newShop.slug")}
                    </label>
                    <input
                      id={shopSlugFieldId}
                      readOnly
                      value={
                        name
                          .trim()
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "") || "…"
                      }
                      className="mt-1 w-full rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("plat.newShop.slugHint")}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? t("plat.newShop.busy") : t("plat.newShop.submit")}
                  </button>
                </form>
              </section>

              <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">{t("plat.invite.title")}</h3>
                </div>
                <form onSubmit={inviteShopAdmin} className="space-y-3">
                  <div>
                    <label
                      htmlFor={inviteEmailFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      {t("plat.invite.email")}
                    </label>
                    <input
                      id={inviteEmailFieldId}
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t("plat.invite.emailPlaceholder")}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={inviteNameFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      {t("plat.invite.name")}
                    </label>
                    <input
                      id={inviteNameFieldId}
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder={t("plat.invite.optional")}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={inviteShopFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      {t("plat.common.shop")}
                    </label>
                    <select
                      id={inviteShopFieldId}
                      required
                      value={inviteShopId}
                      onChange={(e) => setInviteShopId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">{t("plat.invite.selectShop")}</option>
                      {shops
                        .filter((s) => s.status === "active")
                        .map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    aria-label={t("plat.invite.roleAria")}
                  >
                    <option value="employee">{t("plat.invite.optEmployee")}</option>
                    <option value="associate">{t("plat.invite.optAssociate")}</option>
                    <option value="owner">{t("plat.invite.optOwner")}</option>
                  </select>
                  {inviteRole === "owner" && (
                    <label className="block text-xs font-semibold">
                      {t("plat.invite.ownership")}
                      <input
                        required
                        type="number"
                        min={0.01}
                        max={99.99}
                        step={0.01}
                        value={inviteOwnership}
                        onChange={(event) => setInviteOwnership(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      />
                      <span className="mt-1 block font-normal text-muted-foreground">
                        {t("plat.invite.ownershipHint")}
                      </span>
                    </label>
                  )}
                  {inviteMessage && (
                    <p className="text-sm text-primary" role="status">
                      {inviteMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={inviteBusy || shops.length === 0}
                    className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {inviteBusy ? t("plat.invite.busy") : t("plat.invite.submit")}
                  </button>
                </form>
              </section>

              {!demoMode && <AccountManagersPanel shops={shops} />}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        {!demoMode && !demoChrome && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-gold" />
              <h2 className="text-sm font-semibold">{t("plat.account.title")}</h2>
            </div>
            <p className="text-xs text-muted-foreground">{t("plat.account.hint")}</p>
            <ChangePasswordCard />
            <LanguageSettingsCard />
          </section>
        )}
      </main>

      <AlertDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open && !statusBusy) setStatusTarget(null);
        }}
      >
        <AlertDialogContent
          className="max-w-md rounded-[var(--panel-radius)]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            statusTriggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.status === "active"
                ? t("plat.status.suspendTitle", {
                    name: statusTarget?.name ?? t("plat.status.theShop"),
                  })
                : t("plat.status.reactivateTitle", {
                    name: statusTarget?.name ?? t("plat.status.theShop"),
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-relaxed">
              {statusTarget?.status === "active"
                ? t("plat.status.suspendBody")
                : t("plat.status.reactivateBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => setStatusTarget(null)}
              className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {t("plat.common.back")}
            </button>
            <button
              type="button"
              disabled={statusBusy}
              onClick={() => statusTarget && void toggleStatus(statusTarget)}
              className={`action-button min-h-11 disabled:opacity-50 ${
                statusTarget?.status === "active" ? "action-danger" : "action-confirm"
              }`}
            >
              {statusTarget?.status === "active" ? (
                <PauseCircle className="size-4" aria-hidden="true" />
              ) : (
                <PlayCircle className="size-4" aria-hidden="true" />
              )}
              {statusBusy
                ? t("plat.common.saving")
                : statusTarget?.status === "active"
                  ? t("plat.status.suspendConfirm")
                  : t("plat.status.reactivateConfirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!brandShop}
        onOpenChange={(open) => {
          if (!open) {
            setBrandShop(null);
            setBrandSettings(null);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-3xl border-border bg-card p-0">
          <DialogScrollArea className="grid max-h-[calc(92dvh-2px)] gap-4 overflow-y-auto p-5 sm:p-6">
            <DialogTitle className="text-lg font-extrabold tracking-tight">
              {t("plat.brand.title", { name: brandShop?.name ?? t("plat.brand.shopFallback") })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("plat.brand.hint")}
            </DialogDescription>
            {brandLoading || !brandShop || !brandSettings ? (
              <p className="text-sm text-muted-foreground">{t("plat.brand.loading")}</p>
            ) : (
              <BrandIdentityEditor
                key={brandShop.id}
                audience="platform"
                shopName={brandShop.name}
                settings={brandSettings}
                mode={demoDispatch ? "demo" : "supabase"}
                onSaved={(next) => {
                  setBrandSettings(next);
                  if (demoDispatch) demoDispatch({ type: "settings.save", settings: next });
                }}
              />
            )}
          </DialogScrollArea>
        </DialogContent>
      </Dialog>
      {loginTourSettings && (
        <LoginPreviewDialog
          open={loginTourOpen}
          onOpenChange={setLoginTourOpen}
          preview={{
            layout: normalizeLoginLayout(loginTourSettings.login_layout),
            shopName:
              loginTourSettings.display_name?.trim() ||
              demoShop?.name ||
              demoState?.shop.name ||
              t("plat.brand.shopNameFallback"),
            logoUrl: loginTourSettings.logo_url,
            logoBackgroundColor: loginTourSettings.logo_background_color,
            loginImageUrl: loginTourSettings.login_image_url,
            primaryColor: loginTourSettings.primary_color || DEFAULT_PRIMARY_COLOR,
            accentColor: loginTourSettings.accent_color || DEFAULT_ACCENT_COLOR,
            fontFamily: loginTourSettings.font_family || DEFAULT_FONT_FAMILY,
            customFontUrl: loginTourSettings.custom_font_url,
            headerFontWeight: normalizeHeaderFontWeight(loginTourSettings.header_font_weight),
            headerFontStyle:
              normalizeHeaderFontStyle(loginTourSettings.header_font_style) ||
              DEFAULT_HEADER_FONT_STYLE,
            cornerStyle: normalizeCornerStyle(
              loginTourSettings.corner_style ?? DEFAULT_CORNER_STYLE,
            ),
          }}
        />
      )}
    </div>
  );
}
