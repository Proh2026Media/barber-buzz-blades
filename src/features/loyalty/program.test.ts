import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TIERS,
  FALLBACK_PROGRAM,
  parseLoyaltyProgram,
  tierFor,
  tierStyleKey,
  validateTiers,
} from "./program.ts";

test("level follows lifetime points", () => {
  assert.equal(tierFor(0, DEFAULT_TIERS).tier.name, "Classic");
  assert.equal(tierFor(99, DEFAULT_TIERS).tier.name, "Classic");
  assert.equal(tierFor(100, DEFAULT_TIERS).tier.name, "Select");
  assert.equal(tierFor(650, DEFAULT_TIERS).tier.name, "Exclusive");
});

test("level progress and points to next level", () => {
  const position = tierFor(200, DEFAULT_TIERS);
  assert.equal(position.next?.name, "Privilege");
  assert.equal(position.pointsToNext, 100);
  assert.equal(position.progress, 50);
  assert.equal(tierFor(900, DEFAULT_TIERS).progress, 100);
});

test("missing program falls back to the standard rules", () => {
  assert.deepEqual(parseLoyaltyProgram(null), FALLBACK_PROGRAM);
});

test("custom program is read and tiers are sorted", () => {
  const program = parseLoyaltyProgram({
    enabled: false,
    mode: "custom",
    points_per_visit: 80,
    welcome_bonus: 20,
    version: 3,
    tiers: [
      { name: "Ouro", min_points: 200, benefit: "Desconto" },
      { name: "Bronze", min_points: 0, benefit: "" },
    ],
    rewards: [{ id: "r1", name: "Corte", description: "", cost_points: 150, active: true }],
  });
  assert.equal(program.enabled, false);
  assert.deepEqual(
    program.tiers.map((tier) => tier.name),
    ["Bronze", "Ouro"],
  );
  assert.equal(program.rewards[0].cost_points, 150);
});

test("tier validation accepts the standard rules and rejects unsafe ones", () => {
  assert.equal(validateTiers(DEFAULT_TIERS), null);
  assert.equal(validateTiers([]), "count");
  assert.equal(validateTiers([{ name: "A", min_points: 5, benefit: "" }]), "first");
  assert.equal(
    validateTiers([
      { name: "A", min_points: 0, benefit: "" },
      { name: "B", min_points: 0, benefit: "" },
    ]),
    "order",
  );
  assert.equal(
    validateTiers([
      { name: "A", min_points: 0, benefit: "" },
      { name: "a", min_points: 10, benefit: "" },
    ]),
    "duplicate",
  );
});

test("top level keeps the noblest style", () => {
  assert.equal(tierStyleKey(0, 4), "classic");
  assert.equal(tierStyleKey(3, 4), "exclusive");
  assert.equal(tierStyleKey(5, 6), "exclusive");
  assert.equal(tierStyleKey(0, 1), "classic");
});
