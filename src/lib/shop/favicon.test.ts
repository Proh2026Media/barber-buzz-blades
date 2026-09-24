import assert from "node:assert/strict";
import test from "node:test";
import { applyShopFavicon } from "./favicon.ts";

test("applyShopFavicon is a no-op without document (SSR-safe)", () => {
  assert.equal(typeof applyShopFavicon, "function");
  assert.doesNotThrow(() => applyShopFavicon("https://example.com/logo.png"));
  assert.doesNotThrow(() => applyShopFavicon(null));
});
