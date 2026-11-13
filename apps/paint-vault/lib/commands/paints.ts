import { normalizeColorHex } from "@paint-vault/core/color-hex";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, newUserId } from "@paint-vault/core/vault-ids";
import { eq } from "drizzle-orm";

import { getDb } from "../../db/index.ts";
import { paintCatalog } from "../../db/schema.ts";

export class PaintCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaintCommandError";
  }
}
export function commandResponse(error: unknown): Response {
  if (error instanceof PaintCommandError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

export type ImportPaint = {
  id?: string | null;
  brand?: string | null;
  range?: string | null;
  type?: string | null;
  name?: string | null;
  colorHex?: string | null;
  sourceUrl?: string | null;
};
const paintKey = (paint: { brand: string; range: string; name: string }) =>
  JSON.stringify(
    [paint.brand, paint.range, paint.name].map((value) => value.trim().toLowerCase().replace(/\s+/g, " ")),
  );

export function importCustomPaints(body: { paints?: ImportPaint[] } | null) {
  if (!body || !Array.isArray(body.paints) || !body.paints.length)
    throw new PaintCommandError("No paints supplied", 400);
  if (body.paints.length > 2000)
    throw new PaintCommandError("Imports are limited to 2,000 paints at a time", 400);
  const valid = body.paints
    .filter(
      (p) =>
        p &&
        typeof p.brand === "string" &&
        p.brand.trim() &&
        typeof p.name === "string" &&
        p.name.trim() &&
        [p.range, p.type, p.colorHex, p.sourceUrl].every(
          (value) => value == null || typeof value === "string",
        ),
    )
    .map((p) => ({
      // Imported paints are the owner's own, so they always get a new `user:` ID.
      id: newUserId(),
      brand: p.brand!.trim(),
      range: (p.range || p.type || "Other").trim(),
      name: p.name!.trim(),
      // An unreadable color is dropped rather than failing the whole import.
      colorHex: normalizeColorHex(p.colorHex) ?? null,
      sourceUrl: p.sourceUrl?.trim() || null,
      sourceLabel: p.sourceUrl ? "Imported source" : null,
    }))
    // A paint with text longer than the vault stores is skipped, like one missing its name.
    .filter(
      (p) =>
        p.brand.length <= TEXT_LIMITS.paintBrand &&
        p.range.length <= TEXT_LIMITS.paintRange &&
        p.name.length <= TEXT_LIMITS.name &&
        (p.sourceUrl ?? "").length <= TEXT_LIMITS.url,
    );
  if (!valid.length) throw new PaintCommandError("Each paint needs brand and name", 400);
  const imported = getDb().transaction((tx) => {
    const existing = tx
      .select({
        id: paintCatalog.id,
        brand: paintCatalog.brand,
        range: paintCatalog.range,
        name: paintCatalog.name,
      })
      .from(paintCatalog)
      .all();
    const keys = new Set(existing.map(paintKey));
    const clean = valid.filter((paint) => {
      const key = paintKey(paint);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
    return clean.length ? tx.insert(paintCatalog).values(clean).onConflictDoNothing().run().changes : 0;
  });
  return { imported, skipped: body.paints.length - imported };
}

export type CustomPaintInput = {
  brand?: string | null;
  range?: string | null;
  name?: string | null;
  colorHex?: string | null;
  sourceUrl?: string | null;
};

export function updateCustomPaint(id: string, body: CustomPaintInput) {
  if (!isUserId(id)) throw new PaintCommandError("Only custom paints can be edited", 403);
  if (
    typeof body.brand !== "string" ||
    typeof body.name !== "string" ||
    !body.brand.trim() ||
    !body.name.trim()
  )
    throw new PaintCommandError("Brand and name are required", 400);
  const checks = [
    ["Brand", body.brand, TEXT_LIMITS.paintBrand],
    ["Range", body.range, TEXT_LIMITS.paintRange],
    ["Name", body.name, TEXT_LIMITS.name],
    ["Source link", body.sourceUrl, TEXT_LIMITS.url],
  ] as const;
  for (const [label, value, limit] of checks) {
    if (value != null && typeof value !== "string")
      throw new PaintCommandError(`Invalid ${label.toLowerCase()}`, 400);
    if (typeof value === "string" && value.trim().length > limit)
      throw new PaintCommandError(
        `${label} must be ${limit.toLocaleString("en-US")} characters or fewer`,
        400,
      );
  }
  const colorHex = normalizeColorHex(body.colorHex);
  if (colorHex === undefined) throw new PaintCommandError("Use a color hex such as #1a2b3c", 400);
  const result = getDb()
    .update(paintCatalog)
    .set({
      brand: body.brand.trim(),
      range: body.range?.trim() || "Other",
      name: body.name.trim(),
      colorHex,
      sourceUrl: body.sourceUrl?.trim() || null,
    })
    .where(eq(paintCatalog.id, id))
    .returning({ id: paintCatalog.id })
    .all();
  if (!result.length) throw new PaintCommandError("Paint not found", 404);
  return { ok: true };
}

export function deleteCustomPaint(id: string) {
  if (!isUserId(id)) throw new PaintCommandError("Only custom paints can be deleted", 403);
  const result = getDb()
    .delete(paintCatalog)
    .where(eq(paintCatalog.id, id))
    .returning({ id: paintCatalog.id })
    .all();
  if (!result.length) throw new PaintCommandError("Paint not found", 404);
  return { ok: true };
}
