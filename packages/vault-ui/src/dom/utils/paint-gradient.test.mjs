import assert from "node:assert/strict";
import test from "node:test";

import { paintGradient } from "./paint-gradient.ts";

test("paintGradient returns nothing without colors", () => {
  assert.equal(paintGradient([]), undefined);
});

test("paintGradient uses a single color as a solid background", () => {
  assert.equal(paintGradient(["#123456"]), "#123456");
});

test("paintGradient spreads several colors evenly", () => {
  assert.equal(
    paintGradient(["#000", "#888", "#fff"]),
    "linear-gradient(135deg, #000 0%, #888 50%, #fff 100%)",
  );
});
