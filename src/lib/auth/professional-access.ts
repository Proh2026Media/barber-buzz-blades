import type { AccessNotice } from "./destination.ts";
import type { SessionProfile } from "./session.ts";

type ProfessionalProfile = Pick<SessionProfile, "primaryRole" | "shopActors" | "memberships">;

export function hasProfessionalAccess(profile: ProfessionalProfile): boolean {
  return (
    profile.primaryRole === "platform_admin" ||
    profile.shopActors.length > 0 ||
    profile.memberships.some((member) => member.role === "shop_admin")
  );
}

/** Prioridade do convite pendente; falhas de rede/migration usam o motivo geral. */
export async function professionalRefusalFrom(read: {
  invites: () => Promise<boolean>;
  removed: () => Promise<boolean>;
}): Promise<AccessNotice> {
  try {
    if (await read.invites()) return "aguardando";
  } catch {
    /* consulta opcional */
  }
  try {
    if (await read.removed()) return "removido";
  } catch {
    /* consulta indisponível */
  }
  return "sem-acesso";
}

/** A mesma guarda usada por /shop e /shop/pontos, com leitura separada para testes sem rede. */
export async function requireProfessionalWith<T extends ProfessionalProfile>(
  nextPath: string,
  read: {
    session: (nextPath: string) => Promise<T>;
    refusal: (profile: T) => Promise<AccessNotice>;
    refuse: (profile: T, notice: AccessNotice) => never;
  },
): Promise<T> {
  const profile = await read.session(nextPath);
  if (!hasProfessionalAccess(profile)) read.refuse(profile, await read.refusal(profile));
  return profile;
}
