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
  const restrictedPhones = new Set(
    numbers.filter((n) => ["restricted", "banned"].includes(n.status)).map(phone),
  );
  const seen = new Set<string>();
  const eligible = numbers.filter((n) => {
    const p = phone(n);
    if (
      n.status !== "open" ||
      restrictedPhones.has(p) ||
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
  // Um número sem medição não recebe volume zero por suposição.
  const sends = (n: Number) => {
    const level = numberActivityLevel(n.activity);
    return level !== "unknown" && level !== "review" ? n.activity!.accepted : Infinity;
  };
  const ranked = [...eligible].sort(
    (a, b) =>
      load(a).primary - load(b).primary ||
      sends(a) - sends(b) ||
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

/** Preenche cobertura sem reordenar vínculos existentes nem alterar profissionais.
 * Lote determinístico: cada escolha entra na carga da próxima loja.
 * Menos de dois telefones elegíveis nunca produz uma composição de grupo.
 */
export function suggestMissingDistributions(
  shops: readonly { id: string }[],
  numbers: readonly Number[],
  routes: readonly Route[],
) {
  const assignments: { shop: string; primary: string; backup: string; backup2: string | null }[] =
    [];
  const blocked: string[] = [];
  let working = [...routes];
  for (const shop of [...shops].sort((a, b) => a.id.localeCompare(b.id))) {
    const current = working.find((r) => r.barbershop_id === shop.id && r.staff_id === null);
    // Uma configuração existente é decisão administrativa; não trocar a composição automaticamente.
    if (current) continue;
    const proposal = suggestDistribution(shop.id, numbers, working);
    if (!proposal.primary || !proposal.backup) {
      blocked.push(shop.id);
      continue;
    }
    const assignment = {
      shop: shop.id,
      primary: proposal.primary.id,
      backup: proposal.backup.id,
      backup2: proposal.backup2?.id ?? null,
    };
    assignments.push(assignment);
    working = [
      ...working,
      {
        barbershop_id: shop.id,
        staff_id: null,
        channel_id: assignment.primary,
        backup_channel_id: assignment.backup,
        backup2_channel_id: assignment.backup2,
      },
    ];
  }
  return { assignments, blocked };
}
