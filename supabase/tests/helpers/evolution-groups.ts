import { creationHash } from "../../functions/_shared/evolution-groups.ts";

/** Provedor inteiramente fictício. Não contém fetch nem endereço de serviço real. */
export function fakeEvolution() {
  const groupId = "12345-6789@g.us";
  const state = {
    group: {
      id: groupId,
      restrict: false,
      memberAddMode: true,
      joinApprovalMode: false,
      participants: [{ id: "5511888888888@s.whatsapp.net", admin: "admin" as string | null }],
    },
    requests: [] as string[],
    records: new Map<string, unknown>(),
    calls: [] as { route: string; method: string; body: Record<string, unknown> }[],
    creates: 0,
    lostCreateResponse: false,
    removalFails: false,
    admissionFails: false,
    contract: "bc-groups-v1",
    before: async (_route: string) => {},
  };
  const transport = async (path: string, init: RequestInit = {}) => {
    const url = new URL(path, "https://example.invalid"),
      route = url.pathname.split("/")[2];
    const body = init.body ? JSON.parse(String(init.body)) : Object.fromEntries(url.searchParams);
    state.calls.push({ route, method: init.method ?? "GET", body });
    await state.before(route);
    if (route === "bcCapabilities")
      return {
        contract: state.contract,
        memberAddControl: true,
        admissionControl: true,
        persistentOperations: true,
      };
    if (route === "bcCreate") {
      if (!state.records.has(body.operationId)) {
        state.creates++;
        state.records.set(body.operationId, {
          operationKey: body.operationId,
          requestHash: await creationHash(body.subject),
          state: "created",
          groupJid: groupId,
        });
      }
      if (state.lostCreateResponse) throw new Error("Timeout fictício depois da criação");
      return state.records.get(body.operationId);
    }
    if (route === "bcCreateStatus") return state.records.get(body.operationId);
    if (body.groupJid !== groupId) throw new Error("Outro grupo");
    if (route === "bcInspect") return structuredClone(state.group);
    if (route === "updateSetting") state.group.restrict = body.action === "locked";
    else if (route === "updateMemberAddMode") state.group.memberAddMode = body.mode !== "admin_add";
    else if (route === "updateJoinApprovalMode") state.group.joinApprovalMode = body.mode === "on";
    else if (route === "joinRequests") {
      if (init.method !== "POST") return state.requests.map((jid) => ({ jid }));
      const jid = body.participants[0];
      state.requests = state.requests.filter((v) => v !== jid);
      if (body.action === "approve" && !state.admissionFails)
        state.group.participants.push({ id: jid, admin: null });
    } else if (route === "updateParticipant") {
      const jid = body.participants[0];
      if (body.action === "add" && !state.admissionFails)
        state.group.participants.push({ id: jid, admin: null });
      else if (body.action === "remove" && !state.removalFails)
        state.group.participants = state.group.participants.filter((p) => p.id !== jid);
    } else if (route === "inviteCode")
      return { inviteUrl: "https://chat.whatsapp.com/FICTICIO123456789" };
    else if (route === "revokeInviteCode") return { revoked: true };
    else throw new Error("Rota não simulada: " + route);
    return {};
  };
  return { state, transport, groupId };
}
