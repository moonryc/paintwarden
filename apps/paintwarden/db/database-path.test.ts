import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { databaseFile } from "./database-path.ts";

void test("database filename migration reads legacy DB with its untouched sidecars and fails closed on conflicts", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "paintwarden-db-path-"));
  try {
    const current = path.join(dir, "paintwarden.sqlite");
    const legacy = path.join(dir, "paint-vault.sqlite");
    assert.equal(databaseFile(dir), current);
    writeFileSync(legacy, "fixture-db");
    writeFileSync(`${legacy}-wal`, "fixture-wal");
    assert.equal(databaseFile(dir), legacy);
    assert.equal(readFileSync(`${legacy}-wal`, "utf8"), "fixture-wal");
    assert.equal(databaseFile(dir, "/explicit/database.sqlite"), "/explicit/database.sqlite");
    writeFileSync(current, "another-db");
    assert.throws(() => databaseFile(dir), /Both current and legacy/);
    assert.equal(readFileSync(legacy, "utf8"), "fixture-db");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
