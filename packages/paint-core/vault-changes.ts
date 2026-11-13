// The vault snapshot the app loads from /api/state is kept current by merging change sets
// from /api/changes. Both sides identify a row by these key fields.
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

// The server's change log position. The epoch changes whenever the server restarts.
export type VaultCursor = { epoch: string; seq: number };

// `row` is the row's current value, or null when it no longer exists.
export type VaultChange = {
  table: VaultTable;
  key: Record<string, VaultKeyValue>;
  row: Record<string, unknown> | null;
};

export type VaultChanges = VaultCursor & { reload: boolean; changes: VaultChange[] };

type InventoryRecord = { state: unknown; stockLevel: unknown; quantity: unknown };

// The parts of the app's snapshot this module updates. Inventory is stored as maps keyed by
// paint ID; every other table is an array of rows.
export type VaultSnapshot = {
  paintStates: Record<string, unknown>;
  paintRecords: Record<string, InventoryRecord>;
} & { [table in Exclude<VaultTable, "paintRecords">]: object[] };

export function vaultRowKey(table: VaultTable, row: object) {
  const values = row as Record<string, unknown>;
  return JSON.stringify(VAULT_TABLE_KEYS[table].map((field) => values[field]));
}

// Applies changes without disturbing anything they don't touch: unchanged tables keep their
// identity, updated rows stay in place, and new rows are appended.
export function applyVaultChanges<S extends VaultSnapshot>(snapshot: S, changes: VaultChange[]): S {
  if (!changes.length) return snapshot;
  const byTable = new Map<VaultTable, Map<string, Record<string, unknown> | null>>();
  for (const change of changes) {
    const rows = byTable.get(change.table) ?? new Map<string, Record<string, unknown> | null>();
    rows.set(vaultRowKey(change.table, change.key), change.row);
    byTable.set(change.table, rows);
  }

  const next: Record<string, unknown> = { ...snapshot };
  for (const [table, incoming] of byTable) {
    if (table === "paintRecords") {
      const paintStates = { ...snapshot.paintStates },
        paintRecords = { ...snapshot.paintRecords };
      for (const [key, row] of incoming) {
        const [paintId] = JSON.parse(key) as [string];
        if (row) {
          paintStates[paintId] = row.state;
          paintRecords[paintId] = { state: row.state, stockLevel: row.stockLevel, quantity: row.quantity };
        } else {
          delete paintStates[paintId];
          delete paintRecords[paintId];
        }
      }
      next.paintStates = paintStates;
      next.paintRecords = paintRecords;
      continue;
    }
    const pending = new Map(incoming);
    const rows: object[] = [];
    for (const row of snapshot[table]) {
      const key = vaultRowKey(table, row);
      if (!pending.has(key)) {
        rows.push(row);
        continue;
      }
      const replacement = pending.get(key);
      pending.delete(key);
      if (replacement) rows.push(replacement);
    }
    for (const row of pending.values()) if (row) rows.push(row);
    next[table] = rows;
  }
  return next as S;
}
