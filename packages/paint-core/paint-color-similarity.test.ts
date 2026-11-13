import assert from "node:assert/strict";
import test from "node:test";

import { rankPaintsByColor } from "./paint-color-similarity.ts";

test("ranks identical and close colors before distant colors", () => {
  const selected: { id: string; colorHex: string | null } = { id: "selected", colorHex: "#960c23" };
  const paints = [
    selected,
    { id: "blue", colorHex: "#244fba" },
    { id: "near-red", colorHex: "#a10f28" },
    { id: "same-red", colorHex: "#960c23" },
    { id: "unknown", colorHex: null },
  ];
  const ranked = rankPaintsByColor(selected, paints);

  assert.deepEqual(
    ranked?.map(({ paint }) => paint.id),
    ["same-red", "near-red", "blue"],
  );
  assert.equal(ranked?.[0].match.score, 100);
  assert.ok((ranked?.[1].match.score ?? 0) > (ranked?.[2].match.score ?? 0));
});

test("excludes another range of the selected paint but retains other brands", () => {
  const selected = { id: "base", name: "Wraithbone", brand: "Citadel", colorHex: "#ddd8b5" };
  const ranked = rankPaintsByColor(selected, [
    selected,
    { id: "spray", name: "Wraithbone", brand: "Citadel", colorHex: "#ddd8b5" },
    { id: "other-brand", name: "Wraithbone", brand: "Another brand", colorHex: "#ddd8b5" },
    { id: "other-paint", name: "Pale Bone", brand: "Citadel", colorHex: "#ddd8b5" },
  ]);

  assert.deepEqual(
    ranked?.map(({ paint }) => paint.id),
    ["other-brand", "other-paint"],
  );
});

test("reports lighter and darker paints and handles missing selected colors", () => {
  const selected = { id: "selected", colorHex: "#777777" };
  const ranked = rankPaintsByColor(selected, [
    { id: "lighter", colorHex: "#bbbbbb" },
    { id: "darker", colorHex: "#333333" },
  ]);

  assert.ok((ranked?.find(({ paint }) => paint.id === "lighter")?.match.lightnessDelta ?? 0) > 0);
  assert.ok((ranked?.find(({ paint }) => paint.id === "darker")?.match.lightnessDelta ?? 0) < 0);
  assert.equal(
    rankPaintsByColor<{ id: string; colorHex: string | null }>({ id: "missing", colorHex: null }, [selected]),
    null,
  );
});

test("reports the shortest signed hue direction", () => {
  const selected = { id: "red", colorHex: "#ff0000" };
  const ranked = rankPaintsByColor(selected, [
    { id: "orange", colorHex: "#ff8000" },
    { id: "magenta", colorHex: "#ff00ff" },
  ]);

  assert.ok((ranked?.find(({ paint }) => paint.id === "orange")?.match.hueDelta ?? 0) > 0);
  assert.ok((ranked?.find(({ paint }) => paint.id === "magenta")?.match.hueDelta ?? 0) < 0);
});
