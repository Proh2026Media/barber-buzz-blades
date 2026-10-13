import assert from "node:assert/strict";
import test from "node:test";
import { shopBlockFromListed } from "./blocks.ts";

const base = {
  id: "b1",
  barbershop_id: "loja",
  staff_id: "s1",
  starts_at: "2026-10-14T12:00:00.000Z",
  ends_at: "2026-10-14T13:00:00.000Z",
  created_at: "2026-10-13T12:00:00.000Z",
};

test("bloqueio completo vira a linha com o nome do profissional", () => {
  assert.deepEqual(
    shopBlockFromListed({ ...base, reason: "Médico", staff_display_name: "Carlão" }),
    { ...base, reason: "Médico", staff: { display_name: "Carlão" } },
  );
});

test("bloqueio de colega chega sem motivo e sem nome, mas com o profissional", () => {
  const block = shopBlockFromListed({ ...base, reason: null, staff_display_name: null });
  assert.equal(block.staff, null);
  assert.equal(block.reason, null);
  assert.equal(block.staff_id, "s1");
});
