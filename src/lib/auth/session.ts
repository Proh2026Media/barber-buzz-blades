import type { Session, User } from "@supabase/supabase-js";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { capabilitiesFor, type ShopCapabilities, type ShopPermissionMap } from "./capabilities";
import { hasShopToOpen, sortShopActors } from "./shop-acting";
import { areaAccessFor } from "./areas";
import {
  decidePostAuthPath,
  readLastArea,
  type AccessNotice,
  type AreaAccess,
} from "./destination";

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
  // /platform aceita só platform_admin; mandar o gerente de conta para lá criava um ciclo de
  // redirecionamento. Sem tela própria ainda, ele entra pela área comum (/app).
  if (role === "platform_admin") return "/platform";
  if (role === "shop_admin") return "/shop";
  return "/app";
}

export function pickPrimaryRole(memberships: Membership[]): AppRole {
  if (memberships.some((m) => m.role === "platform_admin")) return "platform_admin";
  if (memberships.some((m) => m.role === "account_manager")) return "account_manager";
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
  // Ordem fixa (papel mais alto, depois o vínculo mais antigo): a primeira loja aberta não
  // depende da ordem em que o banco devolve as linhas.
  const shopActors = schemaMissing
    ? []
    : sortShopActors((actorsResult.data ?? []) as unknown as ShopActor[]);
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

/** Áreas que a conta pode abrir (plataforma, painel de barbearia; o app do cliente vale sempre). */
export function areaAccessOf(
  profile: Pick<SessionProfile, "shopActors" | "memberships">,
): AreaAccess {
  return areaAccessFor(profile);
}

/**
 * Destino depois de entrar (e ao abrir "/" ou o app instalado). A regra fica em
 * `destination.ts`: o pedido do link vence quando é específico; sem destino, abre a última área
 * usada neste aparelho ou a mais alta da conta. Só caminhos e parâmetros conhecidos passam.
 */
export async function resolvePostAuthPath(preferredNext?: string): Promise<string> {
  const profile = await getSessionProfile();
  if (!profile) return "/auth";
  return decidePostAuthPath({
    next: preferredNext,
    access: areaAccessOf(profile),
    lastArea: readLastArea(profile.user.id),
  });
}

/**
 * Por que o painel recusou a conta: vínculo de equipe encerrado ("removido") ou nenhum vínculo
 * ("sem-acesso"). O convite aguardando aprovação dos donos ainda não é legível pela pessoa
 * convidada (precisa de consulta no banco).
 */
export async function professionalRefusal(profile: SessionProfile): Promise<AccessNotice> {
  try {
    const { data, error } = await supabase
      .from("shop_members")
      .select("id")
      .eq("user_id", profile.user.id)
      .eq("active", false)
      .limit(1);
    if (!error && data && data.length > 0) return "removido";
  } catch {
    // Sem resposta: mostra o motivo geral.
  }
  return "sem-acesso";
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

/** A conta tem barbearia para abrir no painel (equipe ou shop_admin antigo; nunca de cliente). */
export function hasShopAccess(profile: Pick<SessionProfile, "shopActors" | "memberships">) {
  return hasShopToOpen({ actors: profile.shopActors, memberships: profile.memberships });
}
