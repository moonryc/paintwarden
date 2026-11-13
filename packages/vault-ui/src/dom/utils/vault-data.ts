import { isPaintOwned } from "@paint-vault/core/paint-state";
import { createPaintChoiceResolver } from "@paint-vault/core/paint-substitutions";

import type { ColorScheme, Miniature, State } from "../types";

import { wishlistPaintIds as getWishlistPaintIds } from "./wishlist-paints";

export const owns = (rec: State["paintRecords"][string] | undefined) =>
  isPaintOwned(rec?.state ?? null, rec?.stockLevel ?? null, rec?.quantity ?? 0);

function groupedRows<T extends { sortOrder: number }>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  for (const group of groups.values()) group.sort((a, b) => a.sortOrder - b.sortOrder);
  return groups;
}

function firstById<T extends { id: string }>(rows: T[]) {
  const byId = new Map<string, T>();
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  return byId;
}

function createVaultDataIndex(data: State) {
  return {
    paints: firstById(data.catalog),
    schemes: firstById(data.colorSchemes),
    requirements: groupedRows(data.requirements, (row) => row.miniatureId),
    schemeLinks: groupedRows(data.miniatureColorSchemes, (row) => row.miniatureId),
    schemePaints: groupedRows(data.colorSchemePaints, (row) => row.schemeId),
    resolvePaintChoice: createPaintChoiceResolver(data),
  };
}

// Query snapshots are immutable. Key the index by the entire snapshot so every relationship,
// substitution, catalog and ownership update invalidates it; old vaults can be garbage collected.
const indexes = new WeakMap<State, ReturnType<typeof createVaultDataIndex>>();
export function vaultDataIndex(data: State) {
  let index = indexes.get(data);
  if (!index) {
    index = createVaultDataIndex(data);
    indexes.set(data, index);
  }
  return index;
}

export function attachedSchemes(data: State, miniatureId: string) {
  const index = vaultDataIndex(data);
  return (index.schemeLinks.get(miniatureId) ?? [])
    .map((link) => index.schemes.get(link.schemeId))
    .filter(Boolean) as ColorScheme[];
}

// One row per paint the miniature needs: its recipe paints (a paint used in several steps counts once),
// then any paints from attached schemes that the recipe doesn't already list.
export function effectiveRequirements(data: State, miniatureId: string) {
  const index = vaultDataIndex(data);
  const manual = index.requirements.get(miniatureId) ?? [];
  const unique = new Map(manual.map((row) => [row.paintId, row]));
  for (const scheme of attachedSchemes(data, miniatureId))
    for (const row of index.schemePaints.get(scheme.id) ?? [])
      if (!unique.has(row.paintId))
        unique.set(row.paintId, {
          id: `scheme:${row.paintId}`,
          miniatureId,
          paintId: row.paintId,
          notes: "",
          sortOrder: unique.size,
          step: "OTHER",
        });
  return [...unique.values()];
}

export function resolvedPaintIds(data: State, miniatureId: string) {
  const index = vaultDataIndex(data);
  return [
    ...new Set(
      effectiveRequirements(data, miniatureId).flatMap(
        (row) => index.resolvePaintChoice(row.paintId).paintIds,
      ),
    ),
  ];
}

export function wishlistPaintIds(data: State) {
  return getWishlistPaintIds(data.paintRecords);
}

export function missingProjectPaintIds(data: State, status?: Miniature["status"]) {
  const ids = new Set<string>();
  for (const miniature of data.miniatures) {
    if (status && miniature.status !== status) continue;
    for (const paintId of resolvedPaintIds(data, miniature.id))
      if (!owns(data.paintRecords[paintId])) ids.add(paintId);
  }
  return ids;
}
