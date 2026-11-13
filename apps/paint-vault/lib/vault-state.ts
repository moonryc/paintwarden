import {
  VAULT_TABLE_KEYS,
  vaultRowKey,
  type VaultChanges,
  type VaultKeyValue,
  type VaultTable,
} from "@paint-vault/core/vault-changes";
import { isUserId } from "@paint-vault/core/vault-ids";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import { getDb, getSqlite } from "../db";
import {
  VAULT_TABLES,
  changeLogEpoch,
  changedKeysSince,
  currentChangeSeq,
  pruneChangeLog,
} from "../db/change-log";
import {
  catalogSourceItems,
  catalogSources,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  miniatureColorSchemes,
  miniaturePaintSubstitutions,
  miniatureRequiredPaints,
  miniatureRecipeSteps,
  miniatures,
  paintCatalog,
  paintInventory,
  paintSubstitutionIngredients,
  paintSubstitutions,
} from "../db/schema";

import { sourceLogoUrl } from "./catalog-sources";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type SourceInfo = { sourceName: string; sourceLogoUrl: string | null };
type RowKey = Record<string, VaultKeyValue>;

// Stay below SQLite's traditional 999-variable limit, including every composite-key field.
const MAX_QUERY_PARAMS = 900;

function currentRows(tx: Tx, table: VaultTable, keys: RowKey[]) {
  const source = VAULT_TABLES[table] as SQLiteTable & Record<string, SQLiteColumn>;
  const fields = VAULT_TABLE_KEYS[table];
  const singleField = fields.length === 1 ? fields[0] : undefined;
  const batchSize = Math.floor(MAX_QUERY_PARAMS / fields.length);
  const rows = new Map<string, Record<string, unknown>>();
  for (let offset = 0; offset < keys.length; offset += batchSize) {
    const batch = keys.slice(offset, offset + batchSize);
    // Row-value IN uses the composite index without a deep OR expression tree. Bind each
    // value separately; SQL identifiers come only from the trusted schema/key definitions.
    const predicate = singleField
      ? inArray(
          source[singleField],
          batch.map((key) => key[singleField]),
        )
      : sql`(${sql.join(
          fields.map((field) => source[field]),
          sql`, `,
        )}) in (values ${sql.join(
          batch.map(
            (key) =>
              sql`(${sql.join(
                fields.map((field) => sql`${key[field]}`),
                sql`, `,
              )})`,
          ),
          sql`, `,
        )})`;
    for (const row of tx.select().from(source).where(predicate).all()) rows.set(vaultRowKey(table, row), row);
  }
  return rows;
}

// The image key in the URL changes whenever the photo is replaced, so the image can be cached
// indefinitely without showing a stale photo.
const formatMiniature = (row: typeof miniatures.$inferSelect) => ({
  ...row,
  imageUrl: row.imageKey
    ? `/api/miniatures/${encodeURIComponent(row.id)}/image?v=${encodeURIComponent(row.imageKey)}`
    : row.sourceImageUrl,
});

// The app still reads whether a paint or scheme is the owner's own as a flag.
const formatPaint = (row: { id: string }, source: SourceInfo | undefined) => ({
  ...row,
  isCustom: isUserId(row.id),
  ...source,
});
const formatScheme = (row: { id: string }, source: SourceInfo | undefined) => ({
  ...row,
  isSystem: !isUserId(row.id),
  ...source,
});

function sourceLookup(tx: Tx, kind: "paint" | "scheme", itemIds?: string[]) {
  const sources = new Map(
    tx
      .select()
      .from(catalogSources)
      .all()
      .map((row) => [row.id, { sourceName: row.name, sourceLogoUrl: sourceLogoUrl(row.id, row.logoSvg) }]),
  );
  const lookup = new Map<string, SourceInfo | undefined>();
  const readItems = (ids?: string[]) => {
    const items = tx
      .select()
      .from(catalogSourceItems)
      .where(
        ids
          ? and(eq(catalogSourceItems.kind, kind), inArray(catalogSourceItems.itemId, ids))
          : eq(catalogSourceItems.kind, kind),
      )
      .all();
    // Items are read in key order, so when sources share an item the last source wins.
    for (const row of items) lookup.set(row.itemId, sources.get(row.sourceId));
  };
  // The kind consumes one parameter as well. A shared item stays in one batch, preserving
  // the existing source precedence even when many paints or schemes change at once.
  const batchSize = MAX_QUERY_PARAMS - 1;
  if (itemIds) {
    for (let offset = 0; offset < itemIds.length; offset += batchSize)
      readItems(itemIds.slice(offset, offset + batchSize));
  } else readItems();
  return lookup;
}

export function vaultSnapshot() {
  const db = getDb();
  const sqlite = getSqlite();
  pruneChangeLog(sqlite);
  // One read transaction keeps every table and the change-log position consistent.
  return db.transaction((tx) => {
    const paintSources = sourceLookup(tx, "paint");
    const schemeSources = sourceLookup(tx, "scheme");
    const inventory = tx.select().from(paintInventory).all();
    return {
      cursor: { epoch: changeLogEpoch, seq: currentChangeSeq(sqlite) },
      miniatures: tx.select().from(miniatures).all().map(formatMiniature),
      catalog: tx
        .select()
        .from(paintCatalog)
        .all()
        .map((paint) => formatPaint(paint, paintSources.get(paint.id))),
      paintStates: Object.fromEntries(inventory.map((row) => [row.paintId, row.state])),
      paintRecords: Object.fromEntries(
        inventory.map((row) => [
          row.paintId,
          { state: row.state, stockLevel: row.stockLevel, quantity: row.quantity },
        ]),
      ),
      requirements: tx.select().from(miniatureRequiredPaints).all(),
      recipeSteps: tx.select().from(miniatureRecipeSteps).all(),
      colorSchemes: tx
        .select()
        .from(colorSchemes)
        .all()
        .map((scheme) => formatScheme(scheme, schemeSources.get(scheme.id))),
      colorSchemePaints: tx.select().from(colorSchemePaints).all(),
      colorSchemeDividers: tx.select().from(colorSchemeDividers).all(),
      colorSchemeImages: tx.select().from(colorSchemeImages).all(),
      miniatureColorSchemes: tx.select().from(miniatureColorSchemes).all(),
      paintSubstitutions: tx.select().from(paintSubstitutions).all(),
      paintSubstitutionIngredients: tx.select().from(paintSubstitutionIngredients).all(),
      miniaturePaintSubstitutions: tx.select().from(miniaturePaintSubstitutions).all(),
    };
  });
}

// Returns the current value of every row changed after `since`, formatted as in the snapshot.
export function vaultChangesSince(epoch: string, since: number): VaultChanges {
  const db = getDb();
  const sqlite = getSqlite();
  pruneChangeLog(sqlite);
  return db.transaction((tx) => {
    const logged = changedKeysSince(sqlite, epoch, since);
    if (logged.reload) return { epoch: changeLogEpoch, seq: logged.seq, reload: true, changes: [] };
    const keysByTable = new Map<VaultTable, RowKey[]>();
    for (const { table, key } of logged.keys) {
      const keys = keysByTable.get(table) ?? [];
      keys.push(key);
      keysByTable.set(table, keys);
    }
    const rowsByTable = new Map(
      [...keysByTable].map(([table, keys]) => [table, currentRows(tx, table, keys)]),
    );
    const idsFor = (table: VaultTable) => (keysByTable.get(table) ?? []).map((key) => String(key.id));
    const paintIds = idsFor("catalog"),
      schemeIds = idsFor("colorSchemes");
    const noSources = new Map<string, SourceInfo | undefined>();
    const paintSources = paintIds.length ? sourceLookup(tx, "paint", paintIds) : noSources;
    const schemeSources = schemeIds.length ? sourceLookup(tx, "scheme", schemeIds) : noSources;
    const changes = logged.keys.map(({ table, key }) => {
      // Read in batches, but emit in change-log order (including missing/deleted keys).
      const row = rowsByTable.get(table)?.get(vaultRowKey(table, key));
      if (!row) return { table, key, row: null };
      if (table === "miniatures")
        return { table, key, row: formatMiniature(row as typeof miniatures.$inferSelect) };
      if (table === "catalog")
        return { table, key, row: formatPaint(row as { id: string }, paintSources.get(String(row.id))) };
      if (table === "colorSchemes")
        return { table, key, row: formatScheme(row as { id: string }, schemeSources.get(String(row.id))) };
      return { table, key, row };
    });
    return { epoch: changeLogEpoch, seq: logged.seq, reload: false, changes };
  });
}
