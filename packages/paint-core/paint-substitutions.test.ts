import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaintChoiceResolver,
  isPaintAvailable,
  resolvePaintChoice,
  selectedSubstitution,
  type SubstitutionData,
} from "./paint-substitutions.ts";

const data: SubstitutionData = {
  paintSubstitutions: [
    { id: "mix-a", targetPaintId: "target", name: "Mix A", isDefault: true },
    { id: "mix-b", targetPaintId: "target", name: "Mix B", isDefault: false },
    { id: "nested", targetPaintId: "blue", name: "Nested", isDefault: true },
  ],
  paintSubstitutionIngredients: [
    { substitutionId: "mix-a", paintId: "red", parts: 2, sortOrder: 0 },
    { substitutionId: "mix-a", paintId: "blue", parts: 1, sortOrder: 1 },
    { substitutionId: "mix-b", paintId: "green", parts: 1, sortOrder: 0 },
    { substitutionId: "nested", paintId: "white", parts: 1, sortOrder: 0 },
  ],
  miniaturePaintSubstitutions: [],
};

test("uses the global default and resolves nested recipes", () => {
  assert.equal(selectedSubstitution(data, "mini", "target")?.id, "mix-a");
  assert.deepEqual(resolvePaintChoice(data, "mini", "target").paintIds, ["red", "white"]);
});

test("saved miniature choices do not override the paint default", () => {
  const overridden = {
    ...data,
    miniaturePaintSubstitutions: [
      { miniatureId: "mini", targetPaintId: "target", substitutionId: "mix-b", useOriginal: false },
    ],
  };
  assert.equal(selectedSubstitution(overridden, "mini", "target")?.id, "mix-a");
  assert.deepEqual(resolvePaintChoice(overridden, "mini", "target").paintIds, ["red", "white"]);
  const original = {
    ...data,
    miniaturePaintSubstitutions: [
      { miniatureId: "mini", targetPaintId: "target", substitutionId: null, useOriginal: true },
    ],
  };
  assert.deepEqual(resolvePaintChoice(original, "mini", "target").paintIds, ["red", "white"]);
  const withoutDefault = {
    ...overridden,
    paintSubstitutions: data.paintSubstitutions.map((row) => ({ ...row, isDefault: false })),
  };
  assert.deepEqual(resolvePaintChoice(withoutDefault, "mini", "target").paintIds, ["target"]);
});

test("detects circular substitution chains", () => {
  const circular: SubstitutionData = {
    paintSubstitutions: [
      { id: "a", targetPaintId: "one", name: "A", isDefault: true },
      { id: "b", targetPaintId: "two", name: "B", isDefault: true },
    ],
    paintSubstitutionIngredients: [
      { substitutionId: "a", paintId: "two", parts: 1, sortOrder: 0 },
      { substitutionId: "b", paintId: "one", parts: 1, sortOrder: 0 },
    ],
    miniaturePaintSubstitutions: [],
  };
  assert.equal(resolvePaintChoice(circular, "mini", "one").cycle, true);
  assert.equal(isPaintAvailable(circular, {}, "one"), false);
});

test("active substitution determines availability from every resolved ingredient", () => {
  const owned = { state: "OWNED" as const, stockLevel: "FULL" as const, quantity: 1 };
  const records = { target: owned, red: owned, white: owned };
  assert.equal(isPaintAvailable(data, records, "target"), true);
  assert.equal(isPaintAvailable(data, { ...records, red: { ...owned, quantity: 0 } }, "target"), false);
  assert.equal(
    isPaintAvailable(data, { ...records, white: { ...owned, stockLevel: "EMPTY" } }, "target"),
    false,
  );
  assert.equal(isPaintAvailable(data, { red: owned, white: owned }, "target"), true);
  assert.equal(isPaintAvailable(data, { red: owned, blue: owned }, "target"), false);
  assert.equal(isPaintAvailable(data, { target: owned }, "target"), false);
});

test("only the active substitution affects availability", () => {
  const owned = { state: "OWNED" as const, stockLevel: "FULL" as const, quantity: 1 };
  const inactiveOnly = {
    ...data,
    paintSubstitutions: data.paintSubstitutions.map((row) => ({ ...row, isDefault: false })),
  };
  assert.equal(isPaintAvailable(inactiveOnly, { red: owned, white: owned }, "target"), false);
  assert.equal(isPaintAvailable(inactiveOnly, { target: owned }, "target"), true);
  assert.equal(isPaintAvailable(data, { green: owned }, "target"), false);
  assert.equal(
    isPaintAvailable({ ...data, paintSubstitutionIngredients: [] }, { target: owned }, "target"),
    false,
  );
});

test("indexed resolver shares traversal semantics and caches only complete roots", () => {
  const snapshot: SubstitutionData = {
    paintSubstitutions: [
      { id: "a", targetPaintId: "one", name: "A", isDefault: true },
      { id: "b", targetPaintId: "two", name: "B", isDefault: true },
      { id: "duplicate", targetPaintId: "one", name: "Ignored duplicate", isDefault: true },
      { id: "empty", targetPaintId: "empty", name: "Empty", isDefault: true },
    ],
    paintSubstitutionIngredients: [
      { substitutionId: "a", paintId: "red", parts: 1, sortOrder: 2 },
      { substitutionId: "a", paintId: "two", parts: 1, sortOrder: 0 },
      { substitutionId: "b", paintId: "blue", parts: 1, sortOrder: 1 },
      { substitutionId: "b", paintId: "one", parts: 1, sortOrder: 0 },
      { substitutionId: "duplicate", paintId: "wrong", parts: 1, sortOrder: 0 },
    ],
    miniaturePaintSubstitutions: [
      { miniatureId: "mini", targetPaintId: "one", substitutionId: null, useOriginal: true },
    ],
  };
  const before = structuredClone(snapshot);
  const resolve = createPaintChoiceResolver(snapshot);
  assert.deepEqual(resolve("one"), {
    paintIds: ["blue", "red"],
    cycle: true,
    substitutionIds: ["a", "b"],
  });
  assert.deepEqual(resolve("two"), {
    paintIds: ["red", "blue"],
    cycle: true,
    substitutionIds: ["b", "a"],
  });
  for (const id of ["one", "two", "empty", "original", "one", "two"]) {
    assert.deepEqual(resolve(id), resolvePaintChoice(snapshot, "mini", id));
    assert.strictEqual(resolve(id), resolve(id));
  }
  assert.deepEqual(snapshot, before, "indexing never sorts input arrays in place");
  const changed = createPaintChoiceResolver({ ...snapshot, paintSubstitutions: [] });
  assert.deepEqual(changed("one"), { paintIds: ["one"], cycle: false, substitutionIds: [] });
  assert.equal(resolve("one").cycle, true, "new snapshots do not alter existing resolvers");
  assert.deepEqual(
    resolvePaintChoice(snapshot, "mini", "one", ["one"]),
    {
      paintIds: [],
      cycle: true,
      substitutionIds: [],
    },
    "the original public trail argument remains supported",
  );
});
