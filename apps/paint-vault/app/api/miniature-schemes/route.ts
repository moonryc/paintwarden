import { eq, inArray } from "drizzle-orm";

import { getDb } from "../../../db";
import { colorSchemes, miniatureColorSchemes, miniatures } from "../../../db/schema";

export async function PUT(request: Request) {
  const body = (await request.json()) as { miniatureId?: string; schemeIds?: string[] };
  const schemeIds = [...new Set((body.schemeIds ?? []).filter(Boolean))];
  if (!body.miniatureId || !Array.isArray(body.schemeIds))
    return Response.json({ error: "Invalid color schemes" }, { status: 400 });
  const db = getDb();
  const [mini] = await db
    .select({ id: miniatures.id })
    .from(miniatures)
    .where(eq(miniatures.id, body.miniatureId));
  if (!mini) return Response.json({ error: "Miniature not found" }, { status: 404 });
  const available = schemeIds.length
    ? await db.select({ id: colorSchemes.id }).from(colorSchemes).where(inArray(colorSchemes.id, schemeIds))
    : [];
  if (available.length !== schemeIds.length)
    return Response.json({ error: "Color scheme not found" }, { status: 404 });
  db.transaction((tx) => {
    tx.delete(miniatureColorSchemes).where(eq(miniatureColorSchemes.miniatureId, body.miniatureId!)).run();
    schemeIds.forEach((schemeId, sortOrder) => {
      tx.insert(miniatureColorSchemes).values({ miniatureId: body.miniatureId!, schemeId, sortOrder }).run();
    });
  });
  return Response.json({ ok: true });
}
