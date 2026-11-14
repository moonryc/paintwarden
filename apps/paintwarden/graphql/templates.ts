import { createHash } from "node:crypto";

import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { imageThumbnailUrl } from "@paintwarden/core/image-thumbnails";
import { isUserId } from "@paintwarden/core/vault-ids";
import { GraphQLError } from "graphql";

import { getDb, getSqlite } from "../db/index.ts";
import { sourceLogoUrl } from "../lib/catalog-source-assets.ts";
import { withImageMutation } from "../lib/image-mutations.ts";
import { deleteImage } from "../lib/image-store.ts";
import {
  createTemplate,
  deleteTemplate,
  TemplateCommandError,
  updateTemplate,
  withPreparedTemplateImage,
  type TemplateInput,
} from "../lib/template-commands.ts";
import { templateRecipeCounts } from "../lib/template-recipes.ts";

import { invalidationSince } from "./changes.ts";
import type { GraphQLContext } from "./context.ts";
import { readRevision, validatePage, validateText } from "./library.ts";
import { paginateProjection } from "./miniatures.ts";

type Revision = ReturnType<typeof readRevision>;
type Page = { first: number; after?: string | null };
export type TemplateListArgs = Page & {
  id?: string | null;
  search?: string | null;
  category?: string | null;
  sourceId?: string | null;
  noSource?: boolean | null;
};
export type TemplateSummary = {
  id: string;
  name: string;
  manufacturer: string;
  faction: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  categories: string[];
  kind: "user" | "source";
  sourceId: string | null;
  sourceName: string | null;
  sourceLogoUrl: string | null;
  schemeCount: number;
  paintCount: number;
};
type SummaryRow = Pick<
  TemplateSummary,
  "id" | "name" | "manufacturer" | "faction" | "sourceId" | "sourceName"
> & {
  imageKey: string | null;
  imageUrl: string | null;
  categories: string;
  logoSvg: string | null;
};
type Facet = { key: string; label: string; count: number };
type Projection = {
  revision: Revision;
  nodes: TemplateSummary[];
  categoryCounts: Facet[];
  sourceCounts: Facet[];
  searches: Map<string, { at: number; nodes: TemplateSummary[] }>;
};
let cached: Projection | undefined;
let builds = 0,
  searchRanks = 0;
export function clearTemplateProjectionCache() {
  cached = undefined;
  builds = 0;
  searchRanks = 0;
}
export function templateProjectionDiagnostics() {
  return { builds, searchRanks, resultSets: cached?.searches.size ?? 0 };
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const searchText = (s: TemplateSummary) =>
  `${s.name} ${s.manufacturer} ${s.faction} ${s.categories.join(" ")} ${s.sourceName ?? ""}`;
function projection(revision: Revision, allowCache: boolean): Projection {
  if (allowCache && cached?.revision.epoch === revision.epoch && cached.revision.seq === revision.seq)
    return cached;
  // Only template metadata and SQL GROUP BY counts: no recipe rows, notes, Paint/State
  // projection, source manifests or scheme entries are materialized on the list path.
  const rows = getSqlite()
    .prepare(
      `SELECT t.id,t.name,t.manufacturer,t.faction,t.categories,
    t.image_key AS imageKey,t.image_url AS imageUrl,c.id AS sourceId,c.name AS sourceName,c.logo_svg AS logoSvg
    FROM miniature_templates t LEFT JOIN catalog_sources c ON c.id=(
      SELECT i.source_id FROM catalog_source_items i WHERE i.kind='template' AND i.item_id=t.id
      ORDER BY i.source_id DESC LIMIT 1)`,
    )
    .all() as SummaryRow[];
  const counts = templateRecipeCounts(getDb());
  const nodes: TemplateSummary[] = rows
    .map((r): TemplateSummary => ({
      id: r.id,
      name: r.name,
      manufacturer: r.manufacturer,
      faction: r.faction,
      categories: isUserId(r.id) ? ["My templates"] : (JSON.parse(r.categories) as string[]),
      imageUrl: r.imageKey
        ? `/api/miniature-templates/${encodeURIComponent(r.id)}/image?v=${encodeURIComponent(r.imageKey)}`
        : r.imageUrl || "",
      thumbnailUrl: r.imageKey
        ? imageThumbnailUrl(
            `/api/miniature-templates/${encodeURIComponent(r.id)}/image?v=${encodeURIComponent(r.imageKey)}`,
          )
        : r.imageUrl
          ? imageThumbnailUrl(r.imageUrl)
          : null,
      kind: isUserId(r.id) ? "user" : "source",
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      sourceLogoUrl: r.sourceId ? sourceLogoUrl(r.sourceId, r.logoSvg) : null,
      ...(counts.get(r.id) ?? { schemeCount: 0, paintCount: 0 }),
    }))
    .sort(
      (a, b) =>
        compare(a.name.normalize("NFKD").toLowerCase(), b.name.normalize("NFKD").toLowerCase()) ||
        compare(a.id, b.id),
    );
  const categories = new Map<string, number>([["My templates", 0]]),
    sources = new Map<string, Facet>();
  for (const node of nodes) {
    for (const category of new Set(node.categories))
      categories.set(category, (categories.get(category) ?? 0) + 1);
    const key = node.sourceId ?? "";
    const facet = sources.get(key) ?? { key, label: node.sourceName ?? "No source", count: 0 };
    facet.count++;
    sources.set(key, facet);
  }
  const value = {
    revision,
    nodes,
    categoryCounts: [...categories]
      .sort(([a], [b]) => compare(a, b))
      .map(([key, count]) => ({ key, label: key, count })),
    sourceCounts: [...sources.values()].sort((a, b) => compare(a.label, b.label) || compare(a.key, b.key)),
    searches: new Map<string, { at: number; nodes: TemplateSummary[] }>(),
  };
  builds++;
  if (allowCache) cached = value;
  return value;
}
export function readTemplates(args: TemplateListArgs) {
  validatePage(args);
  validateText(args.id, "id");
  validateText(args.search, "search", 128);
  validateText(args.category, "category");
  validateText(args.sourceId, "sourceId");
  const sqlite = getSqlite(),
    allowCache = !sqlite.inTransaction;
  return sqlite.transaction(() => {
    const revision = readRevision(),
      p = projection(revision, allowCache);
    const query = args.search?.trim() ?? "",
      category = args.category === "ALL" ? null : (args.category ?? null);
    const scope =
      "templates:" +
      createHash("sha256")
        .update(JSON.stringify([query, category, args.sourceId ?? null, !!args.noSource, args.id ?? null]))
        .digest("base64url");
    // Validate stale/filter-mismatched cursors before fuzzy ranking/cache lookup.
    if (args.after != null) paginateProjection(p.nodes, { first: 1, after: args.after }, revision, scope);
    let nodes = p.nodes.filter(
      (s) =>
        (!args.id || s.id === args.id) &&
        (category === null || s.categories.includes(category)) &&
        (!args.sourceId || s.sourceId === args.sourceId) &&
        (!args.noSource || s.sourceId === null),
    );
    if (query) {
      const now = Date.now();
      for (const [key, value] of p.searches) if (now - value.at >= 60_000) p.searches.delete(key);
      const found = p.searches.get(scope);
      if (found) {
        nodes = found.nodes;
        found.at = now;
      } else {
        if (args.after != null)
          throw new GraphQLError("Search expired; restart pagination", {
            extensions: { code: "STALE_CURSOR" },
          });
        // Filter before fuzzy matching: excluded exact matches must not suppress eligible typos.
        nodes = searchFuzzyIndex(createFuzzyIndex(nodes, searchText), query);
        searchRanks++;
        if (p.searches.size >= 100) p.searches.delete(p.searches.keys().next().value!);
        p.searches.set(scope, { at: now, nodes });
      }
    }
    return {
      revision,
      categoryCounts: p.categoryCounts,
      sourceCounts: p.sourceCounts,
      templates: paginateProjection(nodes, args, revision, scope),
    };
  })();
}
export type TemplateRecipeRead = { revision: Revision; templateId: string };
export function readTemplateRecipe(id: string): TemplateRecipeRead {
  validateText(id, "id");
  return getSqlite().transaction(() => {
    if (!getSqlite().prepare("SELECT id FROM miniature_templates WHERE id=?").get(id))
      throw new GraphQLError("Template not found", { extensions: { code: "NOT_FOUND" } });
    return { revision: readRevision(), templateId: id };
  })();
}
function recipePage<T extends { id: string }>(
  v: TemplateRecipeRead,
  args: Page,
  kind: string,
  load: () => T[],
) {
  validatePage(args);
  return getSqlite().transaction(() => {
    const revision = readRevision();
    if (revision.epoch !== v.revision.epoch || revision.seq !== v.revision.seq)
      throw new GraphQLError("Template changed; restart pagination", {
        extensions: { code: "STALE_CURSOR" },
      });
    return paginateProjection(load(), args, revision, `template-${kind}:${v.templateId}`);
  })();
}
export function templatePaints(v: TemplateRecipeRead, args: Page) {
  return recipePage(v, args, "paints", () =>
    (
      getSqlite()
        .prepare(
          `SELECT t.paint_id AS paintId,t.step,t.notes,t.sort_order AS sortOrder,
    COALESCE(p.name,t.paint_id) AS paintName,COALESCE(p.brand,'') AS paintBrand
    FROM miniature_template_paints t LEFT JOIN paint_catalog p ON p.id=t.paint_id
    WHERE t.template_id=? ORDER BY t.sort_order,t.step,t.paint_id`,
        )
        .all(v.templateId) as {
        paintId: string;
        step: string;
        notes: string;
        sortOrder: number;
        paintName: string;
        paintBrand: string;
      }[]
    ).map((r) => ({ ...r, id: JSON.stringify([r.step, r.paintId]) })),
  );
}
export function templateSchemes(v: TemplateRecipeRead, args: Page) {
  return recipePage(v, args, "schemes", () =>
    (
      getSqlite()
        .prepare(
          `SELECT t.scheme_id AS schemeId,COALESCE(s.name,t.scheme_id) AS name
    FROM miniature_template_schemes t LEFT JOIN color_schemes s ON s.id=t.scheme_id
    WHERE t.template_id=? ORDER BY t.sort_order,t.scheme_id`,
        )
        .all(v.templateId) as { schemeId: string; name: string }[]
    ).map((r) => ({ ...r, id: r.schemeId })),
  );
}
function atomic(id: () => string, clientMutationId?: string | null) {
  return getSqlite().transaction(() => {
    const before = readRevision(),
      templateId = id();
    const changes = invalidationSince({ epoch: before.epoch, since: before.seq });
    return {
      templateId,
      clientMutationId,
      revision: { epoch: changes.epoch, seq: changes.seq },
      invalidatedFamilies: changes.families,
    };
  })();
}
function mapError(error: unknown): never {
  if (error instanceof TemplateCommandError)
    throw new GraphQLError(error.message, {
      extensions: {
        code: error.status === 404 ? "NOT_FOUND" : error.status === 403 ? "FORBIDDEN" : "BAD_USER_INPUT",
      },
    });
  throw error;
}
export const templateQueries = {
  templates: (_root: unknown, args: TemplateListArgs, context: GraphQLContext) => {
    const result = readTemplates(args);
    if (context.metrics) context.metrics.rows += result.templates.nodes.length;
    return result;
  },
  templateRecipe: (_root: unknown, args: { id: string }) => readTemplateRecipe(args.id),
};
export const templateViewResolvers = { paints: templatePaints, schemes: templateSchemes };
export const templateMutations = {
  createTemplate: async (
    _root: unknown,
    args: { input: TemplateInput; clientMutationId?: string | null },
  ) => {
    try {
      return await withImageMutation(() =>
        withPreparedTemplateImage(args.input, (key) =>
          atomic(() => createTemplate(args.input, key).id, args.clientMutationId),
        ),
      );
    } catch (error) {
      return mapError(error);
    }
  },
  updateTemplate: (
    _root: unknown,
    args: { id: string; input: TemplateInput; clientMutationId?: string | null },
  ) => {
    try {
      return atomic(() => {
        updateTemplate(args.id, args.input);
        return args.id;
      }, args.clientMutationId);
    } catch (error) {
      return mapError(error);
    }
  },
  deleteTemplate: async (_root: unknown, args: { id: string; clientMutationId?: string | null }) => {
    try {
      return await withImageMutation(async () => {
        let key: string | null = null;
        const result = atomic(() => {
          key = deleteTemplate(args.id).imageKey;
          return args.id;
        }, args.clientMutationId);
        await deleteImage(key);
        return result;
      });
    } catch (error) {
      return mapError(error);
    }
  },
};
