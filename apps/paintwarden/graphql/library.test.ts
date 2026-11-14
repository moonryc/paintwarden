import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-library-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const {
  readLibrary,
  readPaint,
  readPaintOptions,
  readSubstitution,
  paintSubstitutions,
  substitutionIngredients,
  paintUsages,
} = await import("./library.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nextId = () => uuid(++serial);
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const sortedIds = (items: readonly { id: string }[]) => ids(items).sort();
const all = () => readLibrary({ first: 100 });

function paint(
  name: string,
  options: { id?: string; brand?: string; range?: string; custom?: boolean } = {},
) {
  const id = options.id ?? `${options.custom ? "user:" : ""}${nextId()}`;
  sqlite
    .prepare(
      `INSERT INTO paint_catalog
    (id,brand,range,name,color_hex,type,discontinued,source_url,source_label,updated_at)
    VALUES(?,?,?,?,'#123456','BASE',0,'https://example.invalid/paint','Fixture',?)`,
    )
    .run(id, options.brand ?? "Fixture", options.range ?? "Base", name, timestamp);
  return id;
}
function inventory(id: string, state: "OWNED" | "WISHLIST" = "OWNED", stock = "FULL", quantity = 1) {
  sqlite
    .prepare(
      `INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at)
    VALUES(?,?,?,?,?)`,
    )
    .run(id, state, stock, quantity, timestamp);
}
function substitution(target: string, name: string, isDefault = true, ingredients: string[] = []) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at)
    VALUES(?,?,?,?,?,?)`,
    )
    .run(id, target, name, Number(isDefault), timestamp, timestamp);
  ingredients.forEach((paintId, index) => ingredient(id, paintId, index + 1, index));
  return id;
}
function ingredient(sub: string, paintId: string, parts = 1, order = 0) {
  sqlite
    .prepare(
      `INSERT INTO paint_substitution_ingredients
    (substitution_id,paint_id,parts,sort_order,updated_at) VALUES(?,?,?,?,?)`,
    )
    .run(sub, paintId, parts, order, timestamp);
}
function source(name: string, paints: string[] = []) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO catalog_sources
    (id,repository,url,branch,name,version,dependencies,updated_at)
    VALUES(?,?,'https://example.invalid/plugin','main',?,'1.0.0','[]',?)`,
    )
    .run(id, `fixture/${id}`, name, timestamp);
  for (const paintId of paints)
    sqlite
      .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'paint',?)")
      .run(id, paintId);
  return id;
}
function miniature(title: string) {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO miniatures(id,title,status,created_at,updated_at) VALUES(?,?,'OWNED',?,?)")
    .run(id, title, timestamp, timestamp);
  return id;
}
function requirement(miniatureId: string, paintId: string, step = "OTHER") {
  sqlite
    .prepare(
      `INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,updated_at)
    VALUES(?,?,?,?,?)`,
    )
    .run(nextId(), miniatureId, paintId, step, timestamp);
}
function scheme(paints: string[]) {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,'Fixture scheme',?,?)")
    .run(id, timestamp, timestamp);
  paints.forEach((paintId, index) =>
    sqlite
      .prepare(
        `INSERT INTO color_scheme_paints
    (scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,?)`,
      )
      .run(id, paintId, index, timestamp),
  );
  return id;
}
function linkScheme(miniatureId: string, schemeId: string) {
  sqlite
    .prepare("INSERT INTO miniature_color_schemes(miniature_id,scheme_id,updated_at) VALUES(?,?,?)")
    .run(miniatureId, schemeId, timestamp);
}
function code(expected: string) {
  return (error: unknown) => error instanceof GraphQLError && error.extensions.code === expected;
}

beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources;",
  );
  serial = 0;
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});

void test("empty vault and missing detail have empty bounded connections", () => {
  const page = all();
  assert.deepEqual(page.nodes, []);
  assert.equal(page.totalCount, 0);
  assert.equal(page.catalogCount, 0);
  assert.equal(page.availableCount, 0);
  assert.equal(page.explicitWishlistCount, 0);
  assert.deepEqual(page.pageInfo, { hasNextPage: false, endCursor: null });
  assert.deepEqual(page.facets.brands, []);
  assert.deepEqual(page.facets.sources, []);
  assert.deepEqual(
    page.facets.inventory.map((facet) => facet.count),
    [0, 0, 0, 0],
  );
  assert.deepEqual(readPaintOptions({ first: 30, search: "", excludeIds: [] }).items, []);
  const view = readPaint(uuid(999));
  assert.equal(view.paint, null);
  assert.deepEqual(paintSubstitutions(view, { first: 30 }).nodes, []);
  assert.deepEqual(paintUsages(view, { first: 30 }).nodes, []);
  assert.equal(readSubstitution(uuid(999)).substitution, null);
  assert.equal(typeof page.revision.epoch, "string");
  assert.ok(Number.isSafeInteger(page.revision.seq));
});

void test("Library inventory filters use effective ownership, not just inventory state", () => {
  const full = paint("Full");
  const low = paint("Low");
  const empty = paint("Empty");
  const zero = paint("Zero");
  const untracked = paint("Untracked");
  const wish = paint("Wish");
  const replaced = paint("Replaced");
  const replacedWish = paint("Replaced wishlist");
  const overriddenOwned = paint("Owned but unavailable recipe");
  inventory(full);
  inventory(low, "OWNED", "LOW", 2);
  inventory(empty, "OWNED", "EMPTY", 2);
  inventory(zero, "OWNED", "FULL", 0);
  inventory(wish, "WISHLIST", "FULL", 4);
  inventory(replacedWish, "WISHLIST");
  inventory(overriddenOwned);
  const active = substitution(replaced, "Working mix", true, [full, low]);
  substitution(replacedWish, "Wishlist working mix", true, [full]);
  substitution(overriddenOwned, "Missing ingredient", true, [untracked]);

  assert.deepEqual(
    sortedIds(readLibrary({ first: 100, filter: "OWNED" }).nodes),
    [full, low, replaced, replacedWish].sort(),
  );
  assert.deepEqual(
    sortedIds(readLibrary({ first: 100, filter: "WISHLIST" }).nodes),
    [wish, replacedWish].sort(),
  );
  assert.deepEqual(
    sortedIds(readLibrary({ first: 100, filter: "UNTRACKED" }).nodes),
    [empty, zero, untracked, overriddenOwned].sort(),
  );
  assert.equal(all().totalCount, 9);
  assert.equal(all().availableCount, 4);
  assert.equal(all().explicitWishlistCount, 2);
  assert.deepEqual(
    all().facets.inventory.map(({ key, count }) => [key, count]),
    [
      ["ALL", 9],
      ["OWNED", 4],
      ["WISHLIST", 2],
      ["UNTRACKED", 4],
    ],
  );
  const resolved = readPaint(replaced).paint!;
  assert.equal(resolved.inventory, null);
  assert.equal(resolved.available, true);
  assert.equal(resolved.hasActiveSubstitution, true);
  assert.deepEqual(resolved.activeSubstitution, { id: active, name: "Working mix" });
  assert.equal(resolved.missingStock, false);
  assert.equal(resolved.brokenSubstitution, false);
  assert.equal(readPaint(overriddenOwned).paint!.missingStock, true);
  assert.equal(readPaint(overriddenOwned).paint!.brokenSubstitution, false);
  assert.deepEqual(readPaint(low).paint!.inventory, { state: "OWNED", stockLevel: "LOW", quantity: 2 });
});

void test("only nonblank search forces ALL; blank and whitespace retain the requested filter", () => {
  const owned = paint("Shared owned");
  const untracked = paint("Shared untracked");
  const wish = paint("Shared wish");
  inventory(owned);
  inventory(wish, "WISHLIST");
  for (const search of [undefined, null, "", "  \t\n "])
    assert.deepEqual(ids(readLibrary({ first: 100, filter: "OWNED", search }).nodes), [owned]);
  for (const filter of ["OWNED", "WISHLIST", "UNTRACKED"])
    assert.deepEqual(
      sortedIds(readLibrary({ first: 100, filter, search: "  shared  " }).nodes),
      [owned, untracked, wish].sort(),
    );
  assert.deepEqual(readLibrary({ first: 100, filter: "OWNED", search: "no-match-xyzzy" }).nodes, []);
});

void test("Custom brand, plugin name/ID and no-source filters preserve global facets and counts", () => {
  const alpha = paint("Alpha", { brand: "Acme" });
  const beta = paint("Beta", { brand: "Acme" });
  const gamma = paint("Gamma", { brand: "Zenith" });
  const orphan = paint("Orphan", { brand: "Acme" });
  const custom = paint("Handmade", { brand: "Acme", custom: true });
  inventory(alpha);
  inventory(custom, "WISHLIST");
  const first = source("Shared plugin", [alpha]);
  const second = source("Shared plugin", [beta]);
  source("Other plugin", [gamma]);
  const baseline = all();
  assert.deepEqual(baseline.facets.brands, [
    { key: "Acme", label: "Acme", count: 3 },
    { key: "Custom", label: "Custom", count: 1 },
    { key: "Zenith", label: "Zenith", count: 1 },
  ]);
  assert.deepEqual(baseline.facets.sources, [
    { key: "", label: "Not from a plugin", count: 2 },
    { key: "Other plugin", label: "Other plugin", count: 1 },
    { key: "Shared plugin", label: "Shared plugin", count: 2 },
  ]);
  const cases = [
    { filter: { brand: "Custom" }, expected: [custom] },
    { filter: { brand: "Acme" }, expected: [alpha, beta, orphan] },
    { filter: { brand: "ALL" }, expected: [alpha, beta, gamma, orphan, custom] },
    { filter: { sourceId: first }, expected: [alpha] },
    { filter: { sourceId: second }, expected: [beta] },
    { filter: { sourceName: "Shared plugin" }, expected: [alpha, beta] },
    { filter: { noSource: true }, expected: [orphan, custom] },
    { filter: { sourceName: "Shared plugin", noSource: true }, expected: [] },
    { filter: { sourceId: first, brand: "Zenith" }, expected: [] },
    { filter: { sourceName: "missing" }, expected: [] },
  ];
  for (const { filter, expected } of cases) {
    const page = readLibrary({ first: 100, ...filter });
    assert.deepEqual(sortedIds(page.nodes), [...expected].sort(), JSON.stringify(filter));
    assert.deepEqual(page.facets.brands, baseline.facets.brands);
    assert.deepEqual(page.facets.sources, baseline.facets.sources);
    assert.equal(page.catalogCount, 5);
    assert.equal(page.availableCount, 1);
    assert.equal(page.explicitWishlistCount, 1);
  }
  assert.deepEqual(
    readLibrary({ first: 100, sourceName: "Shared plugin" }).facets.inventory.map((f) => f.count),
    [2, 1, 0, 1],
  );
  assert.deepEqual(
    readLibrary({ first: 100, search: "Alpha", sourceName: "Shared plugin" }).facets.inventory.map(
      (f) => f.count,
    ),
    [1, 1, 0, 0],
  );
  assert.equal(readPaint(custom).paint!.isCustom, true);
  assert.equal(readPaint(custom).paint!.brand, "Acme");
  const detail = readPaint(alpha).paint!;
  assert.equal(detail.sourceId, first);
  assert.equal(detail.sourceName, "Shared plugin");
  assert.equal(detail.sourceLogoUrl, null);
  assert.equal(detail.sourceUrl, "https://example.invalid/paint");
  assert.equal(detail.sourceLabel, "Fixture");
  assert.equal(detail.colorHex, "#123456");
  assert.equal(detail.type, "BASE");
  assert.equal(detail.discontinued, false);
  assert.equal(readPaint(orphan).paint!.sourceId, null);
});

void test("Library and picker exactly preserve core literal precedence, normalization, fuzzy ranking and stable ties", () => {
  const scarlet = paint("Scarlet", { brand: "A" });
  const deep = paint("Deep Scarlet", { brand: "B" });
  const typo = paint("Scarlat", { brand: "C" });
  paint("Café Blue", { brand: "D" });
  paint("Same", { brand: "E" });
  paint("Same", { brand: "E" });
  const custom = paint("Handmade", { brand: "Z", custom: true });
  const paints = all().nodes;
  const libraryIndex = createFuzzyIndex(
    paints,
    (p) => `${p.isCustom ? "Custom " : ""}${p.brand} ${p.range} ${p.name}`,
  );
  const pickerIndex = createFuzzyIndex(paints, (p) => `${p.brand} ${p.range} ${p.name}`);
  for (const search of [
    "scarlet",
    "  SCÁRLET  ",
    "scarlte",
    "blue cafe",
    "cafe-blue",
    "same",
    "",
    "xyzzyplugh",
  ]) {
    assert.deepEqual(
      ids(readLibrary({ first: 100, search }).nodes),
      ids(searchFuzzyIndex(libraryIndex, search.trim())),
      search,
    );
    for (const first of [1, 2, 30])
      assert.deepEqual(
        ids(readPaintOptions({ first, search, excludeIds: [] }).items),
        ids(searchFuzzyIndex(pickerIndex, search.trim(), first)),
        search,
      );
  }
  assert.deepEqual(ids(readLibrary({ first: 100, search: "scarlet" }).nodes), [scarlet, deep]);
  assert.ok(!ids(readLibrary({ first: 100, search: "scarlet" }).nodes).includes(typo));
  assert.ok(ids(readLibrary({ first: 100, search: "scarlte" }).nodes).includes(scarlet));
  assert.deepEqual(ids(readLibrary({ first: 100, search: "Custom" }).nodes), [custom]);
  assert.deepEqual(readPaintOptions({ first: 30, search: "Custom", excludeIds: [] }).items, []);
});

void test("picker excludes IDs before scoring so excluded literals cannot suppress eligible fuzzy results", () => {
  const literal = paint("Scarlet");
  const fuzzy = paint("Scarlat");
  const unrelated = paint("Obsidian");
  assert.deepEqual(ids(readPaintOptions({ first: 30, search: "scarlet", excludeIds: [] }).items), [literal]);
  assert.deepEqual(ids(readPaintOptions({ first: 30, search: "scarlet", excludeIds: [literal] }).items), [
    fuzzy,
  ]);
  assert.deepEqual(
    ids(readPaintOptions({ first: 1, search: "", excludeIds: [literal, literal, uuid(999)] }).items),
    [unrelated],
  );
  assert.deepEqual(
    readPaintOptions({ first: 30, search: "scarlet", excludeIds: [literal, fuzzy] }).items,
    [],
  );
});

void test("Library pagination uses deterministic ID ties and revision/filter-bound cursors", () => {
  const last = paint("Same", { id: uuid(30) });
  const first = paint("Same", { id: uuid(10) });
  const middle = paint("Same", { id: uuid(20) });
  inventory(first);
  const page = readLibrary({ first: 1 });
  assert.deepEqual(ids(page.nodes), [first]);
  assert.equal(page.totalCount, 3);
  assert.equal(page.pageInfo.hasNextPage, true);
  assert.ok(page.pageInfo.endCursor);
  const rest = readLibrary({ first: 2, after: page.pageInfo.endCursor });
  assert.deepEqual(ids(rest.nodes), [middle, last]);
  assert.equal(rest.pageInfo.hasNextPage, false);
  assert.deepEqual(rest.revision, page.revision);
  const end = readLibrary({ first: 1, after: rest.pageInfo.endCursor });
  assert.deepEqual(end.nodes, []);
  assert.deepEqual(end.pageInfo, { hasNextPage: false, endCursor: null });
  for (const filter of [
    { filter: "OWNED" },
    { search: "Same" },
    { brand: "Other" },
    { sourceId: uuid(90) },
    { sourceName: "Other" },
    { noSource: true },
  ])
    assert.throws(
      () => readLibrary({ first: 1, after: page.pageInfo.endCursor, ...filter }),
      code("BAD_USER_INPUT"),
    );
  const searched = readLibrary({ first: 1, filter: "OWNED", search: " Same " });
  assert.deepEqual(
    ids(
      readLibrary({ first: 2, filter: "WISHLIST", search: "Same", after: searched.pageInfo.endCursor }).nodes,
    ),
    [middle, last],
  );
  sqlite.prepare("UPDATE paint_catalog SET name='Changed',updated_at=? WHERE id=?").run(timestamp + 1, last);
  assert.throws(() => readLibrary({ first: 1, after: page.pageInfo.endCursor }), code("STALE_CURSOR"));
  assert.ok(all().revision.seq > page.revision.seq);
});

void test("read validation rejects out-of-budget pages, invalid filters, text and malformed cursors", () => {
  paint("Fixture");
  for (const first of [0, -1, 1.5, 101, NaN, Infinity])
    assert.throws(() => readLibrary({ first }), code("BAD_USER_INPUT"));
  for (const first of [0, 31]) {
    assert.throws(() => readPaintOptions({ first, search: "", excludeIds: [] }), code("BAD_USER_INPUT"));
    assert.throws(() => paintSubstitutions(readPaint(uuid(1)), { first }), code("BAD_USER_INPUT"));
  }
  assert.throws(() => readLibrary({ first: 1, filter: "INVALID" }), code("BAD_USER_INPUT"));
  for (const key of ["search", "brand", "sourceId", "sourceName"] as const)
    assert.throws(() => readLibrary({ first: 1, [key]: "x".repeat(257) }), code("BAD_USER_INPUT"));
  assert.throws(() => readPaint("x".repeat(257)), code("BAD_USER_INPUT"));
  assert.throws(
    () => readPaintOptions({ first: 1, search: "x".repeat(257), excludeIds: [] }),
    code("BAD_USER_INPUT"),
  );
  assert.doesNotThrow(() =>
    readPaintOptions({ first: 1, search: "", excludeIds: Array<string>(101).fill(uuid(1)) }),
  );
  assert.throws(
    () => readPaintOptions({ first: 1, search: "", excludeIds: ["x".repeat(257)] }),
    code("BAD_USER_INPUT"),
  );
  const cursor = all().pageInfo.endCursor!;
  const decoded: unknown[] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  for (const after of [
    "",
    "!",
    "not-a-cursor",
    "x".repeat(8193),
    encode({}),
    encode([]),
    encode(["wrong", ...decoded.slice(1)]),
    encode([...decoded.slice(0, 4), -1]),
    encode([...decoded.slice(0, 4), 0.5]),
    encode([...decoded.slice(0, 4), 2]),
  ])
    assert.throws(() => readLibrary({ first: 1, after }), code("BAD_USER_INPUT"));
  assert.throws(
    () =>
      readLibrary({ first: 1, after: encode([decoded[0], decoded[1], "different epoch", decoded[3], 1]) }),
    code("STALE_CURSOR"),
  );
});

void test("empty/cyclic defaults stay broken even when physically owned, while valid ancestors are not themselves broken", () => {
  const empty = paint("Empty recipe");
  const a = paint("Cycle A");
  const b = paint("Cycle B");
  const ancestorEmpty = paint("Ancestor empty");
  const ancestorCycle = paint("Ancestor cycle");
  for (const id of [empty, a, b, ancestorEmpty, ancestorCycle]) inventory(id);
  substitution(empty, "Empty");
  substitution(a, "A to B", true, [b]);
  substitution(b, "B to A", true, [a]);
  substitution(ancestorEmpty, "Valid ancestor of empty", true, [empty]);
  substitution(ancestorCycle, "Valid ancestor of cycle", true, [a]);
  for (const [id, reason] of [
    [empty, "EMPTY"],
    [a, "CYCLE"],
    [b, "CYCLE"],
    [ancestorEmpty, null],
    [ancestorCycle, null],
  ] as const) {
    const detail = readPaint(id).paint!;
    assert.equal(detail.available, false, id);
    assert.equal(detail.brokenReason, reason, id);
    assert.equal(detail.brokenSubstitution, true, id);
    assert.equal(detail.missingStock, false, id);
    const sub = paintSubstitutions(readPaint(id), { first: 30 }).nodes[0];
    assert.equal(sub.available, false);
    assert.equal(sub.brokenReason, reason);
  }
  assert.equal(readLibrary({ first: 100, filter: "OWNED" }).totalCount, 0);
  assert.equal(readLibrary({ first: 100, filter: "UNTRACKED" }).totalCount, 5);
});

void test("direct self ingredients mean physical originals, and saved nondefault recipes do not activate", () => {
  const original = paint("Original");
  const availableIngredient = paint("Owned ingredient");
  const missing = paint("Missing ingredient");
  const inactiveOwner = paint("Inactive owner");
  inventory(original);
  inventory(availableIngredient);
  const active = substitution(original, "Use physical original", true, [original, availableIngredient]);
  const inactive = substitution(original, "Unavailable alternative", false, [missing]);
  const saved = substitution(inactiveOwner, "Saved usable", false, [availableIngredient]);
  const savedEmpty = substitution(inactiveOwner, "Saved empty", false);
  const savedSelf = substitution(inactiveOwner, "Saved self", false, [inactiveOwner]);
  assert.equal(readPaint(original).paint!.available, true);
  assert.equal(readPaint(original).paint!.brokenReason, null);
  assert.deepEqual(readPaint(original).paint!.activeSubstitution, {
    id: active,
    name: "Use physical original",
  });
  assert.equal(readSubstitution(inactive).substitution!.available, false);
  assert.equal(readSubstitution(inactive).substitution!.brokenReason, null);
  assert.equal(readSubstitution(saved).substitution!.available, true);
  assert.equal(readSubstitution(savedEmpty).substitution!.brokenReason, "EMPTY");
  assert.equal(readSubstitution(savedSelf).substitution!.available, false);
  assert.equal(readSubstitution(savedSelf).substitution!.brokenReason, null);
  assert.equal(readPaint(inactiveOwner).paint!.hasActiveSubstitution, false);
  assert.equal(readPaint(inactiveOwner).paint!.activeSubstitution, null);
  assert.equal(readPaint(inactiveOwner).paint!.available, false);
  sqlite
    .prepare("UPDATE paint_inventory SET stock_level='EMPTY',updated_at=? WHERE paint_id=?")
    .run(timestamp + 1, original);
  assert.equal(readPaint(original).paint!.available, false);
  assert.equal(readPaint(original).paint!.missingStock, true);
  assert.equal(readPaint(original).paint!.brokenSubstitution, false);
});

void test("substitution and ingredient connections are ordered, bounded, scoped and retain their captured snapshot", () => {
  const owner = paint("Owner");
  const other = paint("Other owner");
  const a = paint("Ingredient A");
  const b = paint("Ingredient B");
  inventory(a);
  inventory(b);
  const mix = substitution(owner, "Z first by ID", true);
  ingredient(mix, b, 4, 20);
  ingredient(mix, a, 2, 10);
  const alternative = substitution(owner, "A second by ID", false, [a]);
  substitution(other, "Other", true, [a]);
  const view = readPaint(owner);
  const first = paintSubstitutions(view, { first: 1 });
  assert.deepEqual(ids(first.nodes), [mix]);
  assert.equal(first.totalCount, 2);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.deepEqual(ids(paintSubstitutions(view, { first: 30, after: first.pageInfo.endCursor }).nodes), [
    alternative,
  ]);
  const ingredients = substitutionIngredients(first.nodes[0], { first: 1 });
  assert.deepEqual(
    ingredients.nodes.map((i) => [i.paint.id, i.parts, i.sortOrder]),
    [[a, 2, 10]],
  );
  assert.equal(ingredients.totalCount, 2);
  assert.deepEqual(
    substitutionIngredients(first.nodes[0], { first: 100, after: ingredients.pageInfo.endCursor }).nodes.map(
      (i) => [i.paint.id, i.parts, i.sortOrder],
    ),
    [[b, 4, 20]],
  );
  const alt = readSubstitution(alternative).substitution!;
  assert.throws(
    () => substitutionIngredients(alt, { first: 1, after: ingredients.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(
    () => paintSubstitutions(readPaint(other), { first: 1, after: first.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(() => readLibrary({ first: 1, after: first.pageInfo.endCursor }), code("BAD_USER_INPUT"));
  sqlite.prepare("UPDATE paint_catalog SET name='Renamed',updated_at=? WHERE id=?").run(timestamp + 1, a);
  assert.equal(substitutionIngredients(first.nodes[0], { first: 1 }).nodes[0].paint.name, "Ingredient A");
  assert.equal(readPaint(a).paint!.name, "Renamed");
  assert.throws(
    () => paintSubstitutions(readPaint(owner), { first: 1, after: first.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
  assert.throws(
    () =>
      substitutionIngredients(readSubstitution(mix).substitution!, {
        first: 1,
        after: ingredients.pageInfo.endCursor,
      }),
    code("STALE_CURSOR"),
  );
});

void test("usedBy includes direct recipe and linked scheme targets once, never transitive substitution ingredients", () => {
  const target = paint("Target");
  const component = paint("Component");
  substitution(target, "Default component", true, [component]);
  const duplicate = miniature("Same title");
  const sameTitle = miniature("Same title");
  const schemeOnly = miniature("A scheme only");
  const componentOnly = miniature("Component only");
  const legacyOnly = miniature("Legacy override only");
  requirement(duplicate, target, "BASECOAT");
  requirement(duplicate, target, "HIGHLIGHT");
  requirement(sameTitle, target);
  requirement(componentOnly, component);
  const linked = scheme([target, target]);
  linkScheme(duplicate, linked);
  linkScheme(schemeOnly, linked);
  scheme([target]); // An unlinked scheme is not a miniature usage.
  const saved = substitution(component, "Saved target", false, [target]);
  sqlite
    .prepare(
      `INSERT INTO miniature_paint_substitutions
    (miniature_id,target_paint_id,substitution_id,use_original,updated_at) VALUES(?,?,?,0,?)`,
    )
    .run(legacyOnly, component, saved, timestamp);
  const view = readPaint(target);
  assert.deepEqual(paintUsages(view, { first: 100 }).nodes, [
    { id: schemeOnly, title: "A scheme only" },
    { id: duplicate, title: "Same title" },
    { id: sameTitle, title: "Same title" },
  ]);
  assert.deepEqual(ids(paintUsages(readPaint(component), { first: 100 }).nodes), [componentOnly]);
  const first = paintUsages(view, { first: 1 });
  assert.equal(first.totalCount, 3);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.deepEqual(ids(paintUsages(view, { first: 100, after: first.pageInfo.endCursor }).nodes), [
    duplicate,
    sameTitle,
  ]);
  assert.throws(
    () => paintUsages(readPaint(component), { first: 1, after: first.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  const newer = miniature("Z new usage");
  requirement(newer, target);
  assert.equal(paintUsages(view, { first: 100 }).totalCount, 3);
  assert.throws(
    () => paintUsages(readPaint(target), { first: 1, after: first.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
});

void test("SQL writes refresh all read projections, including source metadata and inventory", () => {
  const id = paint("Before");
  const plugin = source("Before plugin", [id]);
  const before = all();
  assert.equal(readPaint(id).paint!.available, false);
  sqlite
    .prepare("UPDATE paint_catalog SET name='After',discontinued=1,updated_at=? WHERE id=?")
    .run(timestamp + 1, id);
  inventory(id);
  sqlite
    .prepare("UPDATE catalog_sources SET name='After plugin',updated_at=? WHERE id=?")
    .run(timestamp + 1, plugin);
  assert.equal(readPaint(id).paint!.name, "After");
  assert.equal(readPaint(id).paint!.discontinued, true);
  assert.equal(readPaint(id).paint!.available, true);
  assert.equal(readPaint(id).paint!.sourceName, "After plugin");
  assert.deepEqual(ids(readPaintOptions({ first: 30, search: "After", excludeIds: [] }).items), [id]);
  assert.equal(readLibrary({ first: 100, sourceName: "Before plugin" }).totalCount, 0);
  assert.equal(readLibrary({ first: 100, sourceName: "After plugin", filter: "OWNED" }).totalCount, 1);
  assert.throws(() => readLibrary({ first: 1, after: before.pageInfo.endCursor }), code("STALE_CURSOR"));
});

void test("reads inside rolled-back transactions neither reuse nor poison committed snapshot cache at a reused sequence", () => {
  const id = paint("Committed");
  const committed = all();
  const rollback = new Error("intentional rollback");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        sqlite
          .prepare("UPDATE paint_catalog SET name='Rolled back',updated_at=? WHERE id=?")
          .run(timestamp + 1, id);
        assert.equal(all().nodes[0].name, "Rolled back");
        assert.equal(readPaint(id).paint!.name, "Rolled back");
        assert.deepEqual(ids(readPaintOptions({ first: 1, search: "Rolled back", excludeIds: [] }).items), [
          id,
        ]);
        throw rollback;
      })(),
    (error: unknown) => error === rollback,
  );
  assert.equal(all().nodes[0].name, "Committed");
  assert.deepEqual(all().revision, committed.revision);
  // SQLite can reuse the rolled-back change-log sequence. A cache keyed only by that
  // sequence must not accidentally return the abandoned transaction's projection.
  sqlite
    .prepare("UPDATE paint_catalog SET name='Actually committed',updated_at=? WHERE id=?")
    .run(timestamp + 2, id);
  assert.equal(all().nodes[0].name, "Actually committed");
  assert.equal(readPaint(id).paint!.name, "Actually committed");
  assert.deepEqual(readPaintOptions({ first: 1, search: "Rolled back", excludeIds: [] }).items, []);
  sqlite.transaction(() => {
    inventory(id);
    assert.equal(readPaint(id).paint!.available, true);
    assert.equal(readLibrary({ first: 100, filter: "OWNED" }).totalCount, 1);
  })();
  assert.equal(readPaint(id).paint!.available, true);
});
