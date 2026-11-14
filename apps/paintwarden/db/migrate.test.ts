import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { migrateVault } from "./migrate.ts";
import { pendingMigrations } from "./migration-backup.ts";

// Writes a Drizzle migrations folder; each migration's statements are joined by breakpoints.
function writeMigrations(folder: string, migrations: string[][]) {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(path.join(folder, "meta"), { recursive: true });
  const tag = (index: number) => `000${index}_step`;
  writeFileSync(
    path.join(folder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: migrations.map((_, idx) => ({
        idx,
        version: "6",
        when: 1_000 + idx,
        tag: tag(idx),
        breakpoints: true,
      })),
    }),
  );
  migrations.forEach((statements, index) =>
    writeFileSync(path.join(folder, `${tag(index)}.sql`), statements.join("\n--> statement-breakpoint\n")),
  );
}

const create = [
  "CREATE TABLE parent (id text PRIMARY KEY NOT NULL);",
  "CREATE TABLE child (id text PRIMARY KEY NOT NULL, parent_id text NOT NULL REFERENCES parent(id) ON DELETE cascade);",
];
// The statements drizzle-kit writes to change a SQLite table: copy it, drop it, rename the copy.
const rebuildParent = (select = "SELECT id FROM parent") => [
  "PRAGMA foreign_keys=OFF;",
  "CREATE TABLE __new_parent (id text PRIMARY KEY NOT NULL, label text DEFAULT '' NOT NULL);",
  `INSERT INTO __new_parent (id) ${select};`,
  "DROP TABLE parent;",
  "ALTER TABLE __new_parent RENAME TO parent;",
  "PRAGMA foreign_keys=ON;",
];

test("migrations that rebuild a table keep the rows that refer to it", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-migrate-"));
  const folder = path.join(directory, "drizzle");
  try {
    await t.test("child rows survive the parent table's rebuild", () => {
      const sqlite = new Database(path.join(directory, "kept.sqlite"));
      sqlite.pragma("foreign_keys = ON");
      writeMigrations(folder, [create]);
      migrateVault(sqlite, folder);
      sqlite.exec("INSERT INTO parent VALUES ('a'); INSERT INTO child VALUES ('x', 'a');");
      writeMigrations(folder, [create, rebuildParent()]);
      migrateVault(sqlite, folder);
      assert.equal(sqlite.prepare("SELECT count(*) FROM child").pluck().get(), 1);
      assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
      sqlite.close();
    });

    await t.test("a migration that breaks links stops with an error", () => {
      const file = path.join(directory, "broken.sqlite");
      let sqlite = new Database(file);
      sqlite.pragma("foreign_keys = ON");
      writeMigrations(folder, [create]);
      migrateVault(sqlite, folder);
      sqlite.exec("INSERT INTO parent VALUES ('a'); INSERT INTO child VALUES ('x', 'a');");
      writeMigrations(folder, [create, rebuildParent("SELECT id FROM parent WHERE 0")]);
      const pending = pendingMigrations(sqlite, folder);
      for (let attempt = 0; attempt < 3; attempt++) {
        assert.throws(() => migrateVault(sqlite, folder, pending), /1 records with broken links \(child\)/);
        assert.deepEqual(sqlite.prepare("SELECT * FROM parent").all(), [{ id: "a" }]);
        assert.deepEqual(sqlite.prepare("SELECT * FROM child").all(), [{ id: "x", parent_id: "a" }]);
        assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
        assert.deepEqual(pendingMigrations(sqlite, folder), ["0001_step"]);
        assert.equal(sqlite.prepare("SELECT count(*) FROM __drizzle_migrations").pluck().get(), 1);
        sqlite.close();
        sqlite = new Database(file);
      }
      // A corrected forward migration can now complete without restoring lost data.
      writeMigrations(folder, [create, rebuildParent()]);
      migrateVault(sqlite, folder);
      assert.deepEqual(pendingMigrations(sqlite, folder), []);
      assert.equal(sqlite.prepare("SELECT count(*) FROM child").pluck().get(), 1);
      assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
      sqlite.close();
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test("up-to-date vaults skip migration SQL, foreign-key toggles and validation", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-migrate-skip-"));
  const folder = path.join(directory, "drizzle");
  const statements: string[] = [];
  const sqlite = new Database(":memory:", { verbose: (sql) => statements.push(String(sql)) });
  try {
    writeMigrations(folder, [create]);
    migrateVault(sqlite, folder);
    // Existing broken links are not a reason to scan the whole vault on ordinary startup.
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec("INSERT INTO child VALUES ('orphan', 'missing');");
    sqlite.pragma("foreign_keys = ON");
    rmSync(path.join(folder, "0000_step.sql"));
    statements.length = 0;

    migrateVault(sqlite, folder);

    assert.ok(statements.some((sql) => sql.includes("__drizzle_migrations")));
    assert.ok(!statements.some((sql) => /foreign_key|\b(CREATE|INSERT|BEGIN|COMMIT)\b/i.test(sql)));
    assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
    assert.equal((sqlite.pragma("foreign_key_check") as unknown[]).length, 1);

    // Startup shares its pending snapshot, avoiding another journal/database lookup.
    const pending = pendingMigrations(sqlite, folder);
    rmSync(path.join(folder, "meta", "_journal.json"));
    statements.length = 0;
    migrateVault(sqlite, folder, pending);
    assert.deepEqual(statements, []);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test("initial migration failure rolls back the schema and migration journal together", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-migrate-new-"));
  const folder = path.join(directory, "drizzle");
  const file = path.join(directory, "vault.sqlite");
  try {
    writeMigrations(folder, [create, ["INSERT INTO child VALUES ('orphan', 'missing');"]]);
    for (let attempt = 0; attempt < 2; attempt++) {
      const sqlite = new Database(file);
      try {
        assert.throws(() => migrateVault(sqlite, folder), /1 records with broken links/);
        assert.deepEqual(sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all(), []);
        assert.deepEqual(pendingMigrations(sqlite, folder), ["0000_step", "0001_step"]);
        assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
      } finally {
        sqlite.close();
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

void test("migrations cannot run inside an outer transaction where FK toggles would be ineffective", () => {
  const sqlite = new Database(":memory:");
  try {
    sqlite.pragma("foreign_keys = ON");
    sqlite.transaction(() => {
      assert.throws(() => migrateVault(sqlite, "/unused", ["pending"]), /require their own transaction/);
      assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
    })();
  } finally {
    sqlite.close();
  }
});

void test("folders forward migration preserves pre-folder rows and relationships with null membership", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "paintwarden-folders-migration-"));
  const folder = path.join(directory, "drizzle");
  const sqlite = new Database(":memory:");
  const released = ["0000_init", "0001_credential_generation"];
  const statements = (name: string) =>
    readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8").split(
      "--> statement-breakpoint",
    );
  try {
    sqlite.pragma("foreign_keys = ON");
    const old = released.map(statements);
    writeMigrations(folder, old);
    migrateVault(sqlite, folder);
    const model = "00000000-0000-4000-8000-000000000001",
      template = "user:00000000-0000-4000-8000-000000000002",
      paint = "00000000-0000-4000-8000-000000000003",
      scheme = "user:00000000-0000-4000-8000-000000000004";
    sqlite
      .prepare(
        "INSERT INTO miniatures(id,title,status,notes,created_at) VALUES(?,'Existing miniature','OWNED','Preserved notes',1)",
      )
      .run(model);
    sqlite
      .prepare(
        "INSERT INTO miniature_templates(id,name,categories,created_at) VALUES(?,'Existing template','[\"Category\"]',1)",
      )
      .run(template);
    sqlite
      .prepare("INSERT INTO paint_catalog(id,brand,range,name) VALUES(?,'Brand','Range','Paint')")
      .run(paint);
    sqlite.prepare("INSERT INTO color_schemes(id,name,created_at) VALUES(?,'Scheme',1)").run(scheme);
    sqlite
      .prepare(
        "INSERT INTO miniature_template_paints(template_id,sort_order,paint_id,notes) VALUES(?,0,?,'Full recipe')",
      )
      .run(template, paint);
    sqlite
      .prepare("INSERT INTO miniature_template_schemes(template_id,scheme_id) VALUES(?,?)")
      .run(template, scheme);
    sqlite
      .prepare("INSERT INTO miniature_color_schemes(miniature_id,scheme_id) VALUES(?,?)")
      .run(model, scheme);
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .pluck()
      .all() as string[];
    const snapshots = tables.map((name) => ({
      name,
      columns: (sqlite.pragma(`table_info(${name})`) as { name: string }[])
        .map((c) => `"${c.name}"`)
        .join(","),
      rows: sqlite.prepare(`SELECT * FROM "${name}"`).all(),
    }));
    writeMigrations(folder, [...old, statements("0002_mixed_phalanx")]);
    migrateVault(sqlite, folder);
    for (const table of snapshots)
      assert.deepEqual(
        sqlite.prepare(`SELECT ${table.columns} FROM "${table.name}"`).all(),
        table.rows,
        table.name,
      );
    assert.equal(sqlite.prepare("SELECT folder_id FROM miniatures WHERE id=?").pluck().get(model), null);
    assert.equal(
      sqlite.prepare("SELECT folder_id FROM miniature_templates WHERE id=?").pluck().get(template),
      null,
    );
    assert.equal(sqlite.prepare("SELECT count(*) FROM folders").pluck().get(), 0);
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
