/** A conferência apenas observa conexões. A ativação continua em outra operação. */
export type PilotState = {
  contract: "bc-pilot-release-v1";
  scoped: boolean;
  isolated: boolean;
  shop_id: string | null;
  customer_id: string | null;
  shop_name: string | null;
  customer_name: string | null;
  policy_version: number;
  pause_version: number;
  paused: boolean;
  cycles: boolean;
  assistance: boolean;
  preparation_ready: boolean;
};
export type PilotTarget = { id: string; phone: string; version: number };
type Snapshot = {
  contract: "bc-pilot-connection-check-v1";
  state: PilotState;
  targets: PilotTarget[];
  fingerprint: string;
};
const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function pilotState(value: unknown): PilotState {
  const state = object(value);
  if (
    state.contract !== "bc-pilot-release-v1" ||
    ["paused", "cycles", "assistance", "preparation_ready", "scoped", "isolated"].some(
      (key) => typeof state[key] !== "boolean",
    ) ||
    [state.policy_version, state.pause_version].some(
      (value) => !Number.isSafeInteger(value) || Number(value) < 0,
    ) ||
    (state.scoped && (!uuid(state.shop_id) || !uuid(state.customer_id)))
  )
    throw Error("CONTRACT_REQUIRED");
  return state as PilotState;
}
function snapshot(value: unknown): Snapshot {
  const data = object(value),
    state = pilotState(data.state);
  if (
    data.contract !== "bc-pilot-connection-check-v1" ||
    typeof data.fingerprint !== "string" ||
    !/^[a-f0-9]{32}$/.test(data.fingerprint)
  )
    throw Error("CONTRACT_REQUIRED");
  if (!state.scoped || !state.isolated) throw Error("PILOT_SCOPE_REQUIRED");
  if (!Array.isArray(data.targets) || data.targets.length < 2 || data.targets.length > 20)
    throw Error("PILOT_CONNECTION_CHECK_FAILED");
  for (const raw of data.targets) {
    const target = object(raw);
    if (
      !uuid(target.id) ||
      typeof target.phone !== "string" ||
      !/^\+[1-9][0-9]{7,14}$/.test(target.phone) ||
      !Number.isSafeInteger(target.version) ||
      Number(target.version) < 0
    )
      throw Error("CONTRACT_REQUIRED");
  }
  const targets = data.targets as PilotTarget[];
  if (
    new Set(targets.map((t) => t.id)).size !== targets.length ||
    new Set(targets.map((t) => t.phone)).size !== targets.length
  )
    throw Error("CONTRACT_REQUIRED");
  return {
    contract: "bc-pilot-connection-check-v1",
    state,
    targets,
    fingerprint: data.fingerprint,
  };
}
export async function checkPilotConnections(
  deps: {
    read: () => Promise<unknown>;
    verify: (target: PilotTarget) => Promise<unknown>;
    current: () => Promise<boolean>;
  },
  signal: AbortSignal,
  expected: Pick<PilotState, "shop_id" | "customer_id"> | null = null,
): Promise<PilotState> {
  const guard = async () => {
    signal.throwIfAborted();
    if (!(await deps.current())) throw Error("SESSION_REQUIRED");
    signal.throwIfAborted();
  };
  await guard();
  const first = snapshot(await deps.read());
  if (
    expected &&
    (first.state.shop_id !== expected.shop_id || first.state.customer_id !== expected.customer_id)
  )
    throw Error("GROUP_STALE");
  let index = 0;
  const worker = async () => {
    while (index < first.targets.length) {
      await guard();
      const target = first.targets[index++];
      if (!target) return;
      const result = object(await deps.verify(target));
      await guard();
      if (
        result.managed_channel_id !== target.id ||
        result.status !== "open" ||
        result.display_phone !== target.phone ||
        result.error
      )
        throw Error("PILOT_CONNECTION_CHECK_FAILED");
    }
  };
  // Esperar todas as consultas já iniciadas, inclusive se uma falhar; não repetir automaticamente.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(4, first.targets.length) }, worker),
  );
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) throw failed.reason;
  await guard();
  const last = snapshot(await deps.read());
  await guard();
  if (
    last.fingerprint !== first.fingerprint ||
    last.state.shop_id !== first.state.shop_id ||
    last.state.customer_id !== first.state.customer_id ||
    JSON.stringify(last.targets) !== JSON.stringify(first.targets)
  )
    throw Error("GROUP_STALE");
  return last.state;
}
