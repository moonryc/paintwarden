import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { Catalog, Manifest, Paint, Scheme, Template } from "./source-format.ts";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-catalog-install-"));
process.env.DATA_DIR = directory;
// An inherited override must never send these mutations to a real vault.
process.env.DATABASE_PATH = path.join(directory, "paintwarden.sqlite");
const { getDb, getSqlite } = await import("../db/index.ts");
const { prepareCatalogInstall, executeCatalogInstall } = await import("./catalog-source-install.ts");
const db = getDb();
const sqlite = getSqlite();
test.after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

const manifest: Manifest = {
  formatVersion: 1,
  name: "Install test",
  version: "1.0.0",
  dependencies: [],
  catalog: "catalog.json",
  assets: "assets.json",
};
const empty = (): Catalog => ({ paints: [], schemes: [], templates: [] });
const paint = (): Paint => ({
  id: randomUUID(),
  brand: "Test",
  range: "Range",
  name: "Red",
  colorHex: "#ff0000",
});
const scheme = (paintId: string): Scheme => ({
  id: randomUUID(),
  name: "Recipe",
  category: "RED",
  entries: [{ id: randomUUID(), type: "PAINT", paintId }],
});
const template = (schemeId: string, paintId: string): Template => ({
  id: randomUUID(),
  name: "Model",
  manufacturer: "Test",
  faction: "Test",
  categories: [],
  schemeIds: [schemeId],
  paints: [{ paintId, step: "OTHER", notes: "Use red", sortOrder: 0 }],
});
const prepare = (id: string, catalog: Catalog, prior: Parameters<typeof prepareCatalogInstall>[7] = []) =>
  prepareCatalogInstall(
    id,
    `test/${id}`,
    `https://github.com/test/${id}`,
    "main",
    manifest,
    catalog,
    new Map(),
    prior,
  );
const commit = (...prepared: ReturnType<typeof prepare>[]) =>
  db.transaction((tx) => {
    for (const item of prepared) executeCatalogInstall(tx, item);
  });
const snapshot = () => {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return tables.map(({ name }) => [
    name,
    sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all(),
  ]);
};
const item = (sourceId: string, kind: string, itemId: string) =>
  sqlite
    .prepare("SELECT * FROM catalog_source_items WHERE source_id = ? AND kind = ? AND item_id = ?")
    .get(sourceId, kind, itemId);

void test("prepare compiles populated installs without any database writes", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id);
  const before = snapshot();
  const prepared = prepare(randomUUID(), { paints: [p], schemes: [s], templates: [t] });
  assert.deepEqual(snapshot(), before);
  assert.equal(sqlite.inTransaction, false);
  assert.throws(() => executeCatalogInstall(undefined as never, prepared), /requires a transaction/);
  assert.deepEqual(snapshot(), before);
});

void test("execution reuses statements without preparing SQL inside the transaction", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id);
  const prepared = prepare(randomUUID(), { paints: [p], schemes: [s], templates: [t] });
  db.transaction((tx) => {
    const original = sqlite.prepare;
    sqlite.prepare = () => {
      throw new Error("SQL preparation inside catalog commit");
    };
    try {
      executeCatalogInstall(tx, prepared);
    } finally {
      sqlite.prepare = original;
    }
  });
  assert.ok(item(prepared.id, "template", t.id));
});

void test("dependency preparations validate against prior installs and execute together", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id);
  const before = snapshot();
  assert.throws(() => prepare(randomUUID(), { ...empty(), schemes: [s] }), /missing paint/);
  assert.throws(() => prepare(randomUUID(), { ...empty(), templates: [t] }), /missing scheme/);
  const paints = prepare(randomUUID(), { ...empty(), paints: [p] });
  assert.throws(() => prepare(randomUUID(), { ...empty(), templates: [t] }, [paints]), /missing scheme/);
  const schemes = prepare(randomUUID(), { ...empty(), schemes: [s] }, [paints]);
  const templates = prepare(randomUUID(), { ...empty(), templates: [t] }, [paints, schemes]);
  assert.deepEqual(snapshot(), before);
  commit(paints, schemes, templates);
  assert.ok(item(paints.id, "paint", p.id));
  assert.ok(item(schemes.id, "scheme", s.id));
  assert.ok(item(templates.id, "template", t.id));
  assert.ok(
    sqlite
      .prepare("SELECT 1 FROM miniature_template_schemes WHERE template_id = ? AND scheme_id = ?")
      .get(t.id, s.id),
  );
});

void test("a reference removed by an earlier dependency update rolls back the entire commit", () => {
  const p = paint(),
    s = scheme(p.id),
    id = randomUUID();
  commit(prepare(id, { ...empty(), paints: [p] }));
  const before = snapshot();
  const dropped = prepare(id, empty());
  // A snapshot can still see this old paint. Commit-time foreign keys protect against
  // a prior dependency update deleting it, without partially installing either update.
  const dependant = prepare(randomUUID(), { ...empty(), schemes: [s] }, [dropped]);
  assert.throws(() => commit(dropped, dependant), /FOREIGN KEY constraint failed/);
  assert.deepEqual(snapshot(), before);
});

void test("prior preparations catch paint, scheme and template ownership conflicts before a transaction", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id);
  const before = snapshot();
  const first = prepare(randomUUID(), { paints: [p], schemes: [s], templates: [t] });
  assert.throws(
    () => prepare(randomUUID(), { ...empty(), paints: [{ ...p, name: "Different" }] }, [first]),
    /Paint ID conflicts/,
  );
  assert.throws(() => prepare(randomUUID(), { ...empty(), schemes: [s] }, [first]), /Scheme ID conflicts/);
  assert.throws(
    () => prepare(randomUUID(), { ...empty(), templates: [t] }, [first]),
    /Template ID conflicts/,
  );
  const shared = prepare(randomUUID(), { ...empty(), paints: [p] }, [first]);
  assert.deepEqual(snapshot(), before);
  commit(first, shared);
  assert.ok(item(first.id, "paint", p.id));
  assert.ok(item(shared.id, "paint", p.id));
});

void test("batched inserts retain all rows and relationships beyond two 250-row boundaries", () => {
  const paints = Array.from({ length: 503 }, paint);
  const schemes = paints.map((p) => scheme(p.id));
  const templates = schemes.map((s, index) => template(s.id, paints[index].id));
  const prepared = prepare(randomUUID(), { paints, schemes, templates });
  commit(prepared);
  for (let index = 0; index < paints.length; index++) {
    const p = paints[index],
      s = schemes[index],
      t = templates[index];
    assert.ok(item(prepared.id, "paint", p.id));
    assert.ok(item(prepared.id, "scheme", s.id));
    assert.ok(item(prepared.id, "template", t.id));
    assert.ok(
      sqlite
        .prepare("SELECT 1 FROM color_scheme_paints WHERE scheme_id = ? AND paint_id = ?")
        .get(s.id, p.id),
    );
    assert.ok(
      sqlite
        .prepare("SELECT 1 FROM miniature_template_paints WHERE template_id = ? AND paint_id = ?")
        .get(t.id, p.id),
    );
    assert.ok(
      sqlite
        .prepare("SELECT 1 FROM miniature_template_schemes WHERE template_id = ? AND scheme_id = ?")
        .get(t.id, s.id),
    );
  }
  assert.equal(
    (
      sqlite
        .prepare("SELECT count(*) AS n FROM catalog_source_items WHERE source_id = ?")
        .get(prepared.id) as { n: number }
    ).n,
    1509,
  );
});

void test("template folder and createdAt changes after prepare survive an update", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id),
    id = randomUUID();
  commit(prepare(id, { paints: [p], schemes: [s], templates: [t] }));
  const prepared = prepare(id, { paints: [p], schemes: [s], templates: [{ ...t, name: "Updated model" }] });
  const folderId = randomUUID();
  sqlite
    .prepare("INSERT INTO folders (id, kind, name, created_at) VALUES (?, 'template', 'Moved', 123)")
    .run(folderId);
  sqlite
    .prepare("UPDATE miniature_templates SET folder_id = ?, created_at = 456 WHERE id = ?")
    .run(folderId, t.id);
  commit(prepared);
  assert.deepEqual(
    sqlite.prepare("SELECT folder_id, created_at, name FROM miniature_templates WHERE id = ?").get(t.id),
    {
      folder_id: folderId,
      created_at: 456,
      name: "Updated model",
    },
  );
});

void test("paint usage added after prepare preserves a discontinued paint and source ownership", () => {
  const p = paint(),
    id = randomUUID();
  commit(prepare(id, { ...empty(), paints: [p] }));
  const prepared = prepare(id, empty());
  sqlite.prepare("INSERT INTO paint_inventory (paint_id, state, quantity) VALUES (?, 'OWNED', 3)").run(p.id);
  commit(prepared);
  assert.deepEqual(sqlite.prepare("SELECT discontinued FROM paint_catalog WHERE id = ?").get(p.id), {
    discontinued: 1,
  });
  assert.ok(item(id, "paint", p.id));
  assert.deepEqual(
    sqlite.prepare("SELECT state, quantity FROM paint_inventory WHERE paint_id = ?").get(p.id),
    { state: "OWNED", quantity: 3 },
  );
});

void test("paint usage removed after prepare permits deletion at execution time", () => {
  const p = paint(),
    id = randomUUID();
  commit(prepare(id, { ...empty(), paints: [p] }));
  sqlite.prepare("INSERT INTO paint_inventory (paint_id, state) VALUES (?, 'OWNED')").run(p.id);
  const prepared = prepare(id, empty());
  sqlite.prepare("DELETE FROM paint_inventory WHERE paint_id = ?").run(p.id);
  commit(prepared);
  assert.equal(sqlite.prepare("SELECT 1 FROM paint_catalog WHERE id = ?").get(p.id), undefined);
  assert.equal(item(id, "paint", p.id), undefined);
});

void test("dropping a template then its scheme removes their last paint usages in the same commit", () => {
  const p = paint(),
    s = scheme(p.id),
    t = template(s.id, p.id),
    id = randomUUID();
  commit(prepare(id, { paints: [p], schemes: [s], templates: [t] }));
  commit(prepare(id, empty()));
  for (const [table, key] of [
    ["miniature_templates", t.id],
    ["color_schemes", s.id],
    ["paint_catalog", p.id],
  ])
    assert.equal(sqlite.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(key), undefined);
  assert.equal(sqlite.prepare("SELECT 1 FROM color_scheme_paints WHERE scheme_id = ?").get(s.id), undefined);
  assert.equal(
    sqlite.prepare("SELECT 1 FROM miniature_template_schemes WHERE template_id = ?").get(t.id),
    undefined,
  );
  assert.equal(
    sqlite.prepare("SELECT 1 FROM miniature_template_paints WHERE template_id = ?").get(t.id),
    undefined,
  );
  assert.equal(sqlite.prepare("SELECT 1 FROM catalog_source_items WHERE source_id = ?").get(id), undefined);
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
});

void test("paint identity conflict introduced after prepare rolls back without writes", () => {
  const p = paint();
  const prepared = prepare(randomUUID(), { ...empty(), paints: [p] });
  const other = prepare(randomUUID(), { ...empty(), paints: [{ ...p, name: "Other identity" }] });
  commit(other);
  const before = snapshot();
  assert.throws(() => commit(prepared), /paint.*conflict/i);
  assert.deepEqual(snapshot(), before);
  assert.equal(item(prepared.id, "paint", p.id), undefined);
});

void test("matching paint owner introduced after prepare retains its nonidentity fields", () => {
  const p = paint();
  const prepared = prepare(randomUUID(), {
    ...empty(),
    paints: [{ ...p, discontinued: false, sourceLabel: "Incoming" }],
  });
  const other = prepare(randomUUID(), {
    ...empty(),
    paints: [
      { ...p, discontinued: true, sourceLabel: "Existing owner", sourceUrl: "https://example.com/paint" },
    ],
  });
  commit(other);
  const before = sqlite.prepare("SELECT * FROM paint_catalog WHERE id = ?").get(p.id);
  commit(prepared);
  assert.deepEqual(sqlite.prepare("SELECT * FROM paint_catalog WHERE id = ?").get(p.id), before);
  assert.ok(item(prepared.id, "paint", p.id));
  assert.ok(item(other.id, "paint", p.id));
});

void test("scheme owner introduced after prepare rejects installation without partial writes", () => {
  const p = paint(),
    s = scheme(p.id);
  const prepared = prepare(randomUUID(), { ...empty(), paints: [p], schemes: [s] });
  const other = prepare(randomUUID(), { ...empty(), paints: [p], schemes: [{ ...s, name: "Other owner" }] });
  commit(other);
  const before = snapshot();
  assert.throws(() => commit(prepared), /scheme.*conflict/i);
  assert.deepEqual(snapshot(), before);
  assert.equal(item(prepared.id, "scheme", s.id), undefined);
});
