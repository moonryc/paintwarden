import assert from "node:assert/strict";
import test from "node:test";

import {
  createPaintChoiceResolver,
  isPaintAvailable,
  resolvePaintChoice,
  resolveSubstitution,
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
    paintIds: ["two", "red"],
    unavailablePaintIds: ["two"],
    cycle: true,
    broken: true,
    brokenReason: "cycle",
    substitutionIds: ["a", "b"],
  });
  assert.deepEqual(resolve("two"), {
    paintIds: ["one", "blue"],
    unavailablePaintIds: ["one"],
    cycle: true,
    broken: true,
    brokenReason: "cycle",
    substitutionIds: ["b", "a"],
  });
  for (const id of ["one", "two", "empty", "original", "one", "two"]) {
    assert.deepEqual(resolve(id), resolvePaintChoice(snapshot, "mini", id));
    assert.strictEqual(resolve(id), resolve(id));
  }
  assert.deepEqual(snapshot, before, "indexing never sorts input arrays in place");
  const changed = createPaintChoiceResolver({ ...snapshot, paintSubstitutions: [] });
  assert.deepEqual(changed("one"), {
    paintIds: ["one"],
    unavailablePaintIds: [],
    cycle: false,
    broken: false,
    brokenReason: null,
    substitutionIds: [],
  });
  assert.equal(resolve("one").cycle, true, "new snapshots do not alter existing resolvers");
  assert.deepEqual(
    resolvePaintChoice(snapshot, "mini", "one", ["one"]),
    {
      paintIds: ["one"],
      unavailablePaintIds: ["one"],
      cycle: true,
      broken: true,
      brokenReason: "cycle",
      substitutionIds: [],
    },
    "the original public trail argument remains supported",
  );
});

const owned = { state: "OWNED" as const, stockLevel: "LOW" as const, quantity: 1 };
const mix = (id: string, targetPaintId: string, isDefault = true) => ({
  id,
  targetPaintId,
  name: id,
  isDefault,
});
const ingredient = (substitutionId: string, paintId: string, sortOrder = 0) => ({
  substitutionId,
  paintId,
  parts: 2,
  sortOrder,
});

test("empty recipes are unavailable even when their original paint is owned", () => {
  const empty: SubstitutionData = {
    paintSubstitutions: [mix("parent", "a"), mix("empty", "b")],
    paintSubstitutionIngredients: [ingredient("parent", "b"), ingredient("parent", "red", 1)],
    miniaturePaintSubstitutions: [],
  };
  assert.equal(resolvePaintChoice(empty, "mini", "b").broken, true);
  assert.equal(resolvePaintChoice(empty, "mini", "b").brokenReason, "empty");
  assert.deepEqual(resolvePaintChoice(empty, "mini", "a"), {
    paintIds: ["b", "red"],
    unavailablePaintIds: ["b"],
    cycle: false,
    broken: false,
    brokenReason: null,
    substitutionIds: ["parent", "empty"],
  });
  assert.equal(isPaintAvailable(empty, { b: owned, red: owned }, "a"), false);
  assert.equal(isPaintAvailable(empty, { a: owned }, "a"), false);
  for (const record of [
    undefined,
    { ...owned, quantity: 0 },
    { ...owned, stockLevel: "EMPTY" as const },
    { ...owned, state: "WISHLIST" as const },
  ]) {
    assert.equal(isPaintAvailable(empty, { b: record }, "b"), false);
  }
  assert.equal(isPaintAvailable(empty, { b: owned }, "b"), false);
});

test("two- and three-paint cycles block the closing owner for each root regardless of inventory", () => {
  for (const ids of [
    ["a", "b"],
    ["a", "b", "c"],
  ]) {
    const circular: SubstitutionData = {
      paintSubstitutions: ids.map((id) => mix(id, id)),
      paintSubstitutionIngredients: ids.flatMap((id, index) => [
        ingredient(id, ids[(index + 1) % ids.length]),
        ingredient(id, "red", 1),
      ]),
      miniaturePaintSubstitutions: [],
    };
    const resolver = createPaintChoiceResolver(circular);
    for (const order of [ids, [...ids].reverse(), ids]) {
      for (const root of order) {
        const closingOwner = ids[(ids.indexOf(root) + ids.length - 1) % ids.length];
        const expected = { paintIds: [closingOwner, "red"], cycle: true, broken: true };
        for (const actual of [resolver(root), resolvePaintChoice(circular, "mini", root)]) {
          assert.deepEqual(actual.paintIds, expected.paintIds);
          assert.equal(actual.cycle, true);
          assert.equal(actual.broken, true);
          assert.equal(actual.brokenReason, "cycle");
          assert.deepEqual(actual.unavailablePaintIds, [closingOwner]);
        }
        assert.equal(isPaintAvailable(circular, { [closingOwner]: owned, red: owned }, root), false);
        assert.equal(isPaintAvailable(circular, { [root]: owned, red: owned }, root), false);
      }
    }
  }
});

test("direct self ingredients are physical while ancestors of longer cycles remain distinct", () => {
  const circular: SubstitutionData = {
    paintSubstitutions: [mix("self", "self"), mix("parent", "parent"), mix("a", "a"), mix("b", "b")],
    paintSubstitutionIngredients: [
      ingredient("self", "self"),
      ingredient("self", "red", 1),
      ingredient("parent", "a"),
      ingredient("a", "b"),
      ingredient("b", "a"),
    ],
    miniaturePaintSubstitutions: [],
  };
  assert.deepEqual(resolvePaintChoice(circular, "mini", "self"), {
    paintIds: ["self", "red"],
    unavailablePaintIds: [],
    cycle: false,
    broken: false,
    brokenReason: null,
    substitutionIds: ["self"],
  });
  assert.equal(isPaintAvailable(circular, { self: owned }, "self"), false);
  assert.equal(isPaintAvailable(circular, { self: owned, red: owned }, "self"), true);
  assert.equal(isPaintAvailable(circular, { red: owned }, "self"), false);
  const parent = resolvePaintChoice(circular, "mini", "parent");
  assert.deepEqual(parent.paintIds, ["b"]);
  assert.equal(parent.cycle, true);
  assert.equal(parent.broken, false, "a valid ancestor is not itself a cycle member");
});

test("saved non-default recipes validate independently while nested defaults remain authoritative", () => {
  const recipes: SubstitutionData = {
    paintSubstitutions: [
      mix("active", "a"),
      mix("empty", "a", false),
      mix("inactive-cycle", "a", false),
      mix("nested", "b"),
      mix("inactive-nested", "b", false),
    ],
    paintSubstitutionIngredients: [
      ingredient("active", "red"),
      ingredient("inactive-cycle", "b"),
      ingredient("nested", "a"),
      ingredient("inactive-nested", "b"),
    ],
    miniaturePaintSubstitutions: [],
  };
  assert.equal(resolveSubstitution(recipes, "empty")?.broken, true);
  assert.equal(resolveSubstitution(recipes, "inactive-cycle")?.broken, true);
  assert.equal(resolveSubstitution(recipes, "inactive-nested")?.broken, false, "direct self is physical");
  assert.equal(resolveSubstitution(recipes, "missing"), null);
  assert.equal(resolvePaintChoice(recipes, "mini", "a").broken, false);
  assert.deepEqual(resolvePaintChoice(recipes, "mini", "a").paintIds, ["red"]);
  assert.equal(isPaintAvailable(recipes, { red: owned }, "a"), true);
  assert.equal(isPaintAvailable(recipes, { a: owned }, "a"), false);
  const onlyInactive = {
    ...recipes,
    paintSubstitutions: recipes.paintSubstitutions.map((row) => ({ ...row, isDefault: false })),
  };
  assert.equal(resolvePaintChoice(onlyInactive, "mini", "a").broken, false);
  assert.deepEqual(resolvePaintChoice(onlyInactive, "mini", "a").paintIds, ["a"]);
  assert.equal(isPaintAvailable(onlyInactive, { a: owned }, "a"), true);
});

test("owner diagnostics discover all cycle members even when resolution cuts another cycle short", () => {
  const graph: SubstitutionData = {
    paintSubstitutions: ["a", "b", "c", "d", "parent"].map((id) => mix(id, id)),
    paintSubstitutionIngredients: [
      ingredient("a", "b"),
      ingredient("b", "c"),
      ingredient("c", "b"),
      ingredient("c", "d", 1),
      ingredient("d", "a"),
      ingredient("parent", "a"),
    ],
    miniaturePaintSubstitutions: [],
  };
  for (const id of ["a", "b", "c", "d"]) {
    assert.equal(resolvePaintChoice(graph, "mini", id).broken, true, id);
  }
  assert.equal(resolvePaintChoice(graph, "mini", "parent").broken, false);
});

test("nested direct-self ingredients use physical stock without recursing or hiding longer loops", () => {
  const snapshot: SubstitutionData = {
    paintSubstitutions: [mix("a", "a"), mix("b", "b")],
    paintSubstitutionIngredients: [ingredient("a", "a"), ingredient("a", "white", 1), ingredient("b", "a")],
    miniaturePaintSubstitutions: [],
  };
  const resolver = createPaintChoiceResolver(snapshot);
  assert.deepEqual(resolver("b").paintIds, ["a", "white"]);
  assert.deepEqual(resolver("b").unavailablePaintIds, []);
  assert.equal(resolver("a").brokenReason, null);
  assert.equal(isPaintAvailable(snapshot, { a: owned, white: owned }, "b"), true);
  assert.equal(isPaintAvailable(snapshot, { b: owned, white: owned }, "b"), false);
  const longerLoop = {
    ...snapshot,
    paintSubstitutionIngredients: [...snapshot.paintSubstitutionIngredients, ingredient("a", "b", 2)],
  };
  assert.equal(resolvePaintChoice(longerLoop, "mini", "a").brokenReason, "cycle");
  assert.equal(isPaintAvailable(longerLoop, { a: owned, b: owned, white: owned }, "a"), false);
});
