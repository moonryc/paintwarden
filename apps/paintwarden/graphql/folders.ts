import { createHash, randomUUID } from "node:crypto";

import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { imageThumbnailUrl } from "@paintwarden/core/image-thumbnails";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import { withImageMutation } from "../lib/image-mutations.ts";
import { deleteImages } from "../lib/image-store.ts";

import { invalidationSince } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import type { Resolvers } from "./generated/resolvers.ts";
import { readRevision, validatePage, validateText } from "./library.ts";
import {
  cursorAnchor,
  miniatureFolderSearchCandidates,
  paginateProjection,
  type MiniatureRead,
} from "./miniatures.ts";
import { templateFolderSearchCandidates, type TemplateSummary } from "./templates.ts";

type Kind = "miniature" | "template";
type ApiKind = "MINIATURE" | "TEMPLATE";
type FolderRow = {
  id: string;
  kind: Kind;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};
export type FolderRead = Omit<FolderRow, "kind"> & {
  kind: ApiKind;
  directCount: number;
  recursiveCount: number;
  childFolderCount: number;
  coverImageUrl: string | null;
  coverThumbnailUrl: string | null;
};
type FolderArgs = {
  kind: ApiKind;
  parentId?: string | null;
  search?: string | null;
  flat?: boolean | null;
  first?: number;
  after?: string | null;
};
const bad = (message: string, code = "BAD_USER_INPUT"): never => {
  throw new GraphQLError(message, { extensions: { code } });
};
const dbKind = (kind: ApiKind | Kind): Kind => {
  if (kind === "MINIATURE" || kind === "miniature") return "miniature";
  if (kind === "TEMPLATE" || kind === "template") return "template";
  return bad("Invalid folder kind");
};
const tableFor = (kind: Kind) => (kind === "miniature" ? "miniatures" : "miniature_templates");
const columns =
  "id,kind,name,parent_id AS parentId,sort_order AS sortOrder,created_at AS createdAt,updated_at AS updatedAt";
function row(id: string): FolderRow {
  validateText(id, "id");
  return (
    (getSqlite().prepare(`SELECT ${columns} FROM folders WHERE id=?`).get(id) as FolderRow | undefined) ??
    bad("Folder not found", "NOT_FOUND")
  );
}
function target(kind: Kind, id: string | null | undefined) {
  if (id != null && row(id).kind !== kind) bad("Folder must have the same kind");
}
function folderName(value: string) {
  validateText(value, "name", 200);
  if (!value.trim()) bad("Folder name is required");
  return value.trim();
}
function subtree(id: string): string[] {
  return getSqlite()
    .prepare(
      `WITH RECURSIVE subtree(id) AS (
    SELECT id FROM folders WHERE id=? UNION SELECT f.id FROM folders f JOIN subtree s ON f.parent_id=s.id
  ) SELECT id FROM subtree`,
    )
    .pluck()
    .all(id) as string[];
}

// One revision-keyed metadata projection: counts are grouped in SQLite, never computed by
// loading miniature recipes/paints. A post-order pass rolls direct counts and covers upward.
let cached: { revision: ReturnType<typeof readRevision>; nodes: Map<string, FolderRead> } | undefined;
function projection(allowCache = true) {
  const revision = readRevision();
  if (allowCache && cached?.revision.epoch === revision.epoch && cached.revision.seq === revision.seq)
    return cached;
  const rows = getSqlite()
    .prepare(`SELECT ${columns} FROM folders ORDER BY sort_order,name COLLATE NOCASE,id`)
    .all() as FolderRow[];
  const nodes = new Map<string, FolderRead>(
    rows.map((r) => [
      r.id,
      {
        ...r,
        kind: r.kind === "miniature" ? "MINIATURE" : "TEMPLATE",
        directCount: 0,
        recursiveCount: 0,
        childFolderCount: 0,
        coverImageUrl: null,
        coverThumbnailUrl: null,
      },
    ]),
  );
  for (const kind of ["miniature", "template"] as const) {
    const table = tableFor(kind);
    const stats = getSqlite()
      .prepare(
        `SELECT folder_id AS folderId,count(*) AS count,
      (SELECT id FROM ${table} cover WHERE cover.folder_id=items.folder_id
       AND (cover.image_key IS NOT NULL OR coalesce(cover.${kind === "miniature" ? "source_image_url" : "image_url"},'') <> '')
       ORDER BY cover.created_at,cover.id LIMIT 1) AS coverId
      FROM ${table} items WHERE folder_id IS NOT NULL GROUP BY folder_id`,
      )
      .all() as { folderId: string; count: number; coverId: string | null }[];
    const cover = getSqlite().prepare(
      `SELECT image_key AS imageKey,${kind === "miniature" ? "source_image_url" : "image_url"} AS imageUrl FROM ${table} WHERE id=?`,
    );
    for (const s of stats) {
      const n = nodes.get(s.folderId);
      if (!n) continue;
      n.directCount = n.recursiveCount = s.count;
      if (s.coverId) {
        const image = cover.get(s.coverId) as { imageKey: string | null; imageUrl: string | null };
        n.coverImageUrl = image.imageKey
          ? `/api/${kind === "miniature" ? "miniatures" : "miniature-templates"}/${encodeURIComponent(s.coverId)}/image?v=${encodeURIComponent(image.imageKey)}`
          : image.imageUrl;
        n.coverThumbnailUrl = n.coverImageUrl ? imageThumbnailUrl(n.coverImageUrl) : null;
      }
    }
  }
  const remaining = new Map<string, number>();
  for (const n of nodes.values()) {
    if (n.parentId) {
      const p = nodes.get(n.parentId);
      if (p) {
        p.childFolderCount++;
        remaining.set(p.id, (remaining.get(p.id) ?? 0) + 1);
      }
    }
  }
  const leaves = [...nodes.values()].filter((n) => !remaining.has(n.id));
  for (let i = 0; i < leaves.length; i++) {
    const n = leaves[i],
      p = n.parentId ? nodes.get(n.parentId) : undefined;
    if (!p) continue;
    p.recursiveCount += n.recursiveCount;
    if (!p.coverImageUrl && n.coverImageUrl) {
      p.coverImageUrl = n.coverImageUrl;
      p.coverThumbnailUrl = n.coverThumbnailUrl;
    }
    remaining.set(p.id, remaining.get(p.id)! - 1);
    if (!remaining.get(p.id)) leaves.push(p);
  }
  const result = { revision, nodes };
  if (allowCache) cached = result;
  return result;
}
function selected(p: ReturnType<typeof projection>, args: FolderArgs) {
  const kind = dbKind(args.kind);
  validateText(args.parentId, "parentId");
  validateText(args.search, "search");
  target(kind, args.parentId);
  const descendants = args.flat && args.parentId ? new Set(subtree(args.parentId)) : null;
  let nodes = [...p.nodes.values()].filter(
    (n) =>
      dbKind(n.kind) === kind &&
      (args.flat
        ? !descendants || (n.id !== args.parentId && descendants.has(n.id))
        : n.parentId === (args.parentId ?? null)),
  );
  if (args.search?.trim())
    nodes = searchFuzzyIndex(
      createFuzzyIndex(nodes, (n) => n.name),
      args.search.trim(),
    );
  return nodes;
}
function pageFolders(p: ReturnType<typeof projection>, args: FolderArgs) {
  const scope = createHash("sha256")
    .update(JSON.stringify([args.kind, args.parentId ?? null, args.search ?? null, args.flat ?? false]))
    .digest("base64url");
  return paginateProjection(
    selected(p, args),
    { first: args.first ?? 100, after: args.after },
    p.revision,
    `folders:${scope}`,
  );
}
export function readFolders(args: FolderArgs) {
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => pageFolders(projection(allowCache), args).nodes)();
}
export function readFolder(id: string) {
  validateText(id, "id");
  return projection(!getSqlite().inTransaction).nodes.get(id) ?? null;
}
export function readFolderBrowser(args: FolderArgs) {
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const p = projection(allowCache);
    const page = pageFolders(p, args);
    return {
      revision: p.revision,
      folders: page.nodes,
      pageInfo: page.pageInfo,
      totalCount: page.totalCount,
    };
  })();
}
type FolderSearchRead =
  | (FolderRead & { __typename: "Folder" })
  | (MiniatureRead & { __typename: "Miniature" })
  | (TemplateSummary & { __typename: "TemplateSummary" });
type FolderSearchArgs = {
  kind: ApiKind;
  search: string;
  folderId?: string | null;
  first: number;
  after?: string | null;
  ownership?: "OWNED" | "WISHLIST" | null;
  stage?: "NOT_STARTED" | "ASSEMBLED" | "PRIMED" | "IN_PROGRESS" | "COMPLETE" | null;
  category?: string | null;
  sourceId?: string | null;
  noSource?: boolean | null;
};
let searchCache:
  | {
      revision: ReturnType<typeof readRevision>;
      entries: Map<string, { items: FolderSearchRead[]; at: number }>;
    }
  | undefined;
export function searchFolders(args: FolderSearchArgs) {
  validateText(args.search, "search", 128);
  validatePage(args);
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => {
    const revision = readRevision(),
      query = args.search.trim();
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          args.kind,
          query,
          args.folderId ?? null,
          args.ownership ?? null,
          args.stage ?? null,
          args.category ?? null,
          args.sourceId ?? null,
          !!args.noSource,
        ]),
      )
      .digest("base64url");
    const scope = `folder-search:${key}`;
    if (args.after != null) cursorAnchor(args.after, revision, scope);
    if (
      !searchCache ||
      searchCache.revision.epoch !== revision.epoch ||
      searchCache.revision.seq !== revision.seq
    )
      searchCache = { revision, entries: new Map() };
    const now = Date.now();
    for (const [k, v] of searchCache.entries) if (now - v.at >= 60_000) searchCache.entries.delete(k);
    let cached = allowCache ? searchCache.entries.get(key) : undefined;
    if (!cached) {
      if (allowCache && args.after != null) bad("Search expired; restart pagination", "STALE_CURSOR");
      const folders = selected(projection(allowCache), {
        kind: args.kind,
        parentId: args.folderId,
        flat: true,
      });
      const items =
        args.kind === "MINIATURE"
          ? miniatureFolderSearchCandidates(args, allowCache).map((n) => ({
              ...n,
              __typename: "Miniature" as const,
            }))
          : templateFolderSearchCandidates(args, allowCache).map((n) => ({
              ...n,
              __typename: "TemplateSummary" as const,
            }));
      const candidates: FolderSearchRead[] = [
        ...folders.map((n) => ({ ...n, __typename: "Folder" as const })),
        ...items,
      ];
      const itemsRanked = searchFuzzyIndex(
        createFuzzyIndex(candidates, (n) =>
          "title" in n
            ? `${n.title} ${n.notes} ${n.manufacturer} ${n.faction} ${n.scale} ${n.paintingStatus}`
            : "categories" in n
              ? `${n.name} ${n.manufacturer} ${n.faction} ${n.categories.join(" ")} ${n.sourceName ?? ""}`
              : n.name,
        ),
        query,
      );
      cached = { items: itemsRanked, at: now };
      if (allowCache) {
        if (searchCache.entries.size >= 100)
          searchCache.entries.delete(searchCache.entries.keys().next().value!);
        searchCache.entries.set(key, cached);
      }
    }
    cached.at = now;
    return { revision, results: paginateProjection(cached.items, args, revision, scope) };
  })();
}

// Shared by create/update and bulk moves. Validate the entire batch before its first write;
// a missing item or cross-kind destination cannot produce a partial success.
export function moveItems(kindInput: Kind | ApiKind, ids: string[], folderId?: string | null) {
  const kind = dbKind(kindInput);
  if (!ids.length || ids.length > 1000) bad("Move between 1 and 1000 items");
  target(kind, folderId);
  const unique = [...new Set(ids)],
    table = tableFor(kind),
    sqlite = getSqlite();
  for (const id of unique) {
    validateText(id, "id");
    if (!sqlite.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id)) bad("Item not found", "NOT_FOUND");
  }
  return sqlite.transaction(() => {
    let count = 0;
    const update = sqlite.prepare(
      `UPDATE ${table} SET folder_id=?,updated_at=? WHERE id=? AND folder_id IS NOT ?`,
    );
    for (const id of unique) count += update.run(folderId ?? null, Date.now(), id, folderId ?? null).changes;
    return count;
  })();
}
function atomic(operation: () => unknown) {
  return getSqlite().transaction(() => {
    const before = readRevision();
    operation();
    const changes = invalidationSince({ epoch: before.epoch, since: before.seq });
    return {
      revision: { epoch: changes.epoch, seq: changes.seq },
      invalidatedFamilies: changes.families,
    };
  })();
}
export const folderQueries: NonNullable<Resolvers<GraphQLContext>["Query"]> = {
  folderBrowser: (_root, args, context) => {
    const value = readFolderBrowser(args);
    if (context.metrics) context.metrics.rows += value.folders.length;
    return value;
  },
  folderSearch: (_root, args, context) => {
    const value = searchFolders(args);
    if (context.metrics) context.metrics.rows += value.results.nodes.length;
    return value;
  },
};
export const folderMutations: NonNullable<Resolvers<GraphQLContext>["Mutation"]> = {
  createFolder: (_root, args) =>
    atomic(() => {
      const kind = dbKind(args.kind),
        name = folderName(args.name);
      target(kind, args.parentId);
      const id = randomUUID();
      getSqlite()
        .prepare("INSERT INTO folders(id,kind,name,parent_id,created_at) VALUES(?,?,?,?,?)")
        .run(id, kind, name, args.parentId ?? null, Date.now());
      return { folderId: id };
    }),
  renameFolder: (_root, args) =>
    atomic(() => {
      row(args.id);
      getSqlite()
        .prepare("UPDATE folders SET name=?,updated_at=? WHERE id=?")
        .run(folderName(args.name), Date.now(), args.id);
      return { folderId: args.id };
    }),
  moveFolder: (_root, args) =>
    atomic(() => {
      const folder = row(args.id);
      target(folder.kind, args.parentId);
      if (args.parentId && subtree(args.id).includes(args.parentId))
        bad("Folder cannot be moved into itself or its descendants");
      getSqlite()
        .prepare("UPDATE folders SET parent_id=?,updated_at=? WHERE id=?")
        .run(args.parentId ?? null, Date.now(), args.id);
      return { folderId: args.id };
    }),
  moveFolderItems: (_root, args) =>
    atomic(() => ({
      folderId: args.folderId ?? undefined,
      movedCount: moveItems(args.kind, args.ids, args.folderId),
    })),
  deleteFolder: async (_root, args) =>
    withImageMutation(async () => {
      const keys: string[] = [];
      const result = atomic(() => {
        const folder = row(args.id),
          sqlite = getSqlite(),
          table = tableFor(folder.kind);
        let movedCount = 0;
        if (args.mode === "MOVE_UP") {
          movedCount += sqlite
            .prepare(`UPDATE ${table} SET folder_id=?,updated_at=? WHERE folder_id=?`)
            .run(folder.parentId, Date.now(), folder.id).changes;
          sqlite
            .prepare("UPDATE folders SET parent_id=?,updated_at=? WHERE parent_id=?")
            .run(folder.parentId, Date.now(), folder.id);
        } else {
          // Delete leaves first rather than asking one FK cascade to traverse an
          // arbitrarily deep authored tree (SQLite limits recursive trigger depth).
          const descendants = sqlite
            .prepare(
              `WITH RECURSIVE tree(id,depth) AS (
            SELECT id,0 FROM folders WHERE id=? UNION ALL
            SELECT f.id,t.depth+1 FROM folders f JOIN tree t ON f.parent_id=t.id
          ) SELECT id FROM tree ORDER BY depth DESC,id`,
            )
            .pluck()
            .all(folder.id) as string[];
          for (const id of descendants) {
            keys.push(
              ...(sqlite
                .prepare(`SELECT image_key FROM ${table} WHERE folder_id=? AND image_key IS NOT NULL`)
                .pluck()
                .all(id) as string[]),
            );
            sqlite.prepare("DELETE FROM folders WHERE id=?").run(id);
          }
        }
        sqlite.prepare("DELETE FROM folders WHERE id=?").run(folder.id);
        return { deletedId: folder.id, movedCount };
      });
      await deleteImages(keys);
      return result;
    }),
};
