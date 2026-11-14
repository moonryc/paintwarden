import assert from "node:assert/strict";
import test from "node:test";

import { averagedHex, canSampleImage, imagePoint } from "../Components/swatch-sampling.ts";

void test("image-space samples remain stable at zoomed/panned coordinates", () => {
  assert.deepEqual(
    imagePoint(
      { x: 150, y: 100 },
      { left: 100, top: 50, width: 200, height: 100 },
      { width: 4000, height: 2000 },
    ),
    { x: 1000, y: 1000 },
  );
  assert.deepEqual(
    imagePoint(
      { x: 300, y: 200 },
      { left: 200, top: 100, width: 400, height: 200 },
      { width: 4000, height: 2000 },
    ),
    { x: 1000, y: 1000 },
  );
  assert.equal(
    imagePoint({ x: 0, y: 0 }, { left: 10, top: 10, width: 100, height: 100 }, { width: 100, height: 100 }),
    null,
  );
  assert.deepEqual(
    imagePoint({ x: 100, y: 100 }, { left: 0, top: 0, width: 100, height: 100 }, { width: 100, height: 100 }),
    { x: 99, y: 99 },
  );
});
void test("samples average linear light and ignore transparent noise", () => {
  assert.equal(averagedHex(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])), "#BCBCBC");
  assert.equal(averagedHex(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0])), "#FF0000");
  assert.equal(averagedHex(new Uint8ClampedArray([0, 0, 0, 0])), null);
});
void test("external and opaque photos fail closed, including desktop opaque origins", () => {
  assert.equal(canSampleImage("/api/miniatures/abc/image", "https://vault.example/"), true);
  assert.equal(canSampleImage("https://elsewhere.example/image", "https://vault.example/"), false);
  assert.equal(canSampleImage("http://vault.example/image", "https://vault.example/"), false);
  assert.equal(canSampleImage("/api/miniatures/abc/image", "paintwarden://app/"), true);
  assert.equal(canSampleImage("paintwarden://other/image", "paintwarden://app/"), false);
  assert.equal(canSampleImage("data:image/png;base64,abc", "paintwarden://app/"), false);
});
