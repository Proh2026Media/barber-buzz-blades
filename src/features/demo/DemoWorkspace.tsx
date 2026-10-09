import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { SessionProfile } from "@/lib/auth/session";
import { supabase } from "@/integrations/supabase/client";
import { ArenaApp } from "@/features/customer/ArenaApp";
import { ShopShell } from "@/features/shop/ShopShell";
import { PlatformShell } from "@/features/platform/PlatformShell";
import { DemoContext } from "./context";
import { DemoChromeContext, type DemoRole } from "./chrome";
import { createDemoState, demoReducer, type DemoShopPreset } from "./model";
import { DemoRoleSelector, DemoAccountMenu } from "./DemoAccountMenu";
import { t as tNow, useI18n } from "@/lib/i18n";
import { armDemoGuard, disarmDemoGuard } from "@/lib/demo-guard";
import {
  DEMO_ASSOCIATE_STAFF_ID,
  DEMO_EMPLOYEE_STAFF_ID,
  demoTeam,
  demoViewer,
  isDemoTeamView,
} from "./team";

/**
 * Enquanto a demonstração está aberta, nada vai ao banco (ver lib/demo-guard). Arma já na
 * primeira renderização, porque os efeitos dos filhos (ShopShell, ArenaApp) rodam antes
 * dos deste componente.
 */
function useDemoNetworkGuard() {
  useState(() => {
    armDemoGuard();
    return true;
  });
  useEffect(() => {
    armDemoGuard();
    return disarmDemoGuard;
  }, []);
}

export function DemoWorkspace({
  profile,
  shopId,
  initialRole = "customer",
  returnToShop,
}: {
  profile: SessionProfile;
  shopId?: string;
  initialRole?: DemoRole;
  /** Veio do "Testar como…" da ficha: ao sair, volta para a ficha desta barbearia. */
  returnToShop?: string;
}) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<DemoShopPreset | null>(null);
  const [loading, setLoading] = useState(Boolean(shopId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    void (async () => {
      const [shop, settings, services, staff, businessHours] = await Promise.all([
        supabase.from("barbershops").select("*").eq("id", shopId).single(),
        supabase.from("barbershop_settings").select("*").eq("barbershop_id", shopId).single(),
        supabase.from("services").select("*").eq("barbershop_id", shopId).order("created_at"),
        supabase.from("staff").select("*").eq("barbershop_id", shopId).order("created_at"),
        supabase.from("business_hours").select("*").eq("barbershop_id", shopId).order("weekday"),
      ]);
      if (!active) return;
      const problem =
        shop.error ?? settings.error ?? services.error ?? staff.error ?? businessHours.error;
      if (problem || !shop.data || !settings.data) {
        setError(tNow("demo.ws.prepareError"));
      } else {
        setPreset({
          shop: shop.data,
          settings: settings.data,
          services: services.data ?? [],
          staff: staff.data ?? [],
          businessHours: businessHours.data ?? [],
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [shopId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p role="status" className="text-sm font-semibold text-muted-foreground">
          {t("demo.ws.preparing")}
        </p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 text-center">
          <p role="alert" className="text-sm font-semibold">
            {error}
          </p>
          <Link
            to="/platform"
            className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {t("demo.ws.backChooseAnother")}
          </Link>
        </div>
      </main>
    );
  }
  return (
    <ConfiguredDemoWorkspace
      profile={profile}
      preset={preset ?? undefined}
      shopParam={shopId}
      initialRole={initialRole}
      returnToShop={returnToShop}
    />
  );
}

function ConfiguredDemoWorkspace({
  profile,
  preset,
  shopParam,
  initialRole = "customer",
  returnToShop,
}: {
  profile: SessionProfile;
  preset?: DemoShopPreset;
  /** Barbearia escolhida no "Testar como…" (fica no endereço junto com a visão). */
  shopParam?: string;
  initialRole?: DemoRole;
  returnToShop?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  useDemoNetworkGuard();
  const [role, setRoleState] = useState<DemoRole>(initialRole);
  // O papel escolhido fica no endereço (?view=): recarregar ou compartilhar abre a mesma visão.
  const setRole = (next: DemoRole) => {
    setRoleState(next);
    void navigate({
      to: "/demo",
      search: {
        shop: shopParam,
        view: next,
        ...(returnToShop ? { volta: "ficha" as const } : {}),
      },
      replace: true,
      resetScroll: false,
    });
  };
  const [openProfileRequest, setOpenProfileRequest] = useState(false);
  const [state, dispatch] = useReducer(demoReducer, undefined, () =>
    createDemoState(new Date(), preset),
  );

  useEffect(() => {
    setRoleState(initialRole);
  }, [initialRole]);

  useEffect(() => {
    let last = Date.now();
    const timer = setInterval(() => {
      const current = Date.now();
      dispatch({ type: "clock.advance", milliseconds: current - last });
      last = current;
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [role]);

  const exit = () => {
    // A página da plataforma volta a ler o banco (a checagem de acesso roda antes de sair daqui).
    disarmDemoGuard();
    // Veio da ficha da barbearia: volta para ela (aba Barbearias, ficha aberta).
    if (returnToShop) {
      void navigate({
        href: `/platform?aba=barbearias&loja=${encodeURIComponent(returnToShop)}`,
      });
      return;
    }
    void navigate({ to: "/platform" });
  };

  const chrome = {
    role,
    setRole,
    exit,
    state,
    dispatch,
    openProfileRequest,
    requestOpenProfile: () => {
      setRole("customer");
      setOpenProfileRequest(true);
    },
    clearOpenProfileRequest: () => setOpenProfileRequest(false),
  };

  // Personagens de cada papel e a equipe fictícia da visão (estáveis entre os tiques do relógio,
  // para as telas de sociedade não recarregarem à toa).
  const ownerStaff =
    state.staff.find(
      (row) => row.id !== DEMO_ASSOCIATE_STAFF_ID && row.id !== DEMO_EMPLOYEE_STAFF_ID,
    ) ?? null;
  const associateStaff = state.staff.find((row) => row.id === DEMO_ASSOCIATE_STAFF_ID) ?? null;
  const employeeStaff = state.staff.find((row) => row.id === DEMO_EMPLOYEE_STAFF_ID) ?? null;
  const teamKey = [role, ownerStaff, associateStaff, employeeStaff]
    .map((row) => (row && typeof row === "object" ? `${row.id}:${row.display_name}` : row))
    .join("|");
  const fallbackOwnerName = t("demo.role.owner");
  const team = useMemo(
    () =>
      isDemoTeamView(role)
        ? demoTeam(role, {
            viewerId: profile.user.id,
            owner: ownerStaff ?? { id: "demo-staff", display_name: fallbackOwnerName },
            associate: associateStaff,
            employee: employeeStaff,
            stamp: new Date(0).toISOString(),
          })
        : undefined,
    // A equipe só muda quando muda a visão ou o nome/cartão de alguém (teamKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamKey, profile.user.id, fallbackOwnerName],
  );

  let content: ReactNode;
  if (role === "platform") {
    // Com o mesmo contexto da Loja e do Cliente, Relatórios e pedidos de privacidade leem os
    // dados fictícios da demonstração em vez de consultar o servidor de verdade.
    content = (
      <DemoContext.Provider value={{ ...state, dispatch, exit }}>
        <PlatformShell profile={profile} demoMode />
      </DemoContext.Provider>
    );
  } else if (isDemoTeamView(role)) {
    // Cada visão da equipe tem o próprio personagem (Dono, Parceiro, Contratado) e a própria
    // sociedade (dono único, partes iguais, menor parte), com ids fictícios.
    const viewer = demoViewer(role);
    const viewerStaff =
      viewer.staff === "associate"
        ? associateStaff
        : viewer.staff === "employee"
          ? employeeStaff
          : ownerStaff;
    const mockActor = {
      id: `demo-actor-${role}`,
      user_id: profile.user.id,
      barbershop_id: state.shop.id,
      staff_id: viewerStaff?.id ?? "demo-staff",
      role: viewer.role,
      ownership_percent: viewer.percent,
      active: true,
      created_at: state.now.toISOString(),
      updated_at: state.now.toISOString(),
      barbershop: state.shop,
      staff: viewerStaff ?? null,
    };
    // O painel usa este vínculo fictício; as permissões saem das regras do papel
    // (lib/auth/shop-acting), sem consultar o banco.
    const demoProfile = {
      ...profile,
      shopActors: [mockActor],
      activeShopActor: mockActor,
    };

    content = (
      <DemoContext.Provider value={{ ...state, dispatch, exit, team }}>
        <ShopShell
          key={role}
          profile={demoProfile as unknown as SessionProfile}
          headerActions={
            <>
              <DemoAccountMenu />
              <DemoRoleSelector />
            </>
          }
        />
      </DemoContext.Provider>
    );
  } else {
    content = (
      <DemoContext.Provider value={{ ...state, dispatch, exit }}>
        <ArenaApp />
      </DemoContext.Provider>
    );
  }

  return (
    <DemoChromeContext.Provider value={chrome}>
      {/* Sem recuo inferior: a barra de demonstração agora vive no cabeçalho, e
          qualquer sobra aqui encurta a tela e deixa a navegação flutuante fora
          da superfície do app (parecia cortada embaixo). */}
      <div className="demo-layout bg-background text-foreground">
        <div className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-xs font-semibold text-foreground">
          {t("demo.ws.bannerShort")}{" "}
          <button
            type="button"
            onClick={exit}
            className="relative px-1 underline underline-offset-2 before:absolute before:-inset-x-3 before:-inset-y-3.5 before:content-['']"
          >
            {t("demo.ws.exit")}
          </button>
        </div>
        <div className="demo-content">{content}</div>
      </div>
    </DemoChromeContext.Provider>
  );
}
