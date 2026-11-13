import assert from "node:assert/strict";
import test from "node:test";

import { normalizeColorHex } from "./color-hex.ts";

test("color hex input is normalized to #rrggbb", () => {
  assert.equal(normalizeColorHex("#AABBCC"), "#aabbcc");
  assert.equal(normalizeColorHex(" abc "), "#aabbcc");
  assert.equal(normalizeColorHex("#1a2B3c"), "#1a2b3c");
  assert.equal(normalizeColorHex(""), null);
  assert.equal(normalizeColorHex(null), null);
  assert.equal(normalizeColorHex(undefined), null);
  assert.equal(normalizeColorHex("#abcd"), undefined);
  assert.equal(normalizeColorHex("red"), undefined);
  assert.equal(normalizeColorHex(42), undefined);
});
