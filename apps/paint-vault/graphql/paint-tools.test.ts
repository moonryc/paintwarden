import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-tools-"));
const originalDataDir = process.env.DATA_DIR;
const originalDatabasePath = process.env.DATABASE_PATH;
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
const { getSqlite } = await import("../db/index.ts");
const { readPaintRanking, readOwnedPaintOptions } = await import("./paint-tools.ts");
const sqlite = getSqlite();
let serial = 0;
const paint = (name: string, color = "#cc0000", range = "Base") => {
  const id = `00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
  sqlite
    .prepare(
      "INSERT INTO paint_catalog(id,brand,range,name,color_hex,type,discontinued,updated_at) VALUES(?,?,?,?,?,'BASE',0,1)",
    )
    .run(id, "Fixture", range, name, color);
  return id;
};
const stock = (id: string, state = "OWNED", level = "FULL", quantity = 1) => {
  sqlite
    .prepare("INSERT INTO paint_inventory(paint_id,state,stock_level,quantity,updated_at) VALUES(?,?,?,?,1)")
    .run(id, state, level, quantity);
};
beforeEach(() => {
  sqlite.exec(
    "DELETE FROM miniatures; DELETE FROM miniature_templates; DELETE FROM color_schemes; DELETE FROM paint_catalog;",
  );
  serial = 0;
});
after(() => {
  sqlite.close();
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
});
void test("ranking returns only requested pages, validates scope and rejects stale revisions", () => {
  const target = paint("Target");
  for (let i = 0; i < 75; i++) paint(`Candidate ${i}`);
  const first = readPaintRanking({ id: target, first: 30 });
  assert.equal(first.totalCount, 75);
  assert.equal(first.nodes.length, 30);
  assert.equal(first.pageInfo.hasNextPage, true);
  const second = readPaintRanking({ id: target, first: 30, after: first.pageInfo.endCursor });
  assert.equal(second.nodes.length, 30);
  assert.equal(new Set([...first.nodes, ...second.nodes].map((row) => row.paint.id)).size, 60);
  const third = readPaintRanking({ id: target, first: 30, after: second.pageInfo.endCursor });
  assert.equal(third.nodes.length, 15);
  assert.equal(third.pageInfo.hasNextPage, false);
  assert.throws(
    () => readPaintRanking({ id: target, first: 30, ownedOnly: true, after: first.pageInfo.endCursor }),
    /Invalid.*cursor/,
  );
  stock(target);
  assert.throws(
    () => readPaintRanking({ id: target, first: 30, after: first.pageInfo.endCursor }),
    /changed; restart/,
  );
});
void test("conversion candidates and picker use physical stock rather than wishlist or empty bottles", () => {
  const target = paint("Target");
  const same = paint("Closest owned");
  stock(same);
  const low = paint("Low bottle", "#0000ff");
  stock(low, "OWNED", "LOW", 2);
  const empty = paint("Empty bottle");
  stock(empty, "OWNED", "EMPTY");
  const zero = paint("Zero bottle");
  stock(zero, "OWNED", "FULL", 0);
  const wish = paint("Wishlist bottle");
  stock(wish, "WISHLIST");
  const ranking = readPaintRanking({ id: target, first: 30, ownedOnly: true });
  assert.equal(ranking.suggestedId, same);
  assert.equal(ranking.owned, false);
  assert.deepEqual(new Set(ranking.nodes.map((row) => row.paint.id)), new Set([same, low]));
  assert.deepEqual(
    new Set(readOwnedPaintOptions({ search: "", first: 30 }).items.map((row) => row.id)),
    new Set([same, low]),
  );
  assert.equal(readOwnedPaintOptions({ search: "clost owned", first: 30 }).items[0]?.id, same);
});
void test("missing paints and malformed cursors remain bounded and safe", () => {
  assert.equal(readPaintRanking({ id: "missing", first: 30 }).paint, null);
  assert.throws(() => readPaintRanking({ id: "missing", first: 30, after: "invalid!" }), /Invalid.*cursor/);
  assert.throws(() => readPaintRanking({ id: "missing", first: 101 }), /first/);
  assert.throws(() => readOwnedPaintOptions({ search: "", first: 31 }), /first/);
});
