import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-families-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const { changeLogEpoch, currentChangeSeq } = await import("../db/change-log.ts");
const { ALL_FAMILIES, invalidationSince } = await import("./changes.ts");
const sqlite = getSqlite();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const paint = `user:${uuid(1)}`,
  leaf = `user:${uuid(2)}`,
  mini = uuid(3),
  sub = uuid(4),
  scheme = uuid(5),
  source = uuid(6);
const cursor = () => ({ epoch: changeLogEpoch, since: currentChangeSeq(sqlite) });
const expectedAvailability = ["LIBRARY", "PAINT", "OPTIONS", "HOME", "MINIATURES", "WISHLIST", "SCHEMES"];
after(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

void test("durable trigger invalidations use precise families and conservative cascade/reset fanout", async (t) => {
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'Fixture','Base','Target'),(?,'Fixture','Base','Leaf')",
    )
    .run(paint, leaf);
  sqlite
    .prepare("INSERT INTO miniatures(id,title,status,created_at,updated_at) VALUES(?,'Fixture','OWNED',1,1)")
    .run(mini);
  sqlite
    .prepare("INSERT INTO color_schemes(id,name,created_at,updated_at) VALUES(?,'Fixture',1,1)")
    .run(scheme);
  sqlite
    .prepare(
      "INSERT INTO catalog_sources(id,repository,url,branch,name,version,dependencies,updated_at) VALUES(?,'fixture/plugin','u','main','Fixture','1','[]',1)",
    )
    .run(source);
  await t.test("no changes yields no invalidated families", () => {
    const c = cursor(),
      event = invalidationSince(c);
    assert.equal(event.reset, false);
    assert.equal(event.seq, c.since);
    assert.deepEqual(event.families, []);
  });
  await t.test("inventory and every substitution component fan out availability", () => {
    let c = cursor();
    sqlite
      .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity) VALUES(?,'OWNED','LOW',2)")
      .run(leaf);
    assert.deepEqual(new Set(invalidationSince(c).families), new Set(expectedAvailability));
    c = cursor();
    sqlite
      .prepare(
        "INSERT INTO paint_substitutions(id,target_paint_id,name,is_default,created_at,updated_at) VALUES(?,?,'Mix',1,1,1)",
      )
      .run(sub, paint);
    assert.deepEqual(new Set(invalidationSince(c).families), new Set(expectedAvailability));
    c = cursor();
    sqlite
      .prepare(
        "INSERT INTO paint_substitution_ingredients(substitution_id,paint_id,parts,sort_order) VALUES(?,?,2,0)",
      )
      .run(sub, leaf);
    assert.deepEqual(new Set(invalidationSince(c).families), new Set(expectedAvailability));
  });
  await t.test("model edits refresh detail usages without refreshing Library or options", () => {
    const c = cursor();
    sqlite.prepare("UPDATE miniatures SET title='Renamed' WHERE id=?").run(mini);
    const event = invalidationSince(c);
    assert.equal(event.reset, false);
    assert.deepEqual(
      new Set(event.families),
      new Set(["MINIATURES", "HOME", "WISHLIST", "PAINT", "SCHEMES"]),
    );
    assert.ok(!event.families.includes("LIBRARY"));
    assert.ok(!event.families.includes("OPTIONS"));
  });
  await t.test("scheme metadata and memberships invalidate their dependent views", () => {
    let c = cursor();
    sqlite.prepare("UPDATE color_schemes SET name='Renamed' WHERE id=?").run(scheme);
    assert.deepEqual(new Set(invalidationSince(c).families), new Set(["SCHEMES", "MINIATURES", "TEMPLATES"]));
    c = cursor();
    sqlite
      .prepare("INSERT INTO color_scheme_paints(scheme_id,paint_id,sort_order) VALUES(?,?,0)")
      .run(scheme, paint);
    const event = invalidationSince(c);
    assert.ok(event.families.includes("PAINT"));
    assert.ok(event.families.includes("WISHLIST"));
    assert.ok(event.families.includes("HOME"));
  });
  await t.test("source bookkeeping only refreshes SOURCES", () => {
    const c = cursor();
    sqlite
      .prepare("UPDATE catalog_sources SET last_error='Fixture error',updated_at=2 WHERE id=?")
      .run(source);
    const event = invalidationSince(c);
    assert.equal(event.reset, false);
    assert.deepEqual(event.families, ["SOURCES"]);
    assert.ok(event.seq > c.since);
    const same = cursor();
    sqlite.prepare("UPDATE catalog_sources SET last_error=last_error WHERE id=?").run(source);
    assert.deepEqual(invalidationSince(same).families, []);
  });
  await t.test("source display changes reset every family", () => {
    const c = cursor();
    sqlite.prepare("UPDATE catalog_sources SET name='Renamed plugin' WHERE id=?").run(source);
    const event = invalidationSince(c);
    assert.equal(event.reset, true);
    assert.deepEqual(event.families, [...ALL_FAMILIES]);
  });
  await t.test("deletion tombstones conservatively cover cascaded paint relationships", () => {
    sqlite
      .prepare("INSERT INTO miniature_required_paints(id,miniature_id,paint_id,step) VALUES(?,?,?,'OTHER')")
      .run(uuid(7), mini, paint);
    const c = cursor();
    sqlite.prepare("DELETE FROM paint_catalog WHERE id=?").run(paint);
    const event = invalidationSince(c);
    assert.equal(event.reset, false);
    for (const family of [...expectedAvailability, "TEMPLATES"])
      assert.ok(event.families.includes(family as (typeof event.families)[number]), family);
    assert.equal(sqlite.prepare("SELECT count(*) FROM paint_substitutions WHERE id=?").pluck().get(sub), 0);
    assert.equal(
      sqlite.prepare("SELECT count(*) FROM miniature_required_paints WHERE paint_id=?").pluck().get(paint),
      0,
    );
  });
  await t.test("epoch mismatch and impossible future cursors reset all families", () => {
    for (const c of [
      { epoch: "previous-process", since: 0 },
      { epoch: changeLogEpoch, since: currentChangeSeq(sqlite) + 1 },
    ]) {
      const event = invalidationSince(c);
      assert.equal(event.reset, true);
      assert.deepEqual(event.families, [...ALL_FAMILIES]);
    }
  });
});
