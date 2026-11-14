import { TEXT_LIMITS, type TextLimit } from "@paintwarden/core/text-limits";
import { eq } from "drizzle-orm";

import { getDb } from "../../db/index.ts";
import {
  miniatureColorSchemes,
  miniatureRequiredPaints,
  miniatureTemplates,
  miniatures,
} from "../../db/schema.ts";
import { copyImage, deleteImage } from "../image-store.ts";
import { templateRecipe } from "../template-recipes.ts";

export class MiniatureCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MiniatureCommandError";
  }
}

export function commandResponse(error: unknown): Response {
  if (error instanceof MiniatureCommandError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

export type MiniatureInput = {
  title?: string | null;
  status?: string | null;
  notes?: string | null;
  manufacturer?: string | null;
  faction?: string | null;
  scale?: string | null;
  paintingStatus?: string | null;
  templateId?: string | null;
  includeTemplateImage?: boolean | null;
};

const stages = ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"] as const;
function fields(input: MiniatureInput, title: string) {
  const checks: [string, unknown, TextLimit][] = [
    ["Name", title, "name"],
    ["Notes", input.notes, "miniatureNotes"],
    ["Manufacturer", input.manufacturer, "detail"],
    ["Faction", input.faction, "detail"],
    ["Scale", input.scale, "detail"],
  ];
  for (const [label, value, limit] of checks) {
    if (value != null && typeof value !== "string")
      throw new MiniatureCommandError(`Invalid ${label.toLowerCase()}`, 400);
    if (typeof value === "string" && value.trim().length > TEXT_LIMITS[limit])
      throw new MiniatureCommandError(
        `${label} must be ${TEXT_LIMITS[limit].toLocaleString("en-US")} characters or fewer`,
        400,
      );
  }
  return {
    title,
    status: input.status === "WISHLIST" ? ("WISHLIST" as const) : ("OWNED" as const),
    notes: input.notes?.trim() ?? "",
    manufacturer: input.manufacturer?.trim() ?? "",
    faction: input.faction?.trim() ?? "",
    scale: input.scale?.trim() ?? "",
    paintingStatus: stages.includes(input.paintingStatus as (typeof stages)[number])
      ? (input.paintingStatus as (typeof stages)[number])
      : ("NOT_STARTED" as const),
    updatedAt: Date.now(),
  };
}

function findTemplate(input: MiniatureInput) {
  const template = input.templateId
    ? getDb().select().from(miniatureTemplates).where(eq(miniatureTemplates.id, input.templateId)).get()
    : undefined;
  if (input.templateId && !template)
    throw new MiniatureCommandError("That miniature template is not available", 400);
  return template;
}

// Files are prepared before the synchronous transaction. Callers keep the image mutation lock
// over preparation, commit and cleanup (including when this is used by GraphQL).
export async function prepareMiniatureImage(input: MiniatureInput): Promise<string | null> {
  const template = findTemplate(input);
  if (!template?.imageKey || input.includeTemplateImage === false) return null;
  return copyImage(template.imageKey);
}

// No asynchronous work inside commands: an outer GraphQL transaction can read the durable
// revision and invalidation envelope atomically with these writes. Drizzle nests via savepoints.
export function createMiniature(input: MiniatureInput, imageKey: string | null = null) {
  return getDb().transaction((tx) => {
    const template = findTemplate(input);
    if (input.title != null && typeof input.title !== "string")
      throw new MiniatureCommandError("Invalid name", 400);
    const title = input.title?.trim() || template?.name;
    if (!title) throw new MiniatureCommandError("A miniature name is required", 400);
    const values = fields(input, title);
    const recipe = template ? templateRecipe(tx, template.id) : { schemeIds: [], paints: [] };
    const row = {
      ...values,
      id: crypto.randomUUID(),
      manufacturer: values.manufacturer || template?.manufacturer || "",
      faction: values.faction || template?.faction || "",
      imageKey,
      sourceImageUrl: input.includeTemplateImage !== false ? template?.imageUrl || null : null,
      createdAt: values.updatedAt,
    };
    tx.insert(miniatures).values(row).run();
    if (recipe.schemeIds.length)
      tx.insert(miniatureColorSchemes)
        .values(recipe.schemeIds.map((schemeId, sortOrder) => ({ miniatureId: row.id, schemeId, sortOrder })))
        .run();
    if (recipe.paints.length)
      tx.insert(miniatureRequiredPaints)
        .values(
          recipe.paints.map((entry, sortOrder) => ({
            id: crypto.randomUUID(),
            miniatureId: row.id,
            paintId: entry.paintId,
            sortOrder,
            step: entry.step,
            notes: entry.notes,
          })),
        )
        .onConflictDoNothing()
        .run();
    return row;
  });
}

export function updateMiniature(id: string, input: MiniatureInput) {
  if (input.title != null && typeof input.title !== "string")
    throw new MiniatureCommandError("Invalid name", 400);
  const title = input.title?.trim();
  if (!title) throw new MiniatureCommandError("A miniature name is required", 400);
  const values = fields(input, title);
  getDb().transaction((tx) => {
    tx.update(miniatures).set(values).where(eq(miniatures.id, id)).run();
  });
  return { ok: true as const };
}

export function deleteMiniature(id: string) {
  return getDb().transaction((tx) => {
    const row = tx
      .select({ imageKey: miniatures.imageKey })
      .from(miniatures)
      .where(eq(miniatures.id, id))
      .get();
    tx.delete(miniatures).where(eq(miniatures.id, id)).run();
    return { ok: true as const, imageKey: row?.imageKey ?? null };
  });
}

export function setMiniatureImage(id: string, imageKey: string | null) {
  return getDb().transaction((tx) => {
    const row = tx
      .select({ imageKey: miniatures.imageKey })
      .from(miniatures)
      .where(eq(miniatures.id, id))
      .get();
    if (!row) return undefined;
    tx.update(miniatures)
      .set({ imageKey, sourceImageUrl: null, updatedAt: Date.now() })
      .where(eq(miniatures.id, id))
      .run();
    return row.imageKey;
  });
}

export async function withPreparedMiniatureImage<T>(
  input: MiniatureInput,
  commit: (imageKey: string | null) => T,
): Promise<T> {
  const key = await prepareMiniatureImage(input);
  try {
    return commit(key);
  } catch (error) {
    await deleteImage(key);
    throw error;
  }
}
