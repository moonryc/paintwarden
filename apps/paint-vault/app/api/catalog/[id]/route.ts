import { normalizeColorHex } from "@paint-vault/core/color-hex";
import { isUserId } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { paintCatalog } from "../../../../db/schema";
import { textTooLong } from "../../../../lib/text-limits";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params,
    body = (await request.json()) as {
      brand?: string;
      range?: string;
      name?: string;
      colorHex?: string;
      sourceUrl?: string;
    };
  if (!isUserId(id)) return Response.json({ error: "Only custom paints can be edited" }, { status: 403 });
  if (!body.brand?.trim() || !body.name?.trim())
    return Response.json({ error: "Brand and name are required" }, { status: 400 });
  const tooLong = textTooLong([
    ["Brand", body.brand.trim(), "paintBrand"],
    ["Range", body.range?.trim(), "paintRange"],
    ["Name", body.name.trim(), "name"],
    ["Source link", body.sourceUrl?.trim(), "url"],
  ]);
  if (tooLong) return tooLong;
  const colorHex = normalizeColorHex(body.colorHex);
  if (colorHex === undefined)
    return Response.json({ error: "Use a color hex such as #1a2b3c" }, { status: 400 });
  const result = await getDb()
    .update(paintCatalog)
    .set({
      brand: body.brand.trim(),
      range: body.range?.trim() || "Other",
      name: body.name.trim(),
      colorHex,
      sourceUrl: body.sourceUrl?.trim() || null,
    })
    .where(eq(paintCatalog.id, id))
    .returning({ id: paintCatalog.id });
  if (!result.length) return Response.json({ error: "Paint not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUserId(id)) return Response.json({ error: "Only custom paints can be deleted" }, { status: 403 });
  const result = await getDb()
    .delete(paintCatalog)
    .where(eq(paintCatalog.id, id))
    .returning({ id: paintCatalog.id });
  if (!result.length) return Response.json({ error: "Paint not found" }, { status: 404 });
  return Response.json({ ok: true });
}
