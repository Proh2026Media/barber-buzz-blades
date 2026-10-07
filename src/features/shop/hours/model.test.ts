import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changedWeekdays,
  dayInvalid,
  fromMinutes,
  groupWeek,
  liveStatus,
  quickRanges,
  rulerRange,
  rulerTicks,
  toMinutes,
  weekdayOfKey,
  type HoursRow,
} from "./model.ts";

const day = (weekday: number, opens = "09:00:00", closes = "19:00:00", open = true): HoursRow => ({
  weekday,
  is_open: open,
  opens_at: opens,
  closes_at: closes,
});
const week = () => [
  day(0, "09:00:00", "19:00:00", false),
  ...[1, 2, 3, 4, 5, 6].map((d) => day(d)),
];

test("converte minutos e horários", () => {
  assert.equal(toMinutes("09:30:00"), 570);
  assert.equal(fromMinutes(570), "09:30");
  assert.equal(fromMinutes(1440), "24:00");
});

test("agrupa dias seguidos iguais, de segunda a domingo", () => {
  const groups = groupWeek(week());
  assert.deepEqual(
    groups.map((g) => [g.weekdays, g.is_open]),
    [
      [[1, 2, 3, 4, 5, 6], true],
      [[0], false],
    ],
  );
  const rows = week();
  rows[6] = day(6, "09:00:00", "14:00:00");
  assert.equal(groupWeek(rows).length, 3);
});

test("compara rascunho com o gravado só por horas e minutos", () => {
  const saved = week();
  const draft = week().map((row) => ({ ...row, opens_at: row.opens_at.slice(0, 5) }));
  assert.deepEqual(changedWeekdays(draft, saved), []);
  draft[1] = { ...draft[1], closes_at: "20:00" };
  draft[0] = { ...draft[0], opens_at: "10:00" }; // domingo fechado: horário não conta
  assert.deepEqual(changedWeekdays(draft, saved), [1]);
});

test("valida fechamento depois da abertura", () => {
  assert.equal(dayInvalid(day(1, "20:00", "19:00")), true);
  assert.equal(dayInvalid(day(1, "20:00", "19:00", false)), false);
});

test("régua comum cobre a semana inteira", () => {
  const rows = week();
  rows[6] = day(6, "08:30:00", "14:00:00");
  assert.deepEqual(rulerRange(rows), { start: 8 * 60, end: 19 * 60 });
  assert.deepEqual(rulerTicks({ start: 8 * 60, end: 19 * 60 }), [540, 720, 900, 1080]);
});

test("estado de agora: aberta, em pausa, fechada", () => {
  const hours = week();
  assert.deepEqual(liveStatus({ hours, todayWeekday: 1, nowMinutes: 600, shopBlocks: [] }), {
    kind: "open",
    closesAt: "19:00",
  });
  assert.deepEqual(
    liveStatus({
      hours,
      todayWeekday: 1,
      nowMinutes: 730,
      shopBlocks: [
        { start: 720, end: 780 },
        { start: 780, end: 810 },
      ],
    }),
    { kind: "paused", until: "13:30", closesAt: "19:00" },
  );
  assert.deepEqual(liveStatus({ hours, todayWeekday: 6, nowMinutes: 1200, shopBlocks: [] }), {
    kind: "closed",
    next: { inDays: 2, opensAt: "09:00" },
  });
  assert.deepEqual(liveStatus({ hours, todayWeekday: 1, nowMinutes: 480, shopBlocks: [] }), {
    kind: "closed",
    next: { inDays: 0, opensAt: "09:00" },
  });
});

test("atalhos de bloqueio cabem no expediente", () => {
  assert.deepEqual(
    quickRanges(day(1)).map((r) => `${r.id} ${r.start}-${r.end}`),
    ["lunch 12:00-13:00", "morning 09:00-12:00", "afternoon 13:00-19:00", "allDay 09:00-19:00"],
  );
  assert.deepEqual(
    quickRanges(day(6, "14:00", "18:00")).map((r) => r.id),
    ["allDay"],
  );
  assert.deepEqual(quickRanges(day(0, "09:00", "19:00", false)), []);
});

test("dia da semana de uma data da loja", () => {
  assert.equal(weekdayOfKey("2026-10-05"), 1);
  assert.equal(weekdayOfKey("2026-10-11"), 0);
});
