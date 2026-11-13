import type { RecipeStep } from "@paint-vault/core/recipe-steps";
import { asc, count, eq, inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as schema from "../db/schema.ts";
import { miniatureTemplatePaints, miniatureTemplateSchemes } from "../db/schema.ts";

type Db = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

export type TemplatePaint = { paintId: string; step: RecipeStep; notes: string; sortOrder: number };
export type TemplateRecipe = { schemeIds: string[]; paints: TemplatePaint[] };

// Aggregate in SQL so listing templates never loads their recipe rows.
export function templateRecipeCounts(db: Db) {
  const counts = new Map<string, { schemeCount: number; paintCount: number }>();
  for (const row of db
    .select({ templateId: miniatureTemplateSchemes.templateId, total: count() })
    .from(miniatureTemplateSchemes)
    .groupBy(miniatureTemplateSchemes.templateId)
    .all())
    counts.set(row.templateId, { schemeCount: row.total, paintCount: 0 });
  for (const row of db
    .select({ templateId: miniatureTemplatePaints.templateId, total: count() })
    .from(miniatureTemplatePaints)
    .groupBy(miniatureTemplatePaints.templateId)
    .all())
    counts.set(row.templateId, {
      schemeCount: counts.get(row.templateId)?.schemeCount ?? 0,
      paintCount: row.total,
    });
  return counts;
}

// Reads the scheme and paint lists of the given templates, or of every template, in order.
export function templateRecipes(db: Db, templateIds?: string[]) {
  const recipes = new Map<string, TemplateRecipe>();
  if (templateIds && !templateIds.length) return recipes;
  const recipe = (id: string) => {
    let value = recipes.get(id);
    if (!value) recipes.set(id, (value = { schemeIds: [], paints: [] }));
    return value;
  };
  for (const id of templateIds ?? []) recipe(id);
  const schemes = db.select().from(miniatureTemplateSchemes);
  const paints = db.select().from(miniatureTemplatePaints);
  for (const row of (templateIds
    ? schemes.where(inArray(miniatureTemplateSchemes.templateId, templateIds))
    : schemes
  )
    .orderBy(asc(miniatureTemplateSchemes.sortOrder))
    .all())
    recipe(row.templateId).schemeIds.push(row.schemeId);
  for (const row of (templateIds
    ? paints.where(inArray(miniatureTemplatePaints.templateId, templateIds))
    : paints
  )
    .orderBy(asc(miniatureTemplatePaints.sortOrder))
    .all())
    recipe(row.templateId).paints.push({
      paintId: row.paintId,
      step: row.step,
      notes: row.notes,
      sortOrder: row.sortOrder,
    });
  return recipes;
}

export const templateRecipe = (db: Db, templateId: string) =>
  templateRecipes(db, [templateId]).get(templateId)!;

// Replaces a template's scheme and paint lists. Call inside a transaction.
export function writeTemplateRecipe(db: Db, templateId: string, recipe: TemplateRecipe) {
  db.delete(miniatureTemplateSchemes).where(eq(miniatureTemplateSchemes.templateId, templateId)).run();
  db.delete(miniatureTemplatePaints).where(eq(miniatureTemplatePaints.templateId, templateId)).run();
  if (recipe.schemeIds.length)
    db.insert(miniatureTemplateSchemes)
      .values(recipe.schemeIds.map((schemeId, sortOrder) => ({ templateId, schemeId, sortOrder })))
      .run();
  const paints = [...recipe.paints].sort((a, b) => a.sortOrder - b.sortOrder);
  for (let index = 0; index < paints.length; index += 500)
    db.insert(miniatureTemplatePaints)
      .values(
        paints.slice(index, index + 500).map((paint, offset) => ({
          templateId,
          sortOrder: index + offset,
          paintId: paint.paintId,
          step: paint.step,
          notes: paint.notes,
        })),
      )
      .run();
}
