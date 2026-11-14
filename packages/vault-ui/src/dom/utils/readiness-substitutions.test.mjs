import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { build } from "esbuild";

// Exercise the real Library/Schemes availability rule, miniature readiness and Wishlist
// associations against the same snapshots. No database or user's vault is opened.
const bundled = await build({
  stdin: {
    contents: `
      export * from "@paintwarden/core/paint-substitutions";
      export { readiness, createHomeDerivations } from "../Pages/home.utils.ts";
      export { resolvedPaintIds, missingProjectPaintIds, projectPaintIssues } from "./vault-data.ts";
      export { shoppingRows, missingShoppingPaints, retainedShoppingRows } from "./semantic-contract.ts";
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
  projectPaintIssues,
  shoppingRows,
  retainedShoppingRows,
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

function assertConsumers(data, expectedIds, missingIds, available, brokenIds = []) {
  // Library OWNED filtering and both scheme readiness consumers call this shared rule.
  assert.equal(isPaintAvailable(data, data.paintRecords, "a"), available);
  for (const miniatureId of ["m0", "m1"]) {
    assert.deepEqual(resolvedPaintIds(data, miniatureId), expectedIds);
    const result = readiness(data, miniatureId);
    assert.equal(result.total, expectedIds.length);
    assert.equal(result.missing, missingIds.length);
    const issues = projectPaintIssues(data, miniatureId);
    assert.deepEqual([...issues.keys()], missingIds);
    assert.deepEqual(
      [...issues].filter(([, reasons]) => reasons.has("brokenSubstitution")).map(([id]) => id),
      brokenIds,
    );
    for (const [id, reasons] of issues) {
      const record = data.paintRecords[id];
      const stockMissing = record?.state !== "OWNED" || record.quantity <= 0 || record.stockLevel === "EMPTY";
      assert.equal(reasons.has("missingStock"), stockMissing, id);
    }
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

test("empty default is unavailable in every consumer even if its original is owned", () => {
  const base = fixture([mix("empty", "a")], []);
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, true);
  assert.equal(resolveSubstitution(base, "empty").broken, true);
  assertConsumers(base, ["a"], ["a"], false, ["a"]);
  assertConsumers({ ...base, paintRecords: { a: owned } }, ["a"], ["a"], false, ["a"]);
  for (const record of [wish, { ...owned, quantity: 0 }, { ...owned, stockLevel: "EMPTY" }]) {
    assertConsumers({ ...base, paintRecords: { a: record } }, ["a"], ["a"], false, ["a"]);
  }
});

test("nested empty blocks its otherwise valid parent despite owning every original and ingredient", () => {
  const base = fixture(
    [mix("parent", "a"), mix("empty", "b")],
    [ingredient("parent", "b"), ingredient("parent", "red", 1)],
  );
  assert.equal(resolvePaintChoice(base, "m0", "a").broken, false);
  assert.equal(resolvePaintChoice(base, "m0", "b").broken, true);
  assertConsumers({ ...base, paintRecords: { a: owned } }, ["b", "red"], ["b", "red"], false, ["b"]);
  assertConsumers({ ...base, paintRecords: { a: owned, b: owned, red: owned } }, ["b", "red"], ["b"], false, [
    "b",
  ]);
  assertConsumers({ ...base, paintRecords: { b: wish, red: owned } }, ["b", "red"], ["b"], false, ["b"]);
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

test("two- and three-paint cycles block the closing owner in every consumer regardless of stock", () => {
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
    assertConsumers({ ...base, paintRecords: { a: owned } }, [closingOwner], [closingOwner], false, [
      closingOwner,
    ]);
    assertConsumers(
      { ...base, paintRecords: { [closingOwner]: owned } },
      [closingOwner],
      [closingOwner],
      false,
      [closingOwner],
    );
    assertConsumers(
      { ...base, paintRecords: { a: wish, [closingOwner]: wish } },
      [closingOwner],
      [closingOwner],
      false,
      [closingOwner],
    );
  }
});

test("cycle block ignores all ingredients of the closing step; ancestors are not marked broken", () => {
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
  assertConsumers({ ...base, paintRecords: { c: owned } }, ["c"], ["c"], false, ["c"]);
  assertConsumers({ ...base, paintRecords: { a: owned, b: owned, red: owned } }, ["c"], ["c"], false, ["c"]);
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

test("a direct-self ingredient uses physical stock, including when reached by another default", () => {
  const base = fixture(
    [mix("active-a", "a"), mix("active-b", "b")],
    [ingredient("active-a", "b"), ingredient("active-b", "b"), ingredient("active-b", "red", 1)],
  );
  assert.equal(resolvePaintChoice(base, "m0", "b").broken, false);
  assertConsumers({ ...base, paintRecords: { a: owned, b: owned, red: owned } }, ["b", "red"], [], true);
  assertConsumers({ ...base, paintRecords: { a: owned, red: owned } }, ["b", "red"], ["b"], false);
});

test("broken substitution and missing stock remain separate reasons; neither auto-adds a shopping row", () => {
  const base = fixture([mix("empty", "a")], []);
  const ownedBroken = { ...base, paintRecords: { a: owned } };
  assert.deepEqual([...projectPaintIssues(ownedBroken, "m0").get("a")], ["brokenSubstitution"]);
  assert.deepEqual(shoppingRows(ownedBroken), [], "owned broken paint is not automatically shopping");
  assert.deepEqual(
    missingShoppingPaints(ownedBroken).map(({ paint, projectCount, reasons }) => [
      paint.id,
      projectCount,
      reasons,
    ]),
    [["a", 2, ["brokenSubstitution"]]],
  );
  assert.deepEqual([...projectPaintIssues(base, "m0").get("a")], ["missingStock", "brokenSubstitution"]);
  assert.deepEqual(shoppingRows(base), [], "missing stock is not automatically explicit wishlist");
  assert.deepEqual(missingShoppingPaints(base)[0].reasons, ["missingStock", "brokenSubstitution"]);
  for (const record of [wish, { ...owned, quantity: 0 }, { ...owned, stockLevel: "EMPTY" }]) {
    const listed = { ...base, paintRecords: { a: record } };
    assert.deepEqual(missingShoppingPaints(listed), [], "listed rows stay out of missing-not-listed");
    const [row] = shoppingRows(listed);
    assert.equal(row.paint.id, "a");
    assert.deepEqual(row.reasons, ["missingStock", "brokenSubstitution"]);
    assert.deepEqual(
      row.projects.map(({ id }) => id),
      ["m0", "m1"],
    );
    assert.equal(readiness(listed, "m0").missing, 1, "two reasons count as one unavailable requirement");
  }
});

test("retained just-bought rows refresh independent stock and broken reasons after purchase and repair", () => {
  const listed = fixture([mix("empty", "a")], [], { a: wish });
  const [row] = shoppingRows(listed);
  const retained = new Map([["a", row]]);
  const bought = { ...listed, paintRecords: { a: owned } };
  const [stillBroken] = retainedShoppingRows(shoppingRows(bought), retained, bought.paintRecords, bought);
  assert.deepEqual(stillBroken.reasons, ["brokenSubstitution"]);
  const fixed = { ...bought, paintSubstitutions: [] };
  const [ready] = retainedShoppingRows(shoppingRows(fixed), retained, fixed.paintRecords, fixed);
  assert.deepEqual(ready.reasons, []);
  assert.equal(ready.paint.id, "a", "quantity editing row stays until leaving");
});
