import { normalizeColorHex } from "@paint-vault/core/color-hex";
import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { TEXT_LIMITS } from "@paint-vault/core/text-limits";
import { isUserId, newUserId } from "@paint-vault/core/vault-ids";

import { getDb, getSqlite } from "../../../db";
import { paintCatalog } from "../../../db/schema";
import { createSqliteReadCache } from "../../../lib/sqlite-read-cache";

let readSearchIndex: ReturnType<typeof createCatalogReader> | undefined;
function createCatalogReader() {
  return createSqliteReadCache(getSqlite(), () =>
    createFuzzyIndex(
      getDb().select().from(paintCatalog).all(),
      (paint) => `${paint.brand} ${paint.range} ${paint.name}`,
    ),
  );
}

type ImportPaint = {
  id?: string;
  brand?: string;
  range?: string;
  type?: string;
  name?: string;
  colorHex?: string;
  sourceUrl?: string;
};
const paintKey = (paint: { brand: string; range: string; name: string }) =>
  JSON.stringify(
    [paint.brand, paint.range, paint.name].map((value) => value.trim().toLowerCase().replace(/\s+/g, " ")),
  );

export async function GET(request: Request) {
  const url = new URL(request.url),
    q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1),
    pageSize = Math.min(100, Math.max(12, Number(url.searchParams.get("pageSize")) || 48));
  readSearchIndex ??= createCatalogReader();
  const matches = searchFuzzyIndex(readSearchIndex(), q);
  return Response.json({
    items: matches
      .slice((page - 1) * pageSize, page * pageSize)
      .map((paint) => ({ ...paint, isCustom: isUserId(paint.id) })),
    total: matches.length,
    page,
    pageSize,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { paints?: ImportPaint[] } | null;
  if (!body || !Array.isArray(body.paints) || !body.paints.length)
    return Response.json({ error: "No paints supplied" }, { status: 400 });
  if (body.paints.length > 2000)
    return Response.json({ error: "Imports are limited to 2,000 paints at a time" }, { status: 400 });
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
  if (!valid.length) return Response.json({ error: "Each paint needs brand and name" }, { status: 400 });
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
  return Response.json(
    { imported, skipped: body.paints.length - imported },
    { status: imported ? 201 : 200 },
  );
}
