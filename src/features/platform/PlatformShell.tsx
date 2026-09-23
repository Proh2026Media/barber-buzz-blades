import { DataRights } from "@/features/insights/DataRights";
import { SurveyCatalog } from "@/features/insights/SurveyCatalog";
import { BusinessInsights } from "@/features/insights/BusinessInsights";
import { useScrollIndicators } from "@/lib/use-scroll-indicators";
import { useCallback, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CirclePause,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Palette,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
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
import { PlatformPermissionsEditor } from "./PlatformPermissionsEditor";
import { DemoAccountMenu, DemoRoleSelector } from "@/features/demo/DemoAccountMenu";
import { useDemoChrome } from "@/features/demo/chrome";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SessionProfile } from "@/lib/auth/session";
import { brandCornerClass, brandFontScopeClass, brandVariables } from "@/lib/shop/branding";

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
  barbershop?: { name: string; slug: string };
  role?: "partner" | "associate" | "employee";
  ownership_percent?: number | null;
};

export function PlatformShell({ profile, headerActions, demoMode = false }: PlatformShellProps) {
  useScrollIndicators();
  const demoChrome = useDemoChrome();
  const [shops, setShops] = useState<Tables<"barbershops">[]>([]);
  const [memberships, setMemberships] = useState<
    Pick<Tables<"memberships">, "barbershop_id" | "role" | "user_id">[]
  >([]);
  const [shopSearch, setShopSearch] = useState("");
  const [shopStatus, setShopStatus] = useState<"all" | "active" | "suspended">("all");
  const [platformTab, setPlatformTab] = useState<"overview" | "shops" | "insights" | "permissions">(
    "overview",
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteShopId, setInviteShopId] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"partner" | "associate" | "employee">("employee");
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
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
  const [brandShop, setBrandShop] = useState<Tables<"barbershops"> | null>(null);
  const [brandSettings, setBrandSettings] = useState<Tables<"barbershop_settings"> | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [demoShopId, setDemoShopId] = useState("");
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
      setInviteShopId(demoState.shop.id);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [shopsResult, membershipsResult, modulesResult] = await Promise.all([
      supabase.from("barbershops").select("*").order("created_at", { ascending: true }),
      supabase.from("memberships").select("barbershop_id, role, user_id"),
      supabase.from("barbershop_settings").select("barbershop_id, sports_enabled"),
    ]);
    if (shopsResult.error) setError(shopsResult.error.message);
    else if (membershipsResult.error) setError(membershipsResult.error.message);
    else if (modulesResult.error) setError(modulesResult.error.message);
    else {
      setShops(shopsResult.data ?? []);
      setMemberships(membershipsResult.data ?? []);
      setSportsModules(
        Object.fromEntries(
          (modulesResult.data ?? []).map((row) => [row.barbershop_id, row.sports_enabled]),
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
      setError(settingsError.message);
      setBrandShop(null);
    } else {
      setBrandSettings(data);
    }
    setBrandLoading(false);
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
      setError(err instanceof Error ? err.message : "Falha ao criar barbearia");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(shop: Tables<"barbershops">) {
    const next = shop.status === "active" ? "suspended" : "active";
    if (demoDispatch) {
      demoDispatch({ type: "shop.update", shop: { status: next } });
      return;
    }
    const { error: updateError } = await supabase
      .from("barbershops")
      .update({ status: next })
      .eq("id", shop.id);
    if (updateError) setError(updateError.message);
    else await loadShops();
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
      setError("Não foi possível alterar o módulo Esportes.");
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
      if (!token) throw new Error("Sessão inválida");

      const { data, error: fnError } = await supabase.functions.invoke<InviteResult>(
        "invite-shop-admin",
        {
          body: {
            email: inviteEmail.trim(),
            barbershop_id: inviteShopId,
            full_name: inviteName.trim() || undefined,
            role: inviteRole,
            ownership_percent: inviteRole === "partner" ? Number(inviteOwnership) : undefined,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const shopLabel = data?.barbershop?.name ?? "loja";
      if (data?.created && data.temporary_password) {
        setInviteMessage(
          `Profissional criado para ${data.email} em ${shopLabel}. Senha temporária: ${data.temporary_password}`,
        );
      } else {
        setInviteMessage(
          `${data?.email ?? inviteEmail} foi vinculado à equipe de ${shopLabel} como ${inviteRole === "partner" ? "sócio" : inviteRole === "associate" ? "parceiro" : "contratado"}.`,
        );
      }
      setInviteEmail("");
      setInviteName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao convidar admin");
    } finally {
      setInviteBusy(false);
    }
  }

  const activeShops = shops.filter((shop) => shop.status === "active").length;
  const suspendedShops = shops.length - activeShops;
  const customerCount = memberships.filter((membership) => membership.role === "customer").length;
  const shopAdminCount = memberships.filter(
    (membership) => membership.role === "shop_admin",
  ).length;
  const normalizedSearch = shopSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredShops = shops.filter(
    (shop) =>
      (shopStatus === "all" || shop.status === shopStatus) &&
      `${shop.name} ${shop.slug}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
  );
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
          <p className="text-xs font-bold text-gold">Gestão global</p>
          <h1 className="truncate text-lg font-extrabold tracking-tight">Plataforma Arena</h1>
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
                aria-label="Abrir gestão da loja"
                className="app-icon-button sm:hidden"
              >
                <Building2 size={20} />
              </Link>
              <Link
                to="/shop"
                aria-label="Abrir gestão da loja"
                className="hidden text-xs font-semibold text-muted-foreground hover:text-foreground sm:inline"
              >
                Loja
              </Link>
              <button onClick={signOut} aria-label="Sair" className="app-icon-button">
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
        <div key={platformTab} className="mb-panel space-y-6">
          <nav
            aria-label="Áreas da administração"
            className="grid grid-cols-4 gap-1 rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-sm"
          >
            {[
              { id: "overview" as const, label: "Visão geral", icon: LayoutDashboard },
              { id: "shops" as const, label: "Barbearias", icon: Building2 },
              { id: "permissions" as const, label: "Acessos", icon: ShieldAlert },
              { id: "insights" as const, label: "Relatórios", icon: MessageSquareText },
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
              <section
                aria-label="Resumo da plataforma"
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {[
                  { label: "Barbearias ativas", value: activeShops, icon: Building2 },
                  { label: "Suspensas", value: suspendedShops, icon: CirclePause },
                  { label: "Clientes", value: customerCount, icon: UsersRound },
                  { label: "Administradores", value: shopAdminCount, icon: ShieldCheck },
                ].map(({ label, value, icon: Icon }) => (
                  <article key={label} className="app-action-card relative overflow-hidden p-4">
                    <Icon size={18} className="relative text-gold" />
                    <p className="relative mt-4 text-2xl font-black">{loading ? "—" : value}</p>
                    <p className="relative mt-1 text-xs font-medium text-muted-foreground">
                      {label}
                    </p>
                  </article>
                ))}
              </section>
              <section className="space-y-4 rounded-3xl border border-primary/20 bg-card p-5">
                <div className="flex items-center gap-2">
                  <FlaskConical size={18} className="text-primary" />
                  <h2 className="text-sm font-semibold">
                    {demoMode ? "Você está na demonstração" : "Demonstração"}
                  </h2>
                </div>
                {demoMode ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Toque no ícone de perfil no canto do header para ver o perfil, trocar entre
                    Admin, Barbearia e Cliente, ou sair da demonstração.
                  </p>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Explore o app com clientes e reservas fictícios. Nada desta prévia altera a
                      operação real.
                    </p>
                    <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
                      Barbearia da demonstração
                      <select
                        value={demoShopId}
                        onChange={(event) => setDemoShopId(event.target.value)}
                        className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {shops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                            {shop.status === "suspended" ? " · suspensa" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Identidade, serviços, equipe e horários são copiados para uma sessão isolada.
                      O cliente e as reservas continuam fictícios.
                    </p>
                    <Link
                      to="/demo"
                      search={{ shop: demoShopId || undefined }}
                      aria-disabled={!demoShopId}
                      onClick={(event) => {
                        if (!demoShopId) event.preventDefault();
                      }}
                      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50"
                    >
                      Abrir demonstração
                    </Link>
                  </>
                )}
              </section>
            </>
          )}

          {platformTab === "insights" && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="app-section-title">
                  <MessageSquareText />
                  <h2>Relatórios e pesquisas</h2>
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
                    <h2 className="text-xl font-extrabold tracking-tight">Barbearias</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {filteredShops.length} de {shops.length}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                  <label className="relative">
                    <span className="sr-only">Buscar barbearia</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={shopSearch}
                      onChange={(event) => setShopSearch(event.target.value)}
                      placeholder="Nome ou endereço da página"
                      className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-3 text-sm"
                    />
                  </label>
                  <select
                    aria-label="Filtrar por situação"
                    value={shopStatus}
                    onChange={(event) => setShopStatus(event.target.value as typeof shopStatus)}
                    className="rounded-xl border border-input bg-background px-3 py-3 text-sm"
                  >
                    <option value="all">Todas as situações</option>
                    <option value="active">Ativas</option>
                    <option value="suspended">Suspensas</option>
                  </select>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : shops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma barbearia ainda.</p>
                ) : filteredShops.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhuma barbearia corresponde aos filtros.
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
                                aria-label={`Módulo Esportes em ${shop.name}`}
                              />
                              Módulo Esportes
                            </label>
                            <p className="text-xs uppercase tracking-widest text-muted-foreground">
                              /{shop.slug}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-1">
                                {customers} clientes
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {admins} admins
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {shop.timezone}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            <button
                              onClick={() => void toggleStatus(shop)}
                              aria-label={
                                shop.status === "active"
                                  ? `Suspender ${shop.name}`
                                  : `Reativar ${shop.name}`
                              }
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                shop.status === "active"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {shop.status === "active" ? "Ativa" : "Suspensa"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openBranding(shop)}
                              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-bold hover:bg-muted"
                            >
                              <Palette className="size-4 text-primary" />
                              Personalizar
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
                  <h3 className="text-sm font-semibold">Nova barbearia</h3>
                </div>
                <form onSubmit={createShop} className="space-y-3">
                  <div>
                    <label
                      htmlFor={shopNameFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Nome da barbearia
                    </label>
                    <input
                      id={shopNameFieldId}
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: Barbearia Central"
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={shopSlugFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Endereço do link (automático)
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
                      Gerado a partir do nome. Renomear a loja cria redirect do endereço antigo.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? "Criando..." : "Criar barbearia"}
                  </button>
                </form>
              </section>

              <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Adicionar profissional à equipe</h3>
                </div>
                <form onSubmit={inviteShopAdmin} className="space-y-3">
                  <div>
                    <label
                      htmlFor={inviteEmailFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      E-mail do profissional
                    </label>
                    <input
                      id={inviteEmailFieldId}
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="nome@exemplo.com"
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={inviteNameFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Nome do profissional
                    </label>
                    <input
                      id={inviteNameFieldId}
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={inviteShopFieldId}
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Barbearia
                    </label>
                    <select
                      id={inviteShopFieldId}
                      required
                      value={inviteShopId}
                      onChange={(e) => setInviteShopId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Selecione a barbearia</option>
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
                    aria-label="Papel do profissional"
                  >
                    <option value="employee">Contratado · agenda e score próprios</option>
                    <option value="associate">Parceiro · operação e valores próprios</option>
                    <option value="partner">Sócio · visão completa da unidade</option>
                  </select>
                  {inviteRole === "partner" && (
                    <label className="block text-xs font-semibold">
                      Participação societária (%)
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
                        A participação informada é transferida do dono atual.
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
                    {inviteBusy ? "Adicionando..." : "Adicionar à equipe"}
                  </button>
                </form>
              </section>
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
              <h2 className="text-sm font-semibold">Sua conta</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Altere a senha de acesso desta conta de administrador.
            </p>
            <ChangePasswordCard />
          </section>
        )}
      </main>

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
              Personalizar {brandShop?.name ?? "barbearia"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              O que você salvar aqui vale na hora para a equipe e para os clientes desta barbearia.
            </DialogDescription>
            {brandLoading || !brandShop || !brandSettings ? (
              <p className="text-sm text-muted-foreground">Carregando identidade…</p>
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
    </div>
  );
}
