import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError, graphql } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-schemes-"));
const previousData = process.env.DATA_DIR,
  previousDatabase = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const { readSchemes, readSchemePaintOptions } = await import("./schemes.ts");
const { readMiniatureScheme } = await import("./miniature-schemes.ts");
const { schema } = await import("./server.ts");
const { readRevision } = await import("./library.ts");
const sqlite = getSqlite();
let serial = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
function scheme(name: string, category: string | null = "RED") {
  const id = uuid();
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,category,created_at) VALUES(?,?,?,1)")
    .run(id, name, category);
  return id;
}
function paint(name: string, owned = false, color = "#123456") {
  const id = uuid();
  sqlite
    .prepare("INSERT INTO paint_catalog(id,brand,range,name,color_hex) VALUES(?,'Fixture','Base',?,?)")
    .run(id, name, color);
  if (owned)
    sqlite
      .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity) VALUES(?,'OWNED','FULL',1)")
      .run(id);
  return id;
}
function attach(schemeId: string, paintId: string, sortOrder = 0) {
  sqlite
    .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,?)")
    .run(schemeId, paintId, sortOrder);
}
function source(schemeId: string, name = "Source A") {
  const id = uuid();
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,?,'https://example.invalid','main',?,'1','[]',1)",
    )
    .run(id, `fixture/${id}`, name);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'scheme',?)")
    .run(id, schemeId);
  return id;
}
const ids = (nodes: { id: string }[]) => nodes.map((node) => node.id);
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

void test("scheme facets preserve global categories/sources and contextual readiness without search", () => {
  const red = scheme("Scarlet"),
    blue = scheme("Ocean", "BLUE"),
    empty = scheme("Empty", null);
  const p = paint("Vermilion", true);
  attach(red, p);
  attach(blue, paint("Azure"));
  const origin = source(red);
  const filtered = readSchemes({
    first: 48,
    category: "RED",
    sourceId: origin,
    usesPaintIds: [p],
    search: "nothingmatches",
    readiness: "MISSING",
  });
  assert.equal(filtered.totalCount, 0);
  assert.deepEqual(
    filtered.facets.readiness.map((f) => [f.key, f.count]),
    [
      ["ALL", 1],
      ["READY", 1],
      ["MISSING", 0],
    ],
  );
  assert.equal(filtered.facets.categories.find((f) => f.key === "BLUE")?.count, 1);
  assert.equal(filtered.facets.categories.find((f) => f.key === "GREEN")?.count, 0);
  assert.equal(filtered.facets.categories.find((f) => f.key === "")?.count, 1);
  assert.deepEqual(
    filtered.facets.sources.map((f) => [f.key, f.count]).sort(),
    [
      ["", 2],
      [origin, 1],
    ].sort(),
  );
  assert.deepEqual(ids(readSchemes({ first: 48, category: "" }).nodes), [empty]);
  assert.deepEqual(ids(readSchemes({ first: 48, noSource: true }).nodes), [blue, empty]);
  assert.deepEqual(ids(readSchemes({ first: 48, readiness: "READY" }).nodes), [red]);
  assert.deepEqual(ids(readSchemes({ first: 48, readiness: "MISSING" }).nodes), [blue, empty]);
});

void test("uses-paints AND original targets, duplicates and substitution readiness", () => {
  const target = paint("Target"),
    leaf = paint("Leaf", true),
    second = paint("Second", true);
  const both = scheme("Both"),
    one = scheme("One"),
    mix = uuid();
  attach(both, target);
  attach(both, second, 1);
  attach(one, target);
  attach(one, target, 1);
  sqlite
    .prepare(
      "INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at) VALUES(?,?,'Mix',1,1)",
    )
    .run(mix, target);
  sqlite
    .prepare(
      "INSERT INTO paint_substitution_ingredients(substitution_id,paint_id,parts,sort_order) VALUES(?,?,1,0)",
    )
    .run(mix, leaf);
  assert.deepEqual(ids(readSchemes({ first: 48, usesPaintIds: [target, second] }).nodes), [both]);
  assert.deepEqual(ids(readSchemes({ first: 48, usesPaintIds: [target, target] }).nodes), [both, one]);
  assert.equal(readSchemes({ first: 48, usesPaintIds: [leaf] }).totalCount, 0);
  assert.equal(readSchemes({ first: 48, usesPaintIds: [target, uuid()] }).totalCount, 0);
  const ready = readSchemes({ first: 48, readiness: "READY" });
  assert.deepEqual(ids(ready.nodes), [both, one]);
  assert.equal(ready.nodes[1].paintCount, 1);
  assert.equal(ready.nodes[1].availableCount, 1);
});

void test("fuzzy membership uses category labels then canonical category/name/ID order and scoped pages", () => {
  const redZ = scheme("Shared Zebra"),
    redA = scheme("Shared Alpha"),
    blue = scheme("Shared", "BLUE"),
    none = scheme("Shared", null);
  const tied = scheme("shared alpha");
  const expected = [blue, redA, tied, redZ, none];
  for (const search of ["Shared", "Shred"]) {
    const result: string[] = [];
    let after: string | null = null;
    do {
      const page = readSchemes({ first: 2, search, after });
      assert.equal(page.totalCount, 5);
      result.push(...ids(page.nodes));
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (after);
    assert.deepEqual(result, expected);
  }
  assert.deepEqual(ids(readSchemes({ first: 48, search: "Blue" }).nodes), [blue]);
  const cursor = readSchemes({ first: 1 }).pageInfo.endCursor;
  for (const change of [
    { search: "Shared" },
    { category: "RED" },
    { readiness: "READY" as const },
    { sourceId: uuid() },
    { noSource: true },
    { usesPaintIds: [uuid()] },
  ])
    assert.throws(() => readSchemes({ first: 1, after: cursor, ...change }), code("BAD_USER_INPUT"));
  assert.throws(() => readSchemes({ first: 1, after: "invalid" }), code("BAD_USER_INPUT"));
  sqlite.prepare("UPDATE color_schemes SET name='Changed' WHERE id=?").run(redZ);
  assert.throws(() => readSchemes({ first: 1, after: cursor }), code("STALE_CURSOR"));
});

void test("paint options filter used original paints and exclusions before fuzzy ranking and limit", () => {
  const s = scheme("Scheme"),
    unused = paint("Scarlet"),
    literal = paint("Scarlet"),
    fuzzy = paint("Scarlat"),
    leaf = paint("Resolved");
  attach(s, literal);
  attach(s, fuzzy, 1);
  assert.deepEqual(
    ids(readSchemePaintOptions({ first: 1, search: "Scarlet", excludeIds: [literal] }).items),
    [fuzzy],
  );
  assert.deepEqual(
    new Set(ids(readSchemePaintOptions({ first: 30, search: "", excludeIds: [] }).items)),
    new Set([literal, fuzzy]),
  );
  assert.equal(readSchemePaintOptions({ first: 30, search: "Resolved", excludeIds: [] }).items.length, 0);
  assert.notEqual(unused, leaf);
  for (const first of [0, 31, 1.5])
    assert.throws(
      () => readSchemePaintOptions({ first, search: "", excludeIds: [] }),
      code("BAD_USER_INPUT"),
    );
  for (const first of [0, 101, 1.5]) assert.throws(() => readSchemes({ first }), code("BAD_USER_INPUT"));
  assert.throws(() => readSchemes({ first: 1, search: "x".repeat(257) }), code("BAD_USER_INPUT"));
});

void test("card summaries preserve all repeated ordered names/colors, usage and last thumbnail", () => {
  const s = scheme("Long"),
    names: string[] = [],
    colors: string[] = [];
  for (let i = 0; i < 24; i++) {
    const name = `Color ${i}`,
      color = i % 2 ? "#ffffff" : "#000000";
    attach(s, paint(name, false, color), i);
    names.push(name);
    colors.push(color);
  }
  const first = sqlite
    .prepare("SELECT paint_id AS id FROM color_scheme_paints WHERE scheme_id=? AND sort_order=0")
    .get(s) as { id: string };
  attach(s, first.id, 24);
  names.push(names[0]);
  colors.push(colors[0]);
  sqlite
    .prepare(
      "INSERT INTO color_scheme_images(id,scheme_id,image_url,thumbnail_url,sort_order) VALUES(?,?,'/first','/first-thumb',1),(?,?,'/last','/last-thumb',50)",
    )
    .run(uuid(), s, uuid(), s);
  const mini = uuid();
  sqlite.prepare("INSERT INTO miniatures(id,title,status,created_at) VALUES(?,'Mini','OWNED',1)").run(mini);
  sqlite
    .prepare("INSERT INTO miniature_color_schemes(miniature_id,scheme_id,sort_order) VALUES(?,?,0)")
    .run(mini, s);
  const row = readSchemes({ first: 1 }).nodes[0];
  assert.equal(row.paintNames, names.join(" · "));
  assert.equal(
    row.gradient,
    `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${(i / 24) * 100}%`).join(", ")})`,
  );
  assert.equal(row.usageCount, 1);
  assert.equal(row.imageUrl, "/last-thumb");
  assert.equal(row.previewSwatches.length, 8);
  assert.equal(row.previewSwatchesTruncated, true);
  assert.equal(readMiniatureScheme(s).scheme?.gradient, row.gradient);
});

void test("transaction rollback never poisons scheme projection at reused sequence", () => {
  const s = scheme("Committed");
  const before = readSchemes({ first: 48 });
  assert.throws(
    () =>
      sqlite.transaction(() => {
        sqlite.prepare("UPDATE color_schemes SET name='Abandoned' WHERE id=?").run(s);
        assert.equal(readSchemes({ first: 48 }).nodes[0].name, "Abandoned");
        throw new Error("rollback");
      })(),
    /rollback/,
  );
  assert.deepEqual(readSchemes({ first: 48 }), before);
  sqlite.prepare("UPDATE color_schemes SET name='Final' WHERE id=?").run(s);
  assert.equal(readSchemes({ first: 48 }).nodes[0].name, "Final");
});

void test("GraphQL owner commands return atomic trigger envelopes, preserve errors and cascade links", async () => {
  const p = paint("Paint");
  const input = {
    name: "Owner",
    category: "RED",
    entries: [
      { type: "DIVIDER", label: "BASECOAT", tone: "SECTION" },
      { type: "PAINT", paintId: p },
    ],
  };
  const selection = "schemeId clientMutationId revision{epoch seq} invalidatedFamilies";
  const created = await graphql({
    schema,
    source: `mutation($input:SchemeInput!){createScheme(input:$input,clientMutationId:"fixture"){${selection}}}`,
    variableValues: { input },
  });
  assert.equal(created.errors, undefined, JSON.stringify(created));
  const payload = created.data!.createScheme as {
    schemeId: string;
    clientMutationId: string;
    revision: { epoch: string; seq: string };
    invalidatedFamilies: string[];
  };
  assert.equal(payload.clientMutationId, "fixture");
  assert.ok(payload.invalidatedFamilies.includes("SCHEMES"));
  assert.deepEqual({ ...payload.revision }, { ...readRevision(), seq: String(readRevision().seq) });
  const changed = await graphql({
    schema,
    source: `mutation($id:ID!,$input:SchemeInput!){updateScheme(id:$id,input:$input){${selection}}}`,
    variableValues: { id: payload.schemeId, input: { ...input, name: "Changed" } },
  });
  assert.equal(changed.errors, undefined, JSON.stringify(changed));
  assert.equal(readMiniatureScheme(payload.schemeId).scheme?.name, "Changed");
  const before = readRevision();
  const bad = await graphql({
    schema,
    source: `mutation($id:ID!,$input:SchemeInput!){updateScheme(id:$id,input:$input){${selection}}}`,
    variableValues: { id: payload.schemeId, input: { ...input, entries: [] } },
  });
  assert.equal(bad.errors?.[0].extensions.code, "BAD_USER_INPUT");
  assert.deepEqual(readRevision(), before);
  const imported = scheme("Imported");
  const forbidden = await graphql({
    schema,
    source: `mutation($id:ID!){deleteScheme(id:$id){${selection}}}`,
    variableValues: { id: imported },
  });
  assert.equal(forbidden.errors?.[0].extensions.code, "FORBIDDEN");
  const removed = await graphql({
    schema,
    source: `mutation($id:ID!){deleteScheme(id:$id){${selection}}}`,
    variableValues: { id: payload.schemeId },
  });
  assert.equal(removed.errors, undefined, JSON.stringify(removed));
  assert.equal(readMiniatureScheme(payload.schemeId).scheme, null);
  const missing = await graphql({
    schema,
    source: `mutation($id:ID!){deleteScheme(id:$id){${selection}}}`,
    variableValues: { id: payload.schemeId },
  });
  assert.equal(missing.errors?.[0].extensions.code, "NOT_FOUND");
});

void test("stress card preview is explicitly bounded while all authored entries remain available", (t) => {
  const s = scheme("Stress"),
    p = paint("A representative paint name");
  const insert = sqlite.prepare(
    "INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,?)",
  );
  sqlite.transaction(() => {
    for (let i = 0; i < 1000; i++) insert.run(s, p, i);
  })();
  const row = readSchemes({ first: 1 }).nodes[0];
  assert.ok(row.paintNames.length <= 512);
  assert.equal(row.gradient.split("#123456").length - 1, 32);
  assert.ok(row.previewMoreCount >= 968);
  assert.equal(readMiniatureScheme(s).entries.length, 1000);
  t.diagnostic(
    `1000-step single-scheme compact summary JSON bytes=${Buffer.byteLength(JSON.stringify(row))}`,
  );
});
