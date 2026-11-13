import assert from "node:assert/strict";
import test from "node:test";

import { needsLegacySnapshot } from "../utils/legacy-screen.ts";

const none = { plugins: false, schemeForm: false };
test("Home, Miniatures and Library launch without the legacy snapshot", () => {
  for (const tab of ["dashboard", "miniatures", "paints"] as const)
    assert.equal(needsLegacySnapshot(tab, none), false, tab);
});
test("unmigrated screens and source/scheme overlays opt into the snapshot lazily", () => {
  for (const tab of ["wishlist", "schemes", "templates", "settings", "paint-tools"] as const)
    assert.equal(needsLegacySnapshot(tab, none), true, tab);
  assert.equal(needsLegacySnapshot("dashboard", { ...none, plugins: true }), true);
  assert.equal(needsLegacySnapshot("dashboard", { ...none, schemeForm: true }), true);
});
