import type { Session, User } from "@supabase/supabase-js";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { capabilitiesFor, type ShopCapabilities, type ShopPermissionMap } from "./capabilities";

export { capabilitiesFor, type ShopCapabilities, type ShopPermissionMap } from "./capabilities";

export type AppRole = Enums<"app_role">;

export type Membership = Tables<"memberships"> & {
  barbershop?: Tables<"barbershops"> | null;
};

export type ShopActor = Tables<"shop_members"> & {
  barbershop?: Tables<"barbershops"> | null;
  staff?: Tables<"staff"> | null;
};

export type SessionProfile = {
  session: Session;
  user: User;
  profile: Tables<"profiles"> | null;
  memberships: Membership[];
  shopActors: ShopActor[];
  activeShopActor: ShopActor | null;
  capabilities: ShopCapabilities | null;
  governanceMode: "single" | "equal" | "majority" | null;
  primaryRole: AppRole;
};

export function homeForRole(role: AppRole): "/app" | "/shop" | "/platform" {
  if (role === "platform_admin") return "/platform";
  if (role === "shop_admin") return "/shop";
  return "/app";
}

export function pickPrimaryRole(memberships: Membership[]): AppRole {
  if (memberships.some((m) => m.role === "platform_admin")) return "platform_admin";
  if (memberships.some((m) => m.role === "shop_admin")) return "shop_admin";
  return "customer";
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session?.user) return null;

  const userId = session.user.id;

  const [profileResult, membershipsResult, actorsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("memberships").select("*, barbershop:barbershops(*)").eq("user_id", userId),
    supabase
      .from("shop_members")
      .select("*, barbershop:barbershops(*), staff:staff(*)")
      .eq("user_id", userId)
      .eq("active", true),
  ]);

  // Schema may not be applied yet — degrade to customer home.
  const schemaMissing =
    (profileResult.error &&
      /could not find|relation|schema cache/i.test(profileResult.error.message)) ||
    (membershipsResult.error &&
      /could not find|relation|schema cache/i.test(membershipsResult.error.message)) ||
    (actorsResult.error &&
      /could not find|relation|schema cache/i.test(actorsResult.error.message));

  if (membershipsResult.error && !schemaMissing) throw membershipsResult.error;
  if (actorsResult.error && !schemaMissing) throw actorsResult.error;

  const list = schemaMissing ? [] : ((membershipsResult.data ?? []) as Membership[]);
  const shopActors = schemaMissing ? [] : ((actorsResult.data ?? []) as unknown as ShopActor[]);
  const activeShopActor = shopActors[0] ?? null;
  let governanceMode: SessionProfile["governanceMode"] = null;
  let canApplyProtected: boolean | undefined;
  let activePermissions: ShopPermissionMap | null = null;
  if (activeShopActor) {
    const [context, permissionResult] = await Promise.all([
      supabase.rpc("get_shop_access_context", {
        p_shop_id: activeShopActor.barbershop_id,
      }),
      // Permissões efetivas do próprio usuário; a matriz completa é restrita a quem administra.
      supabase.rpc("get_my_shop_permissions", {
        p_shop_id: activeShopActor.barbershop_id,
      }),
    ]);
    if (
      !context.error &&
      context.data &&
      typeof context.data === "object" &&
      !Array.isArray(context.data)
    ) {
      const data = context.data as {
        governance_mode?: unknown;
        can_apply_protected_change?: unknown;
      };
      if (["single", "equal", "majority"].includes(String(data.governance_mode))) {
        governanceMode = data.governance_mode as SessionProfile["governanceMode"];
      }
      canApplyProtected = data.can_apply_protected_change === true;
    }
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
        activePermissions = payload.permissions as ShopPermissionMap;
      }
    }
  }

  return {
    session,
    user: session.user,
    profile: schemaMissing ? null : (profileResult.data ?? null),
    memberships: list,
    shopActors,
    activeShopActor,
    capabilities: capabilitiesFor(
      activeShopActor,
      governanceMode,
      canApplyProtected,
      activePermissions,
    ),
    governanceMode,
    primaryRole: pickPrimaryRole(list),
  };
}

function isSafeAppPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value !== "/";
}

/** Rank used so login never "downgrades" (e.g. platform_admin → /shop via ?next=). */
function pathRank(path: string): number {
  if (path.startsWith("/platform")) return 3;
  if (path.startsWith("/shop")) return 2;
  if (path.startsWith("/app")) return 1;
  return 0;
}

export async function resolvePostAuthPath(preferredNext?: string): Promise<string> {
  const profile = await getSessionProfile();
  if (!profile) return "/auth";

  const home =
    profile.primaryRole === "platform_admin"
      ? "/platform"
      : profile.shopActors.length
        ? "/shop"
        : homeForRole(profile.primaryRole);
  if (preferredNext && isSafeAppPath(preferredNext)) {
    // Only follow next when it is at least as privileged as the role home.
    if (pathRank(preferredNext) >= pathRank(home)) return preferredNext;
  }
  return home;
}

export function hasProfessionalAccess(profile: SessionProfile): boolean {
  return (
    profile.primaryRole === "platform_admin" ||
    profile.shopActors.length > 0 ||
    hasAnyRole(profile.memberships, ["shop_admin"])
  );
}

export function hasAnyRole(memberships: Membership[], roles: AppRole[]): boolean {
  return memberships.some((m) => roles.includes(m.role));
}
