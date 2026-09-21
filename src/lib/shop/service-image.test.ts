import assert from "node:assert/strict";
import test from "node:test";
import { getSquareCropRect } from "./service-image-crop.ts";

test("square crop centers and covers landscape and portrait images", () => {
  assert.deepEqual(
    getSquareCropRect({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportSize: 300,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }),
    { x: 350, y: 0, size: 900 },
  );
  assert.deepEqual(
    getSquareCropRect({
      naturalWidth: 900,
      naturalHeight: 1600,
      viewportSize: 300,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    }),
    { x: 0, y: 350, size: 900 },
  );
});

test("square crop maps zoom and position back to source pixels", () => {
  assert.deepEqual(
    getSquareCropRect({
      naturalWidth: 1600,
      naturalHeight: 900,
      viewportSize: 300,
      zoom: 2,
      offsetX: 0,
      offsetY: 0,
    }),
    { x: 575, y: 225, size: 450 },
  );

  const moved = getSquareCropRect({
    naturalWidth: 1600,
    naturalHeight: 900,
    viewportSize: 300,
    zoom: 1,
    offsetX: 100,
    offsetY: 0,
  });
  assert.equal(Math.round(moved.x), 50);
  assert.equal(moved.y, 0);
  assert.equal(moved.size, 900);
});

test("square crop remains inside the source at extreme offsets", () => {
  const crop = getSquareCropRect({
    naturalWidth: 1600,
    naturalHeight: 900,
    viewportSize: 300,
    zoom: 1,
    offsetX: -10000,
    offsetY: 10000,
  });
  assert.deepEqual(crop, { x: 700, y: 0, size: 900 });
});
