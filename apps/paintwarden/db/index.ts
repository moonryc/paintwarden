import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { databaseFile } from "./database-path.ts";
import { installChangeLog } from "./change-log.ts";
import { migrateVault, reclaimSpace } from "./migrate.ts";
import { backupBeforeMigrating, pendingMigrations } from "./migration-backup.ts";
import * as schema from "./schema.ts";

function createDatabase() {
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "../../data");
  mkdirSync(dataDir, { recursive: true });

  const databasePath = databaseFile(dataDir, process.env.DATABASE_PATH);
  const sqlite = new Database(databasePath);
  rawDatabase = sqlite;
  // Freed pages can be returned to the file system only when auto_vacuum is chosen before the
  // first table exists, so a new vault turns it on before anything else.
  if (sqlite.prepare("SELECT count(*) FROM sqlite_schema").pluck().get() === 0)
    sqlite.pragma("auto_vacuum = INCREMENTAL");
  sqlite.pragma("journal_mode = WAL");
  // NORMAL is durable across application crashes in WAL mode and avoids an fsync per commit.
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("cache_size = -16000");
  sqlite.pragma("temp_store = MEMORY");

  const database = drizzle(sqlite, { schema });
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const pending = pendingMigrations(sqlite, migrationsFolder);
  // A vault is never migrated without a copy to go back to; a failed copy stops startup.
  const backup = backupBeforeMigrating(sqlite, databasePath, migrationsFolder, undefined, pending);
  migrationBackup = backup;
  try {
    migrateVault(sqlite, migrationsFolder, pending);
  } catch (error) {
    sqlite.close();
    rawDatabase = undefined;
    const saved = backup
      ? ` Its contents before the update are saved at ${backup}; quit Paintwarden / stop the server, keep a copy of the data directory, remove the database -wal and -shm sidecars, then copy that file over ${databasePath}. Keep images unchanged. Restart with the previous working app or a corrected update; Retry alone cannot repair a faulty migration.`
      : "";
    if (saved)
      throw new Error(
        `Updating the vault failed: ${error instanceof Error ? error.message : String(error)}.${saved}`,
        {
          cause: error,
        },
      );
    throw error;
  }
  sqlite.prepare("DELETE FROM vault_sessions WHERE expires_at <= ?").run(Date.now());
  installChangeLog(sqlite);
  sqlite.pragma("optimize = 0x10002");
  return database;
}

let database: ReturnType<typeof createDatabase> | undefined;
let rawDatabase: Database.Database | undefined;
let migrationBackup: string | null = null;

// The copy saved before this start's migrations, if any ran.
export function migrationBackupPath() {
  getDb();
  return migrationBackup;
}

export function getDb() {
  database ??= createDatabase();
  return database;
}

// Returns space freed by large deletions to the file system. Call it outside a transaction.
export function shrinkDatabase() {
  reclaimSpace(getSqlite());
}

export function getSqlite() {
  getDb();
  return rawDatabase!;
}
