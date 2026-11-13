import { RECIPE_STEP_IDS, type RecipeStep } from "@paint-vault/core/recipe-steps";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, newUserId } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { getDb } from "../db/index.ts";
import {
  colorSchemes,
  miniatureColorSchemes,
  miniatureRequiredPaints,
  miniatureTemplates,
  miniatures,
  paintCatalog,
} from "../db/schema.ts";

import { deleteImage, loadImage, saveImage } from "./image-store.ts";
import { templateRecipe, writeTemplateRecipe, type TemplateRecipe } from "./template-recipes.ts";

export type TemplateInput = {
  name?: string | null;
  manufacturer?: string | null;
  faction?: string | null;
  imageUrl?: string | null;
  sourceMiniatureId?: string | null;
  schemeIds?: string[] | null;
  paints?: { paintId: string; step: string; notes?: string | null; sortOrder?: number | null }[] | null;
};
type Input = TemplateInput;
const steps = RECIPE_STEP_IDS;

export class TemplateCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TemplateCommandError";
  }
}
export function templateCommandResponse(error: unknown): Response {
  if (error instanceof TemplateCommandError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

function prepare(input: Input, existing?: typeof miniatureTemplates.$inferSelect & TemplateRecipe) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { error: "Invalid template content" } as const;
  for (const key of ["name", "manufacturer", "faction", "imageUrl", "sourceMiniatureId"] as const)
    if (input[key] != null && typeof input[key] !== "string") return { error: `Invalid ${key}` } as const;
  const db = getDb();
  const source = input.sourceMiniatureId
    ? db.select().from(miniatures).where(eq(miniatures.id, input.sourceMiniatureId)).get()
    : undefined;
  if (input.sourceMiniatureId && !source) return { error: "Miniature not found" } as const;
  const name = (input.name ?? source?.title ?? existing?.name ?? "").trim();
  if (!name || name.length > TEXT_LIMITS.name)
    return { error: `Template name must be 1–${TEXT_LIMITS.name} characters` } as const;
  const manufacturer = (input.manufacturer ?? source?.manufacturer ?? existing?.manufacturer ?? "").trim();
  const faction = (input.faction ?? source?.faction ?? existing?.faction ?? "").trim();
  if (manufacturer.length > TEXT_LIMITS.detail || faction.length > TEXT_LIMITS.detail)
    return { error: `Manufacturer and faction must be ${TEXT_LIMITS.detail} characters or fewer` } as const;
  const schemeIds = source
    ? db
        .select()
        .from(miniatureColorSchemes)
        .where(eq(miniatureColorSchemes.miniatureId, source.id))
        .all()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((row) => row.schemeId)
    : (input.schemeIds ?? existing?.schemeIds ?? []);
  const paints = source
    ? db
        .select()
        .from(miniatureRequiredPaints)
        .where(eq(miniatureRequiredPaints.miniatureId, source.id))
        .all()
    : (input.paints ?? existing?.paints ?? []);
  if (!Array.isArray(schemeIds) || !Array.isArray(paints))
    return { error: "Invalid template content" } as const;
  const validSchemes = new Set(
    db
      .select({ id: colorSchemes.id })
      .from(colorSchemes)
      .all()
      .map((row) => row.id),
  );
  const validPaints = new Set(
    db
      .select({ id: paintCatalog.id })
      .from(paintCatalog)
      .all()
      .map((row) => row.id),
  );
  if (
    schemeIds.some((id) => typeof id !== "string" || !validSchemes.has(id)) ||
    new Set(schemeIds).size !== schemeIds.length
  )
    return { error: "Template contains invalid schemes" } as const;
  if (
    paints.some(
      (row) =>
        !row ||
        typeof row.paintId !== "string" ||
        !validPaints.has(row.paintId) ||
        !steps.has(row.step) ||
        (row.notes != null && typeof row.notes !== "string") ||
        (row.sortOrder != null && !Number.isSafeInteger(row.sortOrder)),
    ) ||
    new Set(paints.map((row) => `${row.step}:${row.paintId}`)).size !== paints.length
  )
    return { error: "Template contains invalid paints" } as const;
  const imageUrl = source?.sourceImageUrl ?? input.imageUrl ?? existing?.imageUrl ?? null;
  if (imageUrl && !/^https?:\/\//.test(imageUrl))
    return { error: "Image URL must use http or https" } as const;
  if (imageUrl && imageUrl.length > TEXT_LIMITS.url)
    return {
      error: `Image URL must be ${TEXT_LIMITS.url.toLocaleString("en-US")} characters or fewer`,
    } as const;
  if (paints.some((row) => typeof row.notes === "string" && row.notes.length > TEXT_LIMITS.stepNotes))
    return {
      error: `Step notes must be ${TEXT_LIMITS.stepNotes.toLocaleString("en-US")} characters or fewer`,
    } as const;
  return {
    value: {
      name,
      manufacturer,
      faction,
      imageUrl,
      schemeIds,
      paints: paints
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((row, index) => ({
          paintId: row.paintId,
          step: row.step as RecipeStep,
          notes: row.notes || "",
          sortOrder: index,
        })),
    },
    sourceImageKey: source?.imageKey,
  } as const;
}

function prepared(input: TemplateInput, existing?: typeof miniatureTemplates.$inferSelect & TemplateRecipe) {
  const result = prepare(input, existing);
  if ("error" in result) throw new TemplateCommandError(result.error!, 400);
  return result;
}
function existingUserTemplate(id: string) {
  if (!id || !isUserId(id)) throw new TemplateCommandError("Source templates are read-only", 403);
  const row = getDb().select().from(miniatureTemplates).where(eq(miniatureTemplates.id, id)).get();
  if (!row) throw new TemplateCommandError("Template not found", 404);
  return row;
}

// The caller owns the image mutation lock across preparation, SQL commit and cleanup.
export async function withPreparedTemplateImage<T>(
  input: TemplateInput,
  commit: (key: string | null) => T,
): Promise<T> {
  const result = prepared(input);
  let key: string | null = null;
  if (result.sourceImageKey) {
    const image = await loadImage(result.sourceImageKey);
    if (image)
      key = await saveImage(new File([new Uint8Array(image.bytes)], "template", { type: image.contentType }));
  }
  try {
    return commit(key);
  } catch (error) {
    await deleteImage(key);
    throw error;
  }
}

// Synchronous commands nest safely in a GraphQL revision/invalidation transaction.
export function createTemplate(input: TemplateInput, imageKey: string | null = null) {
  const { schemeIds, paints, ...fields } = prepared(input).value;
  const now = Date.now();
  const row = {
    id: newUserId(),
    ...fields,
    categories: ["My templates"],
    imageKey,
    createdAt: now,
    updatedAt: now,
  };
  getDb().transaction((tx) => {
    tx.insert(miniatureTemplates).values(row).run();
    writeTemplateRecipe(tx, row.id, { schemeIds, paints });
  });
  return { ...row, schemeIds, paints };
}
export function updateTemplate(id: string, input: TemplateInput) {
  const existing = existingUserTemplate(id),
    db = getDb();
  const { schemeIds, paints, ...fields } = prepared(input, { ...existing, ...templateRecipe(db, id) }).value;
  db.transaction((tx) => {
    tx.update(miniatureTemplates)
      .set({ ...fields, updatedAt: Date.now() })
      .where(eq(miniatureTemplates.id, id))
      .run();
    writeTemplateRecipe(tx, id, { schemeIds, paints });
  });
  return { ok: true as const };
}
export function deleteTemplate(id: string) {
  const existing = existingUserTemplate(id);
  getDb().delete(miniatureTemplates).where(eq(miniatureTemplates.id, id)).run();
  return { ok: true as const, imageKey: existing.imageKey };
}
