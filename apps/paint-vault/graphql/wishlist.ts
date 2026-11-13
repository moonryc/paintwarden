import { createHash } from "node:crypto";

import { searchFuzzyIndex } from "@paint-vault/core/fuzzy-search";
import { isPaintOwned } from "@paint-vault/core/paint-state";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";

import { validatePage, validateText, type PaintRead } from "./library.ts";
import { paginateProjection, readMiniatureProjection } from "./miniatures.ts";

type Page = { first: number; after?: string | null };
type Project = { id: string; title: string };
type ModelOption = Project & { projectCount: number };
type Row = {
  id: string;
  paint: PaintRead;
  brandGroup: string;
  restock: boolean;
  missingStock: boolean;
  brokenSubstitution: boolean;
  projectCount: number;
  relatedProjectsPreview: Project[];
  relatedProjectsTruncated: boolean;
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const normalized = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("base64url");
const physical = (p: PaintRead) =>
  isPaintOwned(p.inventory?.state ?? null, p.inventory?.stockLevel ?? null, p.inventory?.quantity ?? 0);
const shopping = (p: PaintRead) =>
  p.inventory?.state === "WISHLIST" || (p.inventory?.state === "OWNED" && !physical(p));
const byNeed = (a: Row, b: Row) =>
  b.projectCount - a.projectCount ||
  compare(normalized(a.paint.name), normalized(b.paint.name)) ||
  compare(a.id, b.id);
const byShopping = (a: Row, b: Row) =>
  compare(normalized(a.brandGroup), normalized(b.brandGroup)) || byNeed(a, b);

type Aggregate = ReturnType<typeof build>;
let cached: Aggregate | undefined;
let builds = 0,
  searchRanks = 0;
export function clearWishlistProjectionCache() {
  cached = undefined;
  builds = 0;
  searchRanks = 0;
}
export function wishlistProjectionDiagnostics() {
  return { builds, searchRanks, resultSets: cached?.resultSets.size ?? 0 };
}
function build(base: ReturnType<typeof readMiniatureProjection>) {
  // Reuse the same per-root, deduplicated resolved leaves and issue flags as miniature
  // readiness. This includes wishlist miniatures and attached scheme targets; no N+1 reads.
  const projects = new Map<string, Project[]>();
  const issues = new Map<string, { missingStock: boolean; brokenSubstitution: boolean }>();
  for (const mini of base.miniatures) {
    for (const leaf of base.required.get(mini.id) ?? []) {
      const list = projects.get(leaf.id) ?? [];
      list.push({ id: mini.id, title: mini.title });
      projects.set(leaf.id, list);
    }
    for (const issue of base.missing.get(mini.id) ?? []) {
      const previous = issues.get(issue.id);
      issues.set(issue.id, {
        missingStock: Boolean(previous?.missingStock || issue.missingStock),
        brokenSubstitution: Boolean(previous?.brokenSubstitution || issue.brokenSubstitution),
      });
    }
  }
  const shoppingRows: Row[] = [],
    missingRows: Row[] = [];
  const modelCounts = new Map<string, number>();
  for (const p of base.paint.paints) {
    const related = projects.get(p.id) ?? [];
    const listed = shopping(p),
      issue = issues.get(p.id);
    if (!listed && !issue) continue;
    const row: Row = {
      id: p.id,
      paint: p,
      brandGroup: p.isCustom ? "Custom" : p.brand,
      restock: Boolean(
        p.inventory && (p.inventory.state === "OWNED" || p.inventory.stockLevel === "EMPTY") && !physical(p),
      ),
      missingStock: issue?.missingStock ?? !physical(p),
      brokenSubstitution: issue?.brokenSubstitution ?? p.brokenSubstitution,
      projectCount: related.length,
      relatedProjectsPreview: related.slice(0, 3),
      relatedProjectsTruncated: related.length > 3,
    };
    if (listed) {
      shoppingRows.push(row);
      for (const mini of related) modelCounts.set(mini.id, (modelCounts.get(mini.id) ?? 0) + 1);
    } else missingRows.push(row);
  }
  shoppingRows.sort(byShopping);
  // The global attention panel remains most-needed first, unlike shelf-grouped shopping.
  missingRows.sort(byNeed);
  builds++;
  return {
    revision: base.revision,
    base,
    projects,
    shoppingRows,
    missingRows,
    models: base.miniatures.map((m) => ({
      id: m.id,
      title: m.title,
      projectCount: modelCounts.get(m.id) ?? 0,
    })),
    counts: {
      shoppingPaints: shoppingRows.length,
      restockPaints: shoppingRows.filter((r) => r.restock).length,
      projectCount: modelCounts.size,
      missingPaints: missingRows.length,
      missingStock: missingRows.filter((r) => r.missingStock).length,
      brokenSubstitution: missingRows.filter((r) => r.brokenSubstitution).length,
      listedMissingStock: shoppingRows.filter((r) => r.projectCount > 0 && r.missingStock).length,
    },
    resultSets: new Map<string, { items: ModelOption[]; accessed: number }>(),
  };
}
function aggregate(allowCache: boolean): Aggregate {
  const base = readMiniatureProjection(allowCache);
  if (
    allowCache &&
    cached?.revision.epoch === base.revision.epoch &&
    cached.revision.seq === base.revision.seq
  )
    return cached;
  const result = build(base);
  if (allowCache) cached = result;
  return result;
}
function read<T>(operation: (s: Aggregate) => T): T {
  // Never publish a transaction-local generation: rollback can reuse its sequence.
  const allowCache = !getSqlite().inTransaction;
  return getSqlite().transaction(() => operation(aggregate(allowCache)))();
}
function validateMiniature(id: string | null | undefined) {
  validateText(id, "miniatureId");
}
function selected(s: Aggregate, miniatureId?: string | null) {
  return miniatureId
    ? s.shoppingRows.filter((r) => s.projects.get(r.id)?.some((m) => m.id === miniatureId))
    : s.shoppingRows;
}
export function readWishlist(
  args: Page & { miniatureId?: string | null; missingFirst?: number; missingAfter?: string | null },
) {
  validatePage(args);
  validatePage({ first: args.missingFirst ?? 48, after: args.missingAfter });
  validateMiniature(args.miniatureId);
  return read((s) => ({
    revision: s.revision,
    counts: s.counts,
    shopping: paginateProjection(
      selected(s, args.miniatureId),
      args,
      s.revision,
      `wishlist:shopping:${fingerprint(args.miniatureId || null)}`,
    ),
    // Model filtering applies only to shopping, never global project attention.
    missing: paginateProjection(
      s.missingRows,
      { first: args.missingFirst ?? 48, after: args.missingAfter },
      s.revision,
      "wishlist:missing",
    ),
  }));
}
export function readWishlistModelOptions(args: Page & { search?: string | null }) {
  validatePage(args);
  validateText(args.search, "search", 128);
  return read((s) => {
    const search = args.search?.trim() ?? "",
      key = fingerprint(search),
      scope = `wishlist:models:${key}`;
    // Validate the cursor's scope/generation before considering result-set expiry.
    if (args.after != null) paginateProjection(s.models, args, s.revision, scope);
    const now = Date.now();
    for (const [k, set] of s.resultSets) if (now - set.accessed > 60_000) s.resultSets.delete(k);
    let set = s.resultSets.get(key);
    if (!set) {
      if (search && args.after != null)
        throw new GraphQLError("Search expired; restart pagination", {
          extensions: { code: "STALE_CURSOR" },
        });
      const byId = new Map(s.models.map((m) => [m.id, m]));
      const items = search ? searchFuzzyIndex(s.base.search, search).map((m) => byId.get(m.id)!) : s.models;
      if (search) searchRanks++;
      if (s.resultSets.size >= 100) s.resultSets.delete(s.resultSets.keys().next().value!);
      set = { items, accessed: now };
      s.resultSets.set(key, set);
    }
    set.accessed = now;
    return { revision: s.revision, ...paginateProjection(set.items, args, s.revision, scope) };
  });
}
export function readWishlistRelatedProjects(args: Page & { paintId: string }) {
  validatePage(args);
  validateText(args.paintId, "paintId");
  return read((s) => ({
    revision: s.revision,
    ...paginateProjection(
      s.projects.get(args.paintId) ?? [],
      args,
      s.revision,
      `wishlist:projects:${fingerprint(args.paintId)}`,
    ),
  }));
}
export function readWishlistExport(args: { miniatureId?: string | null }) {
  validateMiniature(args.miniatureId);
  return read((s) => {
    const rows = selected(s, args.miniatureId);
    const mini = args.miniatureId ? s.base.byId.get(args.miniatureId) : null;
    const lines = [mini ? `Paint shopping list for ${mini.title}` : "Paint shopping list"];
    let brand: string | undefined;
    for (const row of rows) {
      if (row.brandGroup !== brand) {
        brand = row.brandGroup;
        lines.push(`\n${brand}`);
      }
      lines.push(`• ${row.paint.name} (${row.paint.range})`);
    }
    return { revision: s.revision, text: lines.join("\n"), totalCount: rows.length };
  });
}
