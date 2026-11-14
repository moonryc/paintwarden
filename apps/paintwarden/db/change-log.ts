import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";
import { getTableColumns, getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import {
  catalogSourceItems,
  catalogSources,
  folders,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  miniatureColorSchemes,
  miniaturePaintSubstitutions,
  miniatureRequiredPaints,
  miniatureRecipeSteps,
  miniatureTemplates,
  miniatureTemplateSchemes,
  miniatureTemplatePaints,
  miniatures,
  paintCatalog,
  paintInventory,
  paintSubstitutionIngredients,
  paintSubstitutions,
} from "./schema.ts";

// Trigger keys are server-only: GraphQL clients receive family invalidations, never rows.
export const VAULT_TABLE_KEYS = {
  miniatures: ["id"],
  catalog: ["id"],
  paintRecords: ["paintId"],
  requirements: ["id"],
  recipeSteps: ["miniatureId", "step"],
  colorSchemes: ["id"],
  colorSchemePaints: ["schemeId", "sortOrder"],
  colorSchemeDividers: ["schemeId", "id"],
  colorSchemeImages: ["schemeId", "id"],
  miniatureColorSchemes: ["miniatureId", "schemeId"],
  paintSubstitutions: ["id"],
  paintSubstitutionIngredients: ["substitutionId", "paintId"],
  miniaturePaintSubstitutions: ["miniatureId", "targetPaintId"],
} as const;

export type VaultTable = keyof typeof VAULT_TABLE_KEYS;
export type VaultKeyValue = string | number;

// Temporary triggers capture writes and foreign-key cascades for resumable invalidations.
// A restart starts a new epoch, causing clients to discard their previous revision baseline.
export const VAULT_TABLES: Record<VaultTable, SQLiteTable> = {
  miniatures,
  catalog: paintCatalog,
  paintRecords: paintInventory,
  requirements: miniatureRequiredPaints,
  recipeSteps: miniatureRecipeSteps,
  colorSchemes,
  colorSchemePaints,
  colorSchemeDividers,
  colorSchemeImages,
  miniatureColorSchemes,
  paintSubstitutions,
  paintSubstitutionIngredients,
  miniaturePaintSubstitutions,
};

// Source identity/display changes invalidate every projection. Bookkeeping only invalidates sources.
const RELOAD_TABLE = "$reload";

// Bound catchup work; a large write asks clients to refresh their loaded projections.
const MAX_CHANGES = 2000;
const KEEP_ENTRIES = 20_000;

export const changeLogEpoch = randomUUID();
const prunedThroughByDatabase = new WeakMap<Database.Database, number>();

const sqlColumn = (table: SQLiteTable, field: string) =>
  (getTableColumns(table) as Record<string, { name: string }>)[field].name;

const rowChanged = (table: SQLiteTable) =>
  Object.values(getTableColumns(table))
    .map((column) => `OLD."${column.name}" IS NOT NEW."${column.name}"`)
    .join(" OR ");

export function installChangeLog(sqlite: Database.Database) {
  const statements = [
    `CREATE TEMP TABLE IF NOT EXISTS vault_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      table_key TEXT NOT NULL,
      row_key TEXT NOT NULL
    )`,
  ];
  for (const [tableKey, table] of Object.entries(VAULT_TABLES) as [VaultTable, SQLiteTable][]) {
    const name = getTableName(table);
    const key = (row: "NEW" | "OLD") =>
      `json_array(${VAULT_TABLE_KEYS[tableKey].map((field) => `${row}."${sqlColumn(table, field)}"`).join(", ")})`;
    const log = (row: "NEW" | "OLD") =>
      `INSERT INTO vault_changes (table_key, row_key) VALUES ('${tableKey}', ${key(row)});`;
    statements.push(
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_insert AFTER INSERT ON main."${name}" BEGIN ${log("NEW")} END`,
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_update AFTER UPDATE ON main."${name}"
        WHEN ${rowChanged(table)} BEGIN ${log("OLD")}
        INSERT INTO vault_changes (table_key, row_key)
          SELECT '${tableKey}', ${key("NEW")} WHERE ${key("OLD")} IS NOT ${key("NEW")}; END`,
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_delete AFTER DELETE ON main."${name}" BEGIN ${log("OLD")} END`,
    );
  }
  const reload = `INSERT INTO vault_changes (table_key, row_key) VALUES ('${RELOAD_TABLE}', '[]');`;
  // Folder and template changes conservatively invalidate every projection.
  for (const table of [folders, miniatureTemplates, miniatureTemplateSchemes, miniatureTemplatePaints]) {
    const name = getTableName(table);
    statements.push(
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_insert AFTER INSERT ON main."${name}" BEGIN ${reload} END`,
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_update AFTER UPDATE ON main."${name}"
        WHEN ${rowChanged(table)} BEGIN ${reload} END`,
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_delete AFTER DELETE ON main."${name}" BEGIN ${reload} END`,
    );
  }
  const sources = getTableName(catalogSources);
  const sourceName = sqlColumn(catalogSources, "name"),
    sourceLogo = sqlColumn(catalogSources, "logoSvg");
  for (const name of [sources, getTableName(catalogSourceItems)])
    statements.push(
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_insert AFTER INSERT ON main."${name}" BEGIN ${reload} END`,
      `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${name}_delete AFTER DELETE ON main."${name}" BEGIN ${reload} END`,
    );
  statements.push(
    `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${sources}_update AFTER UPDATE ON main."${sources}"
      WHEN OLD."${sourceName}" IS NOT NEW."${sourceName}" OR OLD."${sourceLogo}" IS NOT NEW."${sourceLogo}"
      BEGIN ${reload} END`,
    `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${sources}_metadata_update AFTER UPDATE ON main."${sources}"
      WHEN ${rowChanged(catalogSources)}
      BEGIN INSERT INTO vault_changes (table_key, row_key) VALUES ('$sources', '[]'); END`,
    `CREATE TEMP TRIGGER IF NOT EXISTS vault_log_${getTableName(catalogSourceItems)}_update
      AFTER UPDATE ON main."${getTableName(catalogSourceItems)}"
      WHEN ${rowChanged(catalogSourceItems)} BEGIN ${reload} END`,
  );
  for (const statement of statements) sqlite.exec(statement);
}

export function currentChangeSeq(sqlite: Database.Database) {
  return (sqlite.prepare("SELECT coalesce(max(seq), 0) FROM vault_changes").pluck().get() as number) || 0;
}

export type LoggedChanges =
  | { reload: true; seq: number }
  | {
      reload: false;
      seq: number;
      sourcesChanged?: boolean;
      keys: { table: VaultTable; key: Record<string, VaultKeyValue> }[];
    };

// Call inside a transaction so the returned position and invalidation keys are consistent.
export function changedKeysSince(sqlite: Database.Database, epoch: string, since: number): LoggedChanges {
  const seq = currentChangeSeq(sqlite);
  if (epoch !== changeLogEpoch || since < (prunedThroughByDatabase.get(sqlite) ?? 0) || since > seq)
    return { reload: true, seq };
  const rows = sqlite
    .prepare(
      `SELECT table_key AS tableKey, row_key AS rowKey FROM vault_changes
       WHERE seq > ? GROUP BY table_key, row_key ORDER BY max(seq) LIMIT ?`,
    )
    .all(since, MAX_CHANGES + 1) as { tableKey: string; rowKey: string }[];
  if (rows.length > MAX_CHANGES || rows.some((row) => row.tableKey === RELOAD_TABLE))
    return { reload: true, seq };
  return {
    reload: false,
    seq,
    ...(rows.some((row) => row.tableKey === "$sources") ? { sourcesChanged: true } : {}),
    keys: rows
      .filter((row) => row.tableKey !== "$sources")
      .map(({ tableKey, rowKey }) => {
        const table = tableKey as VaultTable;
        const values = JSON.parse(rowKey) as VaultKeyValue[];
        return {
          table,
          key: Object.fromEntries(VAULT_TABLE_KEYS[table].map((field, index) => [field, values[index]])),
        };
      }),
  };
}

export function pruneChangeLog(sqlite: Database.Database) {
  const seq = currentChangeSeq(sqlite);
  if (seq - (prunedThroughByDatabase.get(sqlite) ?? 0) <= KEEP_ENTRIES * 2) return;
  const prunedThrough = seq - KEEP_ENTRIES;
  sqlite.prepare("DELETE FROM vault_changes WHERE seq <= ?").run(prunedThrough);
  prunedThroughByDatabase.set(sqlite, prunedThrough);
}
