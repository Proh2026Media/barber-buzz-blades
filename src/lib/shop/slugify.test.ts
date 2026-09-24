import assert from "node:assert/strict";
import test from "node:test";
import { isValidBookingSlug, slugifyPt } from "./slugify.ts";

test("slugifyPt remove acentos e espaços", () => {
  assert.equal(slugifyPt("Mestre Carlão"), "mestre-carlao");
  assert.equal(slugifyPt("  Ezequiel  "), "ezequiel");
});

test("isValidBookingSlug", () => {
  assert.equal(isValidBookingSlug("ezequiel"), true);
  assert.equal(isValidBookingSlug("tiago-2"), true);
  assert.equal(isValidBookingSlug("Ezequiel"), false);
  assert.equal(isValidBookingSlug("-tiago"), false);
});
