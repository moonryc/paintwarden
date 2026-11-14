import { createHash } from "node:crypto";

import { COLOR_CATEGORIES, COLOR_CATEGORY_LABELS, isColorCategory } from "@paintwarden/core/color-categories";
import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { GraphQLError } from "graphql";

import { getSqlite } from "../db/index.ts";
import { createScheme, updateScheme, deleteScheme, SchemeCommandError } from "../lib/commands/schemes.ts";
import { withImageMutation } from "../lib/image-mutations.ts";

import { invalidationSince } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import type { Resolvers } from "./generated/resolvers.ts";
import { readPaintProjection, readRevision, validatePage, validateText } from "./library.ts";
import {
  readSchemeProjection,
  paginateSchemeItems,
  type MiniatureSchemeSummary,
} from "./miniature-schemes.ts";

type SchemesArgs = {
  first: number;
  after?: string | null;
  search?: string | null;
  category?: string | null;
  sourceId?: string | null;
  noSource?: boolean;
  readiness?: "READY" | "MISSING" | null;
  usesPaintIds?: string[];
};
const categoryLabel = (value: string | null) =>
  isColorCategory(value) ? COLOR_CATEGORY_LABELS[value] : (value ?? "");
const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
function compareSchemes(a: MiniatureSchemeSummary, b: MiniatureSchemeSummary) {
  if (!a.category && b.category) return 1;
  if (a.category && !b.category) return -1;
  return (
    compareText(categoryLabel(a.category), categoryLabel(b.category)) ||
    compareText(a.name, b.name) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
const ready = (scheme: MiniatureSchemeSummary) =>
  scheme.paintCount > 0 && scheme.availableCount === scheme.paintCount;

export function readSchemes(args: SchemesArgs) {
  validatePage(args);
  for (const key of ["search", "category", "sourceId"] as const) validateText(args[key], key);
  args.usesPaintIds?.forEach((id) => validateText(id, "uses paint ID"));
  if (args.readiness != null && args.readiness !== "READY" && args.readiness !== "MISSING")
    throw new GraphQLError("Invalid scheme readiness", { extensions: { code: "BAD_USER_INPUT" } });
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const revision = readRevision(),
      projection = readSchemeProjection(revision, allowCache);
    const query = args.search?.trim() ?? "",
      category = args.category === "ALL" ? null : (args.category ?? null);
    const paintIds = [...new Set(args.usesPaintIds ?? [])].sort();
    // Uses-paints means AND over original authored targets, never resolved substitution leaves.
    const candidates = projection.nodes.filter(
      (node) =>
        (category === null || (node.category ?? "") === category) &&
        (!args.sourceId || node.sourceId === args.sourceId) &&
        (!args.noSource || !node.sourceId) &&
        paintIds.every((id) => projection.targetIds.get(node.id)?.has(id)),
    );
    let nodes = candidates.filter((node) => !args.readiness || ready(node) === (args.readiness === "READY"));
    // Fuzzy ranking decides membership on the filtered population; display order is canonical.
    if (query)
      nodes = searchFuzzyIndex(
        createFuzzyIndex(nodes, (node) => `${node.name} ${categoryLabel(node.category)}`),
        query,
      );
    nodes = [...nodes].sort(compareSchemes);
    const scope = createHash("sha256")
      .update(
        JSON.stringify([
          "schemes",
          query,
          category,
          args.sourceId ?? null,
          Boolean(args.noSource),
          args.readiness ?? null,
          paintIds,
        ]),
      )
      .digest("base64url");
    const categoryCounts = new Map<string, number>(),
      sourceCounts = new Map<string, { label: string; count: number }>();
    sourceCounts.set("", { label: "Not from a plugin", count: 0 });
    for (const node of projection.nodes) {
      const key = node.category ?? "";
      categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
      const sourceKey = node.sourceId ?? "";
      const source = sourceCounts.get(sourceKey) ?? {
        label: node.sourceName ?? "Not from a plugin",
        count: 0,
      };
      source.count++;
      sourceCounts.set(sourceKey, source);
    }
    const readyCount = candidates.filter(ready).length;
    return {
      revision,
      ...paginateSchemeItems(nodes, args, revision, scope),
      facets: {
        categories: [
          ...COLOR_CATEGORIES.map((key) => ({
            key,
            label: COLOR_CATEGORY_LABELS[key],
            count: categoryCounts.get(key) ?? 0,
          })),
          ...(categoryCounts.has("")
            ? [{ key: "", label: "Uncategorized", count: categoryCounts.get("")! }]
            : []),
        ],
        sources: [...sourceCounts]
          .map(([key, value]) => ({ key, ...value }))
          .sort((a, b) => compareText(a.label, b.label) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
        readiness: [
          { key: "ALL", label: "All", count: candidates.length },
          { key: "READY", label: "Ready to paint", count: readyCount },
          { key: "MISSING", label: "Missing paints", count: candidates.length - readyCount },
        ],
      },
    };
  })();
}

export function readSchemePaintOptions(args: { first: number; search: string; excludeIds: string[] }) {
  validatePage(args, 30);
  validateText(args.search, "search");
  args.excludeIds.forEach((id) => validateText(id, "exclude ID"));
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const paints = readPaintProjection(allowCache),
      projection = readSchemeProjection(paints.revision, allowCache);
    const used = new Set([...projection.targetIds.values()].flatMap((ids) => [...ids])),
      excluded = new Set(args.excludeIds);
    const candidates = paints.paints.filter((paint) => used.has(paint.id) && !excluded.has(paint.id));
    return {
      revision: paints.revision,
      items: searchFuzzyIndex(
        createFuzzyIndex(candidates, (paint) => `${paint.brand} ${paint.range} ${paint.name}`),
        args.search.trim(),
        args.first,
      ),
    };
  })();
}

function atomic(operation: () => string, clientMutationId?: string | null) {
  return getSqlite().transaction(() => {
    const before = readRevision(),
      schemeId = operation();
    const changes = invalidationSince({ epoch: before.epoch, since: before.seq });
    return {
      schemeId,
      revision: { epoch: changes.epoch, seq: changes.seq },
      clientMutationId,
      invalidatedFamilies: changes.families,
    };
  })();
}
function mapError(error: unknown): never {
  if (error instanceof SchemeCommandError)
    throw new GraphQLError(error.message, {
      extensions: {
        code: error.status === 404 ? "NOT_FOUND" : error.status === 403 ? "FORBIDDEN" : "BAD_USER_INPUT",
      },
    });
  throw error;
}
// Keep REST's image mutation serialization. Commands themselves are synchronous shared SQL,
// so the revision and trigger-derived invalidations are captured in the same transaction.
export const schemeMutations: NonNullable<Resolvers<GraphQLContext>["Mutation"]> = {
  createScheme: async (_root, args) => {
    try {
      return await withImageMutation(async () =>
        atomic(() => createScheme(args.input).id, args.clientMutationId),
      );
    } catch (error) {
      return mapError(error);
    }
  },
  updateScheme: async (_root, args) => {
    try {
      return await withImageMutation(async () =>
        atomic(() => {
          updateScheme(args.id, args.input);
          return args.id;
        }, args.clientMutationId),
      );
    } catch (error) {
      return mapError(error);
    }
  },
  deleteScheme: async (_root, args) => {
    try {
      return await withImageMutation(async () =>
        atomic(() => {
          deleteScheme(args.id);
          return args.id;
        }, args.clientMutationId),
      );
    } catch (error) {
      return mapError(error);
    }
  },
};
