import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { build } from "esbuild";

// Bundle the real helpers: plain Node cannot resolve their extensionless imports.
const bundled = await build({
  stdin: {
    contents: `
      export * from "../Pages/home.utils.ts";
      export * from "./vault-data.ts";
      export { emptyState } from "./constants.ts";
      export { resolvePaintChoice } from "@paint-vault/core/paint-substitutions";
      export { fuzzyFilter } from "@paint-vault/core/fuzzy-search";
    `,
    resolveDir: fileURLToPath(new URL(".", import.meta.url)),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const {
  createHomeDerivations,
  attachedSchemes,
  effectiveRequirements,
  resolvedPaintIds,
  missingProjectPaintIds,
  readiness,
  sortedProjects,
  emptyState,
  resolvePaintChoice,
  fuzzyFilter,
} = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const paint = (id) => ({
  id,
  brand: "Test",
  range: "Base",
  name: id,
  colorHex: null,
  sourceUrl: null,
  isCustom: false,
});
const mini = (id, title, createdAt, status = "OWNED", paintingStatus = "NOT_STARTED") => ({
  id,
  title,
  createdAt,
  status,
  paintingStatus,
  notes: "",
  manufacturer: "Forge",
  faction: "Solar",
  scale: "28mm",
  imageUrl: null,
});
const req = (id, miniatureId, paintId, sortOrder = 0) => ({
  id,
  miniatureId,
  paintId,
  sortOrder,
  notes: id,
  step: "OTHER",
});
const owned = { state: "OWNED", stockLevel: "FULL", quantity: 1 };
const wish = { state: "WISHLIST", stockLevel: "FULL", quantity: 0 };
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function fixture() {
  return freeze({
    ...structuredClone(emptyState),
    catalog: ["red", "blue", "green", "empty"].map(paint),
    miniatures: [
      mini("z", "Zulu", 10),
      mini("a", "Alpha", 10, "OWNED", "PRIMED"),
      mini("w", "Wish", 20, "WISHLIST", "COMPLETE"),
      { ...mini("n", "No recipe", 1), notes: "Weathered armor" },
    ],
    paintRecords: {
      red: { ...owned },
      blue: { ...wish },
      green: { ...owned },
      empty: { ...owned, stockLevel: "EMPTY" },
    },
    requirements: [
      req("late", "z", "red", 4),
      req("first", "z", "red", 0),
      req("blue", "z", "blue", 2),
      req("gone", "z", "absent", 5),
      req("a", "a", "green"),
      req("w", "w", "empty"),
    ],
    colorSchemes: [
      { id: "s1", name: "First", category: null, isSystem: false, createdAt: 1, updatedAt: 1 },
      { id: "s2", name: "Second", category: null, isSystem: false, createdAt: 1, updatedAt: 1 },
    ],
    miniatureColorSchemes: [
      { miniatureId: "z", schemeId: "s2", sortOrder: 2 },
      { miniatureId: "z", schemeId: "deleted", sortOrder: 0 },
      { miniatureId: "z", schemeId: "s1", sortOrder: 1 },
    ],
    colorSchemePaints: [
      { schemeId: "s1", paintId: "green", sortOrder: 2 },
      { schemeId: "s1", paintId: "red", sortOrder: 1 },
      { schemeId: "s2", paintId: "empty", sortOrder: 1 },
      { schemeId: "s2", paintId: "green", sortOrder: 0 },
    ],
  });
}
const ids = (projects) => projects.map(({ mini }) => mini.id);
const derive = (select, data, overrides = {}) => {
  const { workbench = false, filter = "ALL", stageFilter = "ALL", q = "" } = overrides;
  return select(data, workbench, filter, stageFilter, q);
};

// Independent reference retaining the pre-indexing merge/order and core resolver semantics.
function referenceRequirements(data, miniatureId) {
  const manual = data.requirements
    .filter((r) => r.miniatureId === miniatureId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const unique = new Map(manual.map((r) => [r.paintId, r]));
  for (const link of data.miniatureColorSchemes
    .filter((r) => r.miniatureId === miniatureId)
    .sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!data.colorSchemes.some((s) => s.id === link.schemeId)) continue;
    for (const row of data.colorSchemePaints
      .filter((r) => r.schemeId === link.schemeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!unique.has(row.paintId))
        unique.set(row.paintId, {
          id: `scheme:${row.paintId}`,
          miniatureId,
          paintId: row.paintId,
          notes: "",
          sortOrder: unique.size,
          step: "OTHER",
        });
    }
  }
  return [...unique.values()];
}
const referenceIds = (data, id) => [
  ...new Set(
    referenceRequirements(data, id).flatMap((r) => resolvePaintChoice(data, id, r.paintId).paintIds),
  ),
];
const isOwned = (record) => record?.state === "OWNED" && record.stockLevel !== "EMPTY" && record.quantity > 0;
function referenceProjects(data) {
  return data.miniatures
    .map((mini) => {
      const paintIds = referenceIds(data, mini.id);
      const unavailable = new Set(
        referenceRequirements(data, mini.id).flatMap(
          (row) => resolvePaintChoice(data, mini.id, row.paintId).unavailablePaintIds,
        ),
      );
      return {
        mini,
        paints: paintIds.map((id) => data.catalog.find((p) => p.id === id)).filter(Boolean),
        total: paintIds.length,
        missing: paintIds.filter((id) => unavailable.has(id) || !isOwned(data.paintRecords[id])).length,
      };
    })
    .sort((a, b) => b.mini.createdAt - a.mini.createdAt || a.mini.title.localeCompare(b.mini.title));
}

test("indexed helpers preserve manual duplicates, missing IDs, scheme order and readiness", () => {
  const data = fixture();
  assert.deepEqual(
    attachedSchemes(data, "z").map((s) => s.id),
    ["s1", "s2"],
  );
  assert.deepEqual(effectiveRequirements(data, "z"), referenceRequirements(data, "z"));
  assert.equal(
    effectiveRequirements(data, "z")[0].id,
    "late",
    "last duplicate wins without moving first insertion",
  );
  assert.deepEqual(resolvedPaintIds(data, "z"), ["red", "blue", "absent", "green", "empty"]);
  assert.deepEqual(readiness(data, "z"), {
    paints: ["red", "blue", "green", "empty"].map((id) => data.catalog.find((p) => p.id === id)),
    total: 5,
    missing: 3,
  });
  assert.deepEqual(sortedProjects(data), referenceProjects(data));
  assert.deepEqual([...missingProjectPaintIds(data, "OWNED")], ["blue", "absent", "empty"]);
  assert.deepEqual(effectiveRequirements(data, "unknown"), []);
});

test("same snapshot and view inputs retain every derived identity across viewport-only renders", () => {
  const data = fixture();
  const select = createHomeDerivations();
  const before = JSON.stringify(data);
  const first = derive(select, data);
  for (const scrollY of [0, 300, 900, 1500]) {
    assert.ok(scrollY >= 0); // Viewport changes do not enter the selector's arguments.
    const next = derive(select, data);
    assert.strictEqual(next, first);
    for (const key of [
      "projects",
      "pageProjects",
      "visibleProjects",
      "shelfItems",
      "statusCounts",
      "stageCounts",
    ])
      assert.strictEqual(next[key], first[key], key);
  }
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(first.projects, referenceProjects(data));
});

test("filter, stage, search and dashboard changes invalidate the view but retain project derivations", () => {
  const data = fixture();
  const select = createHomeDerivations();
  let previous = derive(select, data);
  for (const options of [
    { filter: "OWNED" },
    { filter: "WISHLIST" },
    { workbench: true },
    { workbench: true, stageFilter: "PRIMED" },
    { q: "Zulu" },
  ]) {
    const next = derive(select, data, options);
    assert.notStrictEqual(next, previous);
    assert.strictEqual(next.projects, previous.projects);
    assert.strictEqual(derive(select, data, options), next);
    previous = next;
  }
});

test("collection and workbench counts ignore search and filters, with shelf placeholder only without query", () => {
  const data = fixture();
  const select = createHomeDerivations();
  const all = derive(select, data);
  assert.deepEqual(ids(all.projects), ["w", "a", "z", "n"]);
  assert.equal(all.shelfItems[0], null);
  assert.deepEqual(all.shelfItems.slice(1), all.visibleProjects);
  assert.deepEqual(all.statusCounts, { ALL: 4, OWNED: 3, WISHLIST: 1 });
  assert.equal(all.ready, 1);
  assert.equal(all.pct, 25);
  assert.equal(all.missingProjectPaints, 3);
  assert.equal(all.wishlistedMissingPaints, 2);
  assert.deepEqual(ids(derive(select, data, { filter: "WISHLIST" }).visibleProjects), ["w"]);
  const bench = derive(select, data, {
    workbench: true,
    filter: "WISHLIST",
    stageFilter: "PRIMED",
    q: "Alpha",
  });
  assert.deepEqual(ids(bench.pageProjects), ["a", "z", "n"]);
  assert.deepEqual(ids(bench.visibleProjects), ["a"]);
  assert.deepEqual(bench.shelfItems, bench.visibleProjects);
  assert.equal(bench.stageCounts.ALL, 3);
  assert.equal(bench.stageCounts.PRIMED, 1);
  assert.equal(bench.stageCounts.NOT_STARTED, 2);
  assert.equal(bench.stageCounts.COMPLETE, 0);
  assert.equal(bench.ready, 1);
  assert.equal(bench.pct, (1 / 3) * 100);
  assert.deepEqual(bench.statusCounts, all.statusCounts);
  const noMatch = derive(select, data, { q: "zzzzzzzzzzzzzz" });
  assert.deepEqual(noMatch.shelfItems, []);
});

test("search retains fuzzy ranking and all searchable miniature fields", () => {
  const data = fixture();
  const select = createHomeDerivations();
  for (const q of ["Zlu", "Forge", "Solar", "28mm", "PRIMED", "Alpha", "Weathered"]) {
    const expected = fuzzyFilter(
      referenceProjects(data),
      q,
      ({ mini }) =>
        `${mini.title} ${mini.notes} ${mini.manufacturer} ${mini.faction} ${mini.scale} ${mini.paintingStatus}`,
    );
    assert.deepEqual(derive(select, data, { q }).visibleProjects, expected, q);
  }
});

test("empty state yields finite zero readiness, complete counts and an add tile", () => {
  const result = derive(createHomeDerivations(), freeze(structuredClone(emptyState)), { workbench: true });
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.shelfItems, [null]);
  assert.equal(result.ready, 0);
  assert.equal(result.pct, 0);
  assert.equal(result.missingProjectPaints, 0);
  assert.equal(result.wishlistedMissingPaints, 0);
  assert.deepEqual(result.statusCounts, { ALL: 0, OWNED: 0, WISHLIST: 0 });
  for (const stage of ["ALL", "NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"])
    assert.equal(result.stageCounts[stage], 0);
});

test("nested defaults and cycles match core resolution; legacy per-miniature choices are ignored", () => {
  const base = fixture();
  const data = freeze({
    ...base,
    paintSubstitutions: [
      { id: "red-mix", targetPaintId: "red", name: "Red", isDefault: true },
      { id: "blue-mix", targetPaintId: "blue", name: "Blue", isDefault: true },
      { id: "legacy", targetPaintId: "red", name: "Legacy", isDefault: false },
    ],
    paintSubstitutionIngredients: [
      { substitutionId: "red-mix", paintId: "blue", parts: 1, sortOrder: 0 },
      { substitutionId: "red-mix", paintId: "green", parts: 1, sortOrder: 1 },
      { substitutionId: "blue-mix", paintId: "red", parts: 1, sortOrder: 0 },
      { substitutionId: "blue-mix", paintId: "empty", parts: 1, sortOrder: 1 },
      { substitutionId: "legacy", paintId: "absent", parts: 1, sortOrder: 0 },
    ],
    miniaturePaintSubstitutions: [
      { miniatureId: "z", targetPaintId: "red", substitutionId: "legacy", useOriginal: true },
    ],
  });
  assert.equal(resolvePaintChoice(data, "z", "red").cycle, true);
  assert.deepEqual(resolvePaintChoice(data, "z", "red").paintIds, ["blue", "green"]);
  for (const m of data.miniatures) assert.deepEqual(resolvedPaintIds(data, m.id), referenceIds(data, m.id));
  assert.deepEqual(derive(createHomeDerivations(), data).projects, referenceProjects(data));
  const noIngredients = freeze({ ...data, paintSubstitutionIngredients: [] });
  assert.deepEqual(resolvedPaintIds(noIngredients, "z"), referenceIds(noIngredients, "z"));
});

test("every immutable data dependency invalidates cached derivations and matches uncached semantics", () => {
  const base = fixture();
  const variants = {
    requirements: { requirements: [...base.requirements, req("extra", "a", "blue", 1)] },
    schemes: { colorSchemes: base.colorSchemes.filter((s) => s.id !== "s2") },
    links: { miniatureColorSchemes: [] },
    schemePaints: {
      colorSchemePaints: [
        ...base.colorSchemePaints,
        { schemeId: "s1", paintId: "new-missing", sortOrder: 7 },
      ],
    },
    catalog: { catalog: [...base.catalog, paint("absent")] },
    records: { paintRecords: { ...base.paintRecords, blue: { ...owned } } },
    substitutions: {
      paintSubstitutions: [{ id: "new", targetPaintId: "red", name: "Mix", isDefault: true }],
      paintSubstitutionIngredients: [{ substitutionId: "new", paintId: "blue", parts: 1, sortOrder: 0 }],
    },
    ingredients: {
      paintSubstitutionIngredients: [{ substitutionId: "unused", paintId: "blue", parts: 1, sortOrder: 0 }],
    },
    legacy: {
      miniaturePaintSubstitutions: [
        { miniatureId: "z", targetPaintId: "red", substitutionId: null, useOriginal: true },
      ],
    },
    miniatures: {
      miniatures: base.miniatures.map((m) => (m.id === "z" ? { ...m, createdAt: 100, title: "Renamed" } : m)),
    },
  };
  for (const [name, patch] of Object.entries(variants)) {
    const select = createHomeDerivations();
    const first = derive(select, base);
    const changed = freeze({ ...base, ...patch });
    const next = derive(select, changed);
    assert.notStrictEqual(next, first, name);
    assert.deepEqual(next.projects, referenceProjects(changed), name);
    assert.deepEqual(next, derive(createHomeDerivations(), changed), name);
    assert.strictEqual(derive(select, changed), next, name);
    assert.deepEqual(derive(select, base).projects, first.projects, `${name}: reverting snapshot`);
  }
  // Specifically exercise ingredients changing while the default substitution is unchanged.
  const mixed = freeze({ ...base, ...variants.substitutions });
  const select = createHomeDerivations();
  const first = derive(select, mixed);
  const changed = freeze({
    ...mixed,
    paintSubstitutionIngredients: [{ substitutionId: "new", paintId: "green", parts: 2, sortOrder: 0 }],
  });
  const next = derive(select, changed);
  assert.notDeepEqual(next.projects, first.projects);
  assert.deepEqual(next.projects, referenceProjects(changed));
});

test("EMPTY stock and zero quantity stay missing even when marked OWNED", () => {
  const base = fixture();
  const select = createHomeDerivations();
  for (const record of [
    { ...owned, stockLevel: "EMPTY", quantity: 3 },
    { ...owned, quantity: 0 },
    { ...owned, stockLevel: "LOW", quantity: 2 },
  ]) {
    const data = freeze({ ...base, paintRecords: { ...base.paintRecords, green: record } });
    const result = derive(select, data, { workbench: true });
    assert.deepEqual(result.projects, referenceProjects(data));
    assert.equal(result.ready, isOwned(record) ? 1 : 0);
    assert.equal(result.missingProjectPaints, isOwned(record) ? 3 : 4);
    assert.equal(result.wishlistedMissingPaints, isOwned(record) ? 2 : 3);
  }
});

test("indexed substitution traversal matches core across deterministic cyclic graphs", () => {
  let seed = 72341;
  const next = (limit) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  for (let graph = 0; graph < 100; graph++) {
    const data = {
      ...structuredClone(emptyState),
      requirements: Array.from({ length: 8 }, (_, index) => req(`r${index}`, `m${index}`, `p${index}`)),
      paintSubstitutions: Array.from({ length: 8 }, (_, index) => ({
        id: `s${index}`,
        targetPaintId: `p${index}`,
        name: `Substitution ${index}`,
        isDefault: next(4) !== 0,
      })),
      paintSubstitutionIngredients: Array.from({ length: 8 }, (_, index) =>
        Array.from({ length: next(3) }, (_, sortOrder) => ({
          substitutionId: `s${index}`,
          paintId: `p${next(10)}`,
          parts: 1,
          sortOrder,
        })),
      ).flat(),
    };
    freeze(data);
    for (let index = 0; index < 8; index++) {
      const expected = resolvePaintChoice(data, `m${index}`, `p${index}`).paintIds;
      assert.deepEqual(resolvedPaintIds(data, `m${index}`), expected, `graph ${graph}, root ${index}`);
      assert.deepEqual(resolvedPaintIds(data, `m${index}`), expected, "cached root resolution is equivalent");
    }
  }
});
