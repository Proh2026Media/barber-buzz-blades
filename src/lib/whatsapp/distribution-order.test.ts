import test from "node:test";
import assert from "node:assert/strict";
import { reorderNumbers } from "./distribution-order.ts";
test("mover conserva todos os números e atualiza a prioridade", () => {
  const initial = { primary: "a", backup: "b", backup2: "c" };
  assert.deepEqual(reorderNumbers(initial, "primary", "backup2"), {
    primary: "b",
    backup: "c",
    backup2: "a",
  });
  assert.deepEqual(reorderNumbers(initial, "backup2", "primary"), {
    primary: "c",
    backup: "a",
    backup2: "b",
  });
  assert.equal(initial.primary, "a");
});
test("arrastar para reserva vazia nunca deixa o principal vazio", () => {
  assert.deepEqual(
    reorderNumbers({ primary: "a", backup: "b", backup2: null }, "primary", "backup2"),
    { primary: "b", backup: "a", backup2: null },
  );
  assert.deepEqual(
    reorderNumbers({ primary: "a", backup: null, backup2: null }, "primary", "backup"),
    { primary: "a", backup: null, backup2: null },
  );
});
