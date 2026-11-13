import assert from "node:assert/strict";
import test from "node:test";

import { isPaintOutstanding, summarizeRequired } from "./paint-state.ts";

test("wishlist paints remain outstanding", () => {
  assert.equal(isPaintOutstanding("WISHLIST"), true);
});

test("empty owned bottles are outstanding while low bottles still count", () => {
  assert.equal(isPaintOutstanding("OWNED", "EMPTY"), true);
  assert.equal(isPaintOutstanding("OWNED", "LOW"), false);
});

test("zero quantity is outstanding even when state is owned", () => {
  assert.equal(isPaintOutstanding("OWNED", "FULL", 0), true);
  assert.equal(isPaintOutstanding("OWNED", "FULL", 2), false);
});

test("only owned paints satisfy requirements", () => {
  const result = summarizeRequired([
    { id: "a", state: "OWNED" as const },
    { id: "b", state: "WISHLIST" as const },
    { id: "c", state: null },
  ]);
  assert.equal(result.owned.length, 1);
  assert.deepEqual(
    result.missing.map((paint) => paint.id),
    ["b", "c"],
  );
});
