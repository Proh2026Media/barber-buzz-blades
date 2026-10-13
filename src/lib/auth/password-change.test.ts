import assert from "node:assert/strict";
import test from "node:test";
import { mustChangePassword } from "./password-change.ts";

test("só a marca ligada pede senha nova", () => {
  assert.equal(mustChangePassword({ user_metadata: { must_change_password: true } }), true);
  assert.equal(mustChangePassword({ user_metadata: { must_change_password: false } }), false);
  assert.equal(mustChangePassword({ user_metadata: { must_change_password: "true" } }), false);
  assert.equal(mustChangePassword({ user_metadata: {} }), false);
  assert.equal(mustChangePassword({ user_metadata: null }), false);
  assert.equal(mustChangePassword(null), false);
});
