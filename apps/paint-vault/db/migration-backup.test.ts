import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { MIGRATION_BACKUPS_KEPT, backupBeforeMigrating, pendingMigrations } from "./migration-backup.ts";

const migrations = [
  { tag: "0000_first", when: 1_000, sql: "CREATE TABLE notes (id integer PRIMARY KEY, body text NOT NULL);" },
  { tag: "0001_second", when: 2_000, sql: "ALTER TABLE notes ADD COLUMN pinned integer DEFAULT 0 NOT NULL;" },
];

// Writes a Drizzle migrations folder holding the first `count` migrations.
function writeMigrations(folder: string, count: number) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(path.join(folder, "meta"), { recursive: true });
  const entries = migrations.slice(0, count).map(({ tag, when }, idx) => ({
    idx,
    version: "6",
    when,
    tag,
    breakpoints: true,
  }));
  writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries }),
  );
  for (const migration of migrations.slice(0, count))
    writeFileSync(path.join(folder, `${migration.tag}.sql`), migration.sql);
}

test("vaults are copied before migrations change them", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-migration-backup-"));
  const folder = path.join(directory, "drizzle");
  const databasePath = path.join(directory, "vault.sqlite");
  const backups = () => readdirSync(path.join(directory, "backups")).sort();
  try {
    writeMigrations(folder, 1);
    const sqlite = new Database(databasePath);
    sqlite.pragma("journal_mode = WAL");

    await t.test("a new, empty database is not copied", () => {
      assert.deepEqual(pendingMigrations(sqlite, folder), ["0000_first"]);
      assert.equal(backupBeforeMigrating(sqlite, databasePath, folder), null);
    });

    migrate(drizzle(sqlite), { migrationsFolder: folder });
    sqlite.prepare("INSERT INTO notes (body) VALUES ('before the update')").run();

    await t.test("an up-to-date database is not copied", () => {
      assert.deepEqual(pendingMigrations(sqlite, folder), []);
      assert.equal(backupBeforeMigrating(sqlite, databasePath, folder), null);
      // The shared no-pending snapshot skips even the journal read and backup directory creation.
      rmSync(path.join(folder, "meta", "_journal.json"));
      assert.equal(backupBeforeMigrating(sqlite, databasePath, folder, undefined, []), null);
      assert.deepEqual(
        readdirSync(directory).filter((name) => name === "backups"),
        [],
      );
      writeMigrations(folder, 1);
    });

    await t.test("pending migrations copy the current contents first", () => {
      writeMigrations(folder, 2);
      assert.deepEqual(pendingMigrations(sqlite, folder), ["0001_second"]);
      const pending = pendingMigrations(sqlite, folder);
      // Reuse startup's snapshot rather than reading the journal a second time.
      rmSync(path.join(folder, "meta", "_journal.json"));
      const copy = backupBeforeMigrating(
        sqlite,
        databasePath,
        folder,
        new Date("2026-11-07T18:30:05Z"),
        pending,
      );
      writeMigrations(folder, 2);
      assert.equal(
        copy,
        path.join(directory, "backups", "paint-vault-20261107-183005-before-0001_second.sqlite"),
      );
      migrate(drizzle(sqlite), { migrationsFolder: folder });
      const saved = new Database(String(copy), { readonly: true });
      assert.deepEqual(saved.prepare("SELECT * FROM notes").all(), [{ id: 1, body: "before the update" }]);
      saved.close();
      assert.deepEqual(sqlite.prepare("SELECT * FROM notes").all(), [
        { id: 1, body: "before the update", pinned: 0 },
      ]);
    });

    await t.test(`only the ${MIGRATION_BACKUPS_KEPT} newest copies are kept`, () => {
      for (let day = 1; day <= MIGRATION_BACKUPS_KEPT + 2; day++) {
        // Each run sees one pending migration again.
        sqlite.prepare("DELETE FROM __drizzle_migrations WHERE created_at = 2000").run();
        backupBeforeMigrating(sqlite, databasePath, folder, new Date(`2026-12-0${day}T00:00:00Z`));
      }
      // Other files in the folder are left alone.
      writeFileSync(path.join(directory, "backups", "notes.txt"), "keep me");
      backupBeforeMigrating(sqlite, databasePath, folder, new Date("2026-12-09T00:00:00Z"));
      const kept = backups().filter((name) => name.endsWith(".sqlite"));
      assert.equal(kept.length, MIGRATION_BACKUPS_KEPT);
      assert.ok(kept.includes("paint-vault-20261209-000000-before-0001_second.sqlite"));
      assert.ok(!kept.includes("paint-vault-20261107-183005-before-0001_second.sqlite"));
      assert.ok(backups().includes("notes.txt"));
    });
    sqlite.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
