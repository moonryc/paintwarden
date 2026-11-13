import assert from "node:assert/strict";
import test from "node:test";

import { applyVaultChanges, type VaultSnapshot } from "./vault-changes.ts";

const snapshot = (): VaultSnapshot => ({
  miniatures: [
    { id: "m1", title: "One" },
    { id: "m2", title: "Two" },
  ],
  catalog: [{ id: "p1", name: "Red" }],
  paintStates: { p1: "OWNED" },
  paintRecords: { p1: { state: "OWNED", stockLevel: "FULL", quantity: 1 } },
  requirements: [],
  recipeSteps: [],
  colorSchemes: [],
  colorSchemePaints: [
    { schemeId: "s1", paintId: "p1", sortOrder: 1 },
    { schemeId: "s1", paintId: "p2", sortOrder: 2 },
  ],
  colorSchemeDividers: [],
  colorSchemeImages: [],
  miniatureColorSchemes: [],
  paintSubstitutions: [],
  paintSubstitutionIngredients: [],
  miniaturePaintSubstitutions: [],
});

test("returns the same snapshot when nothing changed", () => {
  const before = snapshot();
  assert.equal(applyVaultChanges(before, []), before);
});

test("updates rows in place, appends new rows, and removes deleted rows", () => {
  const before = snapshot();
  const after = applyVaultChanges(before, [
    { table: "miniatures", key: { id: "m1" }, row: { id: "m1", title: "Renamed" } },
    { table: "miniatures", key: { id: "m3" }, row: { id: "m3", title: "Three" } },
    { table: "colorSchemePaints", key: { schemeId: "s1", sortOrder: 1 }, row: null },
  ]);
  assert.deepEqual(after.miniatures, [
    { id: "m1", title: "Renamed" },
    { id: "m2", title: "Two" },
    { id: "m3", title: "Three" },
  ]);
  assert.deepEqual(after.colorSchemePaints, [{ schemeId: "s1", paintId: "p2", sortOrder: 2 }]);
  assert.equal(after.catalog, before.catalog, "untouched tables keep their identity");
  assert.equal(after.miniatures[1], before.miniatures[1], "untouched rows keep their identity");
});

test("keeps paint states and records in step", () => {
  const after = applyVaultChanges(snapshot(), [
    { table: "paintRecords", key: { paintId: "p1" }, row: null },
    {
      table: "paintRecords",
      key: { paintId: "p2" },
      row: { paintId: "p2", state: "WISHLIST", stockLevel: "FULL", quantity: 0 },
    },
  ]);
  assert.deepEqual(after.paintStates, { p2: "WISHLIST" });
  assert.deepEqual(after.paintRecords, { p2: { state: "WISHLIST", stockLevel: "FULL", quantity: 0 } });
});

test("the last change for a key wins", () => {
  const after = applyVaultChanges(snapshot(), [
    { table: "catalog", key: { id: "p1" }, row: { id: "p1", name: "Blue" } },
    { table: "catalog", key: { id: "p1" }, row: null },
  ]);
  assert.deepEqual(after.catalog, []);
});
