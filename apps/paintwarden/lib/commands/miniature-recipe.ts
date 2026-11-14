import { RECIPE_STEP_IDS, type RecipeStep } from "@paintwarden/core/recipe-steps";
import { TEXT_LIMITS } from "@paintwarden/core/text-limits";
import { isUuid } from "@paintwarden/core/vault-ids";
import { eq, inArray, max } from "drizzle-orm";

import { getDb } from "../../db/index.ts";
import {
  colorSchemes,
  miniatureColorSchemes,
  miniatureRecipeSteps,
  miniatureRequiredPaints,
  miniatures,
  paintCatalog,
} from "../../db/schema.ts";

import { MiniatureCommandError } from "./miniatures.ts";

const INVALID_REQUIREMENT = "Invalid requirement";
const INVALID_REQUIREMENTS = "Invalid requirements";
const INVALID_COLOR_SCHEMES = "Invalid color schemes";

const nonEmpty = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const isStep = (value: unknown): value is RecipeStep =>
  typeof value === "string" && RECIPE_STEP_IDS.has(value);
const fail = (message: string, status = 400): never => {
  throw new MiniatureCommandError(message, status);
};
function record(input: unknown, message: string, allowed?: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail(message);
  if (allowed && Object.keys(input).some((key) => !allowed.includes(key))) return fail(message);
  return input as Record<string, unknown>;
}
function validateNotes(notes: unknown) {
  if (typeof notes === "string" && notes.length > TEXT_LIMITS.stepNotes)
    fail(`Notes must be ${TEXT_LIMITS.stepNotes.toLocaleString("en-US")} characters or fewer`);
}
function requirementError(error: unknown): never {
  if (error instanceof Error && /UNIQUE constraint failed/.test(error.message))
    fail("That paint is already in this step of the recipe", 409);
  throw error;
}

export function addRequirement(input: unknown) {
  const body = record(input, INVALID_REQUIREMENT, ["miniatureId", "paintId", "step", "notes"]);
  const { miniatureId, paintId } = body;
  if (
    !nonEmpty(miniatureId) ||
    !nonEmpty(paintId) ||
    ("step" in body && !isStep(body.step)) ||
    ("notes" in body && typeof body.notes !== "string")
  )
    return fail(INVALID_REQUIREMENT);
  validateNotes(body.notes);
  const id = crypto.randomUUID();
  try {
    return getDb().transaction((tx) => {
      if (
        !tx.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get() ||
        !tx.select({ id: paintCatalog.id }).from(paintCatalog).where(eq(paintCatalog.id, paintId)).get()
      )
        fail("Miniature or paint not found", 404);
      const last = tx
        .select({ sortOrder: max(miniatureRequiredPaints.sortOrder) })
        .from(miniatureRequiredPaints)
        .where(eq(miniatureRequiredPaints.miniatureId, miniatureId))
        .get();
      tx.insert(miniatureRequiredPaints)
        .values({
          id,
          miniatureId,
          paintId,
          notes: typeof body.notes === "string" ? body.notes : "",
          step: isStep(body.step) ? body.step : "OTHER",
          sortOrder: (last?.sortOrder ?? -1) + 1,
        })
        .run();
      return { id };
    });
  } catch (error) {
    return requirementError(error);
  }
}

export function updateRequirement(input: unknown) {
  const body = record(input, "Invalid requirement update", ["id", "notes", "step"]);
  if (
    !nonEmpty(body.id) ||
    (!("notes" in body) && !("step" in body)) ||
    ("notes" in body && typeof body.notes !== "string") ||
    ("step" in body && !isStep(body.step))
  )
    return fail("Invalid requirement update");
  validateNotes(body.notes);
  const id = body.id;
  const changes: Partial<Pick<typeof miniatureRequiredPaints.$inferInsert, "notes" | "step">> = {};
  if (typeof body.notes === "string") changes.notes = body.notes;
  if (isStep(body.step)) changes.step = body.step;
  try {
    return getDb().transaction((tx) => {
      const result = tx
        .update(miniatureRequiredPaints)
        .set(changes)
        .where(eq(miniatureRequiredPaints.id, id))
        .run();
      if (!result.changes) fail("Requirement not found", 404);
      return { ok: true };
    });
  } catch (error) {
    return requirementError(error);
  }
}

export function deleteRequirement(input: unknown) {
  const body = record(input, INVALID_REQUIREMENT, ["id"]);
  if (!nonEmpty(body.id)) return fail(INVALID_REQUIREMENT);
  const id = body.id;
  return getDb().transaction((tx) => {
    const result = tx.delete(miniatureRequiredPaints).where(eq(miniatureRequiredPaints.id, id)).run();
    if (!result.changes) fail("Requirement not found", 404);
    return { ok: true };
  });
}

// Repeated paints within a step keep their first entry; valid unique UUIDs are retained.
export function replaceRequirements(input: unknown) {
  const { miniatureId, entries } = record(input, INVALID_REQUIREMENTS);
  if (!nonEmpty(miniatureId) || !Array.isArray(entries)) return fail(INVALID_REQUIREMENTS);
  try {
    return getDb().transaction((tx) => {
      if (!tx.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get())
        fail("Not found", 404);
      const seenIds = new Set<string>(),
        seenSteps = new Set<string>();
      const rows: (typeof miniatureRequiredPaints.$inferInsert)[] = [];
      entries.forEach(
        (
          entry: {
            id?: unknown;
            paintId?: unknown;
            step?: unknown;
            notes?: unknown;
            sortOrder?: unknown;
          } | null,
          index,
        ) => {
          if (!entry || !nonEmpty(entry.paintId)) return;
          const step = isStep(entry.step) ? entry.step : "OTHER";
          const key = `${step}:${entry.paintId}`;
          if (seenSteps.has(key)) return;
          seenSteps.add(key);
          const id = isUuid(entry.id) && !seenIds.has(entry.id) ? entry.id : crypto.randomUUID();
          seenIds.add(id);
          const notes = typeof entry.notes === "string" ? entry.notes.trim() : "";
          validateNotes(notes);
          rows.push({
            id,
            miniatureId,
            paintId: entry.paintId,
            step,
            notes,
            sortOrder:
              typeof entry.sortOrder === "number" && Number.isFinite(entry.sortOrder)
                ? entry.sortOrder
                : index,
          });
        },
      );
      tx.delete(miniatureRequiredPaints).where(eq(miniatureRequiredPaints.miniatureId, miniatureId)).run();
      for (let index = 0; index < rows.length; index += 500)
        tx.insert(miniatureRequiredPaints)
          .values(rows.slice(index, index + 500))
          .run();
      return { ok: true, ids: rows.map((row) => row.id) };
    });
  } catch (error) {
    if (error instanceof Error && /constraint failed/.test(error.message)) fail(INVALID_REQUIREMENTS);
    throw error;
  }
}

export function setRecipeSteps(input: unknown) {
  const { miniatureId, steps } = record(input, "Invalid recipe steps");
  if (!nonEmpty(miniatureId) || !Array.isArray(steps) || steps.some((step) => !isStep(step)))
    return fail("Invalid recipe steps");
  const unique = [...new Set(steps)] as RecipeStep[];
  return getDb().transaction((tx) => {
    if (!tx.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get())
      fail("Miniature not found", 404);
    tx.delete(miniatureRecipeSteps).where(eq(miniatureRecipeSteps.miniatureId, miniatureId)).run();
    if (unique.length)
      tx.insert(miniatureRecipeSteps)
        .values(unique.map((step) => ({ miniatureId, step })))
        .run();
    return { ok: true };
  });
}

export function setMiniatureSchemes(input: unknown) {
  const body = record(input, INVALID_COLOR_SCHEMES);
  const { miniatureId } = body;
  if (typeof miniatureId !== "string" || !miniatureId || !Array.isArray(body.schemeIds))
    return fail(INVALID_COLOR_SCHEMES);
  // Retain the REST API's omission of falsy IDs and first-occurrence ordering.
  const rawIds: unknown[] = body.schemeIds;
  const schemeIds = [...new Set(rawIds.filter(Boolean))];
  if (!schemeIds.every((id): id is string => typeof id === "string")) return fail(INVALID_COLOR_SCHEMES);
  return getDb().transaction((tx) => {
    if (!tx.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get())
      fail("Miniature not found", 404);
    const available = schemeIds.length
      ? tx.select({ id: colorSchemes.id }).from(colorSchemes).where(inArray(colorSchemes.id, schemeIds)).all()
      : [];
    if (available.length !== schemeIds.length) fail("Color scheme not found", 404);
    tx.delete(miniatureColorSchemes).where(eq(miniatureColorSchemes.miniatureId, miniatureId)).run();
    schemeIds.forEach((schemeId, sortOrder) => {
      tx.insert(miniatureColorSchemes).values({ miniatureId, schemeId, sortOrder }).run();
    });
    return { ok: true };
  });
}
