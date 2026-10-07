import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTimeline,
  countGroups,
  dayOffset,
  freeGaps,
  groupOf,
  mergeIntervals,
  minutesUntil,
  momentOf,
  moneyOf,
  nextUp,
  weekKeys,
  weekdayOf,
} from "./model.ts";

const at = (hour: number, minute = 0) => Date.UTC(2030, 0, 15, hour, minute);
const iso = (hour: number, minute = 0) => new Date(at(hour, minute)).toISOString();
const row = (id: string, start: number, end: number, status: string) => ({
  id,
  starts_at: iso(start),
  ends_at: iso(end),
  status,
});

test("momentOf follows the clock for open appointments", () => {
  const appointment = row("a", 10, 11, "confirmed");
  assert.equal(momentOf(appointment, at(9)), "upcoming");
  assert.equal(momentOf(appointment, at(10)), "inProgress");
  assert.equal(momentOf(appointment, at(10, 59)), "inProgress");
  assert.equal(momentOf(appointment, at(11)), "unresolved");
  assert.equal(momentOf(row("b", 10, 11, "pending"), at(12)), "unresolved");
  assert.equal(momentOf(row("c", 10, 11, "completed"), at(9)), "completed");
  assert.equal(momentOf(row("d", 10, 11, "cancelled"), at(12)), "cancelled");
  assert.equal(momentOf(row("e", 10, 11, "reschedule_requested"), at(12)), "reschedule");
});

test("groupOf puts each appointment in exactly one group and counts add up", () => {
  const rows = [
    row("a", 9, 10, "completed"),
    row("b", 9, 10, "confirmed"),
    row("c", 11, 12, "confirmed"),
    row("d", 11, 12, "pending"),
    row("e", 13, 14, "reschedule_requested"),
    row("f", 13, 14, "cancelled"),
  ];
  const now = at(10, 30);
  assert.equal(groupOf(rows[1], now), "unresolved");
  assert.equal(groupOf(rows[2], now), "confirmed");
  assert.equal(groupOf(rows[3], now), "pending");
  const counts = countGroups(rows, now);
  assert.deepEqual(counts, {
    completed: 1,
    unresolved: 1,
    confirmed: 1,
    pending: 1,
    reschedule_requested: 1,
    cancelled: 1,
  });
  assert.equal(
    Object.values(counts).reduce((sum, value) => sum + value, 0),
    rows.length,
  );
});

test("nextUp ignores what already started, completed or cancelled rows", () => {
  const rows = [
    row("a", 9, 10, "confirmed"),
    row("b", 12, 13, "cancelled"),
    row("c", 14, 15, "pending"),
    row("d", 11, 12, "completed"),
    row("e", 13, 14, "confirmed"),
  ];
  assert.equal(nextUp(rows, at(9, 30))?.id, "e");
  assert.equal(nextUp(rows, at(15)), null);
  assert.equal(minutesUntil(iso(10), at(9, 35)), 25);
  assert.equal(minutesUntil(iso(9), at(9, 35)), 0);
});

test("dayOffset and weekKeys work on calendar dates", () => {
  assert.equal(dayOffset("2026-10-06", "2026-10-05"), 1);
  assert.equal(dayOffset("2026-10-04", "2026-10-05"), -1);
  assert.equal(dayOffset("2026-11-01", "2026-10-05"), 27);
  // 05/10/2026 é segunda-feira.
  assert.equal(weekdayOf("2026-10-05"), 1);
  assert.deepEqual(weekKeys("2026-10-05", 0), [
    "2026-10-04",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
  ]);
  assert.equal(weekKeys("2026-10-04", 1)[0], "2026-09-28");
  assert.equal(weekKeys("2026-10-04", 1)[6], "2026-10-04");
});

test("freeGaps subtracts busy time and drops slivers", () => {
  const busy: Array<[number, number]> = [
    [at(9), at(10)],
    [at(9, 30), at(10, 30)],
    [at(12), at(13)],
    [at(13), at(13, 10)],
  ];
  assert.deepEqual(mergeIntervals(busy), [
    [at(9), at(10, 30)],
    [at(12), at(13, 10)],
  ]);
  assert.deepEqual(freeGaps(busy, at(9), at(14), 30), [
    [at(10, 30), at(12)],
    [at(13, 10), at(14)],
  ]);
  // Sobra de 20 min não aparece com mínimo de 30.
  assert.deepEqual(freeGaps([[at(9), at(13, 40)]], at(9), at(14), 30), []);
  assert.deepEqual(freeGaps([], at(9), at(10), 30), [[at(9), at(10)]]);
  assert.deepEqual(freeGaps([], at(10), at(9), 30), []);
});

test("buildTimeline orders entries and places the now marker between them", () => {
  const appointments = [row("b", 11, 12, "confirmed"), row("a", 9, 10, "completed")];
  const timeline = buildTimeline(appointments, [], [[at(10), at(11)]], at(10, 15));
  assert.deepEqual(
    timeline.map((entry) => entry.key),
    ["a", `gap-${at(10)}`, "now", "b"],
  );
  // Sem "agora" (outro dia) ou antes de tudo, não há marcador.
  assert.equal(
    buildTimeline(appointments, [], [], null).some((entry) => entry.kind === "now"),
    false,
  );
  assert.equal(
    buildTimeline(appointments, [], [], at(8)).some((entry) => entry.kind === "now"),
    false,
  );
});

test("moneyOf separates done and expected values", () => {
  const rows = [
    row("a", 9, 10, "completed"),
    row("b", 10, 11, "confirmed"),
    row("c", 11, 12, "pending"),
    row("d", 12, 13, "cancelled"),
    row("e", 13, 14, "reschedule_requested"),
  ];
  assert.deepEqual(
    moneyOf(rows, () => 1000),
    { done: 1000, expected: 2000 },
  );
});
