import { eq } from "drizzle-orm";

import { getDb } from "../../../db";
import {
  miniatureColorSchemes,
  miniatureRequiredPaints,
  miniatureTemplates,
  miniatures,
} from "../../../db/schema";
import { serializeImageMutation } from "../../../lib/image-mutations";
import { loadImage, saveImage } from "../../../lib/image-store";
import { templateRecipe } from "../../../lib/template-recipes";
import { miniatureTextTooLong } from "../../../lib/text-limits";

export const POST = serializeImageMutation(async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    status?: string;
    notes?: string;
    manufacturer?: string;
    faction?: string;
    scale?: string;
    paintingStatus?: string;
    templateId?: string;
    includeTemplateImage?: boolean;
  };
  const db = getDb();
  const template = body.templateId
    ? db.select().from(miniatureTemplates).where(eq(miniatureTemplates.id, body.templateId)).get()
    : undefined;
  if (body.templateId && !template)
    return Response.json({ error: "That miniature template is not available" }, { status: 400 });
  // Template recipes reference paints and schemes by foreign key, so every entry is still valid.
  const recipe = template ? templateRecipe(db, template.id) : { schemeIds: [], paints: [] };
  const title = body.title?.trim() || template?.name;
  if (!title) return Response.json({ error: "A miniature name is required" }, { status: 400 });
  const tooLong = miniatureTextTooLong({ ...body, title });
  if (tooLong) return tooLong;
  const status = body.status === "WISHLIST" ? "WISHLIST" : "OWNED";
  const now = Date.now();
  const stages = ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"] as const;
  const paintingStatus = stages.includes(body.paintingStatus as (typeof stages)[number])
    ? (body.paintingStatus as (typeof stages)[number])
    : "NOT_STARTED";
  let imageKey: string | null = null;
  if (template?.imageKey && body.includeTemplateImage !== false) {
    const image = await loadImage(template.imageKey);
    if (image)
      imageKey = await saveImage(
        new File([new Uint8Array(image.bytes)], "miniature", { type: image.contentType }),
      );
  }
  const row = {
    id: crypto.randomUUID(),
    title,
    status,
    notes: body.notes?.trim() ?? "",
    manufacturer: body.manufacturer?.trim() || template?.manufacturer || "",
    faction: body.faction?.trim() || template?.faction || "",
    scale: body.scale?.trim() ?? "",
    paintingStatus,
    imageKey,
    sourceImageUrl: body.includeTemplateImage !== false ? template?.imageUrl || null : null,
    createdAt: now,
    updatedAt: now,
  } as const;
  db.transaction((tx) => {
    tx.insert(miniatures).values(row).run();
    if (recipe.schemeIds.length)
      tx.insert(miniatureColorSchemes)
        .values(
          recipe.schemeIds.map((schemeId, sortOrder) => ({
            miniatureId: row.id,
            schemeId,
            sortOrder,
          })),
        )
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
  });
  return Response.json(row, { status: 201 });
});
