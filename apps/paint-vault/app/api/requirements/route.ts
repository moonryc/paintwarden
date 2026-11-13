import { RECIPE_STEP_IDS, type RecipeStep } from "@paint-vault/core/recipe-steps";
import { isUuid } from "@paint-vault/core/vault-ids";
import { eq, max } from "drizzle-orm";

import { getDb } from "../../../db";
import { miniatureRequiredPaints, miniatures, paintCatalog } from "../../../db/schema";
import { textTooLong } from "../../../lib/text-limits";

const notesTooLong = (notes: unknown) => textTooLong([["Notes", notes, "stepNotes"]]);

// Recipe rows have their own IDs. A paint may appear once in each step of a miniature's recipe.
const steps = RECIPE_STEP_IDS;
const isStep = (value: unknown): value is RecipeStep => typeof value === "string" && steps.has(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && !!value.trim();

async function readBody(request: Request, allowed: string[]) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  return Object.keys(value).every((key) => allowed.includes(key)) ? value : null;
}

const conflict = () =>
  Response.json({ error: "That paint is already in this step of the recipe" }, { status: 409 });
const isUniqueViolation = (error: unknown) =>
  error instanceof Error && /UNIQUE constraint failed/.test(error.message);

export async function PATCH(request: Request) {
  const body = await readBody(request, ["id", "notes", "step"]);
  if (
    !body ||
    !nonEmpty(body.id) ||
    (!("notes" in body) && !("step" in body)) ||
    ("notes" in body && typeof body.notes !== "string") ||
    ("step" in body && !isStep(body.step))
  )
    return Response.json({ error: "Invalid requirement update" }, { status: 400 });
  const tooLong = notesTooLong(body.notes);
  if (tooLong) return tooLong;
  const changes: Partial<Pick<typeof miniatureRequiredPaints.$inferInsert, "notes" | "step">> = {};
  if (typeof body.notes === "string") changes.notes = body.notes;
  if (isStep(body.step)) changes.step = body.step;
  try {
    const result = getDb()
      .update(miniatureRequiredPaints)
      .set(changes)
      .where(eq(miniatureRequiredPaints.id, body.id))
      .run();
    return result.changes
      ? Response.json({ ok: true })
      : Response.json({ error: "Requirement not found" }, { status: 404 });
  } catch (error) {
    if (isUniqueViolation(error)) return conflict();
    throw error;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request, ["miniatureId", "paintId", "step", "notes"]);
  if (
    !body ||
    !nonEmpty(body.miniatureId) ||
    !nonEmpty(body.paintId) ||
    ("step" in body && !isStep(body.step)) ||
    ("notes" in body && typeof body.notes !== "string")
  )
    return Response.json({ error: "Invalid requirement" }, { status: 400 });
  const tooLong = notesTooLong(body.notes);
  if (tooLong) return tooLong;
  const { miniatureId, paintId } = body;
  const id = crypto.randomUUID();
  try {
    const found = getDb().transaction((tx) => {
      if (
        !tx.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get() ||
        !tx.select({ id: paintCatalog.id }).from(paintCatalog).where(eq(paintCatalog.id, paintId)).get()
      )
        return false;
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
      return true;
    });
    return found
      ? Response.json({ id }, { status: 201 })
      : Response.json({ error: "Miniature or paint not found" }, { status: 404 });
  } catch (error) {
    if (isUniqueViolation(error)) return conflict();
    throw error;
  }
}

export async function DELETE(request: Request) {
  const body = await readBody(request, ["id"]);
  if (!body || !nonEmpty(body.id)) return Response.json({ error: "Invalid requirement" }, { status: 400 });
  const result = getDb().delete(miniatureRequiredPaints).where(eq(miniatureRequiredPaints.id, body.id)).run();
  return result.changes
    ? Response.json({ ok: true })
    : Response.json({ error: "Requirement not found" }, { status: 404 });
}

type IncomingEntry = {
  id?: unknown;
  paintId?: unknown;
  notes?: unknown;
  step?: unknown;
  sortOrder?: unknown;
};

// Replaces a miniature's whole recipe. Entries keep their IDs when given as UUIDs; a repeated paint within
// one step keeps only its first entry.
export async function PUT(request: Request) {
  const { miniatureId, entries } = ((await request.json().catch(() => null)) ?? {}) as {
    miniatureId?: unknown;
    entries?: unknown;
  };
  if (!nonEmpty(miniatureId) || !Array.isArray(entries))
    return Response.json({ error: "Invalid requirements" }, { status: 400 });
  const db = getDb();
  if (!db.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get())
    return Response.json({ error: "Not found" }, { status: 404 });
  const seenIds = new Set<string>(),
    seenSteps = new Set<string>();
  const rows: (typeof miniatureRequiredPaints.$inferInsert)[] = [];
  (entries as IncomingEntry[]).forEach((entry, index) => {
    if (!entry || !nonEmpty(entry.paintId)) return;
    const step = isStep(entry.step) ? entry.step : "OTHER";
    const stepKey = `${step}:${entry.paintId}`;
    if (seenSteps.has(stepKey)) return;
    seenSteps.add(stepKey);
    const id = isUuid(entry.id) && !seenIds.has(entry.id) ? entry.id : crypto.randomUUID();
    seenIds.add(id);
    rows.push({
      id,
      miniatureId,
      paintId: entry.paintId,
      step,
      notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
      sortOrder:
        typeof entry.sortOrder === "number" && Number.isFinite(entry.sortOrder) ? entry.sortOrder : index,
    });
  });
  for (const row of rows) {
    const tooLong = notesTooLong(row.notes);
    if (tooLong) return tooLong;
  }
  try {
    db.transaction((tx) => {
      tx.delete(miniatureRequiredPaints).where(eq(miniatureRequiredPaints.miniatureId, miniatureId)).run();
      for (let index = 0; index < rows.length; index += 500)
        tx.insert(miniatureRequiredPaints)
          .values(rows.slice(index, index + 500))
          .run();
    });
  } catch (error) {
    // An entry ID that belongs to another miniature's recipe.
    if (error instanceof Error && /constraint failed/.test(error.message))
      return Response.json({ error: "Invalid requirements" }, { status: 400 });
    throw error;
  }
  return Response.json({ ok: true, ids: rows.map((row) => row.id) });
}
