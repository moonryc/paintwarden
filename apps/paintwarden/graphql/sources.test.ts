import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

import { GraphQLError } from "graphql";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-graphql-sources-"));
const previousData = process.env.DATA_DIR;
const previousDatabase = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { checkCatalogSourceVersions } = await import("../lib/catalog-sources.ts");
const { getSqlite } = await import("../db/index.ts");
const { readSources, readSourceVersions, readSourceRemoval, readSourceShareable } =
  await import("./sources.ts");
const sqlite = getSqlite();
const sourceId = "00000000-0000-4000-8000-000000000001";
const catalogPaintId = "00000000-0000-4000-8000-000000000002";
const customPaintId = "user:00000000-0000-4000-8000-000000000003";
const customSchemeId = "user:00000000-0000-4000-8000-000000000004";
const customTemplateId = "user:00000000-0000-4000-8000-000000000005";
const timestamp = 1_800_000_000_000;
function source() {
  sqlite
    .prepare(
      `INSERT INTO catalog_sources(id,repository,url,branch,name,version,license,attribution,dependencies,updated_at)
    VALUES(?,'upload:fixture','upload:fixture','main','Fixture plugin','1.0.0','MIT','Fixture author','[]',?)`,
    )
    .run(sourceId, timestamp);
}
function paint(id: string, name = "Paint") {
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,discontinued,updated_at) VALUES(?,'Fixture','Base',?,'#123456',0,?)",
    )
    .run(id, name, timestamp);
}
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog; DELETE FROM catalog_sources;",
  );
});
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
  if (previousData === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousData;
  if (previousDatabase === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabase;
});
void test("empty sources is a small revision envelope, without catalog records", () => {
  const view = readSources();
  assert.deepEqual(view.sources, []);
  assert.equal(typeof view.revision.seq, "number");
  assert.ok(Buffer.byteLength(JSON.stringify(view)) < 200);
  assert.deepEqual(readSourceShareable().paints, []);
});
void test("installed metadata includes license, attribution, dependency and SQL counts only", () => {
  source();
  paint(catalogPaintId);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'paint',?)")
    .run(sourceId, catalogPaintId);
  const [installed] = readSources().sources;
  assert.equal(installed.name, "Fixture plugin");
  assert.equal(installed.license, "MIT");
  assert.equal(installed.attribution, "Fixture author");
  assert.deepEqual(installed.dependencies, []);
  assert.deepEqual(installed.counts, { paints: 1, schemes: 0, templates: 0 });
  for (const field of ["branch", "logoSvg", "catalog", "assets", "updatedAt", "lastCheckedAt"])
    assert.equal(field in installed, false, field);
  assert.equal(readSourceShareable().paints.length, 0);
});
void test("removal preserves blockers and strips private deletion ID sets", () => {
  source();
  paint(catalogPaintId);
  sqlite
    .prepare("INSERT INTO catalog_source_items(source_id,kind,item_id) VALUES(?,'paint',?)")
    .run(sourceId, catalogPaintId);
  assert.equal(readSourceRemoval(sourceId).canRemove, true);
  sqlite
    .prepare(
      "INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,'OWNED','FULL',1,?)",
    )
    .run(catalogPaintId, timestamp);
  const preview = readSourceRemoval(sourceId);
  assert.equal(preview.canRemove, false);
  assert.deepEqual(preview.removes, { paints: 1, schemes: 0, templates: 0 });
  assert.deepEqual(preview.blockers, [{ label: "Paint inventory or wishlist entries", count: 1 }]);
  assert.equal("ids" in preview, false);
});
void test("removal input errors are typed and bounded", () => {
  const code = (expected: string) => (error: unknown) =>
    error instanceof GraphQLError && error.extensions.code === expected;
  assert.throws(() => readSourceRemoval(""), code("BAD_USER_INPUT"));
  assert.throws(() => readSourceRemoval("x".repeat(257)), code("BAD_USER_INPUT"));
  assert.throws(() => readSourceRemoval(sourceId), code("NOT_FOUND"));
});
void test("Create plugin reads only compact user-authored choices", () => {
  paint(catalogPaintId);
  paint(customPaintId, "Custom paint");
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,'Custom scheme',?,?)")
    .run(customSchemeId, timestamp, timestamp);
  sqlite
    .prepare(
      "INSERT INTO miniature_templates(id,name,categories,created_at,updated_at) VALUES(?,'Custom template','[]',?,?)",
    )
    .run(customTemplateId, timestamp, timestamp);
  const view = readSourceShareable();
  assert.deepEqual(view.paints, [{ id: customPaintId, name: "Fixture · Custom paint" }]);
  assert.deepEqual(view.schemes, [{ id: customSchemeId, name: "Custom scheme" }]);
  assert.deepEqual(view.templates, [{ id: customTemplateId, name: "Custom template" }]);
});
void test("uploaded plugin version checks stay offline", async () => {
  source();
  await checkCatalogSourceVersions();
  const view = readSourceVersions();
  assert.deepEqual(view.versions, [{ id: sourceId }]);
  assert.equal(typeof view.revision.seq, "number");
});

void test("version projection is local even for unchecked GitHub sources, and removes retired IDs", () => {
  source();
  sqlite
    .prepare(
      "UPDATE catalog_sources SET repository='fixture/github',url='https://github.com/fixture/github' WHERE id=?",
    )
    .run(sourceId);
  assert.deepEqual(readSourceVersions().versions, [{ id: sourceId }]);
  sqlite.prepare("DELETE FROM catalog_sources WHERE id=?").run(sourceId);
  assert.deepEqual(readSourceVersions().versions, []);
});
