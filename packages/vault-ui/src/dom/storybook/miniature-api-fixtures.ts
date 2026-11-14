// Complete-State fixture projections shared by whole-app and isolated Apollo stories only.
import { createFuzzyIndex, searchFuzzyIndex } from "@paintwarden/core/fuzzy-search";
import { imageThumbnailUrl } from "@paintwarden/core/image-thumbnails";
import { isPaintAvailable } from "@paintwarden/core/paint-substitutions";

import type { Paint, PaintingStatus, State } from "../types";
import { schemeCardSummary, sortedSchemes } from "../utils/semantic-contract";
import { projectPaintIssues, resolvedPaintIds, wishlistPaintIds } from "../utils/vault-data";

import { fixtureMiniatureView } from "./miniature-fixtures";

type Revision = { epoch: string; seq: string };
const facets = (counts: Record<string, number>) =>
  Object.entries(counts).map(([key, count]) => ({ __typename: "FacetCount", key, label: key, count }));
const page = <T>(nodes: T[], first: number, after: unknown, typename: string) => {
  const start = Number(after ?? 0),
    end = Math.min(start + first, nodes.length);
  return {
    __typename: typename,
    nodes: nodes.slice(start, end),
    totalCount: nodes.length,
    pageInfo: { __typename: "PageInfo", hasNextPage: end < nodes.length, endCursor: String(end) },
  };
};

export function fixtureMiniatureResponse(
  data: State,
  operation: string | undefined,
  vars: Record<string, unknown>,
  revision: Revision,
  projectPaint: (paint: Paint) => unknown = (paint) => paint,
): Record<string, unknown> | null {
  if (operation === "VaultNavigation")
    return {
      vaultNavigation: {
        __typename: "NavigationView",
        revision,
        availablePaints: data.catalog.filter((paint) => isPaintAvailable(data, data.paintRecords, paint.id))
          .length,
        shoppingPaints: wishlistPaintIds(data).size,
      },
    };
  if (operation === "MiniatureList") {
    const view = fixtureMiniatureView(data, {
      workbench: Boolean(vars.workbench),
      ownership: (vars.ownership ?? "ALL") as "ALL" | "OWNED" | "WISHLIST",
      stage: (vars.stage ?? "ALL") as PaintingStatus | "ALL",
      search: typeof vars.search === "string" ? vars.search : "",
    });
    const connection = page(
      view.rows.map(({ mini, swatches, total, missing }) => ({
        __typename: "Miniature",
        ...mini,
        folderId: null,
        thumbnailUrl: mini.imageUrl ? imageThumbnailUrl(mini.imageUrl) : null,
        readiness: { __typename: "Readiness", total, missing },
        previewSwatches: swatches
          .filter((color) => color.colorHex)
          .slice(0, 8)
          .map((color) => ({ __typename: "MiniatureSwatch", ...color })),
      })),
      Number(vars.first ?? 48),
      vars.after,
      "MiniatureConnection",
    );
    return vars.workbench
      ? {
          home: {
            __typename: "HomeView",
            revision,
            counts: {
              __typename: "HomeCounts",
              catalogCount: view.catalogCount,
              owned: view.owned,
              ready: view.ready,
              distinctMissingPaints: view.missingProjectPaints,
              wishlistedMissingPaints: view.wishlistedMissingPaints,
              stages: facets(view.stageCounts),
            },
            miniatures: connection,
          },
        }
      : {
          miniatures: {
            __typename: "MiniaturesView",
            revision,
            ownershipCounts: facets(view.statusCounts),
            stageCounts: facets(view.stageCounts),
            miniatures: connection,
          },
        };
  }
  const schemeSummary = (scheme: State["colorSchemes"][number]) => {
    const paints = data.colorSchemePaints
      .filter((row) => row.schemeId === scheme.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((row) => data.catalog.find((paint) => paint.id === row.paintId) ?? []);
    const colors = paints
      .filter((paint) => paint.colorHex)
      .map((paint) => ({ __typename: "MiniatureSwatch", paintId: paint.id, colorHex: paint.colorHex }));
    const images = data.colorSchemeImages
      .filter((row) => row.schemeId === scheme.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const previewUrl = images.at(-1)?.thumbnailUrl || images.at(-1)?.imageUrl;
    return {
      __typename: "MiniatureScheme",
      ...scheme,
      sourceName: scheme.sourceName ?? null,
      sourceLogoUrl: scheme.sourceLogoUrl ?? null,
      paintCount: paints.length,
      availableCount: paints.filter((paint) => isPaintAvailable(data, data.paintRecords, paint.id)).length,
      previewSwatches: colors.slice(0, 8),
      previewSwatchesTruncated: colors.length > 8,
      imageUrl: previewUrl ?? null,
      thumbnailUrl: previewUrl ? imageThumbnailUrl(previewUrl) : null,
    };
  };
  if (operation === "SchemeUsedPaintOptions") {
    const used = new Set(data.colorSchemePaints.map((row) => row.paintId));
    const excluded = new Set((vars.excludeIds as string[]) ?? []);
    const candidates = data.catalog.filter((paint) => used.has(paint.id) && !excluded.has(paint.id));
    return {
      schemePaintOptions: {
        revision,
        items: searchFuzzyIndex(
          createFuzzyIndex(candidates, (paint) => `${paint.brand} ${paint.range} ${paint.name}`),
          typeof vars.search === "string" ? vars.search : "",
          30,
        ).map(projectPaint),
      },
    };
  }
  if (operation === "SchemesPage") {
    const all = sortedSchemes(data.colorSchemes).map((scheme) => {
      const card = schemeCardSummary(data, scheme.id);
      return {
        ...schemeSummary(scheme),
        sourceId: null,
        gradient: card.gradient ?? "",
        paintNames: card.paintNames,
        usageCount: card.uses,
        previewMoreCount: 0,
      };
    });
    const ids = (vars.usesPaintIds as string[]) ?? [];
    const candidates = all.filter(
      (scheme) =>
        (!vars.category || scheme.category === vars.category) &&
        ids.every((id) =>
          data.colorSchemePaints.some((row) => row.schemeId === scheme.id && row.paintId === id),
        ),
    );
    const matches = new Set(
      searchFuzzyIndex(
        createFuzzyIndex(candidates, (scheme) => scheme.name),
        typeof vars.search === "string" ? vars.search : "",
      ).map((scheme) => scheme.id),
    );
    const nodes = candidates.filter(
      (scheme) =>
        matches.has(scheme.id) &&
        (!vars.readiness ||
          (vars.readiness === "READY") ===
            (scheme.paintCount > 0 && scheme.availableCount === scheme.paintCount)),
    );
    const categories = Object.fromEntries(
      all.map((scheme) => [
        scheme.category ?? "",
        all.filter((row) => row.category === scheme.category).length,
      ]),
    );
    return {
      schemes: {
        revision,
        ...page(nodes, 48, vars.after, "SchemesView"),
        facets: {
          categories: facets(categories),
          sources: [{ key: "", label: "Not from a plugin", count: all.length }],
          readiness: [
            {
              key: "READY",
              label: "Ready to paint",
              count: candidates.filter(
                (scheme) => scheme.paintCount > 0 && scheme.availableCount === scheme.paintCount,
              ).length,
            },
            {
              key: "MISSING",
              label: "Missing paints",
              count: candidates.filter(
                (scheme) => !scheme.paintCount || scheme.availableCount !== scheme.paintCount,
              ).length,
            },
          ],
        },
      },
    };
  }
  if (operation === "ProjectMiniatureDetails") {
    const id = String(vars.id),
      miniature = data.miniatures.find((mini) => mini.id === id) ?? null;
    const issues = projectPaintIssues(data, id);
    const required = resolvedPaintIds(data, id).flatMap(
      (paintId) => data.catalog.find((paint) => paint.id === paintId) ?? [],
    );
    const recipe = data.requirements
      .filter((row) => row.miniatureId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((row) => {
        const paint = data.catalog.find((paint) => paint.id === row.paintId);
        return paint ? [{ __typename: "MiniatureRecipeEntry", ...row, paint: projectPaint(paint) }] : [];
      });
    const schemes = data.miniatureColorSchemes
      .filter((row) => row.miniatureId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((row) => {
        const scheme = data.colorSchemes.find((scheme) => scheme.id === row.schemeId);
        return scheme
          ? [
              {
                __typename: "MiniatureSchemeLink",
                id: row.schemeId,
                sortOrder: row.sortOrder,
                scheme: schemeSummary(scheme),
              },
            ]
          : [];
      });
    return {
      miniature: {
        __typename: "MiniatureView",
        revision,
        miniature: miniature && { __typename: "Miniature", ...miniature },
        recipeSteps: [
          ...new Set([
            ...data.recipeSteps.filter((row) => row.miniatureId === id).map((row) => row.step),
            ...recipe.map((row) => row.step),
          ]),
        ],
        recipe: page(recipe, 40, vars.recipeAfter, "MiniatureRecipeConnection"),
        schemes: page(schemes, 40, vars.schemesAfter, "MiniatureSchemeConnection"),
        required: page(required.map(projectPaint), 40, vars.requiredAfter, "MiniatureRequiredConnection"),
        missing: page(
          required
            .filter((paint) => issues.has(paint.id))
            .map((paint) => ({
              __typename: "MiniatureMissingPaint",
              id: paint.id,
              paint: projectPaint(paint),
              missingStock: issues.get(paint.id)?.has("missingStock") ?? false,
              brokenSubstitution: issues.get(paint.id)?.has("brokenSubstitution") ?? false,
            })),
          40,
          vars.missingAfter,
          "MiniatureMissingConnection",
        ),
      },
    };
  }
  if (operation === "MiniatureSchemeDetails") {
    const scheme = data.colorSchemes.find((scheme) => scheme.id === vars.id);
    const base = {
      paint: null,
      label: null,
      tone: null,
      role: null,
      imageUrl: null,
      thumbnailUrl: null,
      imageType: null,
      method: null,
    };
    const entries = scheme
      ? [
          ...data.colorSchemePaints
            .filter((row) => row.schemeId === scheme.id)
            .flatMap((row) => {
              const paint = data.catalog.find((paint) => paint.id === row.paintId);
              return paint
                ? [
                    {
                      __typename: "MiniatureSchemeEntry",
                      ...base,
                      id: row.paintId,
                      sortOrder: row.sortOrder,
                      kind: "PAINT",
                      paint: projectPaint(paint),
                    },
                  ]
                : [];
            }),
          ...data.colorSchemeDividers
            .filter((row) => row.schemeId === scheme.id)
            .map((row) => ({ __typename: "MiniatureSchemeEntry", ...base, ...row, kind: "DIVIDER" })),
          ...data.colorSchemeImages
            .filter((row) => row.schemeId === scheme.id)
            .map((row) => ({ __typename: "MiniatureSchemeEntry", ...base, ...row, kind: "IMAGE" })),
        ].sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    return {
      miniatureScheme: {
        __typename: "MiniatureSchemeView",
        revision,
        scheme: scheme ? schemeSummary(scheme) : null,
        entries: page(entries, 40, vars.after, "MiniatureSchemeEntryConnection"),
      },
    };
  }
  if (operation === "SchemePickerOptions") {
    const exclude = new Set((vars.excludeIds ?? []) as string[]);
    const candidates = data.colorSchemes.filter(
      (scheme) => !exclude.has(scheme.id) && (!vars.category || scheme.category === vars.category),
    );
    const matches = vars.search
      ? searchFuzzyIndex(
          createFuzzyIndex(candidates, (scheme) => scheme.name),
          typeof vars.search === "string" ? vars.search : "",
        )
      : candidates;
    const counts: Record<string, number> = {};
    for (const scheme of data.colorSchemes)
      counts[scheme.category ?? ""] = (counts[scheme.category ?? ""] ?? 0) + 1;
    return {
      schemeOptions: {
        ...page(matches.map(schemeSummary), 40, vars.after, "MiniatureSchemeOptionsView"),
        revision,
        categoryCounts: facets(counts),
      },
    };
  }
  return null;
}
