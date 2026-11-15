import { careGroupBrand, careGroupContent, sameCareGroupBrand } from "./care-group-content.ts";
import { careGroupTitle } from "./care-group-title.ts";
import { groupSnapshot, individualPhone } from "./whatsapp-groups.ts";

type Database = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown; error?: unknown }>;
};
export type CycleTransport = (path: string, init?: RequestInit) => Promise<unknown>;
type NumberIdentity = { id: string; phone: string; instance: string };
type Step = {
  id: string;
  phase: string;
  revision: string;
  instance_name: string;
  request_hash: string;
  state: "started" | "unknown" | "accepted";
  provider_id: string | null;
  execute?: boolean;
};
export type CareCycleJob = {
  id: string;
  token: string;
  revision: number;
  group_id: string | null;
  group_jid: string | null;
  state: string;
  legacy_closing: boolean;
  cleanup_pending: boolean;
  cleanup_state: Record<string, string>;
  customer_phone: string;
  phone_revision?: {
    id: string;
    cycleId: string;
    admissionId: string;
    oldCustomerJid: string;
    declaredJid: string;
    commitHash: string;
  } | null;
  numbers: NumberIdentity[];
  creator_channel_id: string;
  creator_instance: string;
  provider_creator_id: string | null;
  creation_operation: string;
  creation_body: Record<string, unknown> | null;
  creation_hash: string | null;
  creation_issued_at: string | null;
  admission_id: string;
  created_at: string | null;
  expires_at: string | null;
  entry_pending: boolean;
  steps: Step[];
  content: {
    shop_id: string;
    shop_name: string;
    customer_name: string;
    slug: string;
    timezone: string;
    logo_url: string | null;
    starts_at: string | null;
  } | null;
};
type CycleProof = {
  cycleId: string;
  groupJid: string;
  creatorJid: string;
  creatorInstanceId: string;
  customerJid: string;
  phoneRevision?: {
    id: string;
    cycleId: string;
    admissionId: string;
    oldCustomerJid: string;
    declaredJid: string;
    commitHash: string;
    resolvedJid: string;
    phase: string;
  };
  platformJids: string[];
  createdAt: string;
  expiresAt: string;
  brand?: ReturnType<typeof careGroupBrand>;
  prepared: boolean;
  logoApplied: boolean;
  logoHash: string | null;
  firstWelcomeOperation: string | null;
  firstSenderJid: string | null;
  firstMessageId: string | null;
  firstReceived: boolean;
  lastWelcomeReceived?: boolean;
  lastWelcomeAdmissionId?: string;
  welcomeAdmissions?: Record<string, string>;
  firstViolation: boolean;
  lastWelcomeOperation: string | null;
  lastWelcomeMessageId: string | null;
  pinAccepted: boolean;
  pinExpiresAt: string | null;
  descriptionHash: string | null;
  closing: boolean;
  closed: boolean;
  pinIntent?: { key: string; duration: number; hash: string };
  closeProof?: { lastJid: string };
  leftInstances: string[];
};
export type CycleLogo = (
  shopId: string,
  url: string,
) => Promise<{ base64: string; sha256: string }>;
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const pn = (phone: string) => phone.slice(1) + "@s.whatsapp.net";
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("GROUP_UNVERIFIABLE");
  return value as Record<string, unknown>;
};
export async function cycleHash(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function validJob(input: unknown): input is CareCycleJob {
  if (!input || typeof input !== "object") return false;
  const j = input as CareCycleJob;
  return (
    uuid(j.id) &&
    uuid(j.token) &&
    uuid(j.creation_operation) &&
    Number.isSafeInteger(j.revision) &&
    j.revision > 0 &&
    /^\+[1-9]\d{7,14}$/.test(j.customer_phone) &&
    Array.isArray(j.numbers) &&
    j.numbers.length >= 1 &&
    j.numbers.length <= 20 &&
    j.numbers.every(
      (n) =>
        uuid(n.id) &&
        /^\+[1-9]\d{7,14}$/.test(n.phone) &&
        /^[A-Za-z0-9_-]{1,100}$/.test(n.instance),
    ) &&
    new Set(j.numbers.map((n) => n.phone)).size === j.numbers.length &&
    new Set(j.numbers.map((n) => n.instance)).size === j.numbers.length &&
    j.numbers.some((n) => n.id === j.creator_channel_id && n.instance === j.creator_instance) &&
    !j.numbers.some((n) => n.phone === j.customer_phone) &&
    Array.isArray(j.steps)
  );
}

/** Um ciclo recebe uma posse do banco. Corpo/destino nunca vêm do navegador. */
export async function processCareCycle(
  db: Database,
  transport: CycleTransport,
  cycleId: string,
  logo: CycleLogo,
  enabled = false,
  onFailure?: (code: string) => void,
): Promise<string> {
  if (!enabled || !uuid(cycleId)) return "blocked";
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const r = await db.rpc(name, args);
    if (r.error) throw Error("GROUP_DATABASE_UNAVAILABLE");
    return r.data;
  };
  const claim = await rpc("claim_care_cycle", { p_cycle: cycleId });
  if (!claim) return "blocked";
  if (!validJob(claim)) throw Error("GROUP_CONTEXT_INVALID");
  let job = claim;
  const token = job.token,
    revision = job.revision;
  let group = job.group_jid;
  let observerInstance: string | null = null;
  const before = async (closing = false, step: string | null = null) => {
    const current = await rpc("authorize_care_cycle", {
      p_cycle: job.id,
      p_token: token,
      p_closing: closing,
      p_step: step,
    });
    if (
      !validJob(current) ||
      current.id !== job.id ||
      current.token !== token ||
      current.revision !== revision ||
      JSON.stringify(current.numbers) !== JSON.stringify(job.numbers) ||
      current.customer_phone !== job.customer_phone ||
      (group && current.group_jid !== group)
    )
      throw Error("GROUP_STALE");
    job = current;
  };
  const path = (name: string, instance: string) => {
    if (!/^[A-Za-z]+$/.test(name) || !job.numbers.some((n) => n.instance === instance))
      throw Error("GROUP_ROUTE_INVALID");
    return `/group/${name}/${encodeURIComponent(instance)}`;
  };
  const get = (name: string, instance: string, args: Record<string, string> = {}) =>
    transport(path(name, instance) + "?" + new URLSearchParams(args), {
      signal: AbortSignal.timeout(5000),
    });
  const post = async (
    name: string,
    instance: string,
    body: unknown,
    closing = false,
    step: string | null = null,
  ) => {
    await before(closing, step);
    return transport(path(name, instance), {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  };
  const release = async (reason: string | null = null, closed = false) => {
    await rpc("release_care_cycle", {
      p_cycle: job.id,
      p_token: token,
      p_reason: reason,
      p_closed: closed,
    });
  };
  const start = async (phase: string, key: string, instance: string, hash: string) => {
    const old = job.steps.find((s) => s.phase === phase && s.revision === key);
    if (old) {
      if (old.instance_name !== instance || old.request_hash !== hash) throw Error("GROUP_STALE");
      return { ...old, execute: false };
    }
    const value = record(
      await rpc("start_care_cycle_step", {
        p_cycle: job.id,
        p_token: token,
        p_phase: phase,
        p_revision: key,
        p_instance: instance,
        p_hash: hash,
      }),
    );
    if (!uuid(value.id) || value.instance_name !== instance || value.request_hash !== hash)
      throw Error("GROUP_STEP_INVALID");
    const s = value as unknown as Step;
    job.steps.push(s);
    return s;
  };
  const finish = async (step: Step, accepted: boolean, messageId: string | null = null) => {
    await rpc("finish_care_cycle_step", {
      p_cycle: job.id,
      p_token: token,
      p_step: step.id,
      p_accepted: accepted,
      p_provider_id: messageId,
    });
    step.state = accepted ? "accepted" : "unknown";
    step.provider_id = messageId;
  };
  const proof = async (instance = observerInstance ?? job.creator_instance) => {
    const data = record(await get("bcCycle", instance, { groupJid: group! }));
    const c = data.cycle as CycleProof;
    const platforms = job.numbers.map((n) => pn(n.phone)).sort();
    const correction = c?.phoneRevision;
    const closingIdentity =
      (job.state === "closing" || (job.state === "closed" && job.cleanup_pending)) &&
      job.phone_revision &&
      correction &&
      correction.id === job.phone_revision.id &&
      correction.cycleId === job.id &&
      correction.admissionId === job.phone_revision.admissionId &&
      correction.oldCustomerJid === job.phone_revision.oldCustomerJid &&
      correction.declaredJid === job.phone_revision.declaredJid &&
      correction.commitHash === job.phone_revision.commitHash &&
      ["bound", "committed"].includes(correction.phase) &&
      c.customerJid === correction.resolvedJid &&
      /^[1-9][0-9]{7,14}@s\.whatsapp\.net$/.test(correction.resolvedJid) &&
      !platforms.includes(correction.resolvedJid);
    if (
      !c ||
      c.cycleId !== job.id ||
      c.groupJid !== group ||
      (c.customerJid !== pn(job.customer_phone) && !closingIdentity) ||
      c.creatorInstanceId !== job.provider_creator_id ||
      c.creatorJid !== pn(job.numbers.find((n) => n.instance === job.creator_instance)!.phone) ||
      JSON.stringify([...c.platformJids].sort()) !== JSON.stringify(platforms) ||
      !Number.isFinite(Date.parse(c.createdAt)) ||
      !Number.isFinite(Date.parse(c.expiresAt))
    )
      throw Error("GROUP_PROOF_INVALID");
    if (
      (job.created_at && Date.parse(c.createdAt) !== Date.parse(job.created_at)) ||
      (job.expires_at && Date.parse(c.expiresAt) !== Date.parse(job.expires_at))
    )
      throw Error("GROUP_PROOF_INVALID");
    return c;
  };
  const operation = async (
    step: Step,
    accepted: string,
    body: unknown,
    endpoint: string,
    expectedHash: string,
    closing = false,
  ) => {
    let result: Record<string, unknown>;
    if (step.execute)
      result = record(await post(endpoint, step.instance_name, body, closing, step.id));
    else
      result = record(
        await get("bcOperation", step.instance_name, { groupJid: group!, operationId: step.id }),
      );
    if (
      result.instanceId !== "group:" + group ||
      result.operationKey !== step.id ||
      result.groupJid !== group ||
      result.requestHash !== expectedHash
    )
      throw Error("GROUP_OPERATION_MISMATCH");
    const id =
      typeof result.messageId === "string" &&
      result.messageId.length > 0 &&
      result.messageId.length <= 200
        ? result.messageId
        : null;
    const ok = result.state === accepted && (accepted !== "notice_accepted" || Boolean(id));
    await finish(step, ok, id);
    if (!ok) throw Error("GROUP_OPERATION_UNKNOWN");
    return result;
  };
  try {
    // Registros são sincronizados por uma rodada separada. Capacidade não registra/autoriza contas.
    if (job.state === "closed") {
      for (const n of job.numbers) {
        if (job.cleanup_state?.[n.id] === "accepted") continue;
        let state = "unknown";
        try {
          const hash = await cycleHash(["delete", n.phone]);
          const step = await start("close_delete", n.id, n.instance, hash);
          const result = record(
            await post(
              "bcClose",
              n.instance,
              { groupJid: group, operationId: step.id, stage: "delete" },
              true,
              step.id,
            ),
          );
          state = ["delete_accepted", "chat_deleted"].includes(String(result.state))
            ? "accepted"
            : result.state === "cleanup_pending"
              ? "pending"
              : "unknown";
          await finish(step, state === "accepted");
        } catch {
          /* Limpeza pendente fica visível e não desfaz o encerramento. */
        }
        await rpc("record_care_cycle_cleanup", {
          p_cycle: job.id,
          p_token: token,
          p_number: n.id,
          p_state: state,
        });
      }
      await release("cleanup_pending");
      return "cleanup_pending";
    }
    if (job.state === "closing") {
      if (!group) {
        if (job.creation_issued_at) throw Error("GROUP_CREATION_UNPROVEN");
        await release("closed", true);
        return "closed";
      }
      if (job.legacy_closing && !job.created_at) {
        let adopted: unknown = null;
        for (const n of job.numbers) {
          try {
            await post(
              "bcAdoptClosing",
              n.instance,
              {
                groupJid: group,
                cycleId: job.id,
                customerJid: pn(job.customer_phone),
                platformJids: job.numbers.map((n) => pn(n.phone)),
              },
              true,
            );
            adopted = record(await get("bcCycle", n.instance, { groupJid: group! })).cycle;
            break;
          } catch {
            /* A adoção apenas encerra; jamais libera mensagem ou cria grupo. */
          }
        }
        if (!adopted) throw Error("GROUP_CLOSURE_UNPROVEN");
        const saved = await rpc("record_legacy_care_cycle_proof", {
          p_cycle: job.id,
          p_token: token,
          p_proof: adopted,
        });
        if (!validJob(saved)) throw Error("GROUP_CLOSURE_UNPROVEN");
        job = saved;
      }
      let c: CycleProof | null = null;
      let observer: NumberIdentity | null = null;
      for (const n of job.numbers) {
        try {
          c = await proof(n.instance);
          observer = n;
          break;
        } catch {
          /* Reserva offline não impede retirada pelo outro administrador. */
        }
      }
      if (!c || !observer) throw Error("GROUP_PROOF_INVALID");
      const last = c.closeProof?.lastJid ?? pn(observer.phone);
      const lastNumber = job.numbers.find((n) => pn(n.phone) === last);
      if (!lastNumber) throw Error("GROUP_PROOF_INVALID");
      async function close(stage: string, n: NumberIdentity, target?: string) {
        const phase =
          stage === "start"
            ? "close_start"
            : stage === "final"
              ? "close_final"
              : stage === "withdraw"
                ? "close_withdraw"
                : stage === "delete"
                  ? "close_delete"
                  : "close_leave";
        const hash = await cycleHash([stage, n.phone, target ?? null]);
        const step = await start(phase, target ?? n.id, n.instance, hash);
        const result = record(
          await post(
            "bcClose",
            n.instance,
            {
              groupJid: group,
              operationId: step.id,
              stage,
              ...(target ? { targetJid: target } : {}),
            },
            true,
            step.id,
          ),
        );
        const accepted = [
          "close_accepted",
          "left",
          "closed",
          "delete_accepted",
          "chat_deleted",
        ].includes(String(result.state));
        await finish(step, accepted);
        if (!accepted) throw Error("GROUP_OPERATION_UNKNOWN");
      }
      await close("start", lastNumber);
      for (const n of job.numbers.filter((n) => n.id !== lastNumber.id)) {
        c = await proof(lastNumber.instance);
        if (!c.leftInstances.includes(pn(n.phone)))
          await close("withdraw", lastNumber, pn(n.phone));
      }
      await close("final", lastNumber);
      await release("closed", true);
      return "closed";
    }
    const liveNumbers: NumberIdentity[] = [];
    for (const n of job.numbers) {
      try {
        const c = record(await get("bcCapabilities", n.instance));
        if (
          c.contract === "bc-groups-v4" &&
          [
            "protectedCycle",
            "postAdmissionWelcome",
            "twoPlatformAdmins",
            "persistentOperations",
            "serializedCommands",
            "protectedBranding",
            "protectedNotices",
            "protectedCodes",
          ].every((k) => c[k] === true)
        )
          liveNumbers.push(n);
      } catch {
        /* Observação pode usar outro admin; o emissor permanece escolhido pela rota. */
      }
    }
    if (!liveNumbers.length) throw Error("GROUP_CAPABILITY_REQUIRED");
    observerInstance = liveNumbers.some((n) => n.instance === job.creator_instance)
      ? job.creator_instance
      : liveNumbers[0].instance;
    for (const s of job.steps.filter(
      (s) => ["welcome", "pin"].includes(s.phase) && s.state !== "accepted",
    )) {
      const remote = record(
        await get("bcOperation", s.instance_name, { groupJid: group!, operationId: s.id }),
      );
      const expected = s.phase === "welcome" ? "notice_accepted" : "pin_accepted";
      if (
        remote.instanceId !== "group:" + group ||
        remote.groupJid !== group ||
        remote.operationKey !== s.id ||
        remote.requestHash !== s.request_hash ||
        remote.state !== expected
      )
        throw Error("GROUP_OPERATION_UNKNOWN");
      const id =
        typeof remote.messageId === "string" &&
        remote.messageId.length > 0 &&
        remote.messageId.length <= 200
          ? remote.messageId
          : null;
      if (s.phase === "welcome" && !id) throw Error("GROUP_OPERATION_UNKNOWN");
      await finish(s, true, id);
    }
    await before();
    if (job.numbers.length < 2 || !job.content?.logo_url) throw Error("GROUP_PREPARATION_REQUIRED");
    const content = job.content,
      branding = careGroupBrand({
        shop_name: content.shop_name,
        customer_name: content.customer_name,
        slug: content.slug,
        timezone: content.timezone,
      });
    const title = careGroupTitle(content);
    const logoUrl = job.content.logo_url;
    let asset: Awaited<ReturnType<CycleLogo>>;
    try {
      asset = await logo(content.shop_id, logoUrl);
    } catch {
      throw Error("GROUP_PREPARATION_REQUIRED");
    }
    const creator = job.numbers.find((n) => n.instance === job.creator_instance)!;
    const secondary =
      liveNumbers.find((n) => n.id !== creator.id) ?? job.numbers.find((n) => n.id !== creator.id)!;
    if (!group) {
      let creation = job.creation_body,
        hash = job.creation_hash;
      if (!creation) {
        const cap = record(await get("bcCapabilities", job.creator_instance));
        if (typeof cap.instanceId !== "string") throw Error("GROUP_CAPABILITY_REQUIRED");
        creation = {
          operationId: job.creation_operation,
          cycleId: job.id,
          subject: title,
          participants: job.numbers
            .filter((n) => n.id !== creator.id)
            .map((n) => pn(n.phone))
            .sort(),
          customerJid: pn(job.customer_phone),
          brand: branding,
        };
        hash = await cycleHash([
          job.id,
          pn(creator.phone),
          title,
          creation.participants,
          creation.customerJid,
          branding,
        ]);
        const sealed = await rpc("seal_care_cycle_creation", {
          p_cycle: job.id,
          p_token: token,
          p_instance_id: cap.instanceId,
          p_body: creation,
          p_hash: hash,
        });
        if (!validJob(sealed)) throw Error("GROUP_CONTEXT_INVALID");
        job = sealed;
      }
      const s = await start("create", "initial", job.creator_instance, hash!);
      let result: Record<string, unknown>;
      if (s.execute)
        result = record(await post("bcCreate", job.creator_instance, creation, false, s.id));
      else
        result = record(
          await get("bcCreationStatus", job.creator_instance, {
            cycleId: job.id,
            operationId: job.creation_operation,
            requestHash: hash!,
            creatorInstanceId: job.provider_creator_id!,
          }),
        );
      if (
        result.operationKey !== job.creation_operation ||
        result.requestHash !== hash ||
        result.state !== "created" ||
        typeof result.groupJid !== "string" ||
        !/^[0-9-]+@g\.us$/.test(result.groupJid)
      ) {
        await finish(s, false);
        throw Error("GROUP_OPERATION_UNKNOWN");
      }
      // Recupera apenas o ciclo a partir do JID já provado. Esse endpoint jamais chama groupCreate.
      await post("bcRecoverCycle", job.creator_instance, {
        ...creation,
        creatorInstanceId: job.provider_creator_id,
      });
      group = result.groupJid;
      const c = await proof();
      await rpc("record_care_cycle_creation", {
        p_cycle: job.id,
        p_token: token,
        p_jid: group,
        p_created_at: c.createdAt,
        p_expires_at: c.expiresAt,
      });
      await finish(s, true);
      job.group_jid = group;
      job.created_at = c.createdAt;
      job.expires_at = c.expiresAt;
    }
    let c = await proof();
    const photoHash = await cycleHash(["photo", asset.sha256, pn(creator.phone)]);
    if (
      !c.prepared ||
      !c.logoApplied ||
      c.logoHash !== asset.sha256 ||
      JSON.stringify(c.platformJids) !== JSON.stringify(job.numbers.map((n) => pn(n.phone)).sort())
    ) {
      const preparation = await start(
        "prepare",
        `${job.revision}:${asset.sha256}`,
        job.creator_instance,
        photoHash,
      );
      if (!preparation.execute && preparation.state !== "accepted") {
        const status = record(
          await get("bcOperation", job.creator_instance, {
            groupJid: group!,
            operationId: preparation.id,
          }),
        );
        if (
          status.operationKey !== preparation.id ||
          status.requestHash !== photoHash ||
          status.state !== "config_accepted"
        )
          throw Error("GROUP_OPERATION_UNKNOWN");
      }
      const prepared = record(
        await post(
          "bcPrepare",
          job.creator_instance,
          {
            groupJid: group,
            operationId: preparation.id,
            subject: title,
            platformJids: job.numbers.map((n) => pn(n.phone)),
            brand: branding,
            logoBase64: asset.base64,
            logoHash: asset.sha256,
          },
          false,
          preparation.id,
        ),
      );
      if (prepared.state !== "prepared") {
        await finish(preparation, false);
        throw Error("GROUP_OPERATION_UNKNOWN");
      }
      await finish(preparation, true);
      c = await proof();
    } else {
      if (!sameCareGroupBrand(c.brand, branding))
        await post("bcBrand", observerInstance!, { groupJid: group, brand: branding });
      await post("bcSubject", observerInstance!, {
        groupJid: group,
        subject: title,
        customerJid: pn(job.customer_phone),
        platformJids: job.numbers.map((n) => pn(n.phone)),
        allowAbsent: true,
      });
      c = await proof();
    }
    async function welcome(key: string, admission?: string) {
      const text = careGroupContent({
        ...branding,
        expires_at: new Date(job.expires_at!).toISOString(),
      });
      const hash = await cycleHash([
        "welcome",
        pn(secondary.phone),
        admission ?? null,
        text.version,
        await cycleHash(text.welcome),
      ]);
      const s = await start("welcome", key, secondary.instance, hash);
      return operation(
        s,
        "notice_accepted",
        { groupJid: group, operationId: s.id, ...(admission ? { admissionId: admission } : {}) },
        "bcWelcome",
        hash,
      );
    }
    async function describeAndPin() {
      if (
        c.descriptionHash !==
        (await cycleHash(
          careGroupContent({ ...branding, expires_at: new Date(job.expires_at!).toISOString() })
            .description,
        ))
      )
        await post("bcDescription", secondary.instance, { groupJid: group });
      c = await proof();
      const priorPin =
        c.pinIntent &&
        job.steps.find(
          (s) => s.phase === "pin" && s.id === c.pinIntent!.key && s.state === "accepted",
        );
      if (
        c.pinAccepted &&
        Date.parse(c.pinExpiresAt ?? "") > Date.now() + 86400000 &&
        priorPin &&
        priorPin.request_hash ===
          (await cycleHash([
            "pin",
            c.lastWelcomeMessageId,
            c.pinIntent!.duration,
            new Date(job.expires_at!).toISOString(),
          ]))
      )
        return;
      const remaining = (Date.parse(job.expires_at!) - Date.now()) / 1000;
      const duration = [2592000, 604800, 86400].find((n) => n <= remaining);
      if (!duration) throw Error("GROUP_PIN_WINDOW_UNAVAILABLE");
      const key = `${c.lastWelcomeOperation}:${c.pinExpiresAt ?? "initial"}`;
      const hash = await cycleHash([
        "pin",
        c.lastWelcomeMessageId,
        duration,
        new Date(job.expires_at!).toISOString(),
      ]);
      const s = await start("pin", key, secondary.instance, hash);
      await operation(
        s,
        "pin_accepted",
        { groupJid: group, operationId: s.id, messageId: c.lastWelcomeMessageId, duration },
        "bcPinNotice",
        hash,
      );
    }
    if (job.entry_pending) {
      const pending = await get("joinRequests", observerInstance!, { groupJid: group! });
      if (!Array.isArray(pending) || pending.length > 50) throw Error("GROUP_UNVERIFIABLE");
      for (const raw of pending) {
        const r = record(raw);
        if (typeof r.jid !== "string" || !r.phoneNumber) continue;
        const phone = individualPhone(r.phoneNumber);
        if (!phone) continue;
        await post("joinRequests", observerInstance!, {
          groupJid: group,
          participants: [r.jid],
          action: phone === job.customer_phone ? "approve" : "reject",
        });
      }
    }
    let raw = await get("bcInspect", observerInstance!, { groupJid: group! });
    let snapshot = groupSnapshot(raw);
    if (!snapshot) throw Error("GROUP_UNVERIFIABLE");
    let present = snapshot.participants.some((m) => individualPhone(m.jid) === job.customer_phone);
    if (present) {
      // A admissão é a chave durável; repetições não geram uma segunda boas-vindas.
      if (!c.welcomeAdmissions?.[job.admission_id])
        await welcome(c.firstWelcomeOperation ? job.admission_id : "initial", job.admission_id);
      c = await proof();
      await describeAndPin();
    }
    c = await proof();
    raw = await get("bcInspect", observerInstance!, { groupJid: group! });
    snapshot = groupSnapshot(raw);
    if (!snapshot) throw Error("GROUP_UNVERIFIABLE");
    present = snapshot.participants.some((m) => individualPhone(m.jid) === job.customer_phone);
    let invite: string | null = null;
    if (!present && job.entry_pending) {
      const r = record(await get("bcInvite", observerInstance!, { groupJid: group! }));
      if (
        typeof r.inviteUrl !== "string" ||
        !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,100}$/.test(r.inviteUrl)
      )
        throw Error("GROUP_UNVERIFIABLE");
      invite = r.inviteUrl;
    }
    await before();
    await rpc("record_care_cycle_observation", {
      p_cycle: job.id,
      p_token: token,
      p_cycle_proof: c,
      p_snapshot: snapshot,
      p_invite: invite,
    });
    const received =
      present &&
      c.firstReceived &&
      c.lastWelcomeReceived === true &&
      c.lastWelcomeAdmissionId === job.admission_id;
    await release(present && !received ? "waiting_first_receipt" : null);
    return present ? (received ? "active" : "waiting_first_receipt") : "waiting_customer";
  } catch (error) {
    onFailure?.(
      error instanceof Error && /^GROUP_[A-Z_]+$/.test(error.message)
        ? error.message
        : "GROUP_UNEXPECTED",
    );
    try {
      await release(
        error instanceof Error && error.message === "GROUP_PREPARATION_REQUIRED"
          ? "preparation_required"
          : error instanceof Error && error.message === "GROUP_CAPABILITY_REQUIRED"
            ? "review_required"
            : "operation_unknown",
      );
    } catch {
      /* A posse antiga não modifica uma revisão nova. */
    }
    return group ? "paused" : "unknown";
  }
}

/** Reaplica a mesma versão no registro privado; falha não habilita conta nem apaga revogação. */
export async function syncCareCycleRegistry(
  db: Database,
  transport: CycleTransport,
  enabled = false,
) {
  if (!enabled) return { accepted: 0, pending: 0 };
  const result = await db.rpc("care_cycle_registry_pending", {});
  if (result.error || !Array.isArray(result.data) || result.data.length > 25)
    throw Error("GROUP_REGISTRY_UNAVAILABLE");
  let accepted = 0;
  for (const row of result.data) {
    const p = row as {
      instance_name: string;
      owner_jid: string | null;
      enabled: boolean;
      source_version: number;
    };
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(p.instance_name) ||
      typeof p.enabled !== "boolean" ||
      !Number.isSafeInteger(p.source_version) ||
      (p.enabled && !/^[1-9][0-9]{7,14}@s\.whatsapp\.net$/.test(p.owner_jid ?? ""))
    )
      throw Error("GROUP_REGISTRY_INVALID");
    let ok = false;
    try {
      const reply = record(
        await transport(`/group/bcAuthorizePlatform/${encodeURIComponent(p.instance_name)}`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            enabled: p.enabled,
            sourceVersion: p.source_version,
            ...(p.owner_jid ? { ownerJid: p.owner_jid } : {}),
          }),
        }),
      );
      ok =
        reply.enabled === p.enabled &&
        (reply.sourceVersion === p.source_version || (!p.enabled && reply.sourceVersion == null));
    } catch {
      /* Conta offline pode ser revogada; habilitação exige telefone vivo comprovado. */
    }
    const ack = await db.rpc("care_cycle_registry_ack", {
      p_instance: p.instance_name,
      p_version: p.source_version,
      p_ok: ok,
    });
    if (ack.error) throw Error("GROUP_REGISTRY_UNAVAILABLE");
    if (ok) accepted++;
  }
  return { accepted, pending: result.data.length - accepted };
}
