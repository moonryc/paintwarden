import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { reportStartupProgress, startStartupOperation } from "../lib/startup-progress.ts";

import { pendingMigrations } from "./migration-backup.ts";

type ForeignKeyProblem = { table: string; rowid: number; parent: string };

// Table rebuilds need foreign_keys OFF *outside* the transaction to avoid cascading deletes.
// Drizzle's stock migrator commits before callers can validate those links. Use its SQL reader
// and journal format, but own the transaction so schema, data AND journal roll back together
// on validation errors (or a crash). No failed migration can become "already applied" on retry.
export function migrateVault(
  sqlite: Database.Database,
  migrationsFolder: string,
  pending = pendingMigrations(sqlite, migrationsFolder),
) {
  // Ordinary startup must not load migration SQL or scan every foreign key in the vault.
  if (!pending.length) return;
  if (sqlite.inTransaction) throw new Error("Vault migrations require their own transaction");
  const migrations = readMigrationFiles({ migrationsFolder });
  startStartupOperation("migrating");
  sqlite.pragma("foreign_keys = OFF");
  try {
    sqlite
      .transaction(() => {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric
      )`);
        const latest = sqlite.prepare("SELECT max(created_at) FROM __drizzle_migrations").pluck().get() as
          number | null;
        const record = sqlite.prepare(
          'INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)',
        );
        for (const migration of migrations) {
          if (latest !== null && migration.folderMillis <= latest) continue;
          for (const statement of migration.sql) sqlite.prepare(statement).run();
          record.run(migration.hash, migration.folderMillis);
        }
        const problems = sqlite.pragma("foreign_key_check") as ForeignKeyProblem[];
        if (problems.length) {
          const tables = [...new Set(problems.map((problem) => problem.table))].join(", ");
          throw new Error(`The updated vault has ${problems.length} records with broken links (${tables})`);
        }
      })
      .immediate();
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  reportStartupProgress({ phase: "migrating", status: "completed" });
}

// Space freed by deleted rows is returned to the file system in steps (see `auto_vacuum` in
// index.ts), so removing a large catalog source or replacing the vault shrinks the database.
// Call it outside a transaction.
export function reclaimSpace(sqlite: Database.Database) {
  sqlite.pragma("incremental_vacuum");
}
