import { eq } from "drizzle-orm";

import { getDb } from "../db";
import {
  catalogSourceAssets,
  catalogSourceItems,
  catalogSources,
  colorSchemeDividers,
  colorSchemeImages,
  colorSchemePaints,
  colorSchemes,
  miniatureTemplates,
  paintCatalog,
} from "../db/schema";

import { settleDroppedItems } from "./catalog-source-dropped";
import type { Catalog, Manifest } from "./source-format";
import { writeTemplateRecipe } from "./template-recipes";

// Writes a validated catalog source into the vault, inside the caller's transaction.

export const SOURCE_IMAGE_PATH = "/api/catalog-source-images/";

// `id` is the plugin's UUID in this vault; `repository` is its key outside it.
export function installCatalog(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  id: string,
  repository: string,
  url: string,
  branch: string,
  manifest: Manifest,
  catalog: Catalog,
  assets: Map<string, { key: string; sha256: string }>,
) {
  const db = getDb();
  const now = Date.now();
  const elsewhere = new Set(
    db
      .select()
      .from(catalogSourceItems)
      .all()
      .filter((row) => row.sourceId !== id)
      .map((row) => `${row.kind}:${row.itemId}`),
  );
  const ownedElsewhere = (kind: "paint" | "scheme" | "template", itemId: string) =>
    elsewhere.has(`${kind}:${itemId}`);
  const existingPaints = new Map(
    db
      .select()
      .from(paintCatalog)
      .all()
      .map((row) => [row.id, row]),
  );
  const existingSchemes = new Map(
    db
      .select()
      .from(colorSchemes)
      .all()
      .map((row) => [row.id, row]),
  );
  const existingTemplates = new Map(
    db
      .select()
      .from(miniatureTemplates)
      .all()
      .map((row) => [row.id, row]),
  );
  const availablePaints = new Set([...existingPaints.keys(), ...catalog.paints.map((row) => row.id)]);
  const availableSchemes = new Set([...existingSchemes.keys(), ...catalog.schemes.map((row) => row.id)]);
  for (const scheme of catalog.schemes)
    for (const entry of scheme.entries)
      if (entry.type === "PAINT" && !availablePaints.has(entry.paintId))
        throw new Error(`Scheme ${scheme.name} needs missing paint ${entry.paintId}`);
  for (const template of catalog.templates) {
    if (template.schemeIds.some((schemeId) => !availableSchemes.has(schemeId)))
      throw new Error(`Template ${template.name} needs a missing scheme`);
    if (template.paints.some((paint) => !availablePaints.has(paint.paintId)))
      throw new Error(`Template ${template.name} needs a missing paint`);
  }
  const localImage = (filename?: string | null) =>
    filename ? `${SOURCE_IMAGE_PATH}${assets.get(filename)!.key}` : null;

  {
    tx.insert(catalogSources)
      .values({
        id,
        repository,
        url,
        branch,
        name: manifest.name,
        version: manifest.version,
        license: manifest.license ?? null,
        attribution: manifest.attribution ?? null,
        dependencies: manifest.dependencies,
        updatedAt: now,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: catalogSources.id,
        set: {
          branch,
          name: manifest.name,
          version: manifest.version,
          license: manifest.license ?? null,
          attribution: manifest.attribution ?? null,
          dependencies: manifest.dependencies,
          updatedAt: now,
          lastError: null,
        },
      })
      .run();

    for (const paint of catalog.paints) {
      const existing = existingPaints.get(paint.id);
      if (
        existing &&
        ownedElsewhere("paint", paint.id) &&
        (existing.brand !== paint.brand ||
          existing.range !== paint.range ||
          existing.name !== paint.name ||
          existing.colorHex !== (paint.colorHex ?? null))
      )
        throw new Error(`Paint ID conflicts with another source: ${paint.id}`);
      const values = {
        brand: paint.brand,
        range: paint.range,
        name: paint.name,
        type: paint.type ?? null,
        discontinued: paint.discontinued ?? false,
        colorHex: paint.colorHex ?? null,
        sourceUrl: paint.sourceUrl ?? null,
        sourceLabel: paint.sourceLabel ?? manifest.name,
      };
      if (existing && ownedElsewhere("paint", paint.id)) continue;
      tx.insert(paintCatalog)
        .values({ id: paint.id, ...values })
        .onConflictDoUpdate({ target: paintCatalog.id, set: values })
        .run();
    }

    for (const scheme of catalog.schemes) {
      const existing = existingSchemes.get(scheme.id);
      if (existing && ownedElsewhere("scheme", scheme.id))
        throw new Error(`Scheme ID conflicts with another source: ${scheme.id}`);
      tx.insert(colorSchemes)
        .values({
          id: scheme.id,
          name: scheme.name,
          category: scheme.category as typeof colorSchemes.$inferInsert.category,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: colorSchemes.id,
          set: {
            name: scheme.name,
            category: scheme.category as typeof colorSchemes.$inferInsert.category,
            updatedAt: now,
          },
        })
        .run();
      tx.delete(colorSchemePaints).where(eq(colorSchemePaints.schemeId, scheme.id)).run();
      tx.delete(colorSchemeDividers).where(eq(colorSchemeDividers.schemeId, scheme.id)).run();
      tx.delete(colorSchemeImages).where(eq(colorSchemeImages.schemeId, scheme.id)).run();
      for (const [sortOrder, entry] of scheme.entries.entries()) {
        if (entry.type === "PAINT")
          tx.insert(colorSchemePaints)
            .values({ schemeId: scheme.id, paintId: entry.paintId, sortOrder })
            .run();
        else if (entry.type === "STEP" || entry.type === "MILESTONE")
          tx.insert(colorSchemeDividers)
            .values({
              id: entry.id,
              schemeId: scheme.id,
              label: entry.label,
              tone: entry.type === "STEP" ? "SECTION" : "MILESTONE",
              sortOrder,
            })
            .run();
        else
          tx.insert(colorSchemeImages)
            .values({
              id: entry.id,
              schemeId: scheme.id,
              imageUrl: localImage(entry.imageUrl)!,
              thumbnailUrl: localImage(entry.thumbnailUrl),
              imageType: entry.imageType ?? null,
              method: entry.method ?? null,
              sortOrder,
            })
            .run();
      }
    }

    for (const template of catalog.templates) {
      const existing = existingTemplates.get(template.id);
      if (existing && ownedElsewhere("template", template.id))
        throw new Error(`Template ID conflicts with another source: ${template.id}`);
      const values = {
        name: template.name,
        manufacturer: template.manufacturer,
        faction: template.faction,
        categories: template.categories,
        imageKey: template.imageUrl ? assets.get(template.imageUrl)!.key : null,
        imageUrl: null,
        updatedAt: now,
      };
      tx.insert(miniatureTemplates)
        .values({ id: template.id, ...values, createdAt: existing?.createdAt ?? now })
        .onConflictDoUpdate({ target: miniatureTemplates.id, set: values })
        .run();
      writeTemplateRecipe(tx, template.id, {
        schemeIds: template.schemeIds,
        paints: template.paints,
      });
    }

    const previousItems = tx
      .select({ kind: catalogSourceItems.kind, itemId: catalogSourceItems.itemId })
      .from(catalogSourceItems)
      .where(eq(catalogSourceItems.sourceId, id))
      .all();
    tx.delete(catalogSourceItems).where(eq(catalogSourceItems.sourceId, id)).run();
    const items = [
      ...catalog.paints.map((item) => ({ sourceId: id, kind: "paint" as const, itemId: item.id })),
      ...catalog.schemes.map((item) => ({ sourceId: id, kind: "scheme" as const, itemId: item.id })),
      ...catalog.templates.map((item) => ({ sourceId: id, kind: "template" as const, itemId: item.id })),
    ];
    for (let index = 0; index < items.length; index += 1000)
      tx.insert(catalogSourceItems)
        .values(items.slice(index, index + 1000))
        .run();
    const current = new Set(items.map((item) => `${item.kind}:${item.itemId}`));
    settleDroppedItems(
      tx,
      id,
      previousItems.filter((item) => !current.has(`${item.kind}:${item.itemId}`)),
      ownedElsewhere,
    );
    tx.delete(catalogSourceAssets).where(eq(catalogSourceAssets.sourceId, id)).run();
    const assetRows = [...assets].map(([assetPath, asset]) => ({
      sourceId: id,
      assetPath,
      imageKey: asset.key,
      sha256: asset.sha256,
    }));
    for (let index = 0; index < assetRows.length; index += 500)
      tx.insert(catalogSourceAssets)
        .values(assetRows.slice(index, index + 500))
        .run();
  }
}
