import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LANDING,
  cleanLandingConfig,
  endedToday,
  groupHours,
  instagramUrl,
  nextOpeningAfterToday,
  openStateAt,
  sortStaffByAvailability,
  splitClosedToday,
  parseLandingConfig,
  parseLandingData,
  validateLandingConfig,
  whatsappUrl,
} from "./shop-landing.ts";

test("landing config falls back to defaults", () => {
  assert.deepEqual(parseLandingConfig(null), DEFAULT_LANDING);
  assert.equal(parseLandingConfig({ show_today: false }).show_today, false);
  assert.equal(parseLandingConfig({ show_today: "no" }).show_today, true);
});

test("landing data needs a shop", () => {
  assert.equal(parseLandingData(null), null);
  assert.equal(parseLandingData({ shop: null }), null);
  const data = parseLandingData({
    shop: { id: "s1", name: "Loja", slug: "loja" },
    staff: [{ name: "Ana", free_today: ["10:00", 3, "10:30"] }],
    services: [
      { name: "Corte", icon: "Scissors" },
      { name: "Barba", icon: "" },
    ],
  });
  assert.equal(data?.shop.timezone, "America/Sao_Paulo");
  assert.deepEqual(data?.staff[0].free_today, ["10:00", "10:30"]);
  assert.equal(data?.staff[0].offers_services, true);
  assert.equal(data?.staff[0].min_duration_minutes, null);
  const team = parseLandingData({
    shop: { id: "s1", name: "Loja", slug: "loja" },
    staff: [
      { name: "Ana", free_today: ["18:30"], offers_services: true, min_duration_minutes: 30 },
      { name: "Bia", free_today: [], offers_services: false, min_duration_minutes: null },
    ],
  });
  assert.equal(team?.staff[0].min_duration_minutes, 30);
  assert.equal(team?.staff[1].offers_services, false);
  assert.equal(data?.services[0].icon, "Scissors");
  assert.equal(data?.services[1].icon, null);
});

test("landing validation mirrors the database", () => {
  assert.equal(validateLandingConfig(DEFAULT_LANDING), null);
  assert.equal(validateLandingConfig({ ...DEFAULT_LANDING, instagram: "ab cd" }), "instagram");
  assert.equal(validateLandingConfig({ ...DEFAULT_LANDING, whatsapp: "12" }), "whatsapp");
  assert.equal(validateLandingConfig({ ...DEFAULT_LANDING, headline: "a".repeat(81) }), "length");
  assert.equal(cleanLandingConfig({ ...DEFAULT_LANDING, headline: "  Oi  " }).headline, "Oi");
});

test("open state follows today's hours", () => {
  const today = { date: "", weekday: 1, is_open: true, opens_at: "09:00", closes_at: "19:00" };
  assert.deepEqual(openStateAt(today, "08:30"), { kind: "later", opens: "09:00" });
  assert.deepEqual(openStateAt(today, "12:00"), { kind: "open", until: "19:00" });
  assert.deepEqual(openStateAt(today, "19:00"), { kind: "closed" });
  assert.deepEqual(openStateAt({ ...today, is_open: false }, "12:00"), { kind: "closed" });
});

test("next opening looks at the following days", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_open: weekday !== 0,
    opens_at: weekday === 6 ? "08:00" : "09:00",
    closes_at: "19:00",
  }));
  assert.deepEqual(nextOpeningAfterToday(week, 1), { inDays: 1, weekday: 2, opens: "09:00" });
  assert.deepEqual(nextOpeningAfterToday(week, 6), { inDays: 2, weekday: 1, opens: "09:00" });
  assert.deepEqual(nextOpeningAfterToday(week, 5), { inDays: 1, weekday: 6, opens: "08:00" });
  assert.equal(
    nextOpeningAfterToday(
      week.map((row) => ({ ...row, is_open: false })),
      1,
    ),
    null,
  );
  const today = { date: "", weekday: 1, is_open: true, opens_at: "09:00", closes_at: "19:00" };
  assert.equal(endedToday(today, "19:00"), true);
  assert.equal(endedToday(today, "18:59"), false);
  assert.equal(endedToday({ ...today, is_open: false }, "20:00"), false);
});

test("hours are grouped by equal consecutive days", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_open: weekday !== 0,
    opens_at: weekday === 6 ? "08:00" : "09:00",
    closes_at: weekday === 6 ? "14:00" : "19:00",
  }));
  const groups = groupHours(week);
  assert.deepEqual(
    groups.map((group) => group.days),
    [[1, 2, 3, 4, 5], [6], [0]],
  );
  assert.equal(groups[2].is_open, false);
  // Dia sem linha conta como fechado e não se junta a dias abertos.
  assert.deepEqual(
    groupHours(week.filter((row) => row.weekday !== 3)).map((group) => group.days),
    [[1, 2], [3], [4, 5], [6], [0]],
  );
});

test("today closed by exception gets its own closed row", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    is_open: weekday !== 0,
    opens_at: "09:00",
    closes_at: "19:00",
  }));
  const groups = groupHours(week);
  // Hoje aberto: nada muda.
  assert.equal(splitClosedToday(groups, 3, true), groups);
  const split = splitClosedToday(groups, 3, false);
  assert.deepEqual(
    split.map((group) => group.days),
    [[1, 2], [3], [4, 5, 6], [0]],
  );
  assert.equal(split[1].is_open, false);
  assert.equal(split[2].opens_at, "09:00");
  // Hoje na ponta do grupo: sem grupo vazio.
  assert.deepEqual(
    splitClosedToday(groups, 1, false).map((group) => group.days),
    [[1], [2, 3, 4, 5, 6], [0]],
  );
});

test("staff with free slots come first", () => {
  const member = (name: string, free: string[], offers = true) => ({
    name,
    bio: "",
    avatar_url: null,
    booking_slug: name,
    free_today: free,
    offers_services: offers,
    min_duration_minutes: 30,
  });
  const sorted = sortStaffByAvailability([
    member("sem-agenda", [], false),
    member("lotado", []),
    member("tarde", ["15:00"]),
    member("cedo", ["09:30", "16:00"]),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.name),
    ["cedo", "tarde", "lotado", "sem-agenda"],
  );
});

test("contact links are built safely", () => {
  assert.equal(instagramUrl("@barba.cabelo"), "https://instagram.com/barba.cabelo");
  assert.equal(instagramUrl(""), null);
  assert.equal(whatsappUrl("(11) 99999-0000"), "https://wa.me/5511999990000");
  assert.equal(whatsappUrl("+351 912 345 678"), "https://wa.me/351912345678");
  assert.equal(whatsappUrl("123"), null);
});
