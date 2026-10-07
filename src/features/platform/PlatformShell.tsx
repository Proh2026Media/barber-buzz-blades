import { DataRights } from "@/features/insights/DataRights";
import { SurveyCatalog } from "@/features/insights/SurveyCatalog";
import { BusinessInsights } from "@/features/insights/BusinessInsights";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  BarChart3,
  KeyRound,
  LayoutDashboard,
  MessageCircleOff,
  QrCode,
  RefreshCw,
  Store,
  UserPlus,
  UserX,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dialog, DialogContent, DialogScrollArea, DialogTitle } from "@/components/ui/dialog";
import {
  AttentionList,
  CountBadge,
  LoadingState,
  Notice,
  PersonAvatar,
  type AttentionItem,
} from "@/components/visual";
import { BrandIdentityEditor } from "@/features/shop/BrandIdentityEditor";
import { BrandFontFace } from "@/features/shop/BrandFontFace";
import { BrandRootVariables } from "@/features/shop/BrandRootVariables";
import {
  PlatformWhatsAppCard,
  type PlatformWaReport,
  type PlatformWhatsAppHandle,
} from "./PlatformWhatsAppCard";
import { PlatformPermissionsEditor } from "./PlatformPermissionsEditor";
import { AccountManagersPanel } from "./AccountManagersPanel";
import { PlatformDashboard } from "./PlatformDashboard";
import { PlatformAccountMenu } from "./PlatformAccountMenu";
import { ShopsPanel } from "./ShopsPanel";
import { NewShopDialog } from "./NewShopDialog";
import { InviteMemberDialog } from "./InviteMemberDialog";
import type { ShopModule } from "./ShopDetail";
import { activeShopsWithoutAdmin, countByShop, type MembershipRow } from "./shopStats";
import { platformTabFromSlug, platformTabSlug, type PlatformTab, type ShopFilter } from "./tabs";
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
  DEFAULT_PRIMARY_COLOR,
  normalizeCornerStyle,
  normalizeHeaderFontStyle,
  normalizeHeaderFontWeight,
  normalizeLoginLayout,
} from "@/lib/shop/branding";
import { TermsUpdateGate } from "@/features/legal/TermsUpdateGate";

type PlatformShellProps = {
  profile: SessionProfile;
  headerActions?: ReactNode;
  demoMode?: boolean;
};

/** Aba guardada no endereço (`?aba=barbearias`), para recarregar e voltar ao mesmo lugar. */
function readTabFromUrl(): PlatformTab {
  if (typeof window === "undefined") return "overview";
  return platformTabFromSlug(new URLSearchParams(window.location.search).get("aba")) ?? "overview";
}

function writeTabToUrl(tab: PlatformTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (tab === "overview") url.searchParams.delete("aba");
  else url.searchParams.set("aba", platformTabSlug(tab));
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
}

export function PlatformShell({ profile, headerActions, demoMode = false }: PlatformShellProps) {
  useScrollIndicators();
  const { t } = useI18n();
  const demoChrome = useDemoChrome();
  const mainRef = useRef<HTMLElement>(null);
  const tourRef = useRef<HTMLDivElement>(null);
  const waRef = useRef<PlatformWhatsAppHandle>(null);
  const [shops, setShops] = useState<Tables<"barbershops">[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [platformTab, setPlatformTabState] = useState<PlatformTab>(() =>
    demoMode ? "overview" : readTabFromUrl(),
  );
  const [shopFilter, setShopFilter] = useState<ShopFilter>("all");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [permShopId, setPermShopId] = useState("");
  const [sportsModules, setSportsModules] = useState<Record<string, boolean>>({});
  const [loyaltyModules, setLoyaltyModules] = useState<Record<string, boolean>>({});
  const [brandShop, setBrandShop] = useState<Tables<"barbershops"> | null>(null);
  const [brandSettings, setBrandSettings] = useState<Tables<"barbershop_settings"> | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [newShopOpen, setNewShopOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteShopId, setInviteShopId] = useState<string | null>(null);
  const [demoShopId, setDemoShopId] = useState("");
  const [waStatus, setWaStatus] = useState<PlatformWaReport | null>(null);
  const [scrollToTour, setScrollToTour] = useState(false);
  const [loginTourOpen, setLoginTourOpen] = useState(false);
  const [loginTourSettings, setLoginTourSettings] = useState<Tables<"barbershop_settings"> | null>(
    null,
  );
  const demoState = demoChrome?.state ?? null;
  const demoDispatch = demoChrome?.dispatch ?? null;

  const setPlatformTab = useCallback(
    (tab: PlatformTab) => {
      setPlatformTabState(tab);
      if (!demoMode) writeTabToUrl(tab);
      mainRef.current?.scrollTo({ top: 0 });
    },
    [demoMode],
  );

  const loadShops = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
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
        setUpdatedAt(new Date());
        setLoading(false);
        return [demoState.shop];
      }
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      const [shopsResult, membershipsResult, modulesResult] = await Promise.all([
        supabase.from("barbershops").select("*").order("created_at", { ascending: true }),
        supabase.from("memberships").select("barbershop_id, role, user_id"),
        supabase
          .from("barbershop_settings")
          .select("barbershop_id, sports_enabled, loyalty_enabled"),
      ]);
      const failure = shopsResult.error || membershipsResult.error || modulesResult.error;
      let list: Tables<"barbershops">[] = [];
      if (failure) {
        setLoadError(friendlyAuthError(failure, tNow("plat.shell.loadError")));
      } else {
        list = shopsResult.data ?? [];
        setLoadError(null);
        setShops(list);
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
        setDemoShopId(
          (current) =>
            current || list.find((shop) => shop.status === "active")?.id || list[0]?.id || "",
        );
        setUpdatedAt(new Date());
      }
      setLoading(false);
      setRefreshing(false);
      return list;
    },
    [demoState],
  );

  useEffect(() => {
    void loadShops();
  }, [loadShops]);

  useEffect(() => {
    if (brandShop && demoState) setBrandSettings(demoState.settings);
  }, [brandShop, demoState]);

  // "Testar como…" vindo da ficha: depois de trocar de aba, desce até o cartão do teste.
  useEffect(() => {
    if (!scrollToTour || platformTab !== "overview") return;
    const id = window.setTimeout(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tourRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      setScrollToTour(false);
    }, 80);
    return () => window.clearTimeout(id);
  }, [scrollToTour, platformTab]);

  async function openBranding(shop: Tables<"barbershops">) {
    setBrandError(null);
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
      setBrandError(t("plat.shell.brandOpenError"));
    } else {
      setBrandSettings(data);
    }
    setBrandLoading(false);
  }

  async function openLoginTour() {
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
      toast.error(friendlyAuthError(settingsError, t("plat.shell.loginPreviewError")));
      return;
    }
    setLoginTourSettings(data);
    setLoginTourOpen(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  /** Cria a barbearia e devolve a linha nova (para realçar e personalizar em seguida). */
  async function createShop(shopName: string) {
    // A demonstração nunca grava (a janela já simula o resultado); defesa extra.
    if (demoMode) return null;
    const { error: insertError } = await supabase.from("barbershops").insert({
      name: shopName,
      status: "active",
    });
    if (insertError) throw new Error(friendlyAuthError(insertError, t("plat.shell.createError")));
    const list = await loadShops("refresh");
    return [...list].reverse().find((shop) => shop.name === shopName) ?? null;
  }

  async function toggleStatus(shop: Tables<"barbershops">) {
    const next = shop.status === "active" ? "suspended" : "active";
    if (demoDispatch) {
      demoDispatch({ type: "shop.update", shop: { status: next } });
    } else {
      const { error: updateError } = await supabase
        .from("barbershops")
        .update({ status: next })
        .eq("id", shop.id);
      // A janela de decisão mostra o erro e deixa tentar de novo.
      if (updateError) throw updateError;
      await loadShops("refresh");
    }
    toast.success(
      next === "suspended"
        ? t("plat.status.doneSuspended", { name: shop.name })
        : t("plat.status.doneReactivated", { name: shop.name }),
    );
  }

  async function setModule(shopId: string, module: ShopModule, enabled: boolean) {
    const key = module === "sports" ? "sports_enabled" : "loyalty_enabled";
    if (demoDispatch && demoState) {
      demoDispatch({ type: "settings.save", settings: { ...demoState.settings, [key]: enabled } });
      return;
    }
    const result =
      module === "sports"
        ? await supabase.rpc("set_shop_sports_module", { p_shop_id: shopId, p_enabled: enabled })
        : await supabase.rpc("set_shop_loyalty_module", { p_shop_id: shopId, p_enabled: enabled });
    if (result.error) throw result.error;
    (module === "sports" ? setSportsModules : setLoyaltyModules)((current) => ({
      ...current,
      [shopId]: enabled,
    }));
  }

  function openShops(filter: ShopFilter) {
    setShopFilter(filter);
    setSelectedShopId(null);
    setPlatformTab("shops");
  }

  function openShop(shopId: string) {
    setShopFilter("all");
    setSelectedShopId(shopId);
    setPlatformTab("shops");
  }

  function openInvite(shopId?: string | null) {
    setInviteShopId(shopId ?? null);
    setInviteOpen(true);
  }

  function openNewShop() {
    setNewShopOpen(true);
  }

  function showNewShop(shop: Tables<"barbershops"> | null) {
    setNewShopOpen(false);
    setShopFilter("all");
    setPlatformTab("shops");
    if (!shop) return;
    setSelectedShopId(shop.id);
    setHighlightId(shop.id);
    window.setTimeout(() => setHighlightId(null), 2500);
  }

  const counts = useMemo(() => countByShop(memberships), [memberships]);

  const attention: AttentionItem[] = useMemo(() => {
    if (loading) return [];
    const items: AttentionItem[] = [];
    if (!demoMode && waStatus === "error") {
      items.push({
        id: "wa",
        tone: "danger",
        icon: MessageCircleOff,
        title: t("plat.att.waError"),
        description: t("plat.att.waErrorHint"),
        action: {
          label: t("visual.retry"),
          onClick: () => waRef.current?.recheck(),
          icon: RefreshCw,
        },
      });
    }
    // "Conectando" também é pendência: é o estado enquanto ninguém leu o código, e pode durar.
    if (
      !demoMode &&
      (waStatus === "disconnected" || waStatus === "qr" || waStatus === "connecting")
    ) {
      const waiting = waStatus !== "disconnected";
      items.push({
        id: "wa",
        tone: waiting ? "pending" : "danger",
        icon: waiting ? QrCode : MessageCircleOff,
        title:
          waStatus === "qr"
            ? t("plat.att.waQr")
            : waStatus === "connecting"
              ? t("plat.att.waConnecting")
              : t("plat.att.waOff"),
        description: t("plat.wa.consequence"),
        action: {
          label: waiting ? t("plat.wa.showCode") : t("plat.att.waConnect"),
          onClick: () => waRef.current?.connect(),
          icon: QrCode,
        },
      });
    }
    for (const shop of activeShopsWithoutAdmin(shops, counts)) {
      items.push({
        id: `admin-${shop.id}`,
        tone: "warning",
        icon: UserX,
        title: t("plat.att.noAdmin", { name: shop.name }),
        description: t("plat.att.noAdminHint"),
        action: {
          label: t("plat.shop.addPerson"),
          onClick: () => openInvite(shop.id),
          icon: UserPlus,
        },
      });
    }
    // Barbearia suspensa não entra: é decisão do administrador, não pendência. Ela aparece
    // no cartão "Suspensas" (que abre a lista filtrada) e no selo cinza de pausa.
    return items;
  }, [loading, demoMode, waStatus, shops, counts, t]);

  const demoShop = shops.find((shop) => shop.id === demoShopId) ?? null;
  // Na demonstração, a visão Plataforma representa a mesma barbearia fictícia
  // das visões Cliente e Barbearia. Assim, a opção visual salva no editor pode
  // ser conferida nos três shells sem aplicar a marca de uma loja ao admin
  // global real, que gerencia várias unidades ao mesmo tempo.
  const demoBrandSettings = demoState?.settings ?? null;
  const brandStyle = demoBrandSettings
    ? brandVariables(
        demoBrandSettings.primary_color,
        demoBrandSettings.accent_color,
        demoBrandSettings.font_family,
        demoBrandSettings.custom_font_url,
        demoBrandSettings.header_font_weight,
        demoBrandSettings.header_font_style,
        demoBrandSettings.corner_style,
      )
    : null;

  const navItems = [
    { id: "overview" as const, label: t("plat.tabs.home"), icon: LayoutDashboard },
    { id: "shops" as const, label: t("plat.tabs.shops"), icon: Store },
    { id: "permissions" as const, label: t("plat.tabs.permissions"), icon: KeyRound },
    { id: "insights" as const, label: t("plat.tabs.insights"), icon: BarChart3 },
  ];
  const activeNavIndex = navItems.findIndex((item) => item.id === platformTab);
  const accountName = profile.profile?.full_name || profile.user.email || t("plat.account.role");

  return (
    <div
      className={`arena-workspace platform-workspace min-h-screen bg-background text-foreground ${brandFontScopeClass(demoBrandSettings?.font_scope)} ${brandCornerClass(demoBrandSettings?.corner_style)} ${demoBrandSettings?.floating_chrome ? "brand-chrome-floating" : ""}`}
      style={brandStyle ? (brandStyle as CSSProperties) : undefined}
    >
      <BrandRootVariables vars={brandStyle} />
      <TermsUpdateGate disabled={demoMode} />
      {demoBrandSettings && (
        <BrandFontFace
          url={demoBrandSettings.custom_font_url}
          faces={demoBrandSettings.custom_font_faces}
        />
      )}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gold">{t("plat.header.eyebrow")}</p>
          <h1 className="break-words text-lg font-extrabold leading-tight tracking-tight max-[379px]:text-base">
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
            <PlatformAccountMenu
              name={accountName}
              email={profile.user.email}
              onSignOut={() => void signOut()}
            />
          )}
        </div>
      </header>

      <main ref={mainRef} className="mx-auto w-full max-w-5xl space-y-6 p-4">
        {/* Sem nenhuma barbearia carregada, o erro aparece no lugar do conteúdo (Início e
            Barbearias), nunca como "Nenhuma barbearia ainda". Aqui só nas outras abas ou
            quando os números na tela ficaram desatualizados. */}
        {loadError && (shops.length > 0 || !["overview", "shops"].includes(platformTab)) && (
          <Notice
            tone="danger"
            title={loadError}
            action={{
              label: t("visual.retry"),
              onClick: () => void loadShops(shops.length ? "refresh" : "initial"),
              icon: RefreshCw,
            }}
          />
        )}

        <div key={platformTab} className="mb-panel space-y-6">
          {platformTab === "overview" && (
            <>
              <div className="app-section-title">
                <LayoutDashboard aria-hidden />
                <h2>{t("plat.tabs.overview")}</h2>
              </div>
              {/* "Tudo em ordem" só com os dados carregados e o WhatsApp conectado (fora da demo). */}
              <AttentionList
                items={attention}
                allClear={
                  !loading && !loadError && shops.length > 0 && (demoMode || waStatus === "open")
                }
                max={3}
              />
              <PlatformDashboard
                shops={shops}
                memberships={memberships}
                loading={loading}
                loadError={loadError}
                onRetry={() => void loadShops()}
                updatedAt={updatedAt}
                refreshing={refreshing}
                onRefresh={() => void loadShops("refresh")}
                onOpenShops={openShops}
                onOpenShop={openShop}
                onCreateShop={openNewShop}
              />
            </>
          )}

          {platformTab === "insights" && (
            <div className="space-y-6">
              <div className="app-section-title">
                <BarChart3 aria-hidden />
                <h2>{t("plat.insights.title")}</h2>
              </div>
              <BusinessInsights />
              <SurveyCatalog />
              <DataRights admin />
            </div>
          )}

          {platformTab === "permissions" && (
            <div className="app-section-title">
              <KeyRound aria-hidden />
              <h2>{t("plat.tabs.permissions")}</h2>
            </div>
          )}
          {platformTab === "permissions" && (
            <PlatformPermissionsEditor
              shops={shops}
              demoMode={demoMode}
              shopId={permShopId}
              onShopChange={setPermShopId}
            />
          )}
          {/* Todos os gerentes de conta juntos: quem cuida de quais barbearias, num lugar só. */}
          {platformTab === "permissions" && !demoMode && shops.length > 0 && (
            <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
              <AccountManagersPanel shops={shops} headingAs="h2" />
            </section>
          )}

          {platformTab === "shops" && (
            <ShopsPanel
              shops={shops}
              memberships={memberships}
              loading={loading}
              loadError={loadError}
              onRetry={() => void loadShops()}
              sportsModules={sportsModules}
              loyaltyModules={loyaltyModules}
              demoMode={demoMode}
              filter={shopFilter}
              onFilterChange={setShopFilter}
              selectedId={selectedShopId}
              onSelect={setSelectedShopId}
              highlightId={highlightId}
              onNewShop={openNewShop}
              onSetModule={setModule}
              onCustomize={(shop) => void openBranding(shop)}
              onToggleStatus={toggleStatus}
              onAddPerson={(shopId) => openInvite(shopId)}
              onPermissions={(shopId) => {
                setPermShopId(shopId);
                setSelectedShopId(null);
                setPlatformTab("permissions");
              }}
              onTestAs={(shopId) => {
                if (!demoMode) setDemoShopId(shopId);
                setSelectedShopId(null);
                setPlatformTab("overview");
                setScrollToTour(true);
              }}
            />
          )}
        </div>

        {/* Fica montado nas outras abas (escondido) para a lista de atenção e o contador
            da barra saberem o estado do WhatsApp em qualquer aba. */}
        {!demoMode && (
          <PlatformWhatsAppCard
            ref={waRef}
            onStatusChange={setWaStatus}
            className={platformTab === "overview" ? undefined : "hidden"}
          />
        )}
        {/* Sem barbearias por falha de carga, o "Testar como…" não tem com o que testar. */}
        {platformTab === "overview" && !(loadError && shops.length === 0) && (
          <div ref={tourRef} className="scroll-mt-4">
            {demoMode ? (
              <DemoTourHub
                shopId={demoState?.shop.id ?? ""}
                onSelectRole={demoChrome?.setRole}
                activeRole={demoChrome?.role}
                onPreviewLogin={() => void openLoginTour()}
              />
            ) : (
              <DemoTourHub
                shopId={demoShopId}
                disabled={!demoShopId}
                onPreviewLogin={() => void openLoginTour()}
              >
                {shops.length > 0 && (
                  <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-background ps-3">
                    <PersonAvatar
                      name={demoShop?.name ?? "?"}
                      size="xs"
                      seed={demoShopId || undefined}
                    />
                    <span className="sr-only">{t("demo.hub.shopLabel")}</span>
                    <select
                      value={demoShopId}
                      onChange={(event) => setDemoShopId(event.target.value)}
                      className="min-h-11 min-w-0 flex-1 rounded-2xl bg-transparent! pe-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.name}
                          {shop.status === "suspended" ? t("plat.shops.suspendedSuffix") : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </DemoTourHub>
            )}
          </div>
        )}
      </main>

      <nav
        className="app-mobile-nav app-mobile-nav-floating fixed left-4 right-4 z-40 mx-auto grid max-w-3xl overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        aria-label={t("plat.tabs.aria")}
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
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPlatformTab(id)}
            aria-pressed={platformTab === id}
            aria-current={platformTab === id ? "page" : undefined}
            className={`relative z-10 flex min-w-0 flex-col items-center justify-center px-0.5 py-2.5 ${
              platformTab === id ? "app-nav-current" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="relative mb-1.5">
              <Icon
                className={`h-5 w-5 transition-transform duration-300 ease-out ${platformTab === id ? "scale-110" : ""}`}
                aria-hidden
              />
              {id === "overview" && platformTab !== "overview" && (
                <CountBadge
                  count={attention.length}
                  label={t(attention.length === 1 ? "plat.att.countOne" : "plat.att.countMany", {
                    count: attention.length,
                  })}
                  className="absolute -right-3 -top-2"
                />
              )}
            </span>
            <span className="max-w-full truncate text-xs font-semibold max-[379px]:text-[0.6875rem] max-[379px]:tracking-tight">
              {label}
            </span>
          </button>
        ))}
      </nav>

      <NewShopDialog
        open={newShopOpen}
        onOpenChange={setNewShopOpen}
        onCreate={createShop}
        onCustomize={(shop) => {
          showNewShop(shop);
          void openBranding(shop);
        }}
        onShow={showNewShop}
        demoMode={demoMode}
      />

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) void loadShops("refresh");
        }}
        shops={shops}
        initialShopId={inviteShopId}
        demoMode={demoMode}
      />

      <Dialog
        open={!!brandShop}
        onOpenChange={(open) => {
          if (!open) {
            setBrandShop(null);
            setBrandSettings(null);
            setBrandError(null);
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl border-border bg-card p-0"
        >
          {/* Cabeçalho fixo fora da rolagem: o X não cobre a prévia, que gruda logo abaixo. */}
          <div className="flex min-h-14 shrink-0 items-center border-b border-border px-5 pr-14 sm:px-6">
            <DialogTitle className="text-lg font-extrabold leading-tight tracking-tight">
              {t("plat.brand.title", { name: brandShop?.name ?? t("plat.brand.shopFallback") })}
            </DialogTitle>
          </div>
          <DialogScrollArea className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:p-6">
            {brandError ? (
              <Notice
                tone="danger"
                title={brandError}
                action={{
                  label: t("visual.retry"),
                  onClick: () => brandShop && void openBranding(brandShop),
                  icon: RefreshCw,
                }}
              />
            ) : brandLoading || !brandShop || !brandSettings ? (
              <LoadingState variant="cards" count={2} label={t("plat.brand.loading")} />
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
