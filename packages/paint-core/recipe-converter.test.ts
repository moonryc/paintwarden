import assert from "node:assert/strict";
import test from "node:test";

import { paintType, rankOwnedPaintMatches, suggestedOwnedPaint } from "./recipe-converter.ts";

const paint = (id: string, range: string, colorHex: string) => ({
  id,
  name: id,
  brand: "Example",
  range,
  colorHex,
});

test("keeps paint type ahead of a visually closer but unsuitable finish", () => {
  const target = paint("target", "Shade", "#442233");
  const matches = rankOwnedPaintMatches(target, [
    paint("base", "Base", "#442233"),
    paint("wash", "Wash", "#462435"),
  ]);

  assert.deepEqual(
    matches.map(({ paint: candidate }) => candidate.id),
    ["wash", "base"],
  );
  assert.equal(suggestedOwnedPaint(matches)?.paint.id, "wash");
});

test("does not automatically suggest a distant or differently typed paint", () => {
  const target = paint("target", "Contrast", "#ff0000");
  const matches = rankOwnedPaintMatches(target, [paint("blue", "Speedpaint", "#0000ff")]);

  assert.equal(paintType("Speedpaint 2.0"), paintType("Contrast"));
  assert.equal(suggestedOwnedPaint(matches), null);
  assert.equal(suggestedOwnedPaint(rankOwnedPaintMatches(target, [paint("red", "Base", "#ff0000")])), null);
});

test("paints without a catalog color need a manual choice", () => {
  const target = paint("target", "Base", "not a color");
  assert.deepEqual(rankOwnedPaintMatches(target, [paint("candidate", "Base", "#aaaaaa")]), []);
});
