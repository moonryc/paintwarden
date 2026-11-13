import { createHash } from "node:crypto";

import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { isUserId } from "@paint-vault/core/vault-ids";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import { sourceLogoUrl } from "../lib/catalog-source-assets.ts";

import { readPaintProjection, readRevision, validatePage, validateText, type PaintRead } from "./library.ts";

type Revision = ReturnType<typeof readRevision>;
type PageArgs = { first: number; after?: string | null };
export type MiniatureSchemeSummary = {
  id: string;
  name: string;
  category: string | null;
  isSystem: boolean;
  sourceId: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  paintNames: string;
  usageCount: number;
  gradient: string;
  paintCount: number;
  availableCount: number;
  previewSwatches: { paintId: string; colorHex: string }[];
  previewSwatchesTruncated: boolean;
  imageUrl: string | null;
};
export type MiniatureSchemeEntry = {
  id: string;
  kind: "PAINT" | "DIVIDER" | "IMAGE";
  sortOrder: number;
  paint?: PaintRead | null;
  label?: string | null;
  tone?: string | null;
  role?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  imageType?: string | null;
  method?: string | null;
};
export type MiniatureSchemeRead = {
  revision: Revision;
  scheme: MiniatureSchemeSummary | null;
  entries: MiniatureSchemeEntry[];
};
export type AttachedMiniatureScheme = {
  id: string;
  sortOrder: number;
  scheme: MiniatureSchemeSummary;
};
type SummaryRow = Pick<MiniatureSchemeSummary, "id" | "name" | "category" | "sourceName"> & {
  sourceId: string | null;
  logoSvg: string | null;
};
// Select only compact scheme metadata. Neither options nor links load scheme entries.
const summaryColumns = `s.id,s.name,s.category,c.id AS sourceId,c.name AS sourceName,c.logo_svg AS logoSvg`;
const sourceJoin = `LEFT JOIN catalog_sources c ON c.id=(
  SELECT i.source_id FROM catalog_source_items i WHERE i.kind='scheme' AND i.item_id=s.id
  ORDER BY i.source_id DESC LIMIT 1)`;
type SchemeStats = Pick<
  MiniatureSchemeSummary,
  | "paintCount"
  | "availableCount"
  | "previewSwatches"
  | "previewSwatchesTruncated"
  | "imageUrl"
  | "paintNames"
  | "usageCount"
  | "gradient"
>;
function summary(row: SummaryRow, stats: SchemeStats): MiniatureSchemeSummary {
  return {
    ...stats,
    id: row.id,
    name: row.name,
    category: row.category,
    isSystem: !isUserId(row.id),
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceLogoUrl: row.sourceId ? sourceLogoUrl(row.sourceId, row.logoSvg) : null,
  };
}
// Aggregate in SQL: compact full card names/gradient plus at most eight preview swatches.
// This never materializes full entry rows on the picker/attached-link path.
function schemeStats(rows: SummaryRow[], byId: Map<string, PaintRead>): Map<string, SchemeStats> {
  if (!rows.length) return new Map();
  const availableIds = [...byId.values()].filter((paint) => paint.available).map((paint) => paint.id);
  const stats = getSqlite()
    .prepare(
      `SELECT s.id,COUNT(DISTINCT p.paint_id) AS paintCount,
    COUNT(DISTINCT CASE WHEN p.paint_id IN (SELECT value FROM json_each(?)) THEN p.paint_id END) AS availableCount,
    (SELECT COUNT(DISTINCT pc.id) FROM color_scheme_paints x JOIN paint_catalog pc ON pc.id=x.paint_id
      WHERE x.scheme_id=s.id AND pc.color_hex IS NOT NULL) AS swatchCount,
    (SELECT json_group_array(json_object('paintId',v.paintId,'colorHex',v.colorHex)) FROM
      (SELECT pc.id AS paintId,pc.color_hex AS colorHex FROM color_scheme_paints x
       JOIN paint_catalog pc ON pc.id=x.paint_id WHERE x.scheme_id=s.id AND pc.color_hex IS NOT NULL
       GROUP BY pc.id ORDER BY MIN(x.sort_order),pc.id LIMIT 8) v) AS swatches,
    (SELECT COUNT(*) FROM miniature_color_schemes l WHERE l.scheme_id=s.id) AS usageCount,
    (SELECT json_group_array(v.name) FROM
      (SELECT pc.name FROM color_scheme_paints x JOIN paint_catalog pc ON pc.id=x.paint_id
       WHERE x.scheme_id=s.id ORDER BY x.sort_order,pc.id) v) AS paintNames,
    (SELECT json_group_array(v.colorHex) FROM
      (SELECT pc.color_hex AS colorHex FROM color_scheme_paints x JOIN paint_catalog pc ON pc.id=x.paint_id
       WHERE x.scheme_id=s.id AND pc.color_hex IS NOT NULL ORDER BY x.sort_order,pc.id) v) AS colors,
    (SELECT COALESCE(NULLIF(thumbnail_url,''),image_url) FROM color_scheme_images x WHERE x.scheme_id=s.id ORDER BY x.sort_order DESC,x.id DESC LIMIT 1) AS imageUrl
    FROM color_schemes s LEFT JOIN color_scheme_paints p ON p.scheme_id=s.id
    WHERE s.id IN (SELECT value FROM json_each(?)) GROUP BY s.id`,
    )
    .all(JSON.stringify(availableIds), JSON.stringify(rows.map((row) => row.id))) as {
    id: string;
    paintCount: number;
    availableCount: number;
    swatchCount: number;
    usageCount: number;
    paintNames: string;
    colors: string;
    swatches: string;
    imageUrl: string | null;
  }[];
  return new Map(
    stats.map((row) => [
      row.id,
      {
        paintNames: (JSON.parse(row.paintNames) as string[]).join(" · "),
        usageCount: row.usageCount,
        gradient: paintGradient(JSON.parse(row.colors) as string[]),
        paintCount: row.paintCount,
        availableCount: row.availableCount,
        previewSwatches: JSON.parse(row.swatches) as MiniatureSchemeSummary["previewSwatches"],
        previewSwatchesTruncated: row.swatchCount > 8,
        imageUrl: row.imageUrl,
      },
    ]),
  );
}
// Match the authored card's complete ordered color sequence (including repeated paints).
function paintGradient(colors: string[]): string {
  if (colors.length < 2) return colors[0] ?? "";
  return `linear-gradient(135deg, ${colors.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`).join(", ")})`;
}
const opaque = (parts: unknown[]) => Buffer.from(JSON.stringify(parts)).toString("base64url");
const scopeFor = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("base64url");
const badCursor = (): never => {
  throw new GraphQLError("Invalid miniature scheme cursor", { extensions: { code: "BAD_USER_INPUT" } });
};
export function paginateSchemeItems<T extends { id: string }>(
  items: T[],
  args: PageArgs,
  revision: Revision,
  scope: string,
) {
  validatePage(args);
  let start = 0;
  if (args.after != null) {
    try {
      if (!args.after || !/^[\w-]+$/.test(args.after)) return badCursor();
      const cursor: unknown = JSON.parse(Buffer.from(args.after, "base64url").toString("utf8"));
      if (
        !Array.isArray(cursor) ||
        cursor.length !== 6 ||
        cursor[0] !== "miniature-schemes-v1" ||
        cursor[1] !== scope ||
        typeof cursor[2] !== "string" ||
        !Number.isSafeInteger(cursor[3]) ||
        !Number.isSafeInteger(cursor[4]) ||
        cursor[4] < 1 ||
        typeof cursor[5] !== "string"
      )
        return badCursor();
      if (cursor[2] !== revision.epoch || cursor[3] !== revision.seq)
        throw new GraphQLError("Schemes changed; restart pagination", {
          extensions: { code: "STALE_CURSOR" },
        });
      start = cursor[4] as number;
      if (start > items.length || items[start - 1]?.id !== cursor[5]) return badCursor();
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      return badCursor();
    }
  }
  const nodes = items.slice(start, start + args.first),
    end = start + nodes.length;
  return {
    nodes,
    totalCount: items.length,
    pageInfo: {
      hasNextPage: end < items.length,
      endCursor: nodes.length
        ? opaque(["miniature-schemes-v1", scope, revision.epoch, revision.seq, end, nodes.at(-1)!.id])
        : null,
    },
  };
}
type SearchSet = { at: number; nodes: MiniatureSchemeSummary[] };
type OptionsProjection = {
  targetIds: Map<string, Set<string>>;
  revision: Revision;
  nodes: MiniatureSchemeSummary[];
  byId: Map<string, MiniatureSchemeSummary>;
  index: ReturnType<typeof createFuzzyIndex<MiniatureSchemeSummary>>;
  searches: Map<string, SearchSet>;
  categoryCounts: { key: string; label: string; count: number }[];
};
let cached: OptionsProjection | undefined;
export function readSchemeProjection(revision: Revision, allowCache: boolean): OptionsProjection {
  if (allowCache && cached?.revision.epoch === revision.epoch && cached.revision.seq === revision.seq)
    return cached;
  const rows = getSqlite()
    .prepare(`SELECT ${summaryColumns} FROM color_schemes s ${sourceJoin} ORDER BY s.name,s.id`)
    .all() as SummaryRow[];
  const stats = schemeStats(
    rows,
    rows.length ? readPaintProjection(allowCache).byId : new Map<string, PaintRead>(),
  );
  // Preserve the picker's case/accent-insensitive name collation across page boundaries.
  // IDs make otherwise equivalent names deterministic rather than depending on SQL row order.
  const nodes = rows
    .map((row) => summary(row, stats.get(row.id)!))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const key = node.category ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const categoryCounts = [...counts]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, count]) => ({ key, label: key || "Uncategorized", count }));
  const targetIds = new Map<string, Set<string>>();
  const targets = getSqlite()
    .prepare(
      "SELECT scheme_id AS schemeId,json_group_array(DISTINCT paint_id) AS ids FROM color_scheme_paints GROUP BY scheme_id",
    )
    .all() as { schemeId: string; ids: string }[];
  for (const row of targets) targetIds.set(row.schemeId, new Set(JSON.parse(row.ids) as string[]));
  const projection = {
    targetIds,
    revision,
    categoryCounts,
    nodes,
    byId: new Map(nodes.map((node) => [node.id, node])),
    index: createFuzzyIndex(nodes, (s) => `${s.name} ${s.category ?? ""}`),
    searches: new Map<string, SearchSet>(),
  };
  if (allowCache) cached = projection;
  return projection;
}
export function readMiniatureSchemeOptions(
  args: PageArgs & {
    search?: string | null;
    category?: string | null;
    excludeIds?: string[];
  },
) {
  validatePage(args);
  validateText(args.search, "search");
  validateText(args.category, "category");
  args.excludeIds?.forEach((id) => validateText(id, "exclude ID"));
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const revision = readRevision(),
      projection = readSchemeProjection(revision, allowCache),
      query = args.search?.trim() ?? "",
      category = args.category === "ALL" ? null : (args.category ?? null),
      excluded = [...new Set(args.excludeIds ?? [])].sort(),
      scope = scopeFor(["options", query, category, excluded]);
    const excludedSet = new Set(excluded);
    let nodes = projection.nodes.filter(
      (node) => (category === null || (node.category ?? "") === category) && !excludedSet.has(node.id),
    );
    if (query) {
      const now = Date.now();
      for (const [key, set] of projection.searches)
        if (now - set.at >= 60_000) projection.searches.delete(key);
      const found = projection.searches.get(scope);
      if (found) nodes = found.nodes;
      else {
        const index =
          category !== null || excluded.length
            ? createFuzzyIndex(nodes, (s) => `${s.name} ${s.category ?? ""}`)
            : projection.index;
        nodes = searchFuzzyIndex(index, query);
        if (projection.searches.size >= 100)
          projection.searches.delete(projection.searches.keys().next().value!);
        projection.searches.set(scope, { at: now, nodes });
      }
    }
    // Picker facets ignore search/category but exclude already attached schemes, like the legacy picker.
    const excludedCounts = new Map<string, number>();
    for (const id of excluded) {
      const node = projection.byId.get(id);
      if (node) {
        const key = node.category ?? "";
        excludedCounts.set(key, (excludedCounts.get(key) ?? 0) + 1);
      }
    }
    const categoryCounts = excluded.length
      ? projection.categoryCounts
          .map((f) => ({ ...f, count: f.count - (excludedCounts.get(f.key) ?? 0) }))
          .filter((f) => f.count > 0)
      : projection.categoryCounts;
    return { revision, ...paginateSchemeItems(nodes, args, revision, scope), categoryCounts };
  })();
}
export function readAttachedMiniatureSchemes(
  miniatureId: string,
  byId?: Map<string, PaintRead>,
): AttachedMiniatureScheme[] {
  validateText(miniatureId, "miniatureId");
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const rows = sqlite
      .prepare(
        `SELECT ${summaryColumns},l.sort_order AS sortOrder FROM miniature_color_schemes l
      JOIN color_schemes s ON s.id=l.scheme_id ${sourceJoin}
      WHERE l.miniature_id=? ORDER BY l.sort_order,s.id`,
      )
      .all(miniatureId) as (SummaryRow & { sortOrder: number })[];
    const stats = schemeStats(
      rows,
      byId ?? (rows.length ? readPaintProjection(allowCache).byId : new Map<string, PaintRead>()),
    );
    return rows.map((row) => ({
      id: opaque(["miniature-scheme-link", miniatureId, row.id]),
      sortOrder: row.sortOrder,
      scheme: summary(row, stats.get(row.id)!),
    }));
  })();
}
export function readMiniatureScheme(id: string): MiniatureSchemeRead {
  validateText(id, "id");
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const revision = readRevision();
    const row = sqlite
      .prepare(`SELECT ${summaryColumns} FROM color_schemes s ${sourceJoin} WHERE s.id=?`)
      .get(id) as SummaryRow | undefined;
    if (!row) return { revision, scheme: null, entries: [] };
    const paints = sqlite
      .prepare(
        `SELECT paint_id AS paintId,sort_order AS sortOrder FROM color_scheme_paints WHERE scheme_id=? ORDER BY sort_order`,
      )
      .all(id) as { paintId: string; sortOrder: number }[];
    const byId = readPaintProjection(allowCache).byId;
    const entries: MiniatureSchemeEntry[] = paints.map((paint) => ({
      id: opaque(["scheme-entry", id, "PAINT", paint.sortOrder]),
      kind: "PAINT",
      sortOrder: paint.sortOrder,
      paint: byId.get(paint.paintId) ?? null,
    }));
    const dividers = sqlite
      .prepare(
        `SELECT id,label,tone,role,sort_order AS sortOrder FROM color_scheme_dividers WHERE scheme_id=? ORDER BY sort_order,id`,
      )
      .all(id) as { id: string; label: string; tone: string; role: string | null; sortOrder: number }[];
    const images = sqlite
      .prepare(
        `SELECT id,image_url AS imageUrl,thumbnail_url AS thumbnailUrl,image_type AS imageType,method,sort_order AS sortOrder FROM color_scheme_images WHERE scheme_id=? ORDER BY sort_order,id`,
      )
      .all(id) as {
      id: string;
      imageUrl: string;
      thumbnailUrl: string | null;
      imageType: string | null;
      method: string | null;
      sortOrder: number;
    }[];
    entries.push(
      ...dividers.map((entry) => ({
        ...entry,
        kind: "DIVIDER" as const,
      })),
    );
    entries.push(
      ...images.map((entry) => ({
        ...entry,
        kind: "IMAGE" as const,
      })),
    );
    entries.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
    );
    return { revision, scheme: summary(row, schemeStats([row], byId).get(id)!), entries };
  })();
}
export function miniatureSchemeEntries(parent: MiniatureSchemeRead, args: PageArgs) {
  return paginateSchemeItems(
    parent.entries,
    args,
    parent.revision,
    scopeFor(["entries", parent.scheme?.id ?? null]),
  );
}
