import type { PilotTarget } from "./pilot-check";
export type ReleaseCustomer = { id: string; name: string; allowed: boolean; ready: boolean };
export type ReleaseShop = {
  id: string;
  name: string;
  enabled: boolean;
  version: number;
  customers: ReleaseCustomer[];
};
export type ShopReleaseState = {
  contract: "bc-shop-release-v1";
  managed: boolean;
  running: boolean;
  policy_version: number;
  pause_version: number;
  shops: ReleaseShop[];
};
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const version = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
export function shopReleaseState(raw: unknown): ShopReleaseState {
  const d = obj(raw);
  if (
    d.contract !== "bc-shop-release-v1" ||
    typeof d.managed !== "boolean" ||
    typeof d.running !== "boolean" ||
    !version(d.policy_version) ||
    !version(d.pause_version) ||
    !Array.isArray(d.shops)
  )
    throw Error("CONTRACT_REQUIRED");
  const ids = new Set();
  for (const rawShop of d.shops) {
    const s = obj(rawShop);
    if (
      !uuid(s.id) ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      typeof s.enabled !== "boolean" ||
      !version(s.version) ||
      !Array.isArray(s.customers)
    )
      throw Error("CONTRACT_REQUIRED");
    ids.add(s.id);
    const people = new Set();
    for (const rawCustomer of s.customers) {
      const c = obj(rawCustomer);
      if (
        !uuid(c.id) ||
        people.has(c.id) ||
        typeof c.name !== "string" ||
        typeof c.allowed !== "boolean" ||
        typeof c.ready !== "boolean"
      )
        throw Error("CONTRACT_REQUIRED");
      people.add(c.id);
    }
  }
  return d as ShopReleaseState;
}
function plan(raw: unknown): { fingerprint: string; targets: PilotTarget[] } {
  const d = obj(raw);
  if (
    typeof d.fingerprint !== "string" ||
    !/^[a-f0-9]{32}$/.test(d.fingerprint) ||
    !Array.isArray(d.targets) ||
    d.targets.length < 2 ||
    d.targets.length > 20
  )
    throw Error("PILOT_CONNECTION_CHECK_FAILED");
  const ids = new Set(),
    phones = new Set();
  for (const rawTarget of d.targets) {
    const t = obj(rawTarget);
    if (
      !uuid(t.id) ||
      ids.has(t.id) ||
      typeof t.phone !== "string" ||
      !/^\+[1-9][0-9]{7,14}$/.test(t.phone) ||
      phones.has(t.phone) ||
      !version(t.version)
    )
      throw Error("CONTRACT_REQUIRED");
    ids.add(t.id);
    phones.add(t.phone);
  }
  return d as { fingerprint: string; targets: PilotTarget[] };
}
/** Consulta somente os números do plano atual. Não ativa, pareia nem envia. */
export async function checkShopReleaseNumbers(
  deps: {
    read: () => Promise<unknown>;
    current: () => Promise<boolean>;
    verify: (target: PilotTarget) => Promise<unknown>;
  },
  signal: AbortSignal,
): Promise<void> {
  const guard = async () => {
    signal.throwIfAborted();
    if (!(await deps.current())) throw Error("SESSION_REQUIRED");
    signal.throwIfAborted();
  };
  await guard();
  const first = plan(await deps.read());
  for (const target of first.targets) {
    await guard();
    const result = obj(await deps.verify(target));
    await guard();
    if (
      result.managed_channel_id !== target.id ||
      result.status !== "open" ||
      result.display_phone !== target.phone ||
      result.error
    )
      throw Error("PILOT_CONNECTION_CHECK_FAILED");
  }
  await guard();
  const last = plan(await deps.read());
  await guard();
  if (
    last.fingerprint !== first.fingerprint ||
    JSON.stringify(last.targets) !== JSON.stringify(first.targets)
  )
    throw Error("GROUP_STALE");
}
