import { createHash } from "node:crypto";

import { createFuzzyIndex, searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { rankPaintsByColor } from "@paint-vault/core/paint-color-similarity";
import { isPaintOwned, type PaintState, type StockLevel } from "@paint-vault/core/paint-state";
import {
  createPaintChoiceResolver,
  resolveSubstitution,
  type SubstitutionData,
} from "@paint-vault/core/paint-substitutions";
import { isUserId } from "@paint-vault/core/vault-ids";
import { GraphQLError } from "graphql";

import { changeLogEpoch, currentChangeSeq, pruneChangeLog } from "../db/change-log.ts";
import { getSqlite } from "../db/index.ts";
import { sourceLogoUrl } from "../lib/catalog-source-assets.ts";

type Revision = { epoch: string; seq: number };
type Inventory = {
  state: Exclude<PaintState, null>;
  stockLevel: Exclude<StockLevel, null>;
  quantity: number;
};
export type PaintRead = {
  id: string;
  brand: string;
  range: string;
  name: string;
  colorHex: string | null;
  type: string | null;
  discontinued: boolean;
  isCustom: boolean;
  sourceId: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  inventory: Inventory | null;
  available: boolean;
  hasActiveSubstitution: boolean;
  activeSubstitution: { id: string; name: string } | null;
  brokenReason: "EMPTY" | "CYCLE" | null;
  missingStock: boolean;
  brokenSubstitution: boolean;
};
type Snapshot = {
  revision: Revision;
  paints: PaintRead[];
  byId: Map<string, PaintRead>;
  data: SubstitutionData;
  search: ReturnType<typeof createFuzzyIndex<PaintRead>>;
  pickerSearch: ReturnType<typeof createFuzzyIndex<PaintRead>>;
};
export type SubstitutionRead = {
  id: string;
  targetPaintId: string;
  name: string;
  isDefault: boolean;
  available: boolean;
  brokenReason: "EMPTY" | "CYCLE" | null;
  snapshot: Snapshot;
};
export type PaintViewRead = {
  revision: Revision;
  paint: PaintRead | null;
  snapshot: Snapshot;
  usages: { id: string; title: string }[];
};
let cached: Snapshot | undefined;
const badInput = (message: string): never => {
  throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
};
export function validateText(value: unknown, name: string, max = 256) {
  if (value != null && (typeof value !== "string" || value.length > max))
    badInput(`${name} must be at most ${max} characters`);
}
export function validatePage({ first, after }: { first: number; after?: string | null }, max = 100) {
  if (!Number.isInteger(first) || first < 1 || first > max) badInput(`first must be between 1 and ${max}`);
  validateText(after, "cursor", 8192);
}
export function readRevision(): Revision {
  const sqlite = getSqlite();
  pruneChangeLog(sqlite);
  return { epoch: changeLogEpoch, seq: currentChangeSeq(sqlite) };
}
// A single immutable paint-domain projection, never State or miniature/template/recipe snapshots.
// Reuse only at the exact database generation; rebuild after every write (including REST).
function snapshot(allowCache = true): Snapshot {
  const sqlite = getSqlite();
  const revision = readRevision();
  if (allowCache && cached?.revision.epoch === revision.epoch && cached.revision.seq === revision.seq)
    return cached;
  const rows = sqlite
    .prepare(
      `SELECT p.id,p.brand,p.range,p.name,p.color_hex AS colorHex,p.type,
    p.discontinued,p.source_url AS sourceUrl,p.source_label AS sourceLabel,
    i.state,i.stock_level AS stockLevel,i.quantity FROM paint_catalog p
    LEFT JOIN paint_inventory i ON i.paint_id=p.id ORDER BY p.brand,p.range,p.name,p.id`,
    )
    .all() as (Omit<PaintRead, "discontinued"> & {
    discontinued: number;
    state: Inventory["state"] | null;
    stockLevel: Inventory["stockLevel"] | null;
    quantity: number | null;
  })[];
  const sources = sqlite
    .prepare(
      `SELECT c.item_id AS itemId,s.id,s.name,s.logo_svg AS logoSvg
    FROM catalog_source_items c JOIN catalog_sources s ON s.id=c.source_id
    WHERE c.kind='paint' ORDER BY c.source_id,c.item_id`,
    )
    .all() as { itemId: string; id: string; name: string; logoSvg: string | null }[];
  const sourceById = new Map(sources.map((s) => [s.itemId, s]));
  const substitutions = sqlite
    .prepare(
      `SELECT id,target_paint_id AS targetPaintId,name,is_default AS isDefault
    FROM paint_substitutions ORDER BY id`,
    )
    .all() as (Omit<SubstitutionData["paintSubstitutions"][number], "isDefault"> & { isDefault: number })[];
  const data: SubstitutionData = {
    paintSubstitutions: substitutions.map((s) => ({ ...s, isDefault: Boolean(s.isDefault) })),
    paintSubstitutionIngredients: sqlite
      .prepare(
        `SELECT substitution_id AS substitutionId,paint_id AS paintId,parts,sort_order AS sortOrder
      FROM paint_substitution_ingredients ORDER BY substitution_id,sort_order,paint_id`,
      )
      .all() as SubstitutionData["paintSubstitutionIngredients"],
    miniaturePaintSubstitutions: [],
  };
  const records = new Map(
    rows.map((r) => [
      r.id,
      r.state ? { state: r.state, stockLevel: r.stockLevel!, quantity: r.quantity! } : null,
    ]),
  );
  const physicallyOwned = (id: string) => {
    const r = records.get(id);
    return isPaintOwned(r?.state ?? null, r?.stockLevel ?? null, r?.quantity ?? 0);
  };
  const resolve = createPaintChoiceResolver(data);
  const defaults = new Map(
    data.paintSubstitutions.filter((s) => s.isDefault).map((s) => [s.targetPaintId, s]),
  );
  const paints: PaintRead[] = rows.map((row) => {
    const choice = resolve(row.id),
      source = sourceById.get(row.id),
      active = defaults.get(row.id);
    const missingStock = choice.paintIds.some((id) => !physicallyOwned(id));
    const brokenSubstitution = choice.unavailablePaintIds.length > 0;
    return {
      id: row.id,
      brand: row.brand,
      range: row.range,
      name: row.name,
      colorHex: row.colorHex,
      type: row.type,
      discontinued: Boolean(row.discontinued),
      isCustom: isUserId(row.id),
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceLogoUrl: source ? sourceLogoUrl(source.id, source.logoSvg) : null,
      sourceUrl: row.sourceUrl,
      sourceLabel: row.sourceLabel,
      inventory: records.get(row.id) ?? null,
      available: !brokenSubstitution && !missingStock,
      hasActiveSubstitution: Boolean(active),
      activeSubstitution: active ? { id: active.id, name: active.name } : null,
      brokenReason:
        choice.brokenReason === "empty" ? "EMPTY" : choice.brokenReason === "cycle" ? "CYCLE" : null,
      missingStock,
      brokenSubstitution,
    };
  });
  const result: Snapshot = {
    revision,
    paints,
    byId: new Map(paints.map((p) => [p.id, p])),
    data,
    search: createFuzzyIndex(paints, (p) => `${p.isCustom ? "Custom " : ""}${p.brand} ${p.range} ${p.name}`),
    pickerSearch: createFuzzyIndex(paints, (p) => `${p.brand} ${p.range} ${p.name}`),
  };
  if (allowCache) cached = result;
  return result;
}
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("base64url");
function paginate<T>(
  items: T[],
  args: { first: number; after?: string | null },
  revision: Revision,
  scope: string,
) {
  validatePage(args);
  let start = 0;
  if (args.after != null) {
    try {
      if (!args.after || !/^[\w-]+$/.test(args.after)) throw new Error();
      const c: unknown = JSON.parse(Buffer.from(args.after, "base64url").toString("utf8"));
      if (
        !Array.isArray(c) ||
        c.length !== 5 ||
        c[0] !== "library-v2" ||
        c[1] !== scope ||
        typeof c[2] !== "string" ||
        !Number.isSafeInteger(c[3]) ||
        !Number.isSafeInteger(c[4]) ||
        c[4] < 0
      )
        throw new Error();
      if (c[2] !== revision.epoch || c[3] !== revision.seq)
        throw new GraphQLError("Library changed; restart pagination", {
          extensions: { code: "STALE_CURSOR" },
        });
      start = c[4] as number;
      if (start > items.length) throw new Error();
    } catch (error) {
      if (error instanceof GraphQLError) throw error;
      badInput("Invalid Library cursor");
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
        ? Buffer.from(JSON.stringify(["library-v2", scope, revision.epoch, revision.seq, end])).toString(
            "base64url",
          )
        : null,
    },
  };
}
type LibraryArgs = {
  first: number;
  after?: string | null;
  filter?: string | null;
  search?: string | null;
  brand?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
  noSource?: boolean;
};
function matchesInventory(p: PaintRead, filter: string) {
  return (
    filter === "ALL" ||
    (filter === "OWNED"
      ? p.available
      : filter === "WISHLIST"
        ? p.inventory?.state === "WISHLIST"
        : !p.available && p.inventory?.state !== "WISHLIST")
  );
}
const facets = (items: PaintRead[], key: (p: PaintRead) => string) => {
  const counts = new Map<string, number>();
  for (const p of items) {
    const k = key(p);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, count]) => ({ key: k, label: k || "Not from a plugin", count }));
};
export function readLibrary(args: LibraryArgs) {
  validatePage(args);
  for (const key of ["search", "brand", "sourceId", "sourceName"] as const) validateText(args[key], key);
  if (args.filter && !["ALL", "OWNED", "WISHLIST", "UNTRACKED"].includes(args.filter))
    badInput("Invalid Library filter");
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = snapshot(allowCache),
      q = args.search?.trim() ?? "",
      filter = q ? "ALL" : (args.filter ?? "ALL");
    const searched = searchFuzzyIndex(s.search, q).filter(
      (p) =>
        (!args.brand || args.brand === "ALL" || (p.isCustom ? "Custom" : p.brand) === args.brand) &&
        (!args.sourceId || p.sourceId === args.sourceId) &&
        (!args.sourceName || p.sourceName === args.sourceName) &&
        (!args.noSource || !p.sourceName),
    );
    const page = paginate(
      searched.filter((p) => matchesInventory(p, filter)),
      args,
      s.revision,
      fingerprint([
        "library",
        filter,
        q,
        args.brand ?? null,
        args.sourceId ?? null,
        args.sourceName ?? null,
        Boolean(args.noSource),
      ]),
    );
    return {
      ...page,
      revision: s.revision,
      catalogCount: s.paints.length,
      availableCount: s.paints.filter((p) => p.available).length,
      explicitWishlistCount: s.paints.filter((p) => p.inventory?.state === "WISHLIST").length,
      facets: {
        brands: facets(s.paints, (p) => (p.isCustom ? "Custom" : p.brand)),
        sources: facets(s.paints, (p) => p.sourceName ?? ""),
        inventory: ["ALL", "OWNED", "WISHLIST", "UNTRACKED"].map((key) => ({
          key,
          label: key,
          count: searched.filter((p) => matchesInventory(p, key)).length,
        })),
      },
    };
  })();
}
export function readPaintOptions(args: { first: number; search: string; excludeIds: string[] }) {
  validatePage(args, 30);
  validateText(args.search, "search");
  args.excludeIds.forEach((id) => validateText(id, "exclude ID"));
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = snapshot(allowCache),
      excluded = new Set(args.excludeIds);
    // Exclusions precede ranking: excluded literal matches must not suppress eligible typo matches.
    const candidates = s.paints.filter((p) => !excluded.has(p.id));
    const index = excluded.size
      ? createFuzzyIndex(candidates, (p) => `${p.brand} ${p.range} ${p.name}`)
      : s.pickerSearch;
    return { revision: s.revision, items: searchFuzzyIndex(index, args.search.trim(), args.first) };
  })();
}
function substitutionRead(s: Snapshot, id: string): SubstitutionRead | null {
  const sub = s.data.paintSubstitutions.find((r) => r.id === id),
    choice = resolveSubstitution(s.data, id);
  if (!sub || !choice) return null;
  return {
    ...sub,
    snapshot: s,
    available:
      !choice.unavailablePaintIds.length &&
      choice.paintIds.every((id) => {
        const r = s.byId.get(id)?.inventory;
        return isPaintOwned(r?.state ?? null, r?.stockLevel ?? null, r?.quantity ?? 0);
      }),
    brokenReason:
      choice.brokenReason === "empty" ? "EMPTY" : choice.brokenReason === "cycle" ? "CYCLE" : null,
  };
}
export function readPaint(id: string): PaintViewRead {
  validateText(id, "id");
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = snapshot(allowCache);
    const usages = getSqlite()
      .prepare(
        `SELECT DISTINCT m.id,m.title FROM miniatures m WHERE
      EXISTS(SELECT 1 FROM miniature_required_paints r WHERE r.miniature_id=m.id AND r.paint_id=?) OR
      EXISTS(SELECT 1 FROM miniature_color_schemes l JOIN color_scheme_paints p ON p.scheme_id=l.scheme_id WHERE l.miniature_id=m.id AND p.paint_id=?)
      ORDER BY m.title,m.id`,
      )
      .all(id, id) as { id: string; title: string }[];
    return { revision: s.revision, paint: s.byId.get(id) ?? null, snapshot: s, usages };
  })();
}
export function readSubstitution(id: string) {
  validateText(id, "id");
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = snapshot(allowCache);
    return { revision: s.revision, substitution: substitutionRead(s, id) };
  })();
}
export function paintSubstitutions(view: PaintViewRead, args: { first: number; after?: string | null }) {
  validatePage(args, 30);
  const s = view.snapshot,
    id = view.paint?.id;
  return paginate(
    s.data.paintSubstitutions.filter((r) => r.targetPaintId === id).map((r) => substitutionRead(s, r.id)!),
    args,
    s.revision,
    fingerprint(["substitutions", id]),
  );
}
export function paintUsages(view: PaintViewRead, args: { first: number; after?: string | null }) {
  return paginate(view.usages, args, view.revision, fingerprint(["usedBy", view.paint?.id]));
}
export function similarPaints(view: PaintViewRead, first: number) {
  validatePage({ first }, 30);
  return view.paint
    ? (rankPaintsByColor(view.paint, view.snapshot.paints) ?? []).slice(0, first).map((r) => r.paint)
    : [];
}
export function substitutionIngredients(
  sub: SubstitutionRead,
  args: { first: number; after?: string | null },
) {
  const s = sub.snapshot;
  const ingredients = s.data.paintSubstitutionIngredients
    .filter((r) => r.substitutionId === sub.id)
    .map((r) => ({ paint: s.byId.get(r.paintId)!, parts: r.parts, sortOrder: r.sortOrder }));
  return paginate(ingredients, args, s.revision, fingerprint(["ingredients", sub.id]));
}
