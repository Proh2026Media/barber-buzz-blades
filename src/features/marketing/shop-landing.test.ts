import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LANDING,
  cleanLandingConfig,
  instagramUrl,
  openStateAt,
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
  });
  assert.equal(data?.shop.timezone, "America/Sao_Paulo");
  assert.deepEqual(data?.staff[0].free_today, ["10:00", "10:30"]);
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

test("contact links are built safely", () => {
  assert.equal(instagramUrl("@barba.cabelo"), "https://instagram.com/barba.cabelo");
  assert.equal(instagramUrl(""), null);
  assert.equal(whatsappUrl("(11) 99999-0000"), "https://wa.me/5511999990000");
  assert.equal(whatsappUrl("+351 912 345 678"), "https://wa.me/351912345678");
  assert.equal(whatsappUrl("123"), null);
});
