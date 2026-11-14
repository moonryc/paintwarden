import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { unzipSync, zipSync } from "fflate";

import type { BackupManifest, BackupRow, BackupTables } from "./backup-format.ts";

const app = fileURLToPath(new URL("../", import.meta.url));
const fixtures = path.join(app, "test-fixtures/data-compatibility");
const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-golden-"));
process.env.DATA_DIR = directory;
delete process.env.DATABASE_PATH;
process.chdir(app);
const { getDb, getSqlite } = await import("../db/index.ts");
const { migrateVault } = await import("../db/migrate.ts");
const { pendingMigrations } = await import("../db/migration-backup.ts");
const { createBackup, restoreBackup } = await import("./backup.ts");
const { BACKUP_SECTIONS, SECTION_KEYS } = await import("./backup-format.ts");
const { APP_VERSION } = await import("./app-version.ts");
const { loadImage } = await import("./image-store.ts");
const fixture = (name: string) => path.join(fixtures, name);
const golden = JSON.parse(readFileSync(fixture("v1-tables.json"), "utf8")) as Required<BackupTables>;
const upgradedGolden: Required<BackupTables> = {
  ...golden,
  folders: [],
  miniatures: golden.miniatures.map((row) => ({ ...row, folderId: null })),
  templates: golden.templates.map((row) => ({ ...row, folderId: null })),
};
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
void test("frozen application data and backup compatibility", async (t) => {
  try {
    await t.test("all golden fixture hashes match their recorded provenance", () => {
      const provenance = JSON.parse(readFileSync(fixture("provenance.json"), "utf8")) as {
        files: Record<string, string>;
      };
      const folderProvenance = JSON.parse(readFileSync(fixture("provenance-v2-folders.json"), "utf8")) as {
        files: Record<string, string>;
      };
      for (const [name, hash] of Object.entries({ ...provenance.files, ...folderProvenance.files }))
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
        assert.equal(oldManifest.format, "paintwarden-backup");
        assert.equal(oldManifest.version, 1);
        assert.equal(oldManifest.appVersion, "1.0.0");
        assert.equal(oldManifest.exportedAt, "2023-11-14T22:13:20.000Z");
        assert.deepEqual(oldManifest.tables, golden);
        for (const mode of ["replace", "merge", "replace"] as const) {
          await restoreBackup(fixture("zip-v1.zip"), mode);
          assert.deepEqual(tables(), upgradedGolden, mode);
          assert.deepEqual(accountRows(), owner);
          const { files, manifest } = await exported();
          assert.deepEqual(manifest.tables, upgradedGolden);
          assert.equal(manifest.format, "paintwarden-backup");
          assert.equal(manifest.version, 2);
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

    await t.test(
      "ZIP2 round-trips nested folders and membership, independent of manifest order",
      async () => {
        const expected = JSON.parse(
          readFileSync(fixture("v2-folders-tables.json"), "utf8"),
        ) as Required<BackupTables>;
        const owner = accountRows();
        for (const mode of ["replace", "merge", "replace"] as const) {
          await restoreBackup(fixture("zip-v2-folders.zip"), mode);
          const normalize = (value: BackupTables) => ({
            ...value,
            folders: [...(value.folders ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id))),
          });
          assert.deepEqual(normalize(tables()), normalize(expected));
          assert.deepEqual(normalize((await exported()).manifest.tables), normalize(expected));
          assert.deepEqual(accountRows(), owner);
          assert.deepEqual(getSqlite().pragma("foreign_key_check"), []);
        }
        const files = unzipSync(readFileSync(fixture("zip-v2-folders.zip")));
        const manifest = JSON.parse(Buffer.from(files["backup.json"]).toString()) as BackupManifest;
        const shuffled = path.join(directory, "shuffled-folders.zip");
        writeFileSync(
          shuffled,
          zipSync({
            ...files,
            "backup.json": Buffer.from(
              JSON.stringify({
                ...manifest,
                tables: { ...manifest.tables, folders: [...expected.folders].reverse() },
              }),
            ),
          }),
        );
        await restoreBackup(shuffled, "replace");
        const actual = tables();
        assert.deepEqual(
          actual.folders.sort((a, b) => String(a.id).localeCompare(String(b.id))),
          [...expected.folders].sort((a, b) => String(a.id).localeCompare(String(b.id))),
        );
        assert.deepEqual(actual.miniatures, expected.miniatures);
        assert.deepEqual(actual.templates, expected.templates);
        for (const folders of [
          [...expected.folders, expected.folders[0]],
          expected.folders.map((row, index) =>
            index === 0 ? { ...row, parentId: expected.folders[1].id } : row,
          ),
          expected.folders.map((row, index) =>
            index === 1 ? { ...row, parentId: expected.folders[2].id } : row,
          ),
        ]) {
          const before = tables();
          writeFileSync(
            shuffled,
            zipSync({
              ...files,
              "backup.json": Buffer.from(
                JSON.stringify({ ...manifest, tables: { ...manifest.tables, folders } }),
              ),
            }),
          );
          await assert.rejects(restoreBackup(shuffled, "replace"), /damaged|can't store/);
          assert.deepEqual(tables(), before);
          assert.deepEqual(accountRows(), owner);
          assert.deepEqual((await loadImage(goldenKey))?.bytes, pixel);
        }
      },
    );

    await t.test("ZIP2 round-trips authored trees deeper than SQLite's cascade trigger limit", async () => {
      await restoreBackup(fixture("zip-v2-folders.zip"), "replace");
      const owner = accountRows();
      getSqlite().transaction(() => {
        const insert = getSqlite().prepare(
          "INSERT INTO folders(id,kind,name,parent_id,created_at) VALUES(?, 'miniature', ?, ?, ?)",
        );
        let parent: string | null = null;
        for (let index = 0; index < 1005; index++) {
          const id = randomUUID();
          insert.run(id, `Deep synthetic folder ${index}`, parent, stamp);
          parent = id;
        }
      })();
      const before = tables();
      const file = path.join(directory, "deep-folders.zip");
      writeFileSync(file, Buffer.from(await new Response(createBackup()).arrayBuffer()));
      await restoreBackup(file, "replace");
      const normalize = (rows: BackupRow[]) =>
        [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      assert.deepEqual(normalize(tables().folders), normalize(before.folders));
      assert.deepEqual(tables().miniatures, before.miniatures);
      assert.deepEqual(accountRows(), owner);
      assert.deepEqual(getSqlite().pragma("foreign_key_check"), []);
      await restoreBackup(fixture("zip-v2-folders.zip"), "replace");
      assert.equal(tables().folders.length, 4);
      assert.deepEqual((await loadImage(goldenKey))?.bytes, pixel);
    });

    await t.test(
      "non-ZIP uploads and future/unknown formats reject without touching rows, owner or images",
      async () => {
        const before = tables();
        const owner = accountRows();
        const imageFiles = readdirSync(path.join(directory, "images")).sort();
        const files = unzipSync(readFileSync(fixture("zip-v1.zip")));
        const original = JSON.parse(Buffer.from(files["backup.json"]).toString()) as BackupManifest;
        for (const change of [
          { version: 3 },
          { format: "unknown-backup" },
          { format: "paintwarden_backup" },
          { format: "Paintwarden-backup" },
        ]) {
          const file = path.join(directory, "unsupported.zip");
          writeFileSync(
            file,
            zipSync({ ...files, "backup.json": Buffer.from(JSON.stringify({ ...original, ...change })) }),
          );
          await assert.rejects(
            restoreBackup(file, "replace"),
            /different version|isn't a Paintwarden backup/,
          );
        }
        for (const body of [
          JSON.stringify({ format: "paintwarden-backup", version: 1, tables: golden, images: [] }),
          "not a ZIP",
        ]) {
          const file = path.join(directory, "unsupported-upload.json");
          writeFileSync(file, body);
          for (const mode of ["merge", "replace"] as const)
            await assert.rejects(restoreBackup(file, mode), /Choose a Paintwarden backup/);
        }
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
