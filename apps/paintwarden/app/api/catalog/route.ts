import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { isUserId } from "@paintwarden/core/vault-ids";

import { getDb, getSqlite } from "../../../db";
import { paintCatalog } from "../../../db/schema";
import { commandResponse, importCustomPaints, type ImportPaint } from "../../../lib/commands/paints.ts";
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
  try {
    const result = importCustomPaints(
      (await request.json().catch(() => null)) as { paints?: ImportPaint[] } | null,
    );
    return Response.json(result, { status: result.imported ? 201 : 200 });
  } catch (error) {
    return commandResponse(error);
  }
}
