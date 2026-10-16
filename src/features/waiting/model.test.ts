import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoState, demoReducer } from "../demo/model.ts";
import { canHold, blocksSlot, mayOpenStarts, waitOpportunities, type SlotWait } from "./model.ts";
import { termsFor, type ServiceTerms } from "../../lib/shop/appointments.ts";
import { waitingDemoAction } from "./demo.ts";

function fixture() {
  const state = createDemoState(new Date("2026-09-17T12:00:00Z"));
  state.settings.waiting_enabled = true;
  const a = state.appointments.find(
    (a) =>
      a.customer_id !== state.customerId &&
      a.status === "confirmed" &&
      Date.parse(a.starts_at) > +state.now + 3600000,
  )!;
  return {
    state: demoReducer(state, { type: "status", id: a.id, status: "reschedule_requested" }),
    a,
  };
}
test("waiting requires the complete 15-minute cycle before the cutoff, including exact boundary", () => {
  const start = "2026-09-17T18:00:00Z";
  assert.equal(canHold(start, new Date("2026-09-17T17:15:00Z"), true, 30), true);
  assert.equal(canHold(start, new Date("2026-09-17T17:15:00.001Z"), true, 30), false);
  assert.equal(canHold(start, new Date("2026-09-17T17:30:00Z"), true, 30), false);
  assert.equal(canHold(start, new Date("2026-09-17T17:00:00Z"), false, 30), false);
  for (const cutoff of [-1, 1.5, 1441, NaN])
    assert.equal(canHold(start, new Date("2026-09-17T10:00:00Z"), true, cutoff), false);
});
test("waiting is off by default and a withdrawal then immediately releases", () => {
  const state = createDemoState();
  assert.equal(state.settings.waiting_enabled, false);
  const next = demoReducer(state, {
    type: "status",
    id: state.appointments[0].id,
    status: "reschedule_requested",
  });
  assert.equal(next.waits.length, 0);
});
test("only one customer joins; release grants five minutes and confirmation awards no points", () => {
  const scenario = fixture();
  const a = scenario.a;
  let state = scenario.state;
  const id = state.waits[0].id;
  state = waitingDemoAction(state, id, "join", state.services[0].id);
  assert.throws(() => waitingDemoAction(state, id, "join", state.services[0].id));
  assert.throws(() => waitingDemoAction(state, id, "claim"));
  state = demoReducer(state, { type: "clock.advance", milliseconds: 600000 });
  assert.equal(state.waits[0].state, "exclusive");
  assert.equal(Date.parse(state.waits[0].claim_until) - +state.now, 300000);
  assert.equal(state.waitingEvents.filter((e) => e.kind === "exclusive").length, 1);
  const points = state.points;
  state = waitingDemoAction(state, id, "claim");
  assert.equal(state.points, points);
  assert.equal(state.appointments.at(-1)?.status, "confirmed");
  assert.notEqual(state.appointments.at(-1)?.id, a.id);
  assert.equal(state.appointments.find((row) => row.id === a.id)?.status, "reschedule_requested");
  assert.throws(() => waitingDemoAction(state, id, "claim"));
});
test("empty retention releases at ten minutes; unclaimed exclusivity releases at fifteen", () => {
  let { state } = fixture();
  const expired = demoReducer(state, { type: "clock.advance", milliseconds: 600000 });
  assert.equal(expired.waits[0].state, "released");
  state = waitingDemoAction(state, state.waits[0].id, "join", state.services[0].id);
  state = demoReducer(state, { type: "clock.advance", milliseconds: 900000 });
  assert.equal(blocksSlot(state.waits[0], state.now), false);
  assert.throws(() => waitingDemoAction(state, state.waits[0].id, "claim"));
});
test("restoring cancels interest and notifies; original cancellation preserves hold but prevents restore", () => {
  const scenario = fixture();
  const a = scenario.a;
  let state = scenario.state;
  const id = state.waits[0].id;
  state = waitingDemoAction(state, id, "join", state.services[0].id);
  const restored = waitingDemoAction(state, id, "restore");
  assert.equal(restored.appointments.find((row) => row.id === a.id)?.status, "confirmed");
  assert.equal(restored.waitingEvents.at(-1)?.kind, "restored");
  state = demoReducer(state, { type: "cancel", id: a.id, reason: null, source: "customer" });
  assert.equal(blocksSlot(state.waits[0], state.now), true);
  assert.throws(() => waitingDemoAction(state, id, "restore"));
});
test("leaving holding reopens interest; leaving exclusivity releases to public", () => {
  let { state } = fixture();
  const id = state.waits[0].id;
  state = waitingDemoAction(state, id, "join", state.services[0].id);
  state = waitingDemoAction(state, id, "leave");
  assert.equal(state.waits[0].has_interest, false);
  state = waitingDemoAction(state, id, "join", state.services[0].id);
  state = demoReducer(state, { type: "clock.advance", milliseconds: 600000 });
  state = waitingDemoAction(state, id, "leave");
  assert.equal(state.waits[0].state, "released");
});
test("disable immediately releases both stages; cutoff changes preserve promised deadlines", () => {
  for (const elapsed of [0, 600000]) {
    let { state } = fixture();
    state = waitingDemoAction(state, state.waits[0].id, "join", state.services[0].id);
    state = demoReducer(state, { type: "clock.advance", milliseconds: elapsed });
    const deadline = state.waits[0].claim_until;
    state = demoReducer(state, {
      type: "settings.save",
      settings: { ...state.settings, waiting_cutoff_minutes: 120 },
    });
    assert.equal(state.waits[0].claim_until, deadline);
    state = demoReducer(state, {
      type: "settings.save",
      settings: { ...state.settings, waiting_enabled: false },
    });
    assert.equal(state.waits[0].state, "disabled");
    assert.equal(state.waitingEvents.at(-1)?.kind, "disabled");
  }
});
test("disabling preserves an already claimed appointment and direct demo booking cannot steal a hold", () => {
  const scenario = fixture();
  const a = scenario.a;
  let state = scenario.state;
  const total = state.appointments.length;
  state = demoReducer(state, {
    type: "book",
    appointment: { ...a, id: "competing", customer_id: state.customerId },
  });
  assert.equal(state.appointments.length, total);
  state = waitingDemoAction(state, state.waits[0].id, "join", state.services[0].id);
  state = demoReducer(state, { type: "clock.advance", milliseconds: 600000 });
  state = waitingDemoAction(state, state.waits[0].id, "claim");
  const claimed = state.appointments.at(-1)!;
  state = demoReducer(state, {
    type: "settings.save",
    settings: { ...state.settings, waiting_enabled: false },
  });
  assert.equal(state.appointments.find((row) => row.id === claimed.id)?.status, "confirmed");
});
test("'qualquer profissional' vê as vagas de todos, cada uma pela duração do próprio profissional", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  const wait = (id: string, staff_id: string, minutes: number, extra: Partial<SlotWait> = {}) => ({
    id,
    appointment_id: null,
    staff_id,
    starts_at: "2026-09-17T15:00:00Z",
    ends_at: new Date(Date.parse("2026-09-17T15:00:00Z") + minutes * 60000).toISOString(),
    hold_until: "2026-09-17T12:10:00Z",
    claim_until: "2026-09-17T12:15:00Z",
    state: "holding" as const,
    mine: false,
    has_interest: false,
    service_id: null,
    restorable: false,
    ...extra,
  });
  const waits: SlotWait[] = [
    wait("ana-30", "ana", 30),
    wait("bia-30", "bia", 30),
    wait("caio-60", "caio", 60),
    wait("ana-ocupada", "ana", 60, { has_interest: true }),
    wait("ana-vencida", "ana", 60, { hold_until: "2026-09-17T11:59:00Z" }),
    wait("ana-amanha", "ana", 60, {
      starts_at: "2026-09-18T15:00:00Z",
      ends_at: "2026-09-18T16:00:00Z",
    }),
  ];
  // Ana faz o corte em 30 min, Bia em 45 min, Caio não faz o serviço.
  const durationFor = (staffId: string) => ({ ana: 30, bia: 45 })[staffId] ?? null;
  const base = { durationFor, day: "2026-09-17", timeZone: "UTC", now };
  const ids = (staffId: string | null) =>
    waitOpportunities(waits, { ...base, staffId }).map((w) => w.id);
  assert.deepEqual(ids(null), ["ana-30"]);
  assert.deepEqual(ids("ana"), ["ana-30"]);
  assert.deepEqual(ids("bia"), []);
  assert.deepEqual(ids("caio"), []);
  const longer = waitOpportunities([...waits, wait("bia-45", "bia", 45)], {
    ...base,
    staffId: null,
  });
  assert.deepEqual(
    longer.map((w) => [w.id, w.staff_id]),
    [
      ["ana-30", "ana"],
      ["bia-45", "bia"],
    ],
  );
});

// P-31: uma conta só (waitOpportunities + mayOpenStarts).
const p31Now = new Date("2026-10-15T15:00:00Z"); // 12:00 em Brasília
const p31Tz = "America/Sao_Paulo";
function p31Wait(
  id: string,
  staff_id: string,
  startsAt: string,
  minutes: number,
  extra: Partial<SlotWait> = {},
): SlotWait {
  return {
    id,
    appointment_id: `apt-${id}`,
    staff_id,
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + minutes * 60000).toISOString(),
    hold_until: "2026-10-15T15:08:00Z",
    claim_until: "2026-10-15T15:13:00Z",
    state: "holding",
    mine: false,
    has_interest: false,
    service_id: null,
    restorable: false,
    ...extra,
  };
}
const p31Cut = { id: "corte", duration_minutes: 30, price_cents: 4500 };
const p31Pick = (waits: SlotWait[], terms: ServiceTerms[] | null, staffId: string | null) =>
  waitOpportunities(waits, {
    staffId,
    durationFor: (id) => termsFor(terms, id, p31Cut)?.duration_minutes ?? null,
    day: "2026-10-15",
    timeZone: p31Tz,
    now: p31Now,
  }).map((w) => w.id);

test("P-31: com serviços por profissional, cada vaga usa a duração dele; quem não faz não aparece", () => {
  // Como get_booking_terms devolve: Ana 30 min, Bia 45 min, Caio sem linha (não faz o corte).
  const terms: ServiceTerms[] = [
    { staff_id: "ana", service_id: "corte", duration_minutes: 30, price_cents: 4500 },
    { staff_id: "bia", service_id: "corte", duration_minutes: 45, price_cents: 5000 },
  ];
  const waits = [
    p31Wait("bia-16h", "bia", "2026-10-15T19:00:00Z", 45), // 45 em 45: cabe no limite
    p31Wait("ana-14h", "ana", "2026-10-15T17:00:00Z", 30),
    p31Wait("bia-14h", "bia", "2026-10-15T17:00:00Z", 30), // Bia leva 45: não cabe
    p31Wait("caio-14h", "caio", "2026-10-15T17:00:00Z", 60), // não faz o serviço
  ];
  assert.deepEqual(p31Pick(waits, terms, null), ["ana-14h", "bia-16h"]);
  assert.deepEqual(p31Pick(waits, terms, "ana"), ["ana-14h"]);
  assert.deepEqual(p31Pick(waits, terms, "bia"), ["bia-16h"]);
  assert.deepEqual(p31Pick(waits, terms, "caio"), []);
  // Um minuto a menos que a duração dela já não cabe.
  assert.deepEqual(
    p31Pick([p31Wait("bia-44", "bia", "2026-10-15T19:00:00Z", 44)], terms, null),
    [],
  );
});

test("P-31: sem duração por profissional, todos usam a do catálogo (lista do banco ou demonstração)", () => {
  // Loja sem staff_services: o banco devolve todos com os valores do catálogo.
  const catalog: ServiceTerms[] = ["ana", "bia", "caio"].map((staff_id) => ({
    staff_id,
    service_id: "corte",
    duration_minutes: 30,
    price_cents: 4500,
  }));
  const waits = [
    p31Wait("caio-14h", "caio", "2026-10-15T17:00:00Z", 30),
    p31Wait("ana-14h", "ana", "2026-10-15T17:00:00Z", 30),
    p31Wait("bia-15h", "bia", "2026-10-15T18:00:00Z", 20), // 20 min não cabe um corte de 30
  ];
  assert.deepEqual(p31Pick(waits, catalog, null), ["ana-14h", "caio-14h"]);
  // Sem lista (demonstração: ArenaApp chama setServiceTerms(null)): o mesmo resultado.
  assert.deepEqual(p31Pick(waits, null, null), ["ana-14h", "caio-14h"]);
});

test("P-31: vagas de dois profissionais no mesmo horário: as duas em ordem, um selo só na grade", () => {
  const waits = [
    p31Wait("bia-17h", "bia", "2026-10-15T20:00:00Z", 30),
    p31Wait("bia-14h", "bia", "2026-10-15T17:00:00Z", 30),
    p31Wait("ana-14h", "ana", "2026-10-15T17:00:00Z", 30),
  ];
  const list = waitOpportunities(waits, {
    staffId: null,
    durationFor: () => 30,
    day: "2026-10-15",
    timeZone: p31Tz,
    now: p31Now,
  });
  assert.deepEqual(
    list.map((w) => w.id),
    ["ana-14h", "bia-14h", "bia-17h"],
  );
  assert.deepEqual(mayOpenStarts(list), [
    { iso: "2026-10-15T17:00:00.000Z", waitId: "ana-14h" },
    { iso: "2026-10-15T20:00:00.000Z", waitId: "bia-17h" },
  ]);
  // Formato do banco (+00:00) e o do app (Z) caem no mesmo selo.
  assert.equal(
    mayOpenStarts([
      p31Wait("a", "ana", "2026-10-15T17:00:00+00:00", 30),
      p31Wait("b", "bia", "2026-10-15T17:00:00.000Z", 30),
    ]).length,
    1,
  );
});

test("P-31: o dia da vaga é o do fuso da loja", () => {
  // 22:30 de 15/10 em Brasília = 01:30Z de 16/10; em Lisboa (UTC+1 em outubro) já é 16/10.
  const late = [p31Wait("ana-2230", "ana", "2026-10-16T01:30:00Z", 30)];
  const base = { staffId: null, durationFor: () => 30, now: p31Now };
  assert.equal(waitOpportunities(late, { ...base, day: "2026-10-15", timeZone: p31Tz }).length, 1);
  assert.equal(waitOpportunities(late, { ...base, day: "2026-10-16", timeZone: p31Tz }).length, 0);
  assert.equal(
    waitOpportunities(late, { ...base, day: "2026-10-16", timeZone: "Europe/Lisbon" }).length,
    1,
  );
});

test("P-31: guarda que termina agora, vaga com interessado ou já minha não é oferecida", () => {
  const waits = [
    p31Wait("fim-agora", "ana", "2026-10-15T17:00:00Z", 30, { hold_until: p31Now.toISOString() }),
    p31Wait("com-interesse", "bia", "2026-10-15T17:00:00Z", 30, { has_interest: true }),
    p31Wait("minha", "caio", "2026-10-15T17:00:00Z", 30, { has_interest: true, mine: true }),
  ];
  assert.deepEqual(p31Pick(waits, null, null), []);
});
