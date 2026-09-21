import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelay, validateOccurrence } from "./occurrences.ts";
import { createDemoState, demoReducer } from "../demo/model.ts";
const row = {
  starts_at: "2026-09-16T10:00:00Z",
  ends_at: "2026-09-16T11:00:00Z",
  status: "confirmed",
};
const now = new Date("2026-09-16T12:00:00Z");
test("demo saves, edits and removes delays without changing legacy facts or points", () => {
  const initial = createDemoState();
  const appointment = initial.appointments[0];
  initial.appointments = [{ ...appointment, ...row, status: "completed" }];
  initial.now = now;
  initial.attendance[appointment.id] = { arrived_at: row.starts_at };
  const saved = demoReducer(initial, {
    type: "occurrence",
    id: appointment.id,
    customer: 5,
    shop: 12,
    noShow: false,
  });
  assert.equal(saved.attendance[appointment.id].shop_delay_minutes, 12);
  assert.equal(saved.attendance[appointment.id].arrived_at, row.starts_at);
  const cleared = demoReducer(saved, {
    type: "occurrence",
    id: appointment.id,
    customer: null,
    shop: null,
    noShow: false,
  });
  assert.equal(cleared.attendance[appointment.id].customer_delay_minutes, null);
  assert.equal(cleared.points, initial.points);
});
test("demo no show closes booking without awarding points", () => {
  const state = createDemoState();
  const appointment = state.appointments[0];
  state.appointments = [{ ...appointment, ...row, status: "confirmed" }];
  state.now = now;
  state.attendance = {};
  const result = demoReducer(state, {
    type: "occurrence",
    id: appointment.id,
    customer: null,
    shop: null,
    noShow: true,
  });
  assert.equal(result.appointments[0].status, "cancelled");
  assert.equal(result.points, state.points);
  const completed = demoReducer(result, {
    type: "status",
    id: appointment.id,
    status: "completed",
  });
  assert.equal(completed.appointments[0].status, "cancelled");
  assert.equal(completed.points, state.points);
});
test("empty delays stay unknown and only bounded integers are accepted", () => {
  assert.equal(parseDelay(" "), null);
  assert.equal(parseDelay("1440"), 1440);
  for (const value of ["0", "-1", "1.5", "1441", "abc"]) assert.throws(() => parseDelay(value));
});
test("delays are optional, editable, removable and allowed after completion", () => {
  for (const status of ["pending", "confirmed", "completed"])
    assert.doesNotThrow(() =>
      validateOccurrence({ ...row, status }, { customer_delay_minutes: 5 }, null, 10, false, now),
    );
  assert.doesNotThrow(() => validateOccurrence(row, {}, null, null, false, now));
  assert.throws(() =>
    validateOccurrence(row, {}, 5, null, false, new Date("2026-09-16T09:00:00Z")),
  );
  assert.throws(() => validateOccurrence({ ...row, status: "cancelled" }, {}, 5, null, false, now));
});
test("no show requires end time, active booking and no delay or legacy presence", () => {
  assert.doesNotThrow(() => validateOccurrence(row, {}, null, null, true, now));
  for (const facts of [
    { customer_delay_minutes: 5 },
    { shop_delay_minutes: 5 },
    { arrived_at: row.starts_at },
    { started_at: row.starts_at },
    { no_show_at: row.ends_at },
  ])
    assert.throws(() => validateOccurrence(row, facts, null, null, true, now));
  assert.throws(() => validateOccurrence(row, {}, 5, null, true, now));
  assert.throws(() =>
    validateOccurrence(row, {}, null, null, true, new Date("2026-09-16T10:30:00Z")),
  );
  assert.throws(() =>
    validateOccurrence({ ...row, status: "completed" }, {}, null, null, true, now),
  );
});
