import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-miniature-schemes-"));
const previousData = process.env.DATA_DIR;
const previousDatabase = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const {
  readMiniatureSchemeOptions,
  readMiniatureScheme,
  miniatureSchemeEntries,
  readAttachedMiniatureSchemes,
} = await import("./miniature-schemes.ts");
const sqlite = getSqlite();
const timestamp = 1_800_000_000_000;
let serial = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
function scheme(name: string) {
  const id = uuid();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,category,created_at,updated_at) VALUES(?,?,'RED',?,?)")
    .run(id, name, timestamp, timestamp);
  return id;
}
function paint(schemeId: string, order: number, owned = false) {
  const id = uuid();
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,discontinued,updated_at) VALUES(?,'Fixture','Base','Paint','#112233',0,?)",
    )
    .run(id, timestamp);
  sqlite
    .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,?,?)")
    .run(schemeId, id, order, timestamp);
  if (owned)
    sqlite
      .prepare(
        "INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,'OWNED','FULL',1,?)",
      )
      .run(id, timestamp);
  return id;
}
const code = (expected: string) => (error: unknown) =>
  error instanceof GraphQLError && error.extensions.code === expected;
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources;",
  );
  serial = 0;
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (previousData === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousData;
  if (previousDatabase === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabase;
});
void test("empty, missing and bounded options", () => {
  assert.equal(readMiniatureSchemeOptions({ first: 100 }).totalCount, 0);
  const missing = readMiniatureScheme(uuid());
  assert.equal(missing.scheme, null);
  assert.deepEqual(miniatureSchemeEntries(missing, { first: 1 }).nodes, []);
  for (const first of [0, 101, 1.5, NaN])
    assert.throws(() => readMiniatureSchemeOptions({ first }), code("BAD_USER_INPUT"));
  assert.throws(
    () => readMiniatureSchemeOptions({ first: 1, search: "x".repeat(257) }),
    code("BAD_USER_INPUT"),
  );
});
void test("fuzzy options, compact swatches/counts, scoped revision cursors and source metadata", () => {
  const a = scheme("Scarlet");
  const b = scheme("Scarlet second");
  scheme("Obsidian");
  const firstPaint = paint(a, 0, true);
  for (let i = 1; i < 10; i++) paint(a, i);
  const sourceId = uuid();
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'fixture/plugin','https://example.invalid','main','Plugin','1','[]',?)",
    )
    .run(sourceId, timestamp);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'scheme',?)")
    .run(sourceId, a);
  const found = readMiniatureSchemeOptions({ first: 1, search: "scarlte" });
  assert.equal(found.totalCount, 2);
  assert.equal(found.nodes[0].id, a);
  assert.equal(found.nodes[0].isSystem, true);
  assert.equal(found.nodes[0].sourceName, "Plugin");
  assert.equal(found.nodes[0].paintCount, 10);
  assert.equal(found.nodes[0].availableCount, 1);
  assert.equal(found.nodes[0].previewSwatches.length, 8);
  assert.deepEqual(found.nodes[0].previewSwatches[0], { paintId: firstPaint, colorHex: "#112233" });
  assert.equal(found.nodes[0].previewSwatchesTruncated, true);
  assert.equal(
    readMiniatureSchemeOptions({ first: 1, search: "scarlte", after: found.pageInfo.endCursor }).nodes[0].id,
    b,
  );
  assert.throws(
    () => readMiniatureSchemeOptions({ first: 1, after: found.pageInfo.endCursor }),
    code("BAD_USER_INPUT"),
  );
  sqlite.prepare("UPDATE color_schemes SET name='Changed',updated_at=? WHERE id=?").run(timestamp + 1, b);
  assert.throws(
    () => readMiniatureSchemeOptions({ first: 1, search: "scarlte", after: found.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
});
void test("entry details capture mixed rows, inventory and links independently of subsequent writes", () => {
  const a = scheme("Mixed");
  const p = paint(a, 1, true);
  const divider = uuid(),
    image = uuid(),
    miniatureId = uuid();
  sqlite
    .prepare(
      "INSERT INTO color_scheme_dividers(id,scheme_id,label,tone,role,sort_order,updated_at) VALUES(?,?,'Legacy divider label','MILESTONE','START',0,?)",
    )
    .run(divider, a, timestamp);
  sqlite
    .prepare(
      "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url,image_type,method,sort_order,updated_at) VALUES(?,?,'/image','/thumb','Reference','Brush',2,?)",
    )
    .run(image, a, timestamp);
  sqlite
    .prepare("INSERT INTO miniatures(id,title,status,created_at,updated_at) VALUES(?,'Mini','OWNED',?,?)")
    .run(miniatureId, timestamp, timestamp);
  sqlite
    .prepare(
      "INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order,updated_at) VALUES(?,?,7,?)",
    )
    .run(miniatureId, a, timestamp);
  const view = readMiniatureScheme(a);
  assert.deepEqual(
    view.entries.map((entry) => entry.kind),
    ["DIVIDER", "PAINT", "IMAGE"],
  );
  assert.equal(view.entries[0].id, divider);
  assert.equal(view.entries[0].label, "Legacy divider label");
  assert.equal(view.entries[2].id, image);
  assert.equal(view.entries[1].paint?.available, true);
  assert.equal(view.entries[2].thumbnailUrl, "/thumb");
  assert.equal(view.scheme?.imageUrl, "/thumb");
  const links = readAttachedMiniatureSchemes(miniatureId);
  assert.equal(links[0].sortOrder, 7);
  assert.equal(links[0].scheme.id, a);
  assert.deepEqual(readAttachedMiniatureSchemes(uuid()), []);
  const first = miniatureSchemeEntries(view, { first: 1 });
  assert.equal(first.totalCount, 3);
  sqlite.prepare("UPDATE paint_catalog SET name='Renamed',updated_at=? WHERE id=?").run(timestamp + 1, p);
  assert.equal(
    miniatureSchemeEntries(view, { first: 2, after: first.pageInfo.endCursor }).nodes[0].paint?.name,
    "Paint",
  );
  assert.equal(readMiniatureScheme(a).entries[1].paint?.name, "Renamed");
  assert.throws(
    () => miniatureSchemeEntries(readMiniatureScheme(a), { first: 1, after: first.pageInfo.endCursor }),
    code("STALE_CURSOR"),
  );
  assert.throws(
    () =>
      miniatureSchemeEntries(readMiniatureScheme(scheme("Other")), {
        first: 1,
        after: first.pageInfo.endCursor,
      }),
    code("BAD_USER_INPUT"),
  );
});
void test("rolled-back transaction never poisons generation caches at reused sequence", () => {
  const id = scheme("Committed");
  const initial = readMiniatureSchemeOptions({ first: 100 });
  const rollback = new Error("rollback");
  assert.throws(
    () =>
      sqlite.transaction(() => {
        sqlite
          .prepare("UPDATE color_schemes SET name='Abandoned',updated_at=? WHERE id=?")
          .run(timestamp + 1, id);
        assert.equal(readMiniatureSchemeOptions({ first: 100 }).nodes[0].name, "Abandoned");
        throw rollback;
      })(),
    (error: unknown) => error === rollback,
  );
  assert.deepEqual(readMiniatureSchemeOptions({ first: 100 }), initial);
  sqlite.prepare("UPDATE color_schemes SET name='Final',updated_at=? WHERE id=?").run(timestamp + 2, id);
  assert.equal(readMiniatureSchemeOptions({ first: 100 }).nodes[0].name, "Final");
});

void test("category facets ignore search/category but exclude attached schemes before fuzzy ranking", () => {
  const literal = scheme("Scarlet");
  const fuzzy = scheme("Scarlat");
  const other = scheme("Obsidian");
  sqlite.prepare("UPDATE color_schemes SET category='BLUE' WHERE id=?").run(other);
  const result = readMiniatureSchemeOptions({
    first: 100,
    search: "scarlet",
    excludeIds: [literal],
    category: "RED",
  });
  assert.deepEqual(
    result.nodes.map((row) => row.id),
    [fuzzy],
  );
  assert.deepEqual(result.categoryCounts, [
    { key: "BLUE", label: "BLUE", count: 1 },
    { key: "RED", label: "RED", count: 1 },
  ]);
  const all = readMiniatureSchemeOptions({ first: 1 });
  for (const args of [{ category: "RED" }, { excludeIds: [literal] }])
    assert.throws(
      () => readMiniatureSchemeOptions({ first: 1, after: all.pageInfo.endCursor, ...args }),
      code("BAD_USER_INPUT"),
    );
});

void test("shared source items preserve legacy last-source precedence", () => {
  const id = scheme("Shared"),
    first = uuid(),
    last = uuid();
  const insert = sqlite.prepare(
    "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,?,'https://example.invalid','main',?,'1','[]',?)",
  );
  insert.run(first, "fixture/first", "First", timestamp);
  insert.run(last, "fixture/last", "Last", timestamp);
  const link = sqlite.prepare(
    "INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'scheme',?)",
  );
  link.run(first, id);
  link.run(last, id);
  assert.equal(readMiniatureSchemeOptions({ first: 40 }).nodes[0].sourceName, "Last");
  assert.equal(readMiniatureScheme(id).scheme?.sourceName, "Last");
});

void test("picker summaries dedupe repeated paint steps and prefer the last image thumbnail", () => {
  const id = scheme("Repeated"),
    p = paint(id, 0, true);
  sqlite
    .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order,updated_at) VALUES(?,?,1,?)")
    .run(id, p, timestamp);
  const insert = sqlite.prepare(
    "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url,sort_order,updated_at) VALUES(?,?,?,?,?,?)",
  );
  insert.run(uuid(), id, "/first", "/first-thumb", 2, timestamp);
  insert.run(uuid(), id, "/last", "/last-thumb", 3, timestamp);
  const row = readMiniatureSchemeOptions({ first: 40 }).nodes[0];
  assert.equal(row.paintCount, 1);
  assert.equal(row.availableCount, 1);
  assert.deepEqual(row.previewSwatches, [{ paintId: p, colorHex: "#112233" }]);
  assert.equal(row.imageUrl, "/last-thumb");
  sqlite
    .prepare("UPDATE color_scheme_images SET thumbnail_url='' WHERE scheme_id=? AND sort_order=3")
    .run(id);
  assert.equal(readMiniatureScheme(id).scheme?.imageUrl, "/last");
});

void test("scheme picker searches only name/category, never source metadata", () => {
  const id = scheme("Scarlet"),
    source = uuid();
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'fixture/origin','https://example.invalid','main','XylophoniumManufacturer','1','[]',?)",
    )
    .run(source, timestamp);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'scheme',?)")
    .run(source, id);
  for (const filter of [{}, { category: "RED" }, { excludeIds: [uuid()] }]) {
    assert.equal(
      readMiniatureSchemeOptions({ first: 40, search: "XylophoniumManufacturer", ...filter }).totalCount,
      0,
    );
    assert.equal(
      readMiniatureSchemeOptions({ first: 40, search: "Scarlet", ...filter }).nodes[0].sourceName,
      "XylophoniumManufacturer",
    );
  }
  assert.equal(readMiniatureSchemeOptions({ first: 40, search: "RED" }).nodes[0].id, id);
});

void test("scheme picker uses legacy base-sensitivity name order with ID ties across pages", () => {
  const expected = ["zebra", "éclair", "Alpha", "ÉCLAIR", "alpha", "beta", "Eclair", "Álpha"].map((name) => ({
    id: scheme(name),
    name,
  }));
  expected.sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const actual: string[] = [];
  let after: string | null = null;
  do {
    const page = readMiniatureSchemeOptions({ first: 2, after });
    assert.equal(page.totalCount, expected.length);
    actual.push(...page.nodes.map((node) => node.id));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after !== null);
  assert.deepEqual(
    actual,
    expected.map((row) => row.id),
  );
  assert.equal(new Set(actual).size, expected.length);
});
