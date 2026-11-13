import { RECIPE_STEP_IDS } from "@paint-vault/core/recipe-steps";
import { eq } from "drizzle-orm";

import { getDb } from "../../../db";
import { miniatureRecipeSteps, miniatures } from "../../../db/schema";

const allowedSteps = RECIPE_STEP_IDS;

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Invalid recipe steps" }, { status: 400 });
  const { miniatureId, steps } = body as Record<string, unknown>;
  if (
    typeof miniatureId !== "string" ||
    !miniatureId.trim() ||
    !Array.isArray(steps) ||
    steps.some((step) => typeof step !== "string" || !allowedSteps.has(step))
  )
    return Response.json({ error: "Invalid recipe steps" }, { status: 400 });

  const db = getDb();
  if (!db.select({ id: miniatures.id }).from(miniatures).where(eq(miniatures.id, miniatureId)).get())
    return Response.json({ error: "Miniature not found" }, { status: 404 });
  const unique = [...new Set(steps)] as (typeof miniatureRecipeSteps.$inferInsert.step)[];
  db.transaction((tx) => {
    tx.delete(miniatureRecipeSteps).where(eq(miniatureRecipeSteps.miniatureId, miniatureId)).run();
    if (unique.length)
      tx.insert(miniatureRecipeSteps)
        .values(unique.map((step) => ({ miniatureId, step })))
        .run();
  });
  return Response.json({ ok: true });
}
