import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { unzipSync, zipSync } from "fflate";

import type { BackupManifest, BackupTables } from "./backup-format.ts";

const app = fileURLToPath(new URL("../", import.meta.url));
const fixtures = path.join(app, "test-fixtures/data-compatibility");
const directory = mkdtempSync(path.join(tmpdir(), "paint-vault-golden-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.chdir(app);
const { getDb, getSqlite } = await import("../db/index.ts");
const { migrateVault } = await import("../db/migrate.ts");
const { pendingMigrations } = await import("../db/migration-backup.ts");
const { createBackup, restoreBackup } = await import("./backup.ts");
const { BACKUP_SECTIONS, SECTION_KEYS } = await import("./backup-format.ts");
const { APP_VERSION } = await import("./app-version.ts");
const { isImageKey, loadImage } = await import("./image-store.ts");
const { isUuid } = await import("@paint-vault/core/vault-ids");
const fixture = (name: string) => path.join(fixtures, name);
const golden = JSON.parse(readFileSync(fixture("v1-tables.json"), "utf8")) as Required<BackupTables>;
const pixel = readFileSync(fixture("pixel.png"));
const goldenKey = golden.templates[0].imageKey as string;
const stamp = 1700000000000;

function tables(): Required<BackupTables> {
  return Object.fromEntries(
    SECTION_KEYS.map((section) => [section, getDb().select().from(BACKUP_SECTIONS[section].table).all()]),
  ) as unknown as Required<BackupTables>;
}
async function exported() {
  const files = unzipSync(new Uint8Array(await new Response(createBackup()).arrayBuffer()));
  const manifest = JSON.parse(Buffer.from(files["backup.json"]).toString()) as BackupManifest;
  return { files, manifest };
}
function accountRows() {
  return {
    account: getSqlite().prepare("SELECT * FROM vault_account").all(),
    sessions: getSqlite().prepare("SELECT * FROM vault_sessions").all(),
  };
}
function clearVault() {
  getDb().transaction((tx) => {
    for (const key of [...SECTION_KEYS].reverse()) tx.delete(BACKUP_SECTIONS[key].table).run();
  });
}

void test("frozen application data and backup compatibility", async (t) => {
  try {
    await t.test("all golden fixture hashes match their recorded provenance", () => {
      const provenance = JSON.parse(readFileSync(fixture("provenance.json"), "utf8")) as {
        files: Record<string, string>;
      };
      for (const [name, hash] of Object.entries(provenance.files))
        assert.equal(
          createHash("sha256")
            .update(readFileSync(fixture(name)))
            .digest("hex"),
          hash,
          name,
        );
    });

    await t.test(
      "v1 SQLite upgrades through migrateVault without changing any historical column or row",
      () => {
        const file = path.join(directory, "upgrade.sqlite");
        copyFileSync(fixture("v1.sqlite"), file);
        const sqlite = new Database(file);
        const fresh = new Database(":memory:");
        try {
          const names = sqlite
            .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .pluck()
            .all() as string[];
          const before = names.map((name) => ({
            name,
            columns: (sqlite.pragma(`table_info("${name}")`) as { name: string }[]).map(
              (column) => column.name,
            ),
            rows: sqlite.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
          }));
          sqlite.pragma("foreign_keys = ON");
          migrateVault(sqlite, path.join(app, "drizzle"));
          migrateVault(fresh, path.join(app, "drizzle"));
          for (const { name, columns, rows } of before) {
            // The migration journal may append rows, but it may never rewrite released history.
            const after = sqlite
              .prepare(
                `SELECT ${columns.map((column) => `"${column}"`).join(",")} FROM "${name}" ORDER BY rowid`,
              )
              .all();
            assert.deepEqual(
              name === "__drizzle_migrations" ? after.slice(0, rows.length) : after,
              rows,
              name,
            );
          }
          const schema = (db: Database.Database) =>
            db
              .prepare(
                "SELECT type, name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
              )
              .all();
          assert.deepEqual(schema(sqlite), schema(fresh));
          assert.deepEqual(pendingMigrations(sqlite, path.join(app, "drizzle")), []);
          assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
          assert.equal(sqlite.pragma("integrity_check", { simple: true }), "ok");
          migrateVault(sqlite, path.join(app, "drizzle"));
          assert.deepEqual(schema(sqlite), schema(fresh));
        } finally {
          sqlite.close();
          fresh.close();
        }
      },
    );

    await t.test(
      "ZIP1 Replace then Merge preserves every field of every section and original image bytes",
      async () => {
        getSqlite()
          .prepare(
            "INSERT INTO vault_account (id, username, password_hash, require_sign_in, updated_at) VALUES (1, ?, ?, 1, ?)",
          )
          .run("destination-owner", "synthetic-destination-hash", stamp);
        getSqlite()
          .prepare("INSERT INTO vault_sessions (token_hash, expires_at) VALUES (?, ?)")
          .run("synthetic-destination-token", 4000000000000);
        const owner = accountRows();
        const oldFiles = unzipSync(readFileSync(fixture("zip-v1.zip")));
        const oldManifest = JSON.parse(Buffer.from(oldFiles["backup.json"]).toString()) as BackupManifest;
        assert.equal(oldManifest.version, 1);
        assert.equal(oldManifest.appVersion, "1.0.0");
        assert.equal(oldManifest.exportedAt, "2023-11-14T22:13:20.000Z");
        assert.deepEqual(oldManifest.tables, golden);
        for (const mode of ["replace", "merge", "replace"] as const) {
          await restoreBackup(fixture("zip-v1.zip"), mode);
          assert.deepEqual(tables(), golden, mode);
          assert.deepEqual(accountRows(), owner);
          const { files, manifest } = await exported();
          assert.deepEqual(manifest.tables, golden);
          assert.equal(manifest.format, "paint-vault-backup");
          assert.equal(manifest.version, 1);
          assert.equal(manifest.appVersion, APP_VERSION);
          assert.ok(Number.isFinite(Date.parse(manifest.exportedAt)));
          assert.deepEqual(manifest.images, [goldenKey]);
          assert.deepEqual(Object.keys(files).sort(), ["backup.json", `images/${goldenKey}`].sort());
          assert.deepEqual(Buffer.from(files[`images/${goldenKey}`]), pixel);
          assert.deepEqual((await loadImage(goldenKey))?.bytes, pixel);
          assert.deepEqual(getSqlite().pragma("foreign_key_check"), []);
        }
      },
    );

    for (const name of ["legacy-v3.json", "legacy-v4-synthetic.json"]) {
      await t.test(
        `${name}: merge restores every supported row, relationship and embedded image`,
        async () => {
          clearVault();
          const owner = accountRows();
          const started = Date.now();
          await restoreBackup(fixture(name), "merge");
          const finished = Date.now();
          const actual = tables();
          const expected = structuredClone(golden);
          for (const section of ["plugins", "pluginItems", "pluginImages", "schemeImages"] as const)
            expected[section] = [];
          expected.paints = expected.paints.filter((row) => String(row.id).startsWith("user:"));
          expected.paints[0].type = null; // The old schema had no paint type column.
          expected.miniatures[0].imageKey = null; // Old JSON never carried miniature photos.
          // Old rows without updatedAt receive a new SQL-default timestamp. Bound it to this restore;
          // timestamps actually present in the historical export must still match exactly.
          for (const section of [
            "paints",
            "paintInventory",
            "schemePaints",
            "schemeDividers",
            "templateSchemes",
            "templatePaints",
            "miniatureRecipe",
            "miniatureSteps",
            "miniatureSchemes",
            "substitutionIngredients",
            "miniatureSubstitutions",
          ] as const) {
            for (const row of actual[section]) {
              assert.ok(Number.isInteger(row.updatedAt));
              assert.ok(Number(row.updatedAt) >= started && Number(row.updatedAt) <= finished, section);
              row.updatedAt = stamp;
            }
          }
          // Only newly allocated IDs/keys are normalized; all remaining fields must match exactly.
          assert.ok(isUuid(String(actual.schemeDividers[0].id)));
          actual.schemeDividers[0].id = expected.schemeDividers[0].id;
          assert.ok(isUuid(String(actual.miniatureRecipe[0].id)));
          actual.miniatureRecipe[0].id = expected.miniatureRecipe[0].id;
          const key = actual.templates[0].imageKey as string;
          assert.ok(isImageKey(key));
          assert.deepEqual((await loadImage(key))?.bytes, pixel);
          actual.templates[0].imageKey = goldenKey;
          assert.deepEqual(actual, expected);
          assert.deepEqual(accountRows(), owner);
          assert.deepEqual(getSqlite().pragma("foreign_key_check"), []);
          // Converted data is subsequently a complete ZIP1 vault, not a legacy-only state.
          const { files, manifest } = await exported();
          const roundTrip = path.join(directory, "converted.zip");
          writeFileSync(roundTrip, zipSync(files));
          await restoreBackup(roundTrip, "replace");
          assert.deepEqual(tables(), manifest.tables);
          assert.deepEqual((await loadImage(key))?.bytes, pixel);
        },
      );
    }

    await t.test(
      "legacy Replace and future/unknown formats reject without touching rows, owner or images",
      async () => {
        const before = tables();
        const owner = accountRows();
        const imageFiles = readdirSync(path.join(directory, "images")).sort();
        for (const name of ["legacy-v3.json", "legacy-v4-synthetic.json"])
          await assert.rejects(restoreBackup(fixture(name), "replace"), /Older backups can only be merged/);
        const files = unzipSync(readFileSync(fixture("zip-v1.zip")));
        const original = JSON.parse(Buffer.from(files["backup.json"]).toString()) as BackupManifest;
        for (const change of [{ version: 2 }, { format: "unknown-backup" }]) {
          const file = path.join(directory, "unsupported.zip");
          writeFileSync(
            file,
            zipSync({ ...files, "backup.json": Buffer.from(JSON.stringify({ ...original, ...change })) }),
          );
          await assert.rejects(
            restoreBackup(file, "replace"),
            /different version|isn't a Paint Vault backup/,
          );
        }
        const future = path.join(directory, "future.json");
        writeFileSync(future, JSON.stringify({ format: "paint-vault-backup", version: 5 }));
        await assert.rejects(restoreBackup(future, "merge"), /Choose a Paint Vault backup/);
        assert.deepEqual(tables(), before);
        assert.deepEqual(accountRows(), owner);
        assert.deepEqual(readdirSync(path.join(directory, "images")).sort(), imageFiles);
      },
    );
  } finally {
    getSqlite().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
