import assert from "node:assert/strict";
import test from "node:test";

import { nearSearchBottom, normalizeSearch, SEARCH_DEBOUNCE_MS } from "./use-search-results.ts";

test("server searches share the agreed debounce and enforce the server search budget", () => {
  assert.equal(SEARCH_DEBOUNCE_MS, 250);
  assert.equal(normalizeSearch("  model  "), "model");
  assert.equal(normalizeSearch("x".repeat(180)), "x".repeat(128));
  assert.equal(normalizeSearch(""), "");
});

test("dropdowns fetch near the bottom, not on every scroll", () => {
  assert.equal(nearSearchBottom({ scrollHeight: 1000, scrollTop: 100, clientHeight: 240 }), false);
  assert.equal(nearSearchBottom({ scrollHeight: 1000, scrollTop: 680, clientHeight: 240 }), true);
});
