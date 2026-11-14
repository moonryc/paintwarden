import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-miniatures-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const {
  readHome,
  readMiniatures,
  readMiniature,
  readVaultNavigation,
  miniatureRecipe,
  miniatureSchemes,
  miniatureMissing,
  miniatureRequired,
  clearMiniatureProjectionCache,
  miniatureProjectionDiagnostics,
} = await import("./miniatures.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nextId = () => uuid(++serial);
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const counts = (items: readonly { key: string; count: number }[]) => items.map((f) => [f.key, f.count]);
type ListArgs = Parameters<typeof readMiniatures>[0];
function miniature(
  title: string,
  options: {
    id?: string;
    status?: ListArgs["ownership"];
    stage?: ListArgs["stage"];
    notes?: string;
    manufacturer?: string;
    faction?: string;
    scale?: string;
    createdAt?: number;
  } = {},
) {
  const id = options.id ?? nextId();
  sqlite
    .prepare(
      `INSERT INTO miniatures
    (id,title,status,painting_status,notes,manufacturer,faction,scale,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      title,
      options.status ?? "OWNED",
      options.stage ?? "NOT_STARTED",
      options.notes ?? "",
      options.manufacturer ?? "",
      options.faction ?? "",
      options.scale ?? "",
      options.createdAt ?? timestamp,
      timestamp,
    );
  return id;
}
function paint(name: string, color: string | null = "#123456") {
  const id = nextId();
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,updated_at) VALUES(?,'Fixture','Base',?,?,?)",
    )
    .run(id, name, color, timestamp);
  return id;
}
function inventory(id: string, state = "OWNED", stock = "FULL", quantity = 1) {
  sqlite
    .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,?,?,?,?)")
    .run(id, state, stock, quantity, timestamp);
}
function substitution(target: string, ingredients: string[] = [], active = true) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at)
    VALUES(?,?,'Fixture mix',?,?,?)`,
    )
    .run(id, target, Number(active), timestamp, timestamp);
  ingredients.forEach((paintId, order) =>
    sqlite
      .prepare(
        `INSERT INTO paint_substitution_ingredients
    (substitution_id,paint_id,parts,sort_order,updated_at) VALUES(?,?,1,?,?)`,
      )
      .run(id, paintId, order, timestamp),
  );
  return id;
}
function requirement(miniatureId: string, paintId: string, step = "OTHER", notes = "", order = 0) {
  const id = nextId();
  sqlite
    .prepare(
      `INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step,notes,sort_order,updated_at)
    VALUES(?,?,?,?,?,?,?)`,
    )
    .run(id, miniatureId, paintId, step, notes, order, timestamp);
  return id;
}
function scheme(paints: string[] = [], name = "Fixture scheme") {
  const id = nextId();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,?,?,?)")
    .run(id, name, timestamp, timestamp);
  paints.forEach((paintId, order) =>
    sqlite
      .prepare(
        `INSERT INTO color_scheme_paints
    (scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,?)`,
      )
      .run(id, paintId, order, timestamp),
  );
  return id;
}
function link(miniatureId: string, schemeId: string, order = 0) {
  sqlite
    .prepare(
      "INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order,updated_at) VALUES(?,?,?,?)",
    )
    .run(miniatureId, schemeId, order, timestamp);
}
function code(expected: string) {
  return (error: unknown) => error instanceof GraphQLError && error.extensions.code === expected;
}
const nested = [miniatureRecipe, miniatureSchemes, miniatureMissing, miniatureRequired] as const;

beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources;",
  );
  serial = 0;
  clearMiniatureProjectionCache();
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});

void test("empty vault and absent detail provide bounded empty connections and global zero counts", () => {
  const home = readHome({ first: 1 });
  assert.deepEqual(home.counts, {
    catalogCount: 0,
    owned: 0,
    ready: 0,
    distinctMissingPaints: 0,
    wishlistedMissingPaints: 0,
    stages: home.counts.stages,
  });
  assert.deepEqual(
    home.counts.stages.map((f) => f.count),
    [0, 0, 0, 0, 0, 0],
  );
  const list = readMiniatures({ first: 1 });
  assert.deepEqual(counts(list.ownershipCounts), [
    ["ALL", 0],
    ["OWNED", 0],
    ["WISHLIST", 0],
  ]);
  assert.deepEqual(
    list.stageCounts.map((f) => f.count),
    [0, 0, 0, 0, 0, 0],
  );
  assert.deepEqual(home.miniatures, {
    nodes: [],
    totalCount: 0,
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  assert.deepEqual(list.miniatures, home.miniatures);
  const view = readMiniature(uuid(999));
  assert.equal(view.miniature, null);
  assert.deepEqual(view.recipeSteps, []);
  for (const connection of nested) assert.deepEqual(connection(view, { first: 1 }), home.miniatures);
  assert.deepEqual(readVaultNavigation(), { revision: home.revision, availablePaints: 0, shoppingPaints: 0 });
  assert.equal(typeof home.revision.epoch, "string");
  assert.ok(Number.isSafeInteger(home.revision.seq));
  const empty = miniature("No recipe");
  assert.deepEqual(readMiniature(empty).miniature!.readiness, {
    total: 0,
    missing: 0,
    ready: false,
    missingStock: 0,
    brokenSubstitution: 0,
  });
});

void test("manual and linked scheme targets deduplicate before recursively resolving distinct physical leaves", () => {
  const low = paint("Low stock");
  const full = paint("Full stock");
  const target = paint("Target");
  const middle = paint("Nested target");
  const schemeOnly = paint("Scheme-only leaf");
  inventory(schemeOnly);
  inventory(low, "OWNED", "LOW", 2);
  inventory(full);
  substitution(target, [middle, full]);
  substitution(middle, [low, full]);
  const id = miniature("Nested scheme recipe");
  requirement(id, target, "BASECOAT");
  requirement(id, target, "HIGHLIGHT");
  requirement(id, full);
  const linked = scheme([target, target, low, schemeOnly]);
  link(id, linked);
  link(id, scheme([middle, full]), 1);
  scheme([paint("Not linked")]);
  const view = readMiniature(id);
  assert.deepEqual(ids(miniatureRequired(view, { first: 100 }).nodes), [low, full, schemeOnly]);
  assert.deepEqual(view.miniature!.readiness, {
    total: 3,
    missing: 0,
    ready: true,
    missingStock: 0,
    brokenSubstitution: 0,
  });
  assert.equal(miniatureRecipe(view, { first: 100 }).totalCount, 3);
  assert.equal(miniatureSchemes(view, { first: 100 }).totalCount, 2);
  assert.equal(miniatureMissing(view, { first: 100 }).totalCount, 0);
  assert.equal(readHome({ first: 1 }).counts.ready, 1);
});

void test("physical ownership needs OWNED, nonempty stock and positive quantity; active defaults override owned originals", () => {
  const low = paint("Low");
  const empty = paint("Depleted");
  const zero = paint("Zero quantity");
  const wish = paint("Wishlist");
  const untracked = paint("Untracked");
  const target = paint("Owned original");
  const self = paint("Direct self");
  const inactive = paint("Inactive saved recipe");
  inventory(low, "OWNED", "LOW", 1);
  inventory(empty, "OWNED", "EMPTY", 3);
  inventory(zero, "OWNED", "FULL", 0);
  inventory(wish, "WISHLIST", "FULL", 4);
  inventory(target);
  inventory(self);
  substitution(target, [untracked]);
  substitution(self, [self, low]);
  substitution(inactive, [low], false);
  const id = miniature("Physical rules");
  // Retained per-miniature choices must not override the active global default.
  sqlite
    .prepare(
      `INSERT INTO miniature_paint_substitutions
    (miniature_id,target_paint_id,substitution_id,use_original,updated_at) VALUES(?,?,NULL,1,?)`,
    )
    .run(id, target, timestamp);
  [low, empty, zero, wish, target, self, inactive].forEach((p, i) => requirement(id, p, "OTHER", "", i));
  const view = readMiniature(id);
  assert.deepEqual(ids(miniatureRequired(view, { first: 100 }).nodes), [
    low,
    empty,
    zero,
    wish,
    untracked,
    self,
    inactive,
  ]);
  assert.deepEqual(ids(miniatureMissing(view, { first: 100 }).nodes), [
    empty,
    zero,
    wish,
    untracked,
    inactive,
  ]);
  assert.deepEqual(view.miniature!.readiness, {
    total: 7,
    missing: 5,
    ready: false,
    missingStock: 5,
    brokenSubstitution: 0,
  });
  assert.equal(miniatureRequired(view, { first: 100 }).nodes.find((p) => p.id === self)!.available, true);
});

void test("empty and cyclic defaults never fall back to owned originals, and missing/broken flags may coexist", () => {
  const emptyOwned = paint("Owned empty mix");
  const emptyMissing = paint("Missing empty mix");
  const cycleA = paint("Cycle A");
  const cycleB = paint("Cycle B");
  const ancestor = paint("Valid ancestor");
  [emptyOwned, cycleA, cycleB, ancestor].forEach((p) => inventory(p));
  substitution(emptyOwned);
  substitution(emptyMissing);
  substitution(cycleA, [cycleB]);
  substitution(cycleB, [cycleA]);
  substitution(ancestor, [emptyOwned, emptyMissing, cycleA]);
  const id = miniature("Broken graph");
  requirement(id, ancestor);
  const view = readMiniature(id);
  const missing = miniatureMissing(view, { first: 100 }).nodes;
  assert.deepEqual(
    missing.map((m) => [m.id, m.missingStock, m.brokenSubstitution]),
    [
      [emptyOwned, false, true],
      [emptyMissing, true, true],
      [cycleB, false, true],
    ],
  );
  assert.deepEqual(view.miniature!.readiness, {
    total: 3,
    missing: 3,
    ready: false,
    missingStock: 1,
    brokenSubstitution: 3,
  });
  assert.equal(readHome({ first: 100 }).counts.ready, 0);
  const otherRoot = miniature("Other cycle root");
  requirement(otherRoot, cycleB);
  assert.deepEqual(ids(miniatureMissing(readMiniature(otherRoot), { first: 100 }).nodes), [cycleA]);
});

void test("Home counts owned projects globally, independently of page/search/stage; list ownership counts stay global", () => {
  const full = paint("Full");
  const depleted = paint("Depleted");
  const wish = paint("Wish");
  const missing = paint("Missing");
  const wishlistOnly = paint("Only wishlist project needs this");
  inventory(full);
  inventory(depleted, "OWNED", "EMPTY", 2);
  inventory(wish, "WISHLIST");
  const ready = miniature("Ready hero", { stage: "COMPLETE" });
  const blocked = miniature("Blocked hero", { stage: "PRIMED" });
  const blockedAgain = miniature("Another hero", { stage: "ASSEMBLED" });
  miniature("Empty hero");
  const wished = miniature("Wishlist hero", { status: "WISHLIST", stage: "COMPLETE" });
  requirement(ready, full);
  [depleted, wish, missing].forEach((p) => requirement(blocked, p));
  requirement(blockedAgain, depleted);
  requirement(wished, wishlistOnly);
  const baseline = readHome({ first: 1 });
  assert.deepEqual(baseline.counts, {
    catalogCount: 5,
    owned: 4,
    ready: 1,
    distinctMissingPaints: 3,
    wishlistedMissingPaints: 2,
    stages: baseline.counts.stages,
  });
  assert.deepEqual(counts(baseline.counts.stages), [
    ["ALL", 4],
    ["NOT_STARTED", 1],
    ["ASSEMBLED", 1],
    ["PRIMED", 1],
    ["IN_PROGRESS", 0],
    ["COMPLETE", 1],
  ]);
  assert.equal(baseline.miniatures.totalCount, 4);
  const complete = readHome({ first: 1, stage: "COMPLETE", search: "hero" });
  assert.deepEqual(ids(complete.miniatures.nodes), [ready]);
  assert.deepEqual(complete.counts, baseline.counts);
  const none = readHome({ first: 100, search: "xyzzyplugh" });
  assert.equal(none.miniatures.totalCount, 0);
  assert.deepEqual(none.counts, baseline.counts);
  const next = readHome({ first: 1, after: baseline.miniatures.pageInfo.endCursor });
  assert.deepEqual(next.counts, baseline.counts);
  const list = readMiniatures({ first: 1 });
  assert.deepEqual(counts(list.ownershipCounts), [
    ["ALL", 5],
    ["OWNED", 4],
    ["WISHLIST", 1],
  ]);
  for (const args of [
    { ownership: "WISHLIST" as const },
    { stage: "PRIMED" as const, search: "hero" },
    { search: "xyzzyplugh" },
  ]) {
    const filtered = readMiniatures({ first: 1, ...args });
    assert.deepEqual(filtered.ownershipCounts, list.ownershipCounts);
    assert.deepEqual(filtered.stageCounts, list.stageCounts);
  }
  assert.deepEqual(ids(readMiniatures({ first: 1, ownership: "WISHLIST" }).miniatures.nodes), [wished]);
});

void test("search covers title, notes, manufacturer, faction, scale and stage with core typo ranking", () => {
  const scarlet = miniature("Scarlet captain", {
    notes: "weathered bronze",
    manufacturer: "Citadel",
    faction: "Salamanders",
    scale: "28mm",
    stage: "IN_PROGRESS",
  });
  miniature("Scarlat guard", { status: "WISHLIST" });
  miniature("Café knight", {
    notes: "mountain patrol",
    manufacturer: "Reaper",
    faction: "Stormcast",
    scale: "75mm",
  });
  miniature("Same");
  miniature("Same");
  const rows = readMiniatures({ first: 100 }).miniatures.nodes;
  const index = createFuzzyIndex(
    rows,
    (m) => `${m.title} ${m.notes} ${m.manufacturer} ${m.faction} ${m.scale} ${m.paintingStatus}`,
  );
  for (const search of [
    "scarlet",
    "scarlte",
    "weathered",
    "Citadel",
    "Salamanders",
    "28mm",
    "IN_PROGRESS",
    "cafe",
    "knight cafe",
    "same",
    "xyzzyplugh",
    "  ",
  ]) {
    assert.deepEqual(
      ids(readMiniatures({ first: 100, search }).miniatures.nodes),
      ids(searchFuzzyIndex(index, search.trim())),
      search,
    );
  }
  for (const search of ["weathered", "citadel", "salamanders", "28mm", "IN_PROGRESS", "scarlte"])
    assert.ok(ids(readMiniatures({ first: 100, search }).miniatures.nodes).includes(scarlet), search);
  assert.deepEqual(
    ids(readMiniatures({ first: 100, search: "scarlet", ownership: "WISHLIST" }).miniatures.nodes),
    [rows.find((m) => m.title === "Scarlat guard")!.id],
  );
  for (const search of [undefined, null, "", " \t\n "])
    assert.deepEqual(
      ids(readMiniatures({ first: 100, ownership: "OWNED", search }).miniatures.nodes),
      ids(rows.filter((m) => m.status === "OWNED")),
    );
});

void test("Home and stage filters exclude literals before fuzzy ranking", () => {
  miniature("Scarlet", { status: "WISHLIST", stage: "PRIMED" });
  const fuzzy = miniature("Scarlat", { stage: "PRIMED" });
  miniature("Scarlet", { stage: "COMPLETE" });
  assert.deepEqual(ids(readHome({ first: 100, stage: "PRIMED", search: "scarlet" }).miniatures.nodes), [
    fuzzy,
  ]);
  assert.deepEqual(
    ids(
      readMiniatures({ first: 100, ownership: "OWNED", stage: "PRIMED", search: "scarlet" }).miniatures.nodes,
    ),
    [fuzzy],
  );
});

void test("equal timestamps/title ties use IDs, newest projects first, and cursors bind filters, root and revision", () => {
  const last = miniature("Same", { id: uuid(900) });
  const first = miniature("Same", { id: uuid(700) });
  const middle = miniature("Same", { id: uuid(800) });
  const newer = miniature("Z new", { createdAt: timestamp + 1 });
  const page = readMiniatures({ first: 2 });
  assert.deepEqual(ids(page.miniatures.nodes), [newer, first]);
  assert.equal(page.miniatures.totalCount, 4);
  assert.equal(page.miniatures.pageInfo.hasNextPage, true);
  const after = page.miniatures.pageInfo.endCursor;
  const tail = readMiniatures({ first: 2, after });
  assert.deepEqual(ids(tail.miniatures.nodes), [middle, last]);
  assert.equal(tail.miniatures.pageInfo.hasNextPage, false);
  assert.deepEqual(readMiniatures({ first: 1, after: tail.miniatures.pageInfo.endCursor }).miniatures, {
    nodes: [],
    totalCount: 4,
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  for (const filter of [
    { ownership: "OWNED" as const },
    { stage: "NOT_STARTED" as const },
    { search: "Same" },
  ])
    assert.throws(() => readMiniatures({ first: 2, after, ...filter }), code("BAD_USER_INPUT"));
  assert.throws(() => readHome({ first: 2, after }), code("BAD_USER_INPUT"));
  const searched = readMiniatures({ first: 1, search: " Same " });
  assert.deepEqual(
    ids(
      readMiniatures({ first: 100, search: "Same", after: searched.miniatures.pageInfo.endCursor }).miniatures
        .nodes,
    ),
    [middle, last],
  );
  const home = readHome({ first: 1 });
  assert.throws(
    () => readHome({ first: 1, stage: "COMPLETE", after: home.miniatures.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(
    () => readHome({ first: 1, search: "Same", after: home.miniatures.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  sqlite.prepare("UPDATE miniatures SET title='Renamed',updated_at=? WHERE id=?").run(timestamp + 1, last);
  assert.throws(() => readMiniatures({ first: 2, after }), code("STALE_CURSOR"));
  assert.throws(
    () => readHome({ first: 1, after: home.miniatures.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
  assert.ok(readMiniatures({ first: 1 }).revision.seq > page.revision.seq);
});

void test("validation rejects oversized pages/text, invalid filters and malformed cursors on all connections", () => {
  const id = miniature("Fixture");
  const p = paint("Fixture");
  requirement(id, p);
  link(id, scheme([p]));
  const view = readMiniature(id);
  for (const first of [0, -1, 1.5, 101, NaN, Infinity]) {
    assert.throws(() => readHome({ first }), code("BAD_USER_INPUT"));
    assert.throws(() => readMiniatures({ first }), code("BAD_USER_INPUT"));
    for (const connection of nested) assert.throws(() => connection(view, { first }), code("BAD_USER_INPUT"));
  }
  for (const search of ["x".repeat(129), "x".repeat(257)]) {
    assert.throws(() => readHome({ first: 1, search }), code("BAD_USER_INPUT"));
    assert.throws(() => readMiniatures({ first: 1, search }), code("BAD_USER_INPUT"));
  }
  assert.throws(() => readMiniature("x".repeat(257)), code("BAD_USER_INPUT"));
  assert.throws(
    () => readMiniatures({ first: 1, ownership: "INVALID" as ListArgs["ownership"] }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(
    () => readMiniatures({ first: 1, stage: "INVALID" as ListArgs["stage"] }),
    code("BAD_USER_INPUT"),
  );
  assert.throws(() => readHome({ first: 1, stage: "INVALID" as ListArgs["stage"] }), code("BAD_USER_INPUT"));
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const cursor = readMiniatures({ first: 1 }).miniatures.pageInfo.endCursor!;
  const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown[];
  const malformed = [
    "",
    "!",
    "not-a-cursor",
    "x".repeat(8193),
    encode({}),
    encode([]),
    encode(["wrong", ...decoded.slice(1)]),
    encode([...decoded.slice(0, 4), uuid(999)]),
    encode([...decoded.slice(0, 3), 0.5, id]),
    encode([...decoded, "extra"]),
  ];
  for (const after of malformed) {
    assert.throws(() => readMiniatures({ first: 1, after }), code("BAD_USER_INPUT"));
    assert.throws(() => readHome({ first: 1, after }), code("BAD_USER_INPUT"));
    for (const connection of nested)
      assert.throws(() => connection(view, { first: 1, after }), code("BAD_USER_INPUT"));
  }
  assert.throws(
    () =>
      readMiniatures({ first: 1, after: encode([decoded[0], decoded[1], "other epoch", decoded[3], id]) }),
    code("STALE_CURSOR"),
  );
});

void test("recipe pagination retains more than 100 full notes, repeated paints in separate steps and explicit empty steps", () => {
  const id = miniature("Large recipe");
  const notes = "Complete recipe instructions.\n".repeat(60);
  const paints = Array.from({ length: 103 }, (_, i) => paint(`Paint ${i}`));
  const entries = paints.map((p, i) => requirement(id, p, "BASECOAT", `${i}: ${notes}`, i));
  const highlight = requirement(id, paints[0], "HIGHLIGHT", "Repeat the same physical paint", 0);
  sqlite
    .prepare("INSERT INTO miniature_recipe_steps(miniature_id,step,updated_at) VALUES(?,'PRIMER',?)")
    .run(id, timestamp);
  const view = readMiniature(id);
  assert.deepEqual(view.recipeSteps, ["PRIMER", "BASECOAT", "HIGHLIGHT"]);
  const first = miniatureRecipe(view, { first: 100 });
  const second = miniatureRecipe(view, { first: 100, after: first.pageInfo.endCursor });
  assert.equal(first.totalCount, 104);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.equal(second.pageInfo.hasNextPage, false);
  const rows = [...first.nodes, ...second.nodes];
  assert.deepEqual(ids(rows), [...entries, highlight]);
  rows.slice(0, 103).forEach((row, i) => {
    assert.equal(row.notes, `${i}: ${notes}`);
    assert.equal(row.paint.id, paints[i]);
    assert.equal(row.sortOrder, i);
  });
  assert.equal(rows[103].paint.id, paints[0]);
  assert.equal(rows[103].notes, "Repeat the same physical paint");
  assert.equal(miniatureRequired(view, { first: 100 }).totalCount, 103);
  assert.equal(miniatureRequired(view, { first: 100 }).pageInfo.hasNextPage, true);
  const rest = miniatureRequired(view, {
    first: 100,
    after: miniatureRequired(view, { first: 100 }).pageInfo.endCursor,
  });
  assert.deepEqual(ids(rest.nodes), paints.slice(100));
  const missing = miniatureMissing(view, { first: 100 });
  assert.equal(missing.totalCount, 103);
  assert.deepEqual(
    ids(miniatureMissing(view, { first: 100, after: missing.pageInfo.endCursor }).nodes),
    paints.slice(100),
  );
});

void test("nested connections are ordered, scope-bound and captured before subsequent SQL writes", () => {
  const a = paint("Before A");
  const b = paint("Before B");
  const id = miniature("Project");
  const other = miniature("Other project");
  requirement(id, b, "HIGHLIGHT", "Old highlight", 0);
  requirement(id, a, "BASECOAT", "Old basecoat", 20);
  requirement(other, a);
  const late = scheme([b], "Later scheme");
  const early = scheme([a], "Earlier scheme");
  link(id, late, 20);
  link(id, early, 10);
  link(other, early);
  const view = readMiniature(id);
  assert.deepEqual(
    miniatureRecipe(view, { first: 100 }).nodes.map((r) => r.step),
    ["BASECOAT", "HIGHLIGHT"],
  );
  assert.deepEqual(
    miniatureSchemes(view, { first: 100 }).nodes.map((r) => [r.scheme.id, r.sortOrder]),
    [
      [early, 10],
      [late, 20],
    ],
  );
  const cursors = nested.map((connection) => connection(view, { first: 1 }).pageInfo.endCursor);
  nested.forEach((connection, i) => {
    const first = connection(view, { first: 1 });
    assert.equal(first.totalCount, 2);
    assert.equal(first.pageInfo.hasNextPage, true);
    assert.equal(connection(view, { first: 1, after: cursors[i] }).nodes.length, 1);
    assert.throws(
      () => connection(readMiniature(other), { first: 1, after: cursors[i] }),
      code("BAD_USER_INPUT"),
    );
    assert.throws(() => readMiniatures({ first: 1, after: cursors[i] }), code("BAD_USER_INPUT"));
    nested.forEach((different, j) => {
      if (i !== j)
        assert.throws(() => different(view, { first: 1, after: cursors[i] }), code("BAD_USER_INPUT"));
    });
  });
  const captured = nested.map((connection) => connection(view, { first: 100 }));
  sqlite.prepare("UPDATE paint_catalog SET name='After A',updated_at=? WHERE id=?").run(timestamp + 1, a);
  inventory(a);
  sqlite.prepare("UPDATE miniature_required_paints SET notes='New notes' WHERE miniature_id=?").run(id);
  sqlite.prepare("UPDATE color_schemes SET name='Renamed scheme' WHERE id=?").run(early);
  sqlite.prepare("DELETE FROM miniature_color_schemes WHERE miniature_id=? AND scheme_id=?").run(id, late);
  nested.forEach((connection, i) => {
    assert.deepEqual(connection(view, { first: 100 }), captured[i]);
    assert.doesNotThrow(() => connection(view, { first: 1, after: cursors[i] }));
    assert.throws(() => connection(readMiniature(id), { first: 1, after: cursors[i] }), code("STALE_CURSOR"));
  });
  const fresh = readMiniature(id);
  assert.equal(miniatureRecipe(fresh, { first: 1 }).nodes[0].paint.name, "After A");
  assert.equal(miniatureRecipe(fresh, { first: 1 }).nodes[0].notes, "New notes");
  assert.equal(miniatureSchemes(fresh, { first: 1 }).nodes[0].scheme.name, "Renamed scheme");
  assert.equal(miniatureSchemes(fresh, { first: 100 }).totalCount, 1);
  assert.deepEqual(ids(miniatureMissing(fresh, { first: 100 }).nodes), [b]);
});

void test("preview swatches filter null colors before the eight-color cap, and image URLs preserve source/local selection", () => {
  const id = miniature("Swatches");
  const noColor = paint("No color", null);
  requirement(id, noColor, "OTHER", "", 0);
  const colors = Array.from({ length: 9 }, (_, i) => paint(`Color ${i}`, `#${String(i).repeat(6)}`));
  colors.forEach((p, i) => requirement(id, p, "OTHER", "", i + 1));
  let row = readMiniature(id).miniature!;
  assert.deepEqual(
    row.previewSwatches,
    colors.slice(0, 8).map((paintId, i) => ({ paintId, colorHex: `#${String(i).repeat(6)}` })),
  );
  assert.equal(row.previewSwatchesTruncated, true);
  assert.equal(row.imageUrl, null);
  sqlite
    .prepare("DELETE FROM miniature_required_paints WHERE miniature_id=? AND paint_id=?")
    .run(id, colors[8]);
  sqlite
    .prepare("UPDATE miniatures SET source_image_url='https://example.invalid/miniature.png' WHERE id=?")
    .run(id);
  row = readMiniature(id).miniature!;
  assert.equal(row.previewSwatches.length, 8);
  assert.equal(row.previewSwatchesTruncated, false);
  assert.equal(row.imageUrl, "https://example.invalid/miniature.png");
  const imageKey = `${uuid(999)}.png`;
  sqlite.prepare("UPDATE miniatures SET image_key=? WHERE id=?").run(imageKey, id);
  assert.equal(
    readMiniature(id).miniature!.imageUrl,
    `/api/miniatures/${id}/image?v=${encodeURIComponent(imageKey)}`,
  );
});

void test("navigation shopping is explicit wishlist plus depleted inventory, separate from effective availability", () => {
  const physical = paint("Physical");
  const target = paint("Virtual mix");
  const wishAvailable = paint("Wishlist with available mix");
  const wishMissing = paint("Wishlist without mix");
  const depleted = paint("Depleted with available mix");
  const zero = paint("Zero quantity");
  const emptyOwned = paint("Broken owned");
  paint("Untracked");
  inventory(physical, "OWNED", "LOW", 2);
  inventory(wishAvailable, "WISHLIST");
  inventory(wishMissing, "WISHLIST");
  inventory(depleted, "OWNED", "EMPTY", 2);
  inventory(zero, "OWNED", "FULL", 0);
  inventory(emptyOwned);
  substitution(target, [physical]);
  substitution(wishAvailable, [physical]);
  substitution(depleted, [physical]);
  substitution(emptyOwned);
  const result = readVaultNavigation();
  assert.equal(result.availablePaints, 4);
  assert.equal(result.shoppingPaints, 4);
  assert.deepEqual(result.revision, readHome({ first: 1 }).revision);
});

void test("warm generations build exactly once, rank each filtered query once and rebuild once after REST or raw SQL stock writes", async () => {
  const p = paint("Stock");
  const first = miniature("Cache hero");
  miniature("Cache hero");
  requirement(first, p);
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 0, searchRanks: 0, resultSets: 0 });
  const cold = readHome({ first: 1, search: " hero " });
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 1, searchRanks: 1, resultSets: 1 });
  readHome({ first: 1, search: "hero", after: cold.miniatures.pageInfo.endCursor });
  readMiniatures({ first: 100, search: "hero", ownership: "OWNED" });
  readMiniature(first);
  readVaultNavigation();
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 1, searchRanks: 1, resultSets: 1 });
  readMiniatures({ first: 1, search: "hero" });
  readMiniatures({ first: 100, search: "hero" });
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 1, searchRanks: 2, resultSets: 2 });
  const { PUT } = await import("../app/api/paint-state/route.ts");
  const response = await PUT(
    new Request("http://127.0.0.1/api/paint-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paintId: p, state: "OWNED", stockLevel: "LOW", quantity: 2 }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(readHome({ first: 1, search: "hero" }).counts.ready, 1);
  readMiniatures({ first: 1, search: "hero", ownership: "OWNED" });
  readMiniature(first);
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 2, searchRanks: 3, resultSets: 1 });
  sqlite
    .prepare("UPDATE paint_inventory SET stock_level='EMPTY',updated_at=? WHERE paint_id=?")
    .run(timestamp + 1, p);
  assert.equal(readHome({ first: 1, search: "hero" }).counts.ready, 0);
  readMiniatures({ first: 100, search: "hero", ownership: "OWNED" });
  readMiniature(first);
  readVaultNavigation();
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 3, searchRanks: 4, resultSets: 1 });
  clearMiniatureProjectionCache();
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 0, searchRanks: 0, resultSets: 0 });
  readHome({ first: 1, search: "hero" });
  assert.deepEqual(miniatureProjectionDiagnostics(), { builds: 1, searchRanks: 1, resultSets: 1 });
});

void test("expired search result cursors require a fresh first page without rescoring the abandoned window", () => {
  miniature("Search hero A");
  miniature("Search hero B");
  const home = readHome({ first: 1, search: "hero" });
  const list = readMiniatures({ first: 1, search: "hero" });
  const now = Date.now;
  const later = now() + 61_000;
  Date.now = () => later;
  try {
    assert.throws(
      () => readHome({ first: 1, search: "hero", after: home.miniatures.pageInfo.endCursor }),
      code("STALE_CURSOR"),
    );
    assert.throws(
      () => readMiniatures({ first: 1, search: "hero", after: list.miniatures.pageInfo.endCursor }),
      code("STALE_CURSOR"),
    );
    assert.equal(miniatureProjectionDiagnostics().searchRanks, 2);
    assert.equal(readHome({ first: 1, search: "hero" }).miniatures.totalCount, 2);
    assert.equal(miniatureProjectionDiagnostics().searchRanks, 3);
  } finally {
    Date.now = now;
  }
});

void test("warm linked-scheme details reuse the captured paint projection without full catalog scans", () => {
  const p = paint("Attached scheme paint");
  const id = miniature("Warm detail");
  link(id, scheme([p]));
  readMiniature(id);
  const prepare = sqlite.prepare.bind(sqlite);
  let catalogScans = 0;
  sqlite.prepare = function (sql: string) {
    if (/FROM\s+paint_catalog\s+p\b/i.test(sql)) catalogScans++;
    return prepare(sql);
  };
  try {
    for (let i = 0; i < 3; i++) {
      const view = readMiniature(id);
      assert.equal(miniatureSchemes(view, { first: 100 }).nodes[0].scheme.paintCount, 1);
      readHome({ first: 1 });
      readMiniatures({ first: 1 });
    }
    assert.equal(catalogScans, 0, "warm details must not reload every paint for their scheme summaries");
    assert.equal(miniatureProjectionDiagnostics().builds, 1);
  } finally {
    sqlite.prepare = prepare;
  }
});

void test("rolled-back transaction projections do not poison a later committed generation with a reused sequence", () => {
  const id = miniature("Committed");
  const p = paint("Stock");
  requirement(id, p);
  const before = readHome({ first: 1 });
  const rollback = new Error("intentional rollback");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        sqlite.prepare("UPDATE miniatures SET title='Rolled back' WHERE id=?").run(id);
        inventory(p);
        assert.equal(readMiniature(id).miniature!.title, "Rolled back");
        assert.equal(readHome({ first: 1 }).counts.ready, 1);
        throw rollback;
      })(),
    (error: unknown) => error === rollback,
  );
  assert.deepEqual(readHome({ first: 1 }), before);
  sqlite.prepare("UPDATE miniatures SET title='Actually committed' WHERE id=?").run(id);
  assert.equal(readMiniature(id).miniature!.title, "Actually committed");
  assert.equal(readMiniatures({ first: 1, search: "Rolled back" }).miniatures.totalCount, 0);
  assert.equal(readHome({ first: 1 }).counts.ready, 0);
});

void test("GraphQL HTTP exposes Home, Miniatures, detail connections and navigation with serialized revisions", async () => {
  const id = miniature("HTTP project", { notes: "Metadata", stage: "PRIMED" });
  const p = paint("HTTP paint");
  requirement(id, p, "BASECOAT", "Complete instructions");
  link(id, scheme([p]));
  const { graphqlResponse } = await import("./server.ts");
  const post = (query: string) =>
    graphqlResponse(
      new Request("http://127.0.0.1/api/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      }),
      false,
    );
  const response =
    await post(`query { home(first:1) { revision {epoch seq} counts {owned ready distinctMissingPaints}
    miniatures {nodes {id readiness {total missing}} totalCount pageInfo {hasNextPage endCursor}} }
    miniatures(first:1,ownership:OWNED,stage:PRIMED) {ownershipCounts {key count} miniatures {nodes {id}}}
    vaultNavigation {availablePaints shoppingPaints} }`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.errors, undefined, JSON.stringify(payload));
  assert.equal(payload.data.home.revision.seq, String(readHome({ first: 1 }).revision.seq));
  assert.deepEqual(payload.data.home.counts, { owned: 1, ready: 0, distinctMissingPaints: 1 });
  assert.equal(payload.data.home.miniatures.nodes[0].id, id);
  assert.deepEqual(payload.data.miniatures.miniatures.nodes, [{ id }]);
  assert.deepEqual(payload.data.vaultNavigation, { availablePaints: 0, shoppingPaints: 0 });
  const detail = await post(`query {miniature(id:"${id}") {miniature {id notes paintingStatus} recipeSteps
    recipe(first:1) {nodes {paint {id} step notes} totalCount}
    schemes(first:1) {nodes {scheme {paintCount availableCount}} totalCount}
    required(first:1) {nodes {id} totalCount} missing(first:1) {nodes {id missingStock brokenSubstitution} totalCount}}}`);
  assert.equal(detail.status, 200);
  const result = await detail.json();
  assert.equal(result.errors, undefined, JSON.stringify(result));
  assert.deepEqual(result.data.miniature.miniature, { id, notes: "Metadata", paintingStatus: "PRIMED" });
  assert.deepEqual(result.data.miniature.recipe.nodes, [
    { paint: { id: p }, step: "BASECOAT", notes: "Complete instructions" },
  ]);
  assert.deepEqual(result.data.miniature.required.nodes, [{ id: p }]);
  assert.deepEqual(result.data.miniature.missing.nodes, [
    { id: p, missingStock: true, brokenSubstitution: false },
  ]);
  assert.deepEqual(result.data.miniature.schemes.nodes, [{ scheme: { paintCount: 1, availableCount: 0 } }]);
});

void test("home and miniature lists expose bounded local thumbnails while details retain originals", () => {
  const id = miniature("Thumbnail model");
  const imageKey = `${uuid(998)}.webp`;
  sqlite.prepare("UPDATE miniatures SET image_key=? WHERE id=?").run(imageKey, id);
  const original = `/api/miniatures/${id}/image?v=${imageKey}`;
  for (const row of [
    readHome({ first: 40 }).miniatures.nodes[0],
    readMiniatures({ first: 40 }).miniatures.nodes[0],
  ]) {
    assert.equal(row.thumbnailUrl, `${original}&w=320`);
    assert.equal(row.imageUrl, original);
  }
  assert.equal(readMiniature(id).miniature!.imageUrl, original);
  sqlite
    .prepare("UPDATE miniatures SET image_key=NULL,source_image_url=? WHERE id=?")
    .run("https://external.test/original.png?v=external", id);
  assert.equal(
    readMiniatures({ first: 40 }).miniatures.nodes[0].thumbnailUrl,
    "https://external.test/original.png?v=external",
  );
});
