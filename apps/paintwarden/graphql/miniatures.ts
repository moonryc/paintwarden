import { createHash } from "node:crypto";

import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { imageThumbnailUrl } from "@paintwarden/core/image-thumbnails";
import { isPaintOwned } from "@paintwarden/core/paint-state";
import { createPaintChoiceResolver } from "@paintwarden/core/paint-substitutions";
import { RECIPE_STEP_VALUES } from "@paintwarden/core/recipe-steps";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";

import { readPaintProjection, readRevision, validatePage, validateText, type PaintRead } from "./library.ts";
import { readAttachedMiniatureSchemes, readMiniatureSchemeEntries } from "./miniature-schemes.ts";

type Revision = ReturnType<typeof readRevision>;
type Page = { first: number; after?: string | null };
type Ownership = "OWNED" | "WISHLIST";
type Stage = "NOT_STARTED" | "ASSEMBLED" | "PRIMED" | "IN_PROGRESS" | "COMPLETE";
type MiniatureRow = {
  id: string;
  title: string;
  folderId: string | null;
  status: Ownership;
  paintingStatus: Stage;
  notes: string;
  manufacturer: string;
  faction: string;
  scale: string;
  imageKey: string | null;
  sourceImageUrl: string | null;
  createdAt: number;
  updatedAt: number;
};
type MissingRead = { id: string; paint: PaintRead; missingStock: boolean; brokenSubstitution: boolean };
const stages: Stage[] = ["NOT_STARTED", "ASSEMBLED", "PRIMED", "IN_PROGRESS", "COMPLETE"];
const fingerprint = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("base64url");
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const normalized = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const bad = (message: string): never => {
  throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
};

export function cursorAnchor(after: string, revision: Revision, scope: string): string {
  try {
    if (!after || !/^[\w-]+$/.test(after)) throw new Error();
    const c: unknown = JSON.parse(Buffer.from(after, "base64url").toString("utf8"));
    if (
      !Array.isArray(c) ||
      c.length !== 5 ||
      c[0] !== "miniatures-v1" ||
      c[1] !== scope ||
      typeof c[2] !== "string" ||
      !Number.isSafeInteger(c[3]) ||
      typeof c[4] !== "string"
    )
      throw new Error();
    if (c[2] !== revision.epoch || c[3] !== revision.seq)
      throw new GraphQLError("Collection changed; restart pagination", {
        extensions: { code: "STALE_CURSOR" },
      });
    return c[4];
  } catch (error) {
    if (error instanceof GraphQLError) throw error;
    return bad("Invalid miniature cursor");
  }
}
// A cursor anchors the last unique identity (scheme entries may share raw IDs) in an immutable generation/filter ordered set.
// No SQL/order text or client-chosen offset is evaluated. A revision change restarts paging.
export function paginateProjection<T extends { id: string }>(
  items: T[],
  args: Page,
  revision: Revision,
  scope: string,
  identity: (item: T) => string = (item) => item.id,
) {
  validatePage(args);
  let start = 0;
  if (args.after != null) {
    const anchor = cursorAnchor(args.after, revision, scope),
      index = items.findIndex((item) => identity(item) === anchor);
    if (index < 0) bad("Invalid miniature cursor");
    start = index + 1;
  }
  const nodes = items.slice(start, start + args.first);
  return {
    nodes,
    totalCount: items.length,
    pageInfo: {
      hasNextPage: start + nodes.length < items.length,
      endCursor: nodes.length
        ? Buffer.from(
            JSON.stringify(["miniatures-v1", scope, revision.epoch, revision.seq, identity(nodes.at(-1)!)]),
          ).toString("base64url")
        : null,
    },
  };
}
function physical(p: PaintRead | undefined) {
  return isPaintOwned(
    p?.inventory?.state ?? null,
    p?.inventory?.stockLevel ?? null,
    p?.inventory?.quantity ?? 0,
  );
}
function shopping(p: PaintRead) {
  return p.inventory?.state === "WISHLIST" || (p.inventory?.state === "OWNED" && !physical(p));
}
export function readVaultNavigation() {
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const p = readPaintProjection(allowCache);
    return {
      revision: p.revision,
      ...p.navigation,
    };
  })();
}
function group<T>(rows: T[], key: (r: T) => string) {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const values = result.get(k);
    if (values) values.push(row);
    else result.set(k, [row]);
  }
  return result;
}
function miniatureRead(row: MiniatureRow, required: PaintRead[], missing: MissingRead[]) {
  const colors = required.filter((p) => p.colorHex).map((p) => ({ paintId: p.id, colorHex: p.colorHex! }));
  const imageUrl = row.imageKey
    ? `/api/miniatures/${encodeURIComponent(row.id)}/image?v=${encodeURIComponent(row.imageKey)}`
    : row.sourceImageUrl;
  return {
    id: row.id,
    title: row.title,
    folderId: row.folderId,
    status: row.status,
    paintingStatus: row.paintingStatus,
    notes: row.notes,
    manufacturer: row.manufacturer,
    faction: row.faction,
    scale: row.scale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    imageUrl,
    thumbnailUrl: imageUrl ? imageThumbnailUrl(imageUrl) : null,
    readiness: {
      total: required.length,
      missing: missing.length,
      ready: required.length > 0 && missing.length === 0,
      missingStock: missing.filter((p) => p.missingStock).length,
      brokenSubstitution: missing.filter((p) => p.brokenSubstitution).length,
    },
    previewSwatches: colors.slice(0, 8),
    previewSwatchesTruncated: colors.length > 8,
  };
}
export type MiniatureRead = ReturnType<typeof miniatureRead>;
type Aggregate = {
  revision: Revision;
  paint: ReturnType<typeof readPaintProjection>;
  miniatures: MiniatureRead[];
  byId: Map<string, MiniatureRead>;
  required: Map<string, PaintRead[]>;
  missing: Map<string, MissingRead[]>;
  search: ReturnType<typeof createFuzzyIndex<MiniatureRead>>;
  resultSets: Map<string, { items: MiniatureRead[]; accessed: number }>;
  ownershipCounts: ReturnType<typeof facets>;
  stageCounts: ReturnType<typeof facets>;
  homeCounts: Map<
    string,
    {
      catalogCount: number;
      owned: number;
      ready: number;
      distinctMissingPaints: number;
      wishlistedMissingPaints: number;
      stages: ReturnType<typeof facets>;
    }
  >;
};
let cached: Aggregate | undefined;
let builds = 0,
  searchRanks = 0;
export function clearMiniatureProjectionCache() {
  cached = undefined;
  builds = 0;
  searchRanks = 0;
}
export function miniatureProjectionDiagnostics() {
  return { builds, searchRanks, resultSets: cached?.resultSets.size ?? 0 };
}
// This is a compact relationship/readiness projection, not State: no templates, sources,
// full scheme entries, recipe notes or image assets. A fixed number of batched scans replaces
// per-miniature queries and reuses core's deterministic per-root substitution resolver.
function aggregate(allowCache: boolean): Aggregate {
  const revision = readRevision();
  if (allowCache && cached?.revision.epoch === revision.epoch && cached.revision.seq === revision.seq)
    return cached;
  const sqlite = getSqlite(),
    paint = readPaintProjection(allowCache);
  const rows = sqlite
    .prepare(
      `SELECT id,title,folder_id AS folderId,status,painting_status AS paintingStatus,notes,manufacturer,faction,scale,
    image_key AS imageKey,source_image_url AS sourceImageUrl,created_at AS createdAt,updated_at AS updatedAt FROM miniatures`,
    )
    .all() as MiniatureRow[];
  rows.sort(
    (a, b) =>
      b.createdAt - a.createdAt || compare(normalized(a.title), normalized(b.title)) || compare(a.id, b.id),
  );
  const manual = group(
    sqlite
      .prepare(
        `SELECT miniature_id AS miniatureId,paint_id AS paintId FROM miniature_required_paints ORDER BY miniature_id,sort_order,id`,
      )
      .all() as { miniatureId: string; paintId: string }[],
    (r) => r.miniatureId,
  );
  const links = group(
    sqlite
      .prepare(
        `SELECT miniature_id AS miniatureId,scheme_id AS schemeId FROM miniature_color_schemes ORDER BY miniature_id,sort_order,scheme_id`,
      )
      .all() as { miniatureId: string; schemeId: string }[],
    (r) => r.miniatureId,
  );
  const schemePaints = group(
    sqlite
      .prepare(
        `SELECT scheme_id AS schemeId,paint_id AS paintId FROM color_scheme_paints ORDER BY scheme_id,sort_order`,
      )
      .all() as { schemeId: string; paintId: string }[],
    (r) => r.schemeId,
  );
  const resolve = createPaintChoiceResolver(paint.data),
    required = new Map<string, PaintRead[]>(),
    missing = new Map<string, MissingRead[]>();
  const miniatures = rows.map((row) => {
    const targets = new Set((manual.get(row.id) ?? []).map((r) => r.paintId));
    for (const link of links.get(row.id) ?? [])
      for (const p of schemePaints.get(link.schemeId) ?? []) targets.add(p.paintId);
    const leaves = new Set<string>(),
      blocked = new Set<string>();
    for (const target of targets) {
      const choice = resolve(target);
      for (const id of choice.paintIds) leaves.add(id);
      for (const id of choice.unavailablePaintIds) blocked.add(id);
    }
    const paints: PaintRead[] = [],
      unavailable: MissingRead[] = [];
    for (const id of leaves) {
      const p = paint.byId.get(id);
      if (!p) continue;
      paints.push(p);
      const missingStock = !physical(p),
        brokenSubstitution = blocked.has(id);
      if (missingStock || brokenSubstitution)
        unavailable.push({ id, paint: p, missingStock, brokenSubstitution });
    }
    required.set(row.id, paints);
    missing.set(row.id, unavailable);
    return miniatureRead(row, paints, unavailable);
  });
  const result: Aggregate = {
    revision,
    ownershipCounts: facets(miniatures, ["OWNED", "WISHLIST"], (m) => m.status),
    stageCounts: facets(miniatures, stages, (m) => m.paintingStatus),
    homeCounts: new Map(),
    paint,
    miniatures,
    byId: new Map(miniatures.map((m) => [m.id, m])),
    required,
    missing,
    search: createFuzzyIndex(
      miniatures,
      (m) => `${m.title} ${m.notes} ${m.manufacturer} ${m.faction} ${m.scale} ${m.paintingStatus}`,
    ),
    resultSets: new Map(),
  };
  builds++;
  if (allowCache) cached = result;
  return result;
}
export type FolderScopeArgs = { folderId?: string | null; flat?: boolean | null };
// Null means unrestricted; a set contains only eligible folder IDs (including root).
// UNION, rather than UNION ALL, keeps even a corrupt cyclic folder graph bounded.
export function folderScopeIds(kind: "miniature" | "template", args: FolderScopeArgs) {
  const folderId = args.folderId ?? null;
  if (folderId === null) return args.flat === false ? new Set<string | null>([null]) : null;
  const rows = getSqlite()
    .prepare(
      args.flat === false
        ? "SELECT id FROM folders WHERE id=? AND kind=?"
        : `WITH RECURSIVE subtree(id) AS (
          SELECT id FROM folders WHERE id=? AND kind=?
          UNION SELECT f.id FROM folders f JOIN subtree s ON f.parent_id=s.id WHERE f.kind=?
        ) SELECT id FROM subtree`,
    )
    .all(...(args.flat === false ? [folderId, kind] : [folderId, kind, kind])) as { id: string }[];
  return new Set<string | null>(rows.map((row) => row.id));
}
type ListArgs = Page &
  FolderScopeArgs & {
    ownership?: Ownership | null;
    stage?: Stage | null;
    search?: string | null;
  };
function validateList(args: ListArgs) {
  validatePage(args);
  validateText(args.search, "search", 128);
  validateText(args.folderId, "folderId");
  if (args.ownership != null && !["OWNED", "WISHLIST"].includes(args.ownership)) bad("Invalid ownership");
  if (args.stage != null && !stages.includes(args.stage)) bad("Invalid stage");
}
function filtered(s: Aggregate, args: ListArgs, root: "home" | "miniatures" | "folder-search") {
  const search = args.search?.trim() ?? "",
    key = fingerprint([
      args.ownership ?? null,
      args.stage ?? null,
      search,
      args.folderId ?? null,
      args.flat !== false,
    ]);
  if (args.after != null) cursorAnchor(args.after, s.revision, `${root}:${key}`);
  const now = Date.now();
  for (const [k, v] of s.resultSets) if (now - v.accessed > 60_000) s.resultSets.delete(k);
  const hit = s.resultSets.get(key);
  if (hit) {
    hit.accessed = now;
    return { items: hit.items, key };
  }
  if (search && args.after != null)
    throw new GraphQLError("Search expired; restart pagination", { extensions: { code: "STALE_CURSOR" } });
  const folders = folderScopeIds("miniature", args);
  const candidates = s.miniatures.filter(
    (m) =>
      (!folders || folders.has(m.folderId)) &&
      (!args.ownership || m.status === args.ownership) &&
      (!args.stage || m.paintingStatus === args.stage),
  );
  const ids = new Set(candidates.map((m) => m.id));
  // Filter BEFORE fuzzy matching: an excluded literal must not suppress eligible typo matches.
  const candidateIndex = {
    items: candidates,
    entries: s.search.entries.filter((_entry, i) => ids.has(s.miniatures[i].id)),
  };
  const items = search ? searchFuzzyIndex(candidateIndex, search) : candidates;
  if (search) searchRanks++;
  if (s.resultSets.size >= 100) s.resultSets.delete(s.resultSets.keys().next().value!);
  s.resultSets.set(key, { items, accessed: now });
  return { items, key };
}
const facets = (items: MiniatureRead[], values: string[], key: (m: MiniatureRead) => string) =>
  ["ALL", ...values].map((value) => ({
    key: value,
    label: value,
    count: value === "ALL" ? items.length : items.filter((m) => key(m) === value).length,
  }));
function folderItems(s: Aggregate, args: FolderScopeArgs) {
  const folders = folderScopeIds("miniature", args);
  return folders ? s.miniatures.filter((m) => folders.has(m.folderId)) : s.miniatures;
}
function homeCounts(s: Aggregate, args: FolderScopeArgs) {
  const key = fingerprint([args.folderId ?? null]);
  const hit = s.homeCounts.get(key);
  if (hit) return hit;
  // A folder's Workbench summarizes its entire subtree even while browsing
  // direct children. The root summarizes the complete collection in either view.
  const owned = folderItems(s, { ...args, flat: true }).filter((m) => m.status === "OWNED");
  const allMissing = new Set<string>();
  for (const m of owned) for (const p of s.missing.get(m.id) ?? []) allMissing.add(p.id);
  const counts = {
    catalogCount: s.paint.paints.length,
    owned: owned.length,
    ready: owned.filter((m) => m.readiness.ready).length,
    distinctMissingPaints: allMissing.size,
    wishlistedMissingPaints: [...allMissing].filter((id) => shopping(s.paint.byId.get(id)!)).length,
    stages: facets(owned, stages, (m) => m.paintingStatus),
  };
  if (s.homeCounts.size >= 100) s.homeCounts.delete(s.homeCounts.keys().next().value!);
  s.homeCounts.set(key, counts);
  return counts;
}
// Mixed search consumes the same generation and readiness projection without paging
// (and re-ranking) the entire collection through repeated public resolver calls.
export function miniatureFolderSearchCandidates(args: Omit<ListArgs, "first" | "after">, allowCache = false) {
  validateList({ ...args, first: 1 });
  const s = aggregate(allowCache);
  return filtered(s, { ...args, first: 1, search: null, flat: true }, "folder-search").items;
}
export function readMiniatures(args: ListArgs) {
  validateList(args);
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = aggregate(allowCache),
      { items, key } = filtered(s, args, "miniatures");
    return {
      revision: s.revision,
      ownershipCounts:
        args.folderId != null || args.flat === false
          ? facets(folderItems(s, args), ["OWNED", "WISHLIST"], (m) => m.status)
          : s.ownershipCounts,
      stageCounts:
        args.folderId != null || args.flat === false
          ? facets(folderItems(s, args), stages, (m) => m.paintingStatus)
          : s.stageCounts,
      miniatures: paginateProjection(items, args, s.revision, `miniatures:${key}`),
    };
  })();
}
export function readHome(args: Omit<ListArgs, "ownership">) {
  validateList(args);
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = aggregate(allowCache);
    const { items, key } = filtered(s, { ...args, ownership: "OWNED" }, "home");
    return {
      revision: s.revision,
      counts: homeCounts(s, args),
      miniatures: paginateProjection(items, args, s.revision, `home:${key}`),
    };
  })();
}
export function readMiniature(id: string) {
  validateText(id, "id");
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const s = aggregate(allowCache),
      sqlite = getSqlite();
    const rows = sqlite
      .prepare(
        `SELECT id,paint_id AS paintId,step,notes,sort_order AS sortOrder FROM miniature_required_paints WHERE miniature_id=? ORDER BY sort_order,id`,
      )
      .all(id) as { id: string; paintId: string; step: string; notes: string; sortOrder: number }[];
    rows.sort(
      (a, b) =>
        RECIPE_STEP_VALUES.indexOf(a.step as (typeof RECIPE_STEP_VALUES)[number]) -
          RECIPE_STEP_VALUES.indexOf(b.step as (typeof RECIPE_STEP_VALUES)[number]) ||
        a.sortOrder - b.sortOrder ||
        compare(a.id, b.id),
    );
    const recipe = rows.map((r) => ({
      id: r.id,
      paint: s.paint.byId.get(r.paintId)!,
      step: r.step,
      notes: r.notes,
      sortOrder: r.sortOrder,
    }));
    const steps = new Set(
      (
        sqlite.prepare(`SELECT step FROM miniature_recipe_steps WHERE miniature_id=?`).all(id) as {
          step: string;
        }[]
      ).map((r) => r.step),
    );
    for (const row of rows) steps.add(row.step);
    const schemeRows = readAttachedMiniatureSchemes(id, s.paint.byId);
    const entriesByScheme = readMiniatureSchemeEntries(
      schemeRows.map((row) => row.scheme.id),
      s.paint.byId,
    );
    return {
      revision: s.revision,
      miniature: s.byId.get(id) ?? null,
      recipeSteps: RECIPE_STEP_VALUES.filter((step) => steps.has(step)),
      recipeRows: recipe,
      schemeRows,
      attachedSchemeEntryRows: schemeRows.flatMap((row) => entriesByScheme.get(row.scheme.id)!),
      missingRows: s.missing.get(id) ?? [],
      requiredRows: s.required.get(id) ?? [],
      id,
    };
  })();
}
export type MiniatureViewRead = ReturnType<typeof readMiniature>;
export const miniatureRecipe = (v: MiniatureViewRead, a: Page) =>
  paginateProjection(v.recipeRows, a, v.revision, `recipe:${v.id}`);
export const miniatureSchemes = (v: MiniatureViewRead, a: Page) =>
  paginateProjection(v.schemeRows, a, v.revision, `schemes:${v.id}`);
export const miniatureAttachedSchemeEntries = (v: MiniatureViewRead, a: Page) =>
  paginateProjection(v.attachedSchemeEntryRows, a, v.revision, `attached-scheme-entries:${v.id}`, (entry) =>
    JSON.stringify([entry.schemeId, entry.kind, entry.id]),
  );
export const miniatureMissing = (v: MiniatureViewRead, a: Page) =>
  paginateProjection(v.missingRows, a, v.revision, `missing:${v.id}`);
export const miniatureRequired = (v: MiniatureViewRead, a: Page) =>
  paginateProjection(v.requiredRows, a, v.revision, `required:${v.id}`);

// Shared compact readiness/relationship projection; never a vault State snapshot.
export function readMiniatureProjection(allowCache = true) {
  return aggregate(allowCache);
}
