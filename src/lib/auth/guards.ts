import { requireProfessionalWith } from "./professional-access";
import { redirect } from "@tanstack/react-router";
import type { AccessNotice } from "./destination";
import {
  getSessionProfile,
  hasAnyRole,
  homeForRole,
  professionalRefusal,
  type AppRole,
  type SessionProfile,
} from "./session";

export async function requireSession(nextPath: string): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) {
    throw redirect({
      to: "/auth",
      search: { next: nextPath },
    });
  }
  return profile;
}

/**
 * Recusa explicada: quem cai no app do cliente leva o motivo no endereço (`?aviso=`), e o app
 * mostra o aviso. As outras áreas recebem a pessoa sem aviso (ex.: shop_admin antigo → /shop).
 */
function refuse(profile: SessionProfile, notice: AccessNotice): never {
  const home = homeForRole(profile.primaryRole);
  if (home === "/app") throw redirect({ href: `/app?aviso=${notice}` });
  throw redirect({ to: home });
}

export async function requireRole(nextPath: string, roles: AppRole[]): Promise<SessionProfile> {
  const profile = await requireSession(nextPath);
  if (!hasAnyRole(profile.memberships, roles)) {
    refuse(profile, roles.includes("platform_admin") ? "sem-plataforma" : "sem-acesso");
  }
  return profile;
}

/** Painel da barbearia (/shop e /shop/pontos): sem acesso, diz o motivo no app do cliente. */
export async function requireProfessional(nextPath: string): Promise<SessionProfile> {
  return requireProfessionalWith(nextPath, {
    session: requireSession,
    refusal: professionalRefusal,
    refuse,
  });
}
