import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { build } from "esbuild";

// Exercise the real Library/Schemes availability rule, miniature readiness and Wishlist
// associations against the same snapshots. No database or user's vault is opened.
const bundled = await build({
  stdin: {
    contents: `
      export * from "@paint-vault/core/paint-substitutions";
      export { readiness, createHomeDerivations } from "../Pages/home.utils.ts";
      export { resolvedPaintIds, missingProjectPaintIds } from "./vault-data.ts";
      export { shoppingRows, missingShoppingPaints } from "./semantic-contract.ts";
      export { emptyState } from "./constants.ts";
    `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  isPaintAvailable,
  resolvePaintChoice,
  resolveSubstitution,
  readiness,
  createHomeDerivations,
  resolvedPaintIds,
  missingProjectPaintIds,
  shoppingRows,
  missingShoppingPaints,
  emptyState,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const owned = { state: "OWNED", stockLevel: "LOW", quantity: 1 };
const wish = { state: "WISHLIST", stockLevel: "FULL", quantity: 0 };
const mix = (id, targetPaintId, isDefault = true) => ({ id, targetPaintId, name: id, isDefault });
const ingredient = (substitutionId, paintId, sortOrder = 0) => ({
  substitutionId,
  paintId,
  parts: 3,
  sortOrder,
});
function fixture(paintSubstitutions, paintSubstitutionIngredients, paintRecords = {}) {
  return {
    ...structuredClone(emptyState),
    catalog: ["a", "b", "c", "red"].map((id) => ({
      id,
      name: id,
      brand: "Test",
      range: "Base",
      colorHex: null,
      sourceUrl: null,
      isCustom: false,
    })),
    miniatures: ["OWNED", "WISHLIST"].map((status, index) => ({
      id: `m${index}`,
      title: status,
      status,
      paintingStatus: "NOT_STARTED",
      notes: "",
      manufacturer: "",
      faction: "",
      scale: "",
      imageUrl: null,
      createdAt: index,
    })),
    requirements: [
      { id: "r0", miniatureId: "m0", paintId: "a", sortOrder: 0, notes: "first", step: "OTHER" },
      { id: "r1", miniatureId: "m0", paintId: "a", sortOrder: 1, notes: "repeat", step: "OTHER" },
      { id: "r2", miniatureId: "m1", paintId: "a", sortOrder: 0, notes: "", step: "OTHER" },
    ],
    colorSchemes: [{ id: "s", name: "Scheme", category: null, isSystem: false, createdAt: 0, updatedAt: 0 }],
    colorSchemePaints: [{ schemeId: "s", paintId: "a", sortOrder: 0 }],
    miniatureColorSchemes: [{ miniatureId: "m0", schemeId: "s", sortOrder: 0 }],
    paintSubstitutions,
    paintSubstitutionIngredients,
    paintRecords,
  };
}

function assertConsumers(data, expectedIds, missingIds, available) {
  // Library OWNED filtering and both scheme readiness consumers call this shared rule.
  assert.equal(isPaintAvailable(data, data.paintRecords, "a"), available);
  for (const miniatureId of ["m0", "m1"]) {
    assert.deepEqual(resolvedPaintIds(data, miniatureId), expectedIds);
    const result = readiness(data, miniatureId);
    assert.equal(result.total, expectedIds.length);
    assert.equal(result.missing, missingIds.length);
  }
  assert.deepEqual([...missingProjectPaintIds(data)], missingIds);
  assert.equal(createHomeDerivations()(data, false, "ALL", "ALL", "").ready, available ? 2 : 0);
  const listed = new Set(shoppingRows(data).map(({ paint }) => paint.id));
  assert.deepEqual(
    missingShoppingPaints(data).map(({ paint, projectCount }) => [paint.id, projectCount]),
    missingIds.filter((id) => !listed.has(id)).map((id) => [id, 2]),
  );
  for (const row of shoppingRows(data)) {
    assert.deepEqual(
      row.projects.map(({ id }) => id),
      missingIds.includes(row.paint.id) ? ["m0", "m1"] : [],
    );
  }
}

test("empty default is broken and ignored consistently; original physical ownership decides", () => {
  const base = fixture([mix("empty", "a")], []);
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, true);
  assert.equal(resolveSubstitution(base, "empty").broken, true);
  assertConsumers(base, ["a"], ["a"], false);
  assertConsumers({ ...base, paintRecords: { a: owned } }, ["a"], [], true);
  for (const record of [wish, { ...owned, quantity: 0 }, { ...owned, stockLevel: "EMPTY" }]) {
    assertConsumers({ ...base, paintRecords: { a: record } }, ["a"], ["a"], false);
  }
});

test("nested empty falls back only at that node; its valid parent still needs every ingredient", () => {
  const base = fixture(
    [mix("parent", "a"), mix("empty", "b")],
    [ingredient("parent", "b"), ingredient("parent", "red", 1)],
  );
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, false);
  assert.equal(resolvePaintChoice(base, "m0", "b").broken, true);
  assertConsumers({ ...base, paintRecords: { a: owned } }, ["b", "red"], ["b", "red"], false);
  assertConsumers({ ...base, paintRecords: { b: owned, red: owned } }, ["b", "red"], [], true);
  assertConsumers({ ...base, paintRecords: { b: wish, red: owned } }, ["b", "red"], ["b"], false);
});

test("non-default empty recipes are visibly broken but never affect active requirements", () => {
  const base = fixture(
    [mix("valid", "a"), mix("inactive-empty", "a", false)],
    [ingredient("valid", "b"), ingredient("valid", "red", 1)],
  );
  assert.equal(resolveSubstitution(base, "inactive-empty").broken, true);
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, false);
  assertConsumers({ ...base, paintRecords: { a: owned } }, ["b", "red"], ["b", "red"], false);
  assertConsumers({ ...base, paintRecords: { b: owned, red: owned } }, ["b", "red"], [], true);
  const inactiveOnly = { ...base, paintSubstitutions: [mix("inactive-empty", "a", false)] };
  assert.equal(resolvePaintChoice(inactiveOnly, "m0", "a").broken, false);
  assertConsumers({ ...inactiveOnly, paintRecords: { a: owned } }, ["a"], [], true);
});

test("two- and three-paint cycles use the closing owner's original in every consumer", () => {
  for (const ids of [
    ["a", "b"],
    ["a", "b", "c"],
  ]) {
    const base = fixture(
      ids.map((id) => mix(id, id)),
      ids.map((id, index) => ingredient(id, ids[(index + 1) % ids.length])),
    );
    const closingOwner = ids.at(-1);
    assert.equal(resolvePaintChoice(base, "m0", "a").broken, true);
    assertConsumers({ ...base, paintRecords: { a: owned } }, [closingOwner], [closingOwner], false);
    assertConsumers({ ...base, paintRecords: { [closingOwner]: owned } }, [closingOwner], [], true);
    assertConsumers(
      { ...base, paintRecords: { a: wish, [closingOwner]: wish } },
      [closingOwner],
      [closingOwner],
      false,
    );
  }
});

test("cycle fallback ignores all ingredients of the closing step; ancestors are not marked broken", () => {
  const base = fixture(
    [mix("parent", "a"), mix("cycle-b", "b"), mix("cycle-c", "c")],
    [
      ingredient("parent", "b"),
      ingredient("cycle-b", "c"),
      ingredient("cycle-c", "b"),
      ingredient("cycle-c", "red", 1),
    ],
  );
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, false);
  assert.equal(resolvePaintChoice(base, "m0", "a").cycle, true);
  assert.equal(resolvePaintChoice(base, "m0", "b").broken, true);
  assert.equal(resolvePaintChoice(base, "m0", "c").broken, true);
  assertConsumers({ ...base, paintRecords: { c: owned } }, ["c"], [], true);
  assertConsumers({ ...base, paintRecords: { a: owned, b: owned, red: owned } }, ["c"], ["c"], false);
});

test("an inactive cycle is exposed in saved recipes but cannot change active readiness or shopping", () => {
  const base = fixture(
    [mix("valid", "a"), mix("inactive", "a", false), mix("nested", "b")],
    [ingredient("valid", "red"), ingredient("inactive", "b"), ingredient("nested", "a")],
  );
  assert.equal(resolveSubstitution(base, "inactive").broken, true);
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, false);
  assertConsumers({ ...base, paintRecords: { red: owned } }, ["red"], [], true);
  assertConsumers({ ...base, paintRecords: { a: owned, b: owned, red: wish } }, ["red"], ["red"], false);
});

test("miniatures without any manual or scheme requirements are not ready", () => {
  const data = { ...fixture([], []), requirements: [], miniatureColorSchemes: [] };
  for (const miniatureId of ["m0", "m1"]) {
    assert.deepEqual(readiness(data, miniatureId), { paints: [], total: 0, missing: 0 });
  }
  const result = createHomeDerivations()(data, false, "ALL", "ALL", "");
  assert.equal(result.ready, 0);
  assert.equal(result.pct, 0);
});
