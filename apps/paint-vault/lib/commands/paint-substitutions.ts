import { resolvePaintChoice } from "@paint-vault/core/paint-substitutions";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../../db/index.ts";
import {
  miniaturePaintSubstitutions,
  paintCatalog,
  paintSubstitutionIngredients,
  paintSubstitutions,
} from "../../db/schema.ts";

import { PaintCommandError } from "./paints.ts";

type IngredientInput = { paintId?: unknown; parts?: unknown };

function substitutionData() {
  const db = getDb();
  const substitutions = db.select().from(paintSubstitutions).all();
  const ingredients = db.select().from(paintSubstitutionIngredients).all();
  const choices = db.select().from(miniaturePaintSubstitutions).all();
  return {
    paintSubstitutions: substitutions,
    paintSubstitutionIngredients: ingredients,
    miniaturePaintSubstitutions: choices,
  };
}

function parseIngredients(value: unknown, targetPaintId: string) {
  if (!Array.isArray(value) || !value.length)
    throw new PaintCommandError("Add at least one ingredient paint", 400);
  const parsed = value.map((row, sortOrder) => {
    const ingredient = (row ?? {}) as IngredientInput;
    return {
      paintId: typeof ingredient.paintId === "string" ? ingredient.paintId : "",
      parts: Math.max(1, Math.min(99, Math.floor(Number(ingredient.parts) || 1))),
      sortOrder,
    };
  });
  if (
    parsed.some((row) => !row.paintId || row.paintId === targetPaintId) ||
    new Set(parsed.map((row) => row.paintId)).size !== parsed.length
  )
    throw new PaintCommandError("Choose unique ingredient paints other than the target paint", 400);
  const found = getDb()
    .select({ id: paintCatalog.id })
    .from(paintCatalog)
    .where(
      inArray(
        paintCatalog.id,
        parsed.map((row) => row.paintId),
      ),
    )
    .all();
  if (found.length !== parsed.length)
    throw new PaintCommandError("One or more ingredient paints are unavailable", 400);
  return parsed;
}

function create(body: Record<string, unknown>) {
  const targetPaintId = typeof body.targetPaintId === "string" ? body.targetPaintId : "",
    name = typeof body.name === "string" ? body.name.trim() : "";
  if (!targetPaintId || !name) throw new PaintCommandError("Target paint and recipe name are required", 400);
  const ingredients = parseIngredients(body.ingredients, targetPaintId);
  const target = getDb()
    .select({ id: paintCatalog.id })
    .from(paintCatalog)
    .where(eq(paintCatalog.id, targetPaintId))
    .get();
  if (!target) throw new PaintCommandError("Target paint not found", 404);
  const id = crypto.randomUUID(),
    now = Date.now(),
    db = getDb();
  db.transaction((tx) => {
    tx.insert(paintSubstitutions)
      .values({
        id,
        targetPaintId,
        name: name.slice(0, TEXT_LIMITS.substitutionName),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.insert(paintSubstitutionIngredients)
      .values(ingredients.map((row) => ({ substitutionId: id, ...row })))
      .run();
  });
  return { id };
}

function update(body: Record<string, unknown>) {
  const db = getDb();
  if (body.action === "select") {
    const miniatureId = typeof body.miniatureId === "string" ? body.miniatureId : "",
      targetPaintId = typeof body.targetPaintId === "string" ? body.targetPaintId : "";
    const substitutionId = typeof body.substitutionId === "string" ? body.substitutionId : null,
      useOriginal = body.useOriginal === true;
    if (!miniatureId || !targetPaintId || (!substitutionId && !useOriginal))
      throw new PaintCommandError("Choose an original paint or substitution", 400);
    if (substitutionId) {
      const recipe = db
        .select()
        .from(paintSubstitutions)
        .where(
          and(eq(paintSubstitutions.id, substitutionId), eq(paintSubstitutions.targetPaintId, targetPaintId)),
        )
        .get();
      if (!recipe) throw new PaintCommandError("Substitution not found for this paint", 404);
      const data = substitutionData();
      data.miniaturePaintSubstitutions = [
        ...data.miniaturePaintSubstitutions.filter(
          (row) => row.miniatureId !== miniatureId || row.targetPaintId !== targetPaintId,
        ),
        { miniatureId, targetPaintId, substitutionId, useOriginal: false, updatedAt: Date.now() },
      ];
      if (resolvePaintChoice(data, miniatureId, targetPaintId).cycle)
        throw new PaintCommandError("That choice would create a circular substitution", 400);
    }
    db.insert(miniaturePaintSubstitutions)
      .values({
        miniatureId,
        targetPaintId,
        substitutionId: useOriginal ? null : substitutionId,
        useOriginal,
      })
      .onConflictDoUpdate({
        target: [miniaturePaintSubstitutions.miniatureId, miniaturePaintSubstitutions.targetPaintId],
        set: { substitutionId: useOriginal ? null : substitutionId, useOriginal },
      })
      .run();
    return { ok: true };
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) throw new PaintCommandError("Substitution is required", 400);
  const recipe = db.select().from(paintSubstitutions).where(eq(paintSubstitutions.id, id)).get();
  if (!recipe) throw new PaintCommandError("Substitution not found", 404);
  if (body.action === "default") {
    const enable = body.enabled === true;
    if (enable) {
      const data = substitutionData();
      data.paintSubstitutions = data.paintSubstitutions.map((row) => ({
        ...row,
        isDefault: row.targetPaintId === recipe.targetPaintId ? row.id === id : row.isDefault,
      }));
      if (resolvePaintChoice(data, "__global__", recipe.targetPaintId).cycle)
        throw new PaintCommandError("That default would create a circular substitution", 400);
    }
    db.transaction((tx) => {
      tx.update(paintSubstitutions)
        .set({ isDefault: false, updatedAt: Date.now() })
        .where(eq(paintSubstitutions.targetPaintId, recipe.targetPaintId))
        .run();
      if (enable)
        tx.update(paintSubstitutions)
          .set({ isDefault: true, updatedAt: Date.now() })
          .where(eq(paintSubstitutions.id, id))
          .run();
    });
    return { ok: true };
  }
  throw new PaintCommandError("Unsupported substitution update", 400);
}

export function deleteSubstitution(id: unknown) {
  if (typeof id !== "string" || !id) throw new PaintCommandError("Substitution is required", 400);
  getDb().delete(paintSubstitutions).where(eq(paintSubstitutions.id, id)).run();
  return { ok: true };
}

export function createSubstitution(body: Record<string, unknown>) {
  return getDb().transaction(() => create(body));
}
export function updateSubstitution(body: Record<string, unknown>) {
  return getDb().transaction(() => update(body));
}
