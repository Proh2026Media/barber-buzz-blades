import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePriceInput,
  priceInputFromCents,
  showCounter,
  splitDuration,
  staffDay,
  validDuration,
} from "./format.ts";

test("parsePriceInput lê o preço como a pessoa digita", () => {
  assert.equal(parsePriceInput("45"), 4500);
  assert.equal(parsePriceInput("45,5"), 4550);
  assert.equal(parsePriceInput("45,50"), 4550);
  assert.equal(parsePriceInput("45.90"), 4590);
  assert.equal(parsePriceInput("R$ 1.234,56"), 123456);
  assert.equal(parsePriceInput("1,234.56"), 123456);
  assert.equal(parsePriceInput("1.234.567"), 123456700);
  assert.equal(parsePriceInput("0"), 0);
  assert.equal(parsePriceInput(""), null);
  assert.equal(parsePriceInput("abc"), null);
  assert.equal(parsePriceInput("-5"), null);
  assert.equal(parsePriceInput("4,5,0"), null);
});

test("priceInputFromCents volta ao formato do campo", () => {
  assert.equal(priceInputFromCents(4500), "45,00");
  assert.equal(priceInputFromCents(4550), "45,50");
  assert.equal(priceInputFromCents(4550, "."), "45.50");
});

test("splitDuration e validDuration", () => {
  assert.deepEqual(splitDuration(90), { hours: 1, minutes: 30 });
  assert.deepEqual(splitDuration(45), { hours: 0, minutes: 45 });
  assert.deepEqual(splitDuration(120), { hours: 2, minutes: 0 });
  assert.equal(validDuration(30), true);
  assert.equal(validDuration(4), false);
  assert.equal(validDuration(601), false);
  assert.equal(validDuration(30.5), false);
  assert.equal(validDuration(null), false);
});

test("showCounter só a partir de 80% do limite", () => {
  assert.equal(showCounter(0, 500), false);
  assert.equal(showCounter(399, 500), false);
  assert.equal(showCounter(400, 500), true);
});

test("staffDay resume o dia do profissional", () => {
  const at = (hour: number, minute = 0) => new Date(Date.UTC(2030, 0, 15, hour, minute));
  const iso = (hour: number, minute = 0) => at(hour, minute).toISOString();
  const dayStart = at(0).getTime();
  const dayEnd = at(23, 59).getTime();
  const appointments = [
    { staff_id: "a", status: "completed", starts_at: iso(9), ends_at: iso(9, 30) },
    { staff_id: "a", status: "confirmed", starts_at: iso(14, 30), ends_at: iso(15) },
    { staff_id: "a", status: "cancelled", starts_at: iso(16), ends_at: iso(16, 30) },
    { staff_id: "b", status: "pending", starts_at: iso(11), ends_at: iso(11, 30) },
  ];
  const blocks = [
    { staff_id: "a", starts_at: iso(12), ends_at: iso(13) },
    { staff_id: null, starts_at: iso(18), ends_at: iso(19) },
    { staff_id: "b", starts_at: iso(0), ends_at: at(23, 59).toISOString() },
  ];
  const a = staffDay("a", appointments, blocks, dayStart, dayEnd, at(10).getTime());
  assert.equal(a.count, 2);
  assert.equal(a.next, iso(14, 30));
  assert.equal(a.blocks.length, 2);
  assert.equal(a.allDayBlocked, false);
  const b = staffDay("b", appointments, blocks, dayStart, dayEnd, at(12).getTime());
  assert.equal(b.count, 1);
  assert.equal(b.next, null);
  assert.equal(b.allDayBlocked, true);
});
