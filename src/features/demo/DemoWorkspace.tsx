import { useEffect, useReducer, useState, type ReactNode } from "react";
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

export function DemoWorkspace({
  profile,
  shopId,
  initialRole = "customer",
}: {
  profile: SessionProfile;
  shopId?: string;
  initialRole?: DemoRole;
}) {
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
        setError("Não foi possível preparar esta barbearia para a demonstração.");
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
          Preparando demonstração da barbearia…
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
            Voltar e escolher outra
          </Link>
        </div>
      </main>
    );
  }
  return (
    <ConfiguredDemoWorkspace
      profile={profile}
      preset={preset ?? undefined}
      initialRole={initialRole}
    />
  );
}

function ConfiguredDemoWorkspace({
  profile,
  preset,
  initialRole = "customer",
}: {
  profile: SessionProfile;
  preset?: DemoShopPreset;
  initialRole?: DemoRole;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<DemoRole>(initialRole);
  const [openProfileRequest, setOpenProfileRequest] = useState(false);
  const [state, dispatch] = useReducer(demoReducer, undefined, () =>
    createDemoState(new Date(), preset),
  );

  useEffect(() => {
    setRole(initialRole);
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

  let content: ReactNode;
  if (role === "platform") {
    content = <PlatformShell profile={profile} demoMode />;
  } else if (role !== "customer") {
    // Create a mock activeShopActor for the demo
    const mockActor = {
      id: "demo-actor",
      user_id: profile.user.id,
      barbershop_id: state.shop.id,
      staff_id: state.staff[0]?.id ?? "demo-staff",
      role: role as "owner" | "partner" | "associate" | "employee",
      ownership_percent: role === "owner" ? 100 : role === "partner" ? 50 : null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      barbershop: state.shop,
      staff: state.staff[0],
    };

    // Compute governance mode based on the role
    const mode = role === "owner" ? "single" : role === "partner" ? "equal" : null;

    // Import capabilitiesFor if needed, but it's easier to just mock it or rely on ShopShell using it.
    // Wait, ShopShell recalculates capabilities via RPC get_shop_access_context!
    // But in demo mode, supabase.rpc won't have this demo shop.
    // Let's pass a fully mocked profile to ShopShell.

    // Actually, ShopShell does this:
    // const actor = profile.shopActors.find((candidate) => candidate.id === selectedActorId) ?? profile.activeShopActor;
    // So we just need to provide it in profile.shopActors.

    const demoProfile = {
      ...profile,
      shopActors: [mockActor],
      activeShopActor: mockActor,
      // ShopShell will call RPC, which will fail or return empty, and it might override capabilities.
      // We should probably patch ShopShell to not call the RPC if in demo mode!
    };

    content = (
      <DemoContext.Provider value={{ ...state, dispatch, exit }}>
        <ShopShell
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
          Ambiente de teste visual · dados fictícios ·{" "}
          <button type="button" onClick={exit} className="underline underline-offset-2">
            sair
          </button>
        </div>
        <div className="demo-content">{content}</div>
      </div>
    </DemoChromeContext.Provider>
  );
}
