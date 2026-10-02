import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBookingDays,
  buildBookingDateKeys,
  buildDaySlots,
  buildSlotsForWindow,
  dateFromLocalKey,
  localDateKey,
  minutesLabel,
  previewSlotMinutes,
  shopDateKey,
  shopDateTime,
  shopDayRange,
  slotRuleFromSettings,
  termsFor,
  type SlotRule,
} from "./appointments.ts";

const day = new Date(2030, 0, 15);
const at = (hour: number, minute = 0) => new Date(2030, 0, 15, hour, minute);
const busy = (startHour: number, startMinute: number, endHour: number, endMinute: number) => ({
  starts_at: at(startHour, startMinute).toISOString(),
  ends_at: at(endHour, endMinute).toISOString(),
});

test("removes past slots and a slot starting exactly now", () => {
  const slots = buildDaySlots(day, 30, [], at(10));
  assert.equal(slots[0].getTime(), at(10, 15).getTime());
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
  assert.equal(slots.at(-1)?.getTime(), at(18, 15).getTime());
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
    [600, 615, 630, 720, 735, 750],
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
    ["2030-01-15T12:00:00.000Z", "2030-01-15T12:15:00.000Z", "2030-01-15T12:30:00.000Z"],
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

test("offers every 15-minute start that fits, instead of hiding free time", () => {
  // Antes, a grade andava no tamanho do serviço: 45 min depois de 09:00–09:30 só voltava às 09:45.
  const slots = buildDaySlots(day, 45, [busy(9, 0, 9, 30)], at(8));
  assert.equal(slots[0].getTime(), at(9, 30).getTime());
  assert.ok(slots.every((slot) => slot.getMinutes() % 15 === 0));
});

test("matches the database rule (cenário de supabase/tests/booking_rules_single_source.sql)", () => {
  // Corte de 30 min, 09:00–19:00, atendimento 13:00–13:30, bloqueio 10:00–11:00 e espera 15:00–15:30.
  const slots = buildSlotsForWindow(
    day,
    30,
    [busy(13, 0, 13, 30), busy(10, 0, 11, 0), busy(15, 0, 15, 30)],
    { is_open: true, opens_at: "09:00", closes_at: "19:00" },
    at(8),
  );
  const labels = slots.map(
    (slot) =>
      `${String(slot.getHours()).padStart(2, "0")}:${String(slot.getMinutes()).padStart(2, "0")}`,
  );
  for (const shown of ["09:00", "09:15", "09:30", "11:00", "12:30", "13:30", "15:30", "18:30"]) {
    assert.ok(labels.includes(shown), shown);
  }
  for (const hidden of [
    "09:45",
    "10:00",
    "10:30",
    "12:45",
    "13:00",
    "13:15",
    "14:45",
    "15:00",
    "18:45",
  ]) {
    assert.ok(!labels.includes(hidden), hidden);
  }
});

describeModes();

function describeModes() {
  // Mesmo cenário de supabase/tests/slot_offer_mode.sql: 09:00–19:00, Corte 09:00–09:30
  // e almoço da loja 12:30–13:15.
  const hours = { is_open: true, opens_at: "09:00", closes_at: "19:00" };
  const lunch = [busy(12, 30, 13, 15)];
  const label = (slots: Date[]) =>
    slots.map(
      (slot) =>
        `${String(slot.getHours()).padStart(2, "0")}:${String(slot.getMinutes()).padStart(2, "0")}`,
    );
  const slotsFor = (duration: number, rule: SlotRule) =>
    label(buildSlotsForWindow(day, duration, [busy(9, 0, 9, 30)], hours, at(8), undefined, rule));

  test("flexible mode: Combo right after the Corte and again when lunch ends", () => {
    const slots = slotsFor(60, { mode: "flexible", stepMinutes: 15, blocks: lunch });
    assert.equal(slots[0], "09:30");
    for (const shown of ["09:45", "11:30", "13:15", "13:30", "18:00"])
      assert.ok(slots.includes(shown));
    for (const hidden of ["09:00", "11:45", "12:00", "12:15", "18:15"])
      assert.ok(!slots.includes(hidden), hidden);
  });

  test("literal mode: steps of the service length, restarting after lunch", () => {
    assert.deepEqual(slotsFor(60, { mode: "literal", stepMinutes: 15, blocks: lunch }), [
      "10:00",
      "11:00",
      "13:15",
      "14:15",
      "15:15",
      "16:15",
      "17:15",
    ]);
    const corte = slotsFor(30, { mode: "literal", stepMinutes: 15, blocks: lunch });
    assert.deepEqual(corte.slice(0, 3), ["09:30", "10:00", "10:30"]);
    assert.ok(corte.includes("13:45") && !corte.includes("13:30") && !corte.includes("18:30"));
  });

  test("custom mode: the shop chooses the step", () => {
    const twenty = slotsFor(60, { mode: "custom", stepMinutes: 20, blocks: lunch });
    assert.deepEqual(twenty.slice(0, 6), ["09:40", "10:00", "10:20", "10:40", "11:00", "11:20"]);
    assert.ok(["13:15", "13:35", "17:55"].every((value) => twenty.includes(value)));
    assert.ok(!twenty.includes("11:40") && !twenty.includes("18:00"));
    assert.deepEqual(slotsFor(30, { mode: "custom", stepMinutes: 60, blocks: lunch }), [
      "10:00",
      "11:00",
      "12:00",
      "13:15",
      "14:15",
      "15:15",
      "16:15",
      "17:15",
      "18:15",
    ]);
  });

  test("settings fall back to the flexible mode and allowed steps", () => {
    assert.deepEqual(slotRuleFromSettings(null), { mode: "flexible", stepMinutes: 15 });
    assert.deepEqual(slotRuleFromSettings({ slot_mode: "custom", slot_step_minutes: 25 }), {
      mode: "custom",
      stepMinutes: 15,
    });
    assert.deepEqual(slotRuleFromSettings({ slot_mode: "literal", slot_step_minutes: 30 }), {
      mode: "literal",
      stepMinutes: 30,
    });
  });

  test("settings preview matches the explanation example", () => {
    const afterCorte: Array<[number, number]> = [[540, 570]];
    const flexible = previewSlotMinutes(
      "09:00",
      "19:00",
      60,
      { mode: "flexible", stepMinutes: 15 },
      afterCorte,
    );
    const literal = previewSlotMinutes(
      "09:00",
      "19:00",
      60,
      { mode: "literal", stepMinutes: 15 },
      afterCorte,
    );
    assert.equal(minutesLabel(flexible[0]), "9:30");
    assert.equal(minutesLabel(literal[0]), "10:00");
    assert.deepEqual(
      previewSlotMinutes("09:00", "12:00", 60, { mode: "literal", stepMinutes: 15 }).map(
        minutesLabel,
      ),
      ["9:00", "10:00", "11:00"],
    );
  });
}

test("staff terms decide duration, price and who does the service", () => {
  const service = { id: "corte", duration_minutes: 30, price_cents: 5000 };
  const terms = [{ staff_id: "a", service_id: "corte", duration_minutes: 45, price_cents: 6000 }];
  assert.deepEqual(termsFor(terms, "a", service), { duration_minutes: 45, price_cents: 6000 });
  assert.equal(termsFor(terms, "b", service), null);
  assert.equal(termsFor([], "a", service), null);
  assert.deepEqual(termsFor(null, "b", service), { duration_minutes: 30, price_cents: 5000 });
});
