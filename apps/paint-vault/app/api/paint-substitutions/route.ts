import { resolvePaintChoice } from "@paint-vault/core/paint-substitutions";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "../../../db";
import {
  miniaturePaintSubstitutions,
  paintCatalog,
  paintSubstitutionIngredients,
  paintSubstitutions,
} from "../../../db/schema";

type IngredientInput = { paintId?: unknown; parts?: unknown };

async function substitutionData() {
  const db = getDb();
  const [substitutions, ingredients, choices] = await Promise.all([
    db.select().from(paintSubstitutions),
    db.select().from(paintSubstitutionIngredients),
    db.select().from(miniaturePaintSubstitutions),
  ]);
  return {
    paintSubstitutions: substitutions,
    paintSubstitutionIngredients: ingredients,
    miniaturePaintSubstitutions: choices,
  };
}

async function parseIngredients(value: unknown, targetPaintId: string) {
  if (!Array.isArray(value) || !value.length)
    return Response.json({ error: "Add at least one ingredient paint" }, { status: 400 });
  const parsed = value.map((row, sortOrder) => {
    const ingredient = row as IngredientInput;
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
    return Response.json(
      { error: "Choose unique ingredient paints other than the target paint" },
      { status: 400 },
    );
  const found = await getDb()
    .select({ id: paintCatalog.id })
    .from(paintCatalog)
    .where(
      inArray(
        paintCatalog.id,
        parsed.map((row) => row.paintId),
      ),
    );
  if (found.length !== parsed.length)
    return Response.json({ error: "One or more ingredient paints are unavailable" }, { status: 400 });
  return parsed;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const targetPaintId = typeof body.targetPaintId === "string" ? body.targetPaintId : "",
    name = typeof body.name === "string" ? body.name.trim() : "";
  if (!targetPaintId || !name)
    return Response.json({ error: "Target paint and recipe name are required" }, { status: 400 });
  const ingredients = await parseIngredients(body.ingredients, targetPaintId);
  if (ingredients instanceof Response) return ingredients;
  const [target] = await getDb()
    .select({ id: paintCatalog.id })
    .from(paintCatalog)
    .where(eq(paintCatalog.id, targetPaintId));
  if (!target) return Response.json({ error: "Target paint not found" }, { status: 404 });
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
  return Response.json({ id }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const db = getDb();
  if (body.action === "select") {
    const miniatureId = typeof body.miniatureId === "string" ? body.miniatureId : "",
      targetPaintId = typeof body.targetPaintId === "string" ? body.targetPaintId : "";
    const substitutionId = typeof body.substitutionId === "string" ? body.substitutionId : null,
      useOriginal = body.useOriginal === true;
    if (!miniatureId || !targetPaintId || (!substitutionId && !useOriginal))
      return Response.json({ error: "Choose an original paint or substitution" }, { status: 400 });
    if (substitutionId) {
      const [recipe] = await db
        .select()
        .from(paintSubstitutions)
        .where(
          and(eq(paintSubstitutions.id, substitutionId), eq(paintSubstitutions.targetPaintId, targetPaintId)),
        );
      if (!recipe) return Response.json({ error: "Substitution not found for this paint" }, { status: 404 });
      const data = await substitutionData();
      data.miniaturePaintSubstitutions = [
        ...data.miniaturePaintSubstitutions.filter(
          (row) => row.miniatureId !== miniatureId || row.targetPaintId !== targetPaintId,
        ),
        { miniatureId, targetPaintId, substitutionId, useOriginal: false, updatedAt: Date.now() },
      ];
      if (resolvePaintChoice(data, miniatureId, targetPaintId).cycle)
        return Response.json({ error: "That choice would create a circular substitution" }, { status: 400 });
    }
    await db
      .insert(miniaturePaintSubstitutions)
      .values({
        miniatureId,
        targetPaintId,
        substitutionId: useOriginal ? null : substitutionId,
        useOriginal,
      })
      .onConflictDoUpdate({
        target: [miniaturePaintSubstitutions.miniatureId, miniaturePaintSubstitutions.targetPaintId],
        set: { substitutionId: useOriginal ? null : substitutionId, useOriginal },
      });
    return Response.json({ ok: true });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Substitution is required" }, { status: 400 });
  const [recipe] = await db.select().from(paintSubstitutions).where(eq(paintSubstitutions.id, id));
  if (!recipe) return Response.json({ error: "Substitution not found" }, { status: 404 });
  if (body.action === "default") {
    const enable = body.enabled === true;
    if (enable) {
      const data = await substitutionData();
      data.paintSubstitutions = data.paintSubstitutions.map((row) => ({
        ...row,
        isDefault: row.targetPaintId === recipe.targetPaintId ? row.id === id : row.isDefault,
      }));
      if (resolvePaintChoice(data, "__global__", recipe.targetPaintId).cycle)
        return Response.json({ error: "That default would create a circular substitution" }, { status: 400 });
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
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported substitution update" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Substitution is required" }, { status: 400 });
  await getDb().delete(paintSubstitutions).where(eq(paintSubstitutions.id, id));
  return Response.json({ ok: true });
}
