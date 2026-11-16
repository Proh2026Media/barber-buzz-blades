type Snapshot = {
  enabled: boolean;
  group: {
    id: string;
    version: number;
    cycle_state?: string;
    closing?: boolean;
    numbers_changed?: boolean;
  } | null;
  platform_participants: { id: string; phone: string }[];
  phone_revision?: {
    id: string | null;
    phase: string | null;
    enabled: boolean;
    expired: boolean;
    declared_phone: string | null;
  };
};
type Start = { phone: string; accounts: string[]; accept: boolean; group: string; version: number };
const stale = () => {
  throw Error("GROUP_STALE");
};
const composition = (s: Snapshot) => {
  const values = s.platform_participants;
  if (
    values.length < 2 ||
    values.length > 20 ||
    new Set(values.map((n) => n.id)).size !== values.length ||
    new Set(values.map((n) => n.phone)).size !== values.length
  )
    return stale();
  return JSON.stringify(
    values.map((n) => [n.id, n.phone]).sort((a, b) => a[0].localeCompare(b[0])),
  );
};
/** Só um clique explícito renova a intenção. Nunca renova prazo no polling ou muda grupo/telefone/números. */
export async function resumeExpiredPhoneRevision<T extends Snapshot>(
  initial: T,
  actions: {
    read: () => Promise<T>;
    abort: (revision: string) => Promise<T>;
    revise: (start: Start) => Promise<T>;
  },
) {
  const revision = initial.phone_revision,
    group = initial.group;
  if (
    !initial.enabled ||
    !revision?.enabled ||
    (!revision.expired && revision.phase !== "aborted") ||
    !revision.id ||
    !revision.declared_phone ||
    !group ||
    !["requested", "waiting", "aborted"].includes(revision.phase ?? "") ||
    group.closing ||
    group.numbers_changed ||
    ["closing", "closed", "customer_left", "creation_unknown"].includes(group.cycle_state ?? "")
  )
    return stale();
  const expected = composition(initial);
  const check = (value: T, aborted: boolean) => {
    const r = value.phone_revision,
      g = value.group;
    if (
      !value.enabled ||
      !g ||
      g.id !== group.id ||
      g.closing ||
      g.numbers_changed ||
      ["closing", "closed", "customer_left", "creation_unknown"].includes(g.cycle_state ?? "") ||
      composition(value) !== expected ||
      r?.id !== revision.id ||
      r.declared_phone !== revision.declared_phone ||
      (aborted
        ? r.phase !== "aborted"
        : (revision.phase !== "aborted" && !r.expired) ||
          !r.enabled ||
          r.phase !== revision.phase ||
          g.version !== group.version)
    )
      return stale();
  };
  const current = await actions.read();
  check(current, false);
  const after = revision.phase === "aborted" ? current : await actions.abort(revision.id);
  check(after, true);
  return actions.revise({
    phone: revision.declared_phone,
    accounts: initial.platform_participants.map((n) => n.id),
    accept: true,
    group: group.id,
    version: after.group!.version,
  });
}
