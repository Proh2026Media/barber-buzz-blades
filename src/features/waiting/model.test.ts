import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoState, demoReducer } from "../demo/model.ts";
import { canHold, blocksSlot } from "./model.ts";
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
