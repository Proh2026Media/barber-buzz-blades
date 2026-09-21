import { redirect } from "@tanstack/react-router";
import {
  getSessionProfile,
  hasAnyRole,
  homeForRole,
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

export async function requireRole(nextPath: string, roles: AppRole[]): Promise<SessionProfile> {
  const profile = await requireSession(nextPath);
  if (!hasAnyRole(profile.memberships, roles)) {
    throw redirect({ to: homeForRole(profile.primaryRole) });
  }
  return profile;
}
