import assert from "node:assert/strict";
import test from "node:test";

import { schemePreview } from "./scheme-preview.ts";

test("short scheme card previews are identical, including authored repeats", () => {
  assert.deepEqual(schemePreview(["Red", "Blue", "Red"], ["#ff0000", "#0000ff", "#ff0000"]), {
    paintNames: "Red · Blue · Red",
    gradient: "linear-gradient(135deg, #ff0000 0%, #0000ff 50%, #ff0000 100%)",
    previewMoreCount: 0,
  });
  assert.deepEqual(schemePreview([], []), { paintNames: "", gradient: "", previewMoreCount: 0 });
});

test("card color stops cap at 32, retaining order and repeats, with explicit omitted count", () => {
  const names = Array.from({ length: 40 }, (_, index) => `P${index}`);
  const colors = Array.from({ length: 40 }, (_, index) => (index % 2 ? "#ff0000" : "#0000ff"));
  const result = schemePreview(names, colors);
  assert.equal(result.gradient.match(/#[a-f0-9]{6}/g)?.length, 32);
  assert.deepEqual(result.gradient.match(/#[a-f0-9]{6}/g), colors.slice(0, 32));
  assert.equal(result.previewMoreCount, 8);
  assert.equal(result.paintNames, names.join(" · "));
  assert.equal(colors.length, 40, "preview must not mutate full authored data");
});

test("names cap at 512 characters and count every not-fully-visible name", () => {
  const result = schemePreview(Array(100).fill("A".repeat(100)), ["#ff0000"]);
  assert.equal(result.paintNames.length, 512);
  assert.ok(result.paintNames.endsWith("…"));
  assert.equal(result.previewMoreCount, 96);
  assert.equal(schemePreview(["A".repeat(512)], []).previewMoreCount, 0);
  assert.equal(schemePreview(["A".repeat(513)], []).previewMoreCount, 1);
});
