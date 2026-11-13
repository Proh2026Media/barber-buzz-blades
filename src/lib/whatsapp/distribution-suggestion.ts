import { activityPreference, numberActivityLevel, type NumberActivity } from "./number-activity.ts";
type Number = {
  id: string;
  display_phone: string | null;
  status: string;
  activity?: NumberActivity;
};
type Route = {
  barbershop_id: string;
  staff_id: string | null;
  channel_id: string;
  backup_channel_id: string | null;
  backup2_channel_id?: string | null;
};

/** Heurística local de vínculos. Não representa volume, capacidade ou saúde da conta. */
export function suggestDistribution(
  shop: string,
  numbers: readonly Number[],
  routes: readonly Route[],
) {
  const otherRoutes = routes.filter((r) => r.barbershop_id !== shop || r.staff_id !== null);
  const phone = (n: Number) => n.display_phone?.replace(/\D/g, "") ?? "";
  const seen = new Set<string>();
  const eligible = numbers.filter((n) => {
    const p = phone(n);
    if (
      n.status !== "open" ||
      n.activity?.paused ||
      numberActivityLevel(n.activity) === "review" ||
      !/^[1-9]\d{7,14}$/.test(p) ||
      seen.has(p)
    )
      return false;
    seen.add(p);
    return true;
  });
  const same = (n: Number, id: string | null | undefined) => {
    const assigned = numbers.find((number) => number.id === id);
    return Boolean(assigned && phone(assigned) === phone(n));
  };
  const load = (n: Number) => ({
    primary: otherRoutes.filter((r) => same(n, r.channel_id)).length,
    reserve: otherRoutes.filter(
      (r) => same(n, r.backup_channel_id) || same(n, r.backup2_channel_id),
    ).length,
  });
  const ranked = [...eligible].sort(
    (a, b) =>
      load(a).primary - load(b).primary ||
      activityPreference(a.activity) - activityPreference(b.activity) ||
      load(a).reserve - load(b).reserve ||
      phone(a).localeCompare(phone(b)),
  );
  const primary = ranked.shift() ?? null;
  ranked.sort(
    (a, b) =>
      load(a).reserve - load(b).reserve ||
      activityPreference(a.activity) - activityPreference(b.activity) ||
      load(a).primary - load(b).primary ||
      phone(a).localeCompare(phone(b)),
  );
  return {
    primary,
    backup: ranked[0] ?? null,
    backup2: ranked[1] ?? null,
    available: eligible.length,
  };
}
