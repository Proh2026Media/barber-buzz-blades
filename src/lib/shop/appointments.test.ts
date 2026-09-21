import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBookingDays,
  buildBookingDateKeys,
  buildDaySlots,
  buildSlotsForWindow,
  dateFromLocalKey,
  localDateKey,
  shopDateKey,
  shopDateTime,
  shopDayRange,
} from "./appointments.ts";

const day = new Date(2030, 0, 15);
const at = (hour: number, minute = 0) => new Date(2030, 0, 15, hour, minute);
const busy = (startHour: number, startMinute: number, endHour: number, endMinute: number) => ({
  starts_at: at(startHour, startMinute).toISOString(),
  ends_at: at(endHour, endMinute).toISOString(),
});

test("removes past slots and a slot starting exactly now", () => {
  const slots = buildDaySlots(day, 30, [], at(10));
  assert.equal(slots[0].getTime(), at(10, 30).getTime());
  assert.ok(slots.every((slot) => slot > at(10)));
});

test("respects partial overlaps, allowing adjacent appointments", () => {
  const slots = buildDaySlots(day, 30, [busy(10, 15, 11, 0)], at(8));
  const times = slots.map((slot) => slot.getTime());
  assert.ok(times.includes(at(9, 30).getTime()));
  assert.ok(!times.includes(at(10).getTime()));
  assert.ok(!times.includes(at(10, 30).getTime()));
  assert.ok(times.includes(at(11).getTime()));
});

test("includes bookings crossing the start of the day", () => {
  const slots = buildDaySlots(
    day,
    30,
    [{ starts_at: new Date(2030, 0, 14, 23).toISOString(), ends_at: at(9, 30).toISOString() }],
    at(8),
  );
  assert.equal(slots[0].getTime(), at(9, 30).getTime());
});

test("never offers a service that would finish after closing", () => {
  const slots = buildDaySlots(day, 45, [], at(8));
  assert.equal(slots.at(-1)?.getTime(), at(18).getTime());
  assert.ok(slots.every((slot) => slot.getTime() + 45 * 60_000 <= at(19).getTime()));
});

test("has no availability after closing or on a past day", () => {
  assert.deepEqual(buildDaySlots(day, 30, [], at(19)), []);
  assert.deepEqual(buildDaySlots(day, 30, [], new Date(2030, 0, 16)), []);
});

test("invalid duration cannot produce slots or an infinite loop", () => {
  for (const duration of [0, -1, 0.5, NaN, Infinity]) {
    assert.deepEqual(buildDaySlots(day, duration, [], at(8)), []);
  }
});

test("builds fourteen consecutive local calendar days", () => {
  const days = buildBookingDays(new Date(2030, 0, 30, 22), 14);
  assert.equal(days.length, 14);
  assert.equal(localDateKey(days[0]), "2030-01-30");
  assert.equal(localDateKey(days[13]), "2030-02-12");
  assert.ok(days.every((value) => value.getHours() === 0));
});

test("local date keys round-trip without UTC date shifts", () => {
  for (const value of ["2030-01-01", "2030-02-28", "2030-12-31"]) {
    assert.equal(localDateKey(dateFromLocalKey(value)), value);
  }
});

test("uses the configured opening and closing times", () => {
  const slots = buildSlotsForWindow(
    day,
    30,
    [],
    { is_open: true, opens_at: "10:30:00", closes_at: "13:00:00" },
    at(8),
  );
  assert.equal(slots[0].getTime(), at(10, 30).getTime());
  assert.equal(slots.at(-1)?.getTime(), at(12, 30).getTime());
});

test("closed days have no slots", () => {
  assert.deepEqual(
    buildSlotsForWindow(
      day,
      30,
      [],
      { is_open: false, opens_at: "09:00", closes_at: "19:00" },
      at(8),
    ),
    [],
  );
});

test("shop and staff blocks remove overlapping slots", () => {
  const slots = buildSlotsForWindow(
    day,
    30,
    [busy(11, 0, 12, 0)],
    { is_open: true, opens_at: "10:00", closes_at: "13:00" },
    at(8),
  );
  assert.deepEqual(
    slots.map((slot) => slot.getHours() * 60 + slot.getMinutes()),
    [600, 630, 720, 750],
  );
});

test("derives calendar days from the shop timezone", () => {
  const instant = new Date("2030-01-15T02:30:00Z");
  assert.equal(shopDateKey(instant, "America/Sao_Paulo"), "2030-01-14");
  assert.equal(shopDateKey(instant, "Asia/Tokyo"), "2030-01-15");
  assert.deepEqual(buildBookingDateKeys(instant, 3, "America/Sao_Paulo"), [
    "2030-01-14",
    "2030-01-15",
    "2030-01-16",
  ]);
});

test("builds query boundaries and slots from the shop wall clock", () => {
  const range = shopDayRange("2030-01-15", "America/Sao_Paulo");
  assert.equal(range.start.toISOString(), "2030-01-15T03:00:00.000Z");
  assert.equal(range.end.toISOString(), "2030-01-16T02:59:59.999Z");
  assert.equal(
    shopDateTime("2030-01-15", "09:30", "America/Sao_Paulo").toISOString(),
    "2030-01-15T12:30:00.000Z",
  );
  const slots = buildSlotsForWindow(
    "2030-01-15",
    30,
    [],
    { is_open: true, opens_at: "09:00", closes_at: "10:00" },
    new Date("2030-01-15T00:00:00Z"),
    "America/Sao_Paulo",
  );
  assert.deepEqual(
    slots.map((slot) => slot.toISOString()),
    ["2030-01-15T12:00:00.000Z", "2030-01-15T12:30:00.000Z"],
  );
});

test("offered hours follow the shop timezone instead of the device clock", () => {
  const window = { is_open: true, opens_at: "09:00", closes_at: "11:00" };
  const before = new Date("2030-01-14T00:00:00Z");
  const saoPaulo = buildSlotsForWindow("2030-01-15", 60, [], window, before, "America/Sao_Paulo");
  const tokyo = buildSlotsForWindow("2030-01-15", 60, [], window, before, "Asia/Tokyo");

  // 09:00 em São Paulo (UTC-3) e 09:00 em Tóquio (UTC+9) são instantes distintos:
  // a mesma loja abre às 09:00 da parede dela, não do aparelho de quem reserva.
  assert.equal(saoPaulo[0]!.toISOString(), "2030-01-15T12:00:00.000Z");
  assert.equal(tokyo[0]!.toISOString(), "2030-01-15T00:00:00.000Z");
  assert.equal(
    saoPaulo[0]!.toISOString(),
    shopDateTime("2030-01-15", "09:00", "America/Sao_Paulo").toISOString(),
  );
});
