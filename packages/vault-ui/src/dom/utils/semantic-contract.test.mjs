import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

// Bundle real screen/core exports, not copies of their algorithms. Node's native
// TS loader alone cannot resolve the UI's extensionless imports.
const bundle = await build({
  stdin: {
    contents: `
      export * from "./semantic-contract.ts";
      export * from "./vault-data.ts";
      export * from "./recipe-merge.ts";
      export { schemeOrderEntries } from "./scheme-order.ts";
      export { emptyState } from "./constants.ts";
      export { isPaintOwned } from "@paintwarden/core/paint-state";
      export { isPaintAvailable, resolvePaintChoice } from "@paintwarden/core/paint-substitutions";
      export { fuzzyFilter } from "@paintwarden/core/fuzzy-search";
    `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  shoppingRows,
  retainedShoppingRows,
  shoppingGroups,
  filterShoppingGroups,
  missingShoppingPaints,
  usedByMiniatures,
  libraryInventoryFilter,
  matchesLibraryInventory,
  schemePaintIdIndex,
  filteredSchemes,
  schemeCategoryCount,
  sortedSchemes,
  schemeCardSummary,
  effectiveRequirements,
  resolvedPaintIds,
  wishlistPaintIds,
  mergeRecipePaints,
  schemeOrderEntries,
  emptyState,
  isPaintOwned,
  isPaintAvailable,
  resolvePaintChoice,
  fuzzyFilter,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

const paint = (id, fields = {}) => ({
  id,
  name: id,
  brand: "Test",
  range: "Base",
  colorHex: null,
  sourceUrl: null,
  isCustom: false,
  ...fields,
});
const mini = (id, status = "OWNED") => ({
  id,
  title: id,
  status,
  notes: "",
  manufacturer: "",
  faction: "",
  scale: "",
  paintingStatus: "NOT_STARTED",
  imageUrl: null,
  createdAt: 0,
});
const scheme = (id, category = null, fields = {}) => ({
  id,
  name: id,
  category,
  isSystem: false,
  createdAt: 0,
  updatedAt: 0,
  ...fields,
});
const req = (miniatureId, paintId, sortOrder = 0, fields = {}) => ({
  id: `${miniatureId}:${paintId}:${sortOrder}`,
  miniatureId,
  paintId,
  step: "OTHER",
  notes: "",
  sortOrder,
  ...fields,
});
const owned = { state: "OWNED", stockLevel: "FULL", quantity: 1 };
const wish = { state: "WISHLIST", stockLevel: "FULL", quantity: 0 };
const ids = (rows) => rows.map((row) => row.id);
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const snapshot = (fields) => freeze({ ...structuredClone(emptyState), ...fields });

// §5 stock and Library contract. Broken/empty/cyclic substitutions are covered
// separately by the Q3 readiness suite, not frozen to their legacy discrepancy.
test("physical stock requires OWNED, positive quantity and a non-EMPTY bottle (LOW counts)", () => {
  for (const state of ["OWNED", "WISHLIST", null])
    for (const stock of ["FULL", "LOW", "EMPTY", null])
      for (const quantity of [-1, 0, 1, 9])
        assert.equal(
          isPaintOwned(state, stock, quantity),
          state === "OWNED" && stock !== "EMPTY" && quantity > 0,
          JSON.stringify({ state, stock, quantity }),
        );
});

test("Library OWNED is effective availability; WISHLIST is explicit, not depleted shopping", () => {
  const data = snapshot({
    catalog: ["via-mix", "overridden", "leaf", "depleted", "wish", "untracked"].map((id) => paint(id)),
    paintStates: { overridden: "OWNED", leaf: "OWNED", depleted: "OWNED", wish: "WISHLIST" },
    paintRecords: {
      overridden: owned,
      leaf: owned,
      depleted: { ...owned, stockLevel: "EMPTY" },
      wish,
    },
    paintSubstitutions: [
      { id: "mix", targetPaintId: "via-mix", name: "Mix", isDefault: true },
      { id: "override", targetPaintId: "overridden", name: "Override", isDefault: true },
    ],
    paintSubstitutionIngredients: [
      { substitutionId: "mix", paintId: "leaf", parts: 200, sortOrder: 0 },
      { substitutionId: "override", paintId: "untracked", parts: 1, sortOrder: 0 },
    ],
  });
  const available = new Set(
    data.catalog.filter((p) => isPaintAvailable(data, data.paintRecords, p.id)).map((p) => p.id),
  );
  const matching = (filter) =>
    ids(data.catalog.filter((p) => matchesLibraryInventory(data, available, p, filter)));
  assert.deepEqual(matching("OWNED"), ["via-mix", "leaf"]);
  assert.deepEqual(matching("WISHLIST"), ["wish"]);
  assert.deepEqual(matching("UNTRACKED"), ["overridden", "depleted", "untracked"]);
  assert.deepEqual([...wishlistPaintIds(data)].sort(), ["depleted", "wish"]);
  const explicitlyListedMix = snapshot({
    ...data,
    paintStates: { ...data.paintStates, "via-mix": "WISHLIST" },
  });
  assert.equal(matchesLibraryInventory(explicitlyListedMix, available, data.catalog[0], "WISHLIST"), true);
  assert.equal(matchesLibraryInventory(explicitlyListedMix, available, data.catalog[0], "UNTRACKED"), false);
  for (const filter of ["OWNED", "WISHLIST", "UNTRACKED"]) {
    assert.equal(libraryInventoryFilter("  ", filter), filter);
    assert.equal(libraryInventoryFilter("  typo search  ", filter), "ALL");
    assert.deepEqual(matching(libraryInventoryFilter("leaf", filter)), ids(data.catalog));
  }
});

function recipeSnapshot() {
  return snapshot({
    catalog: ["target", "leaf-a", "leaf-b", "scheme-only"].map((id) => paint(id)),
    miniatures: [mini("project")],
    requirements: [
      req("project", "target", 2, { step: "HIGHLIGHT", notes: "Edge carefully", id: "highlight" }),
      req("project", "leaf-a", 1, { step: "SHADE", notes: "Thin", id: "shade" }),
      req("project", "target", 0, { step: "BASECOAT", notes: "Two coats", id: "base" }),
    ],
    colorSchemes: [scheme("later"), scheme("first")],
    miniatureColorSchemes: [
      { miniatureId: "project", schemeId: "later", sortOrder: 1 },
      { miniatureId: "project", schemeId: "first", sortOrder: 0 },
    ],
    colorSchemePaints: [
      { schemeId: "later", paintId: "leaf-b", sortOrder: 0 },
      { schemeId: "first", paintId: "scheme-only", sortOrder: 3 },
      { schemeId: "first", paintId: "target", sortOrder: 1 },
      { schemeId: "first", paintId: "scheme-only", sortOrder: 2 },
    ],
    paintRecords: { "leaf-a": owned, "leaf-b": owned, "scheme-only": owned },
    paintSubstitutions: [
      { id: "default", targetPaintId: "target", name: "Global", isDefault: true },
      { id: "unused", targetPaintId: "target", name: "Old miniature choice", isDefault: false },
      { id: "nested", targetPaintId: "nested-target", name: "Nested", isDefault: true },
    ],
    paintSubstitutionIngredients: [
      { substitutionId: "default", paintId: "nested-target", parts: 100, sortOrder: 1 },
      { substitutionId: "default", paintId: "leaf-a", parts: 50, sortOrder: 0 },
      { substitutionId: "nested", paintId: "leaf-b", parts: 70, sortOrder: 0 },
      { substitutionId: "nested", paintId: "leaf-a", parts: 20, sortOrder: 1 },
      { substitutionId: "unused", paintId: "never-used", parts: 1, sortOrder: 0 },
    ],
    miniaturePaintSubstitutions: [
      { miniatureId: "project", targetPaintId: "target", substitutionId: "unused", useOriginal: true },
    ],
  });
}

test("requirements dedupe manual targets, append attached schemes in order, recursively dedupe default leaves", () => {
  const data = recipeSnapshot();
  assert.deepEqual(
    effectiveRequirements(data, "project").map((row) => row.paintId),
    ["target", "leaf-a", "scheme-only", "leaf-b"],
  );
  assert.deepEqual(resolvePaintChoice(data, "project", "target").paintIds, ["leaf-a", "leaf-b"]);
  assert.deepEqual(resolvedPaintIds(data, "project"), ["leaf-a", "leaf-b", "scheme-only"]);
  assert.equal(
    isPaintAvailable(data, data.paintRecords, "target"),
    true,
    "parts are ratios, not bottle demand",
  );
  assert.deepEqual(resolvedPaintIds(data, "unknown"), []);
});

test("editor rows retain repeated paints in different steps, original notes/order and original scheme targets", () => {
  const data = recipeSnapshot();
  const original = structuredClone(data.requirements);
  const manual = [...data.requirements].sort((a, b) => a.sortOrder - b.sortOrder);
  const rows = mergeRecipePaints(manual, []);
  assert.deepEqual(
    rows.map(({ paintId, step, manual: row }) => [paintId, step, row.id, row.notes, row.sortOrder]),
    [
      ["target", "BASECOAT", "base", "Two coats", 0],
      ["leaf-a", "SHADE", "shade", "Thin", 1],
      ["target", "HIGHLIGHT", "highlight", "Edge carefully", 2],
    ],
  );
  assert.deepEqual(
    schemeOrderEntries(data, "first").map((row) => [row.paintId, row.sortOrder]),
    [
      ["target", 1],
      ["scheme-only", 2],
      ["scheme-only", 3],
    ],
  );
  effectiveRequirements(data, "project");
  resolvedPaintIds(data, "project");
  assert.deepEqual(data.requirements, original, "derived deduplication must never rewrite editor rows");
});

function shoppingSnapshot() {
  return snapshot({
    catalog: [
      paint("z-many", { brand: "Zeta", name: "A" }),
      paint("a-few", { brand: "Alpha", name: "A" }),
      paint("a-many", { brand: "Alpha", name: "Z" }),
      paint("a-tie", { brand: "Alpha", name: "A" }),
      paint("custom", { brand: "AAA not its group", isCustom: true }),
      paint("missing-global"),
      paint("missing-shared"),
      paint("on-shelf"),
    ],
    miniatures: [mini("owned-project"), mini("wish-project", "WISHLIST")],
    paintRecords: {
      "z-many": { ...owned, stockLevel: "EMPTY" },
      "a-few": { ...owned, stockLevel: "LOW", quantity: 0 },
      "a-many": wish,
      "a-tie": wish,
      custom: wish,
      "on-shelf": { ...owned, stockLevel: "LOW" },
    },
    requirements: [
      ...["owned-project", "wish-project"].flatMap((id) => [
        req(id, "z-many"),
        req(id, "a-many"),
        req(id, "a-tie"),
        req(id, "missing-shared"),
        req(id, "on-shelf"),
      ]),
      req("owned-project", "a-few"),
      req("owned-project", "a-many", 1, { step: "HIGHLIGHT" }),
      req("wish-project", "missing-global"),
      req("wish-project", "absent-catalog"),
    ],
    colorSchemes: [scheme("shared")],
    colorSchemePaints: [{ schemeId: "shared", paintId: "a-many", sortOrder: 0 }],
    miniatureColorSchemes: [{ miniatureId: "owned-project", schemeId: "shared", sortOrder: 0 }],
  });
}

test("shopping includes explicit wishlist and both forms of depleted owned; associations use all miniatures once", () => {
  const data = shoppingSnapshot();
  const rows = shoppingRows(data);
  assert.deepEqual(
    new Set(rows.map(({ paint: p }) => p.id)),
    new Set(["z-many", "a-few", "a-many", "a-tie", "custom"]),
  );
  assert.deepEqual(ids(rows.find(({ paint: p }) => p.id === "a-many").projects), [
    "owned-project",
    "wish-project",
  ]);
  assert.equal(
    rows.find(({ paint: p }) => p.id === "custom").projects.length,
    0,
    "explicit listing needs no project",
  );
  assert.deepEqual(
    shoppingGroups(rows).map(([brand, items]) => [brand, items.map(({ paint: p }) => p.id)]),
    [
      ["Alpha", ["a-tie", "a-many", "a-few"]],
      ["Custom", ["custom"]],
      ["Zeta", ["z-many"]],
    ],
  );
});

test("missing-not-listed is global even when shopping groups are narrowed to one model", () => {
  const data = shoppingSnapshot();
  const groups = shoppingGroups(shoppingRows(data));
  const visible = filterShoppingGroups(groups, "owned-project");
  assert.equal(
    visible.some(([brand]) => brand === "Custom"),
    false,
  );
  assert.deepEqual(
    missingShoppingPaints(data).map(({ paint: p, projectCount }) => [p.id, projectCount]),
    [
      ["missing-shared", 2],
      ["missing-global", 1],
    ],
  );
  assert.equal(filterShoppingGroups(groups, "wish-project").length, 2);
  assert.deepEqual(filterShoppingGroups(groups, "unknown"), []);
  assert.deepEqual(filterShoppingGroups(groups, "ALL"), groups);
});

test("just-bought shopping rows stay editable without duplicates until the page's retained map is cleared", () => {
  const data = shoppingSnapshot();
  const oldRows = shoppingRows(data);
  const bought = oldRows.find(({ paint: p }) => p.id === "a-many");
  const next = snapshot({ ...data, paintRecords: { ...data.paintRecords, "a-many": owned } });
  const listed = shoppingRows(next);
  const retained = new Map([
    ["a-many", bought],
    ["a-tie", oldRows.find(({ paint: p }) => p.id === "a-tie")],
  ]);
  const rows = retainedShoppingRows(listed, retained, next.paintRecords);
  assert.equal(rows.filter(({ paint: p }) => p.id === "a-many").length, 1);
  assert.equal(rows.filter(({ paint: p }) => p.id === "a-tie").length, 1);
  assert.equal(
    retainedShoppingRows(listed, new Map(), next.paintRecords).some(({ paint: p }) => p.id === "a-many"),
    false,
  );
  assert.equal(retainedShoppingRows([], new Map([["a-many", bought]]), {}).length, 0);
});

test("paint detail used-by means original effective target usage, not transitive mix ingredients", () => {
  const data = recipeSnapshot();
  assert.deepEqual(ids(usedByMiniatures(data, "target")), ["project"]);
  assert.deepEqual(ids(usedByMiniatures(data, "scheme-only")), ["project"]);
  assert.deepEqual(
    ids(usedByMiniatures(data, "leaf-b")),
    ["project"],
    "direct attached-scheme target counts",
  );
  const noDirectLeaf = snapshot({
    ...data,
    colorSchemePaints: data.colorSchemePaints.filter((p) => p.paintId !== "leaf-b"),
  });
  assert.deepEqual(ids(usedByMiniatures(noDirectLeaf, "leaf-b")), []);
  assert.deepEqual(ids(usedByMiniatures(data, "nested-target")), []);
});

function schemesSnapshot() {
  return snapshot({
    colorSchemes: [
      scheme("red-both", "RED", { name: "Shared Red", sourceName: "Source A" }),
      scheme("red-one", "RED", { name: "Shared One", sourceName: "Source A" }),
      scheme("red-other-source", "RED", { name: "Other Red", sourceName: "Source B" }),
      scheme("blue-both", "BLUE", { name: "Shared Blue", sourceName: "Source A" }),
      scheme("no-category", null, { name: "Shared", sourceName: "Source A" }),
    ],
    colorSchemePaints: [
      ...["red-both", "red-other-source", "blue-both", "no-category"].flatMap((id) => [
        { schemeId: id, paintId: "target", sortOrder: 0 },
        { schemeId: id, paintId: "second", sortOrder: 1 },
      ]),
      { schemeId: "red-one", paintId: "target", sortOrder: 0 },
      { schemeId: "red-one", paintId: "target", sortOrder: 1 },
    ],
    paintSubstitutions: [{ id: "mix", targetPaintId: "target", name: "Mix", isDefault: true }],
    paintSubstitutionIngredients: [{ substitutionId: "mix", paintId: "leaf", parts: 1, sortOrder: 0 }],
  });
}

test("scheme uses-paints is AND over distinct original targets, not resolved leaves", () => {
  const data = schemesSnapshot();
  const index = schemePaintIdIndex(data);
  const find = (paints) => ids(filteredSchemes(data, "ALL", () => true, paints, index, "ALL", new Set()));
  assert.equal(index.get("red-one").size, 1);
  assert.deepEqual(find(["target", "second"]), ["red-both", "red-other-source", "blue-both", "no-category"]);
  assert.equal(find(["target"]).includes("red-one"), true);
  assert.deepEqual(find(["leaf"]), []);
  assert.deepEqual(find(["target", "unknown"]), []);
});

test("scheme readiness facets ignore search but respect category/source/selected paints; category counts stay global", () => {
  const data = schemesSnapshot();
  const index = schemePaintIdIndex(data);
  const readyIds = new Set(["red-both", "red-one", "blue-both"]);
  const fromA = (s) => s.sourceName === "Source A";
  const candidates = (value) =>
    filteredSchemes(data, "RED", fromA, ["target", "second"], index, value, readyIds);
  assert.deepEqual(ids(candidates("ALL")), ["red-both"]);
  assert.deepEqual(ids(candidates("READY")), ["red-both"]);
  assert.deepEqual(ids(candidates("MISSING")), []);
  assert.deepEqual(ids(filteredSchemes(data, "RED", () => true, ["target"], index, "MISSING", readyIds)), [
    "red-other-source",
  ]);
  assert.equal(filteredSchemes(data, "ALL", fromA, ["target"], index, "READY", readyIds).length, 3);
  assert.deepEqual(
    fuzzyFilter(candidates("ALL"), "nothingmatches", (s) => s.name),
    [],
  );
  assert.equal(candidates("READY").length, 1, "search cannot change the facet population");
  assert.equal(schemeCategoryCount(data, "RED"), 3, "global even with source/paint/readiness filters");
  assert.equal(schemeCategoryCount(data, "BLUE"), 1);
  assert.equal(schemeCategoryCount(data, "GREEN"), 0);
});

test("scheme display order is category label then name, uncategorized last, even after fuzzy ranking", () => {
  const data = schemesSnapshot();
  for (const query of ["Shared", "Shred"]) {
    const matches = fuzzyFilter(data.colorSchemes, query, (s) => s.name);
    assert.notEqual(matches[0].id, "blue-both", "search order differs from category display order");
    assert.deepEqual(ids(sortedSchemes(matches)), ["blue-both", "red-one", "red-both", "no-category"]);
  }
  assert.deepEqual(ids(data.colorSchemes), [
    "red-both",
    "red-one",
    "red-other-source",
    "blue-both",
    "no-category",
  ]);
});

test("scheme cards use last sortOrder image with thumbnail preference and preserve complete ordered names/gradient", () => {
  const paints = Array.from({ length: 24 }, (_, i) =>
    paint(`paint-${i}`, { colorHex: i % 2 ? "#ffffff" : "#000000" }),
  );
  const image = (id, sortOrder, thumbnailUrl) => ({
    id,
    schemeId: "s",
    sortOrder,
    thumbnailUrl,
    imageUrl: `${id}.png`,
    imageType: null,
    method: null,
  });
  const data = snapshot({
    catalog: paints,
    colorSchemePaints: paints.map((p, sortOrder) => ({ schemeId: "s", paintId: p.id, sortOrder })).reverse(),
    colorSchemeImages: [
      image("last", 20, "last-thumb.png"),
      image("first", 1, "first-thumb.png"),
      { ...image("other", 100, null), schemeId: "other" },
    ],
    miniatureColorSchemes: [
      { miniatureId: "one", schemeId: "s", sortOrder: 0 },
      { miniatureId: "two", schemeId: "s", sortOrder: 0 },
    ],
  });
  const summary = schemeCardSummary(data, "s");
  assert.equal(summary.preview.id, "last");
  assert.equal(summary.previewUrl, "last-thumb.png");
  assert.equal(summary.uses, 2);
  assert.equal(summary.paintNames, paints.map((p) => p.name).join(" · "));
  assert.equal(
    summary.gradient,
    `linear-gradient(135deg, ${paints.map((p, i) => `${p.colorHex} ${(i / 23) * 100}%`).join(", ")})`,
  );
  const withoutThumb = snapshot({ ...data, colorSchemeImages: [image("full", 0, null)] });
  assert.equal(schemeCardSummary(withoutThumb, "s").previewUrl, "full.png");
  const empty = schemeCardSummary(data, "absent");
  assert.equal(empty.preview, undefined);
  assert.equal(empty.previewUrl, undefined);
  assert.equal(empty.gradient, undefined);
  assert.equal(empty.paintNames, "");
});
