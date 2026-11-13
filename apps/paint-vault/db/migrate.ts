import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { pendingMigrations } from "./migration-backup.ts";

type ForeignKeyProblem = { table: string; rowid: number; parent: string };

// Applies pending migrations with foreign keys off. Drizzle runs every migration inside one
// transaction, where `PRAGMA foreign_keys=OFF` has no effect, so a migration that rebuilds a table
// (as drizzle-kit does for most SQLite changes) would otherwise cascade-delete the rows that
// refer to it when the old table is dropped. Foreign keys are checked once the migrations are
// done, and turned back on whatever the result.
export function migrateVault(
  sqlite: Database.Database,
  migrationsFolder: string,
  pending = pendingMigrations(sqlite, migrationsFolder),
) {
  // Ordinary startup must not load migration SQL or scan every foreign key in the vault.
  if (!pending.length) return;
  sqlite.pragma("foreign_keys = OFF");
  try {
    migrate(drizzle(sqlite), { migrationsFolder });
    const problems = sqlite.pragma("foreign_key_check") as ForeignKeyProblem[];
    if (problems.length) {
      const tables = [...new Set(problems.map((problem) => problem.table))].join(", ");
      throw new Error(`The updated vault has ${problems.length} records with broken links (${tables})`);
    }
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

// Space freed by deleted rows is returned to the file system in steps (see `auto_vacuum` in
// index.ts), so removing a large catalog source or replacing the vault shrinks the database.
// Call it outside a transaction.
export function reclaimSpace(sqlite: Database.Database) {
  sqlite.pragma("incremental_vacuum");
}
