import assert from "node:assert/strict";
import test from "node:test";

import { wishlistPaintIds } from "./wishlist-paints.ts";

test("wishlist includes wishlisted and depleted paints", () => {
  const ids = wishlistPaintIds({
    wishlist: { state: "WISHLIST", stockLevel: "FULL", quantity: 0 },
    depleted: { state: "OWNED", stockLevel: "EMPTY", quantity: 0 },
    zeroQuantity: { state: "OWNED", stockLevel: "FULL", quantity: 0 },
    markedEmpty: { state: "OWNED", stockLevel: "EMPTY", quantity: 2 },
    ready: { state: "OWNED", stockLevel: "FULL", quantity: 2 },
  });
  assert.deepEqual([...ids], ["wishlist", "depleted", "zeroQuantity", "markedEmpty"]);
});
