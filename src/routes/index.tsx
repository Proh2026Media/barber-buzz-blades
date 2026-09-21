import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionProfile, homeForRole } from "@/lib/auth/session";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const profile = await getSessionProfile();
    if (!profile) {
      throw redirect({ to: "/auth", search: { next: "/" } });
    }
    throw redirect({ to: homeForRole(profile.primaryRole) });
  },
  component: () => null,
});
