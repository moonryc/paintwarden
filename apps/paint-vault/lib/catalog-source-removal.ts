import { eq, inArray } from "drizzle-orm";

import { getDb, getSqlite, shrinkDatabase } from "../db";
import {
  catalogSourceAssets,
  catalogSources,
  colorSchemeImages,
  colorSchemes,
  miniatureTemplates,
  paintCatalog,
} from "../db/schema";

import { normalizeRepository } from "./github-source";
import { serializeImageMutation } from "./image-mutations";
import { deleteImage } from "./image-store";

// Previews and performs removing a catalog source, keeping items another source still provides.

const SOURCE_IMAGE_PATH = "/api/catalog-source-images/";

// Items owned only by this source; the (kind, item_id) index serves the NOT EXISTS lookup.
const SOLE_ITEMS = `SELECT item_id FROM catalog_source_items AS owned
  WHERE owned.source_id = @id AND owned.kind = @kind AND NOT EXISTS (
    SELECT 1 FROM catalog_source_items AS other
    WHERE other.kind = owned.kind AND other.item_id = owned.item_id AND other.source_id <> owned.source_id
  )`;

const SOLE_PAINTS = `(${SOLE_ITEMS.replace("@kind", "'paint'")})`;

const SOLE_SCHEMES = `(${SOLE_ITEMS.replace("@kind", "'scheme'")})`;

const SOLE_TEMPLATES = `(${SOLE_ITEMS.replace("@kind", "'template'")})`;

const REMOVAL_BLOCKER_COUNTS: [string, string][] = [
  [
    "Miniature paint requirements",
    `SELECT COUNT(*) FROM miniature_required_paints WHERE paint_id IN ${SOLE_PAINTS}`,
  ],
  ["Miniature schemes", `SELECT COUNT(*) FROM miniature_color_schemes WHERE scheme_id IN ${SOLE_SCHEMES}`],
  [
    "Paint inventory or wishlist entries",
    `SELECT COUNT(*) FROM paint_inventory WHERE paint_id IN ${SOLE_PAINTS}`,
  ],
  [
    "Other templates",
    `SELECT COUNT(*) FROM (
      SELECT template_id FROM miniature_template_paints WHERE paint_id IN ${SOLE_PAINTS}
      UNION SELECT template_id FROM miniature_template_schemes WHERE scheme_id IN ${SOLE_SCHEMES}
    ) WHERE template_id NOT IN ${SOLE_TEMPLATES}`,
  ],
  [
    "Other schemes",
    `SELECT COUNT(*) FROM color_scheme_paints
      WHERE paint_id IN ${SOLE_PAINTS} AND scheme_id NOT IN ${SOLE_SCHEMES}`,
  ],
  [
    "Paint substitutions",
    `SELECT (SELECT COUNT(*) FROM paint_substitutions WHERE target_paint_id IN ${SOLE_PAINTS})
      + (SELECT COUNT(*) FROM paint_substitution_ingredients WHERE paint_id IN ${SOLE_PAINTS})`,
  ],
  [
    "Miniature substitution choices",
    `SELECT COUNT(*) FROM miniature_paint_substitutions WHERE target_paint_id IN ${SOLE_PAINTS}`,
  ],
];

export function previewSourceRemoval(id: string) {
  const db = getDb();
  const sqlite = getSqlite();
  const source = db.select().from(catalogSources).where(eq(catalogSources.id, id)).get();
  if (!source) throw new Error("Catalog source not found");
  const sole = (kind: "paint" | "scheme" | "template") =>
    new Set(sqlite.prepare(SOLE_ITEMS).pluck().all({ id, kind }) as string[]);
  const paints = sole("paint"),
    schemes = sole("scheme"),
    templates = sole("template");
  const blockers: { label: string; count: number }[] = [];
  const add = (label: string, count: number) => {
    if (count) blockers.push({ label, count });
  };
  add(
    "Other catalog sources",
    db
      .select()
      .from(catalogSources)
      .all()
      .filter(
        (row) =>
          row.id !== id &&
          row.dependencies.some(
            (dependency) => normalizeRepository(dependency.repository).id === source.repository,
          ),
      ).length,
  );
  for (const [label, query] of REMOVAL_BLOCKER_COUNTS)
    add(label, sqlite.prepare(query).pluck().get({ id }) as number);
  return {
    source: { id: source.id, name: source.name, version: source.version },
    removes: { paints: paints.size, schemes: schemes.size, templates: templates.size },
    blockers,
    canRemove: blockers.length === 0,
    ids: { paints, schemes, templates },
  };
}

export const removeCatalogSource = serializeImageMutation(async function removeCatalogSource(id: string) {
  const preview = previewSourceRemoval(id);
  if (!preview.canRemove) return preview;
  const db = getDb();
  const candidates = new Set(
    db
      .select()
      .from(catalogSourceAssets)
      .where(eq(catalogSourceAssets.sourceId, id))
      .all()
      .map((asset) => asset.imageKey),
  );
  // A scheme kept after a newer version dropped it still shows images that version no longer lists.
  for (const row of db
    .select({ imageUrl: colorSchemeImages.imageUrl, thumbnailUrl: colorSchemeImages.thumbnailUrl })
    .from(colorSchemeImages)
    .where(inArray(colorSchemeImages.schemeId, [...preview.ids.schemes]))
    .all())
    for (const url of [row.imageUrl, row.thumbnailUrl])
      if (url?.startsWith(SOURCE_IMAGE_PATH)) candidates.add(url.slice(SOURCE_IMAGE_PATH.length));
  db.transaction((tx) => {
    for (const templateId of preview.ids.templates)
      tx.delete(miniatureTemplates).where(eq(miniatureTemplates.id, templateId)).run();
    for (const schemeId of preview.ids.schemes)
      tx.delete(colorSchemes).where(eq(colorSchemes.id, schemeId)).run();
    for (const paintId of preview.ids.paints)
      tx.delete(paintCatalog).where(eq(paintCatalog.id, paintId)).run();
    tx.delete(catalogSources).where(eq(catalogSources.id, id)).run();
  });
  const retainedKeys = new Set(
    db
      .select()
      .from(catalogSourceAssets)
      .all()
      .map((asset) => asset.imageKey),
  );
  for (const row of db
    .select({ imageUrl: colorSchemeImages.imageUrl, thumbnailUrl: colorSchemeImages.thumbnailUrl })
    .from(colorSchemeImages)
    .all())
    for (const url of [row.imageUrl, row.thumbnailUrl])
      if (url?.startsWith(SOURCE_IMAGE_PATH)) retainedKeys.add(url.slice(SOURCE_IMAGE_PATH.length));
  for (const row of db.select({ imageKey: miniatureTemplates.imageKey }).from(miniatureTemplates).all())
    if (row.imageKey) retainedKeys.add(row.imageKey);
  await Promise.all([...candidates].filter((key) => !retainedKeys.has(key)).map((key) => deleteImage(key)));
  shrinkDatabase();
  return preview;
});
