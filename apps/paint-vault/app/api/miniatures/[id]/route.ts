import { eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { miniatures } from "../../../../db/schema";
import { serializeImageMutation } from "../../../../lib/image-mutations";
import { deleteImage } from "../../../../lib/image-store";
import { miniatureTextTooLong } from "../../../../lib/text-limits";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    status?: string;
    notes?: string;
    manufacturer?: string;
    faction?: string;
    scale?: string;
    paintingStatus?: string;
  };
  const title = body.title?.trim();
  if (!title) return Response.json({ error: "A miniature name is required" }, { status: 400 });
  const tooLong = miniatureTextTooLong(body);
  if (tooLong) return tooLong;
  const stages = ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"] as const;
  const paintingStatus = stages.includes(body.paintingStatus as (typeof stages)[number])
    ? (body.paintingStatus as (typeof stages)[number])
    : "NOT_STARTED";
  await getDb()
    .update(miniatures)
    .set({
      title,
      status: body.status === "WISHLIST" ? "WISHLIST" : "OWNED",
      notes: body.notes?.trim() ?? "",
      manufacturer: body.manufacturer?.trim() ?? "",
      faction: body.faction?.trim() ?? "",
      scale: body.scale?.trim() ?? "",
      paintingStatus,
      updatedAt: Date.now(),
    })
    .where(eq(miniatures.id, id));
  return Response.json({ ok: true });
}

export const DELETE = serializeImageMutation(async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = getDb();
  const [row] = await db.select().from(miniatures).where(eq(miniatures.id, id));
  await db.delete(miniatures).where(eq(miniatures.id, id));
  await deleteImage(row?.imageKey ?? null);
  return Response.json({ ok: true });
});
