import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { createSqliteReadCache } from "./sqlite-read-cache.ts";

test("search snapshot reuses reads and refreshes local/external writes and rollback", () => {
  const dir = mkdtempSync(join(tmpdir(), "paint-search-cache-"));
  const path = join(dir, "fixture.sqlite");
  const sqlite = new Database(path),
    other = new Database(path);
  try {
    sqlite.exec("CREATE TABLE paints (name TEXT); INSERT INTO paints VALUES ('red')");
    let reads = 0;
    const read = createSqliteReadCache(sqlite, () => {
      reads++;
      return sqlite.prepare("SELECT name FROM paints").pluck().all();
    });
    const original = read();
    assert.deepEqual(original, ["red"]);
    assert.equal(read(), original);
    assert.equal(reads, 1);
    sqlite.exec("INSERT INTO paints VALUES ('blue')");
    assert.deepEqual(read(), ["red", "blue"]);
    other.exec("UPDATE paints SET name = 'green' WHERE name = 'red'");
    assert.deepEqual(read(), ["green", "blue"]);
    assert.throws(() =>
      sqlite.transaction(() => {
        sqlite.exec("DELETE FROM paints");
        assert.deepEqual(read(), []);
        throw Error("rollback");
      })(),
    );
    assert.deepEqual(read(), ["green", "blue"]);
    const restored = read();
    assert.equal(read(), restored);
  } finally {
    other.close();
    sqlite.close();
    rmSync(dir, { recursive: true });
  }
});
