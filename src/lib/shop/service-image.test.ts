import assert from "node:assert/strict";
import test from "node:test";
import { getSquareCropRect, initialCropOffset, PORTRAIT_FOCUS_Y } from "./service-image-crop.ts";

test("initial crop covers and centers, nudging portraits of people upward", () => {
  const sizes = { viewportSize: 300 };
  assert.deepEqual(initialCropOffset({ naturalWidth: 1600, naturalHeight: 900, ...sizes }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(initialCropOffset({ naturalWidth: 900, naturalHeight: 1600, ...sizes }), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(
    initialCropOffset({
      naturalWidth: 1600,
      naturalHeight: 900,
      focusY: PORTRAIT_FOCUS_Y,
      ...sizes,
    }),
    { x: 0, y: 0 },
  );

  const offset = initialCropOffset({
    naturalWidth: 900,
    naturalHeight: 1600,
    focusY: PORTRAIT_FOCUS_Y,
    ...sizes,
  });
  const crop = getSquareCropRect({
    naturalWidth: 900,
    naturalHeight: 1600,
    viewportSize: 300,
    zoom: 1,
    offsetX: offset.x,
    offsetY: offset.y,
  });
  assert.equal(crop.size, 900);
  assert.equal(Math.round(crop.y + crop.size / 2), Math.round(1600 * PORTRAIT_FOCUS_Y));

  const extreme = initialCropOffset({
    naturalWidth: 900,
    naturalHeight: 1600,
    focusY: 0,
    ...sizes,
  });
  const top = getSquareCropRect({
    naturalWidth: 900,
    naturalHeight: 1600,
    viewportSize: 300,
    zoom: 1,
    offsetX: extreme.x,
    offsetY: extreme.y,
  });
  assert.equal(Math.round(top.y), 0);
});

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
