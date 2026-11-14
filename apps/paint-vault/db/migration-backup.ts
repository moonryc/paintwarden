import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { reportStartupProgress, startStartupOperation } from "../lib/startup-progress.ts";

// Before a new release changes an existing vault's schema, the database is copied to
// `backups/` beside it, so a failed or faulty migration can be undone by restoring that file.
// Only the most recent copies are kept.
export const MIGRATION_BACKUPS_KEPT = 5;
const BACKUP_NAME = /^paint-vault-\d{8}-\d{6}-before-[\w-]+\.sqlite$/;

type JournalEntry = { tag: string; when: number };

// Migrations in the folder that this database hasn't applied yet. Drizzle applies every journal
// entry newer than the latest one recorded in __drizzle_migrations.
export function pendingMigrations(sqlite: Database.Database, migrationsFolder: string) {
  const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8")) as {
    entries: JournalEntry[];
  };
  const tracked = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  const latest = tracked
    ? (sqlite.prepare("SELECT max(created_at) FROM __drizzle_migrations").pluck().get() as number | null)
    : null;
  return journal.entries.filter((entry) => latest === null || entry.when > latest).map((entry) => entry.tag);
}

// A database without tables is new, so there is nothing to protect.
function hasTables(sqlite: Database.Database) {
  return !!sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get();
}

const timestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/\.\d+Z$/, "")
    .replace(/[-:]/g, "")
    .replace("T", "-");

// Copies the database when migrations are about to change it, and returns the copy's path.
export function backupBeforeMigrating(
  sqlite: Database.Database,
  databasePath: string,
  migrationsFolder: string,
  now = new Date(),
  pending?: string[],
) {
  if (pending?.length === 0 || databasePath === ":memory:" || !hasTables(sqlite)) return null;
  const migrations = pending ?? pendingMigrations(sqlite, migrationsFolder);
  if (!migrations.length) return null;
  startStartupOperation("backing-up");
  const directory = path.join(path.dirname(databasePath), "backups");
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `paint-vault-${timestamp(now)}-before-${migrations[0]}.sqlite`);
  if (existsSync(file)) rmSync(file);
  // VACUUM INTO writes a consistent, compact copy, including changes still in the WAL file.
  sqlite.prepare("VACUUM INTO ?").run(file);
  const copies = readdirSync(directory)
    .filter((name) => BACKUP_NAME.test(name))
    .map((name) => ({ name, modified: statSync(path.join(directory, name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified || b.name.localeCompare(a.name));
  for (const old of copies.slice(MIGRATION_BACKUPS_KEPT)) rmSync(path.join(directory, old.name));
  reportStartupProgress({ phase: "backing-up", status: "completed" });
  return file;
}
