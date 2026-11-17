import assert from "node:assert/strict";
import { test } from "node:test";

import { appScrollOffset } from "./app-layout.ts";

test("windowed keyboard navigation clears the current responsive shell and toolbar", () => {
  const previousDocument = globalThis.document;
  const previousComputedStyle = globalThis.getComputedStyle;
  try {
    let toolbar;
    globalThis.document = {
      querySelector: (selector) =>
        selector === "[data-filter-toolbar]" ? toolbar : { getBoundingClientRect: () => ({ bottom: 92 }) },
    };
    globalThis.getComputedStyle = () => ({ top: "100px" });
    assert.equal(appScrollOffset(), 100);
    toolbar = { getBoundingClientRect: () => ({ height: 58 }) };
    assert.equal(appScrollOffset(), 166);
    globalThis.getComputedStyle = () => ({ top: "auto" });
    assert.equal(appScrollOffset(), 66, "standalone page stories must never scroll to NaN");
  } finally {
    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousComputedStyle;
  }
});
