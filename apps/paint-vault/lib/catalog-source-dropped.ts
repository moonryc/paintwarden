import { eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as schema from "../db/schema.ts";
import { catalogSourceItems, colorSchemes, miniatureTemplates, paintCatalog } from "../db/schema.ts";

type Db = BaseSQLiteDatabase<"sync", unknown, typeof schema>;
export type SourceItemKind = "paint" | "scheme" | "template";
export type SourceItem = { kind: SourceItemKind; itemId: string };

// Whether anything outside the source's own catalog still uses the item. Templates are never
// referenced, so a dropped template is always removed.
const IN_USE: Record<Exclude<SourceItemKind, "template">, (id: string) => ReturnType<typeof sql>> = {
  scheme: (id) => sql`SELECT 1 WHERE
    EXISTS (SELECT 1 FROM miniature_color_schemes WHERE scheme_id = ${id})
    OR EXISTS (SELECT 1 FROM miniature_template_schemes WHERE scheme_id = ${id})`,
  paint: (id) => sql`SELECT 1 WHERE
    EXISTS (SELECT 1 FROM paint_inventory WHERE paint_id = ${id})
    OR EXISTS (SELECT 1 FROM miniature_required_paints WHERE paint_id = ${id})
    OR EXISTS (SELECT 1 FROM miniature_template_paints WHERE paint_id = ${id})
    OR EXISTS (SELECT 1 FROM color_scheme_paints WHERE paint_id = ${id})
    OR EXISTS (SELECT 1 FROM paint_substitutions WHERE target_paint_id = ${id})
    OR EXISTS (SELECT 1 FROM paint_substitution_ingredients WHERE paint_id = ${id})
    OR EXISTS (SELECT 1 FROM miniature_paint_substitutions WHERE target_paint_id = ${id})`,
};

// Settles items an earlier version of a source provided and the new version no longer does.
// An item nothing uses is deleted. One the vault still uses stays, linked to the source so that
// removing the source later accounts for it; a kept paint is marked discontinued. Templates go
// first and paints last, so a paint kept only by a dropped scheme goes when that scheme does.
// Call inside the install transaction, after the new version's items are recorded.
export function settleDroppedItems(
  tx: Db,
  sourceId: string,
  dropped: SourceItem[],
  ownedElsewhere: (kind: SourceItemKind, itemId: string) => boolean,
) {
  const kept: SourceItem[] = [];
  for (const kind of ["template", "scheme", "paint"] as const)
    for (const item of dropped) {
      if (item.kind !== kind || ownedElsewhere(kind, item.itemId)) continue;
      if (kind !== "template" && tx.get(IN_USE[kind](item.itemId))) {
        kept.push(item);
        if (kind === "paint")
          tx.update(paintCatalog).set({ discontinued: true }).where(eq(paintCatalog.id, item.itemId)).run();
        continue;
      }
      const table = { template: miniatureTemplates, scheme: colorSchemes, paint: paintCatalog }[kind];
      tx.delete(table).where(eq(table.id, item.itemId)).run();
    }
  for (let index = 0; index < kept.length; index += 1000)
    tx.insert(catalogSourceItems)
      .values(kept.slice(index, index + 1000).map((item) => ({ sourceId, ...item })))
      .run();
  return kept;
}
